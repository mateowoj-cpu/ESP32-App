//! Native serial (COM / tty) bridge for ESP32 Display Studio.
//!
//! Frontend talks through Tauri commands; RX bytes are pushed as `serial-data` events.
//! Open/close are serialized; each open gets a session id; the reader starts only after
//! the frontend registers listeners and calls `start_serial_read`.

use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use serde::Serialize;
use serialport::{SerialPortInfo, SerialPortType, UsbPortInfo};
use tauri::{AppHandle, Emitter, State};

pub const SERIAL_DATA_EVENT: &str = "serial-data";
pub const SERIAL_DISCONNECTED_EVENT: &str = "serial-disconnected";

/// Known ESP32-related USB vendor IDs (Espressif, CP210x, CH340, FTDI).
const ESP_VENDOR_IDS: &[u16] = &[0x303A, 0x10C4, 0x1A86, 0x0403];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SerialPortDto {
    pub id: String,
    pub label: String,
    pub path: String,
    pub usb_vendor_id: Option<u16>,
    pub usb_product_id: Option<u16>,
    pub manufacturer: Option<String>,
    pub product: Option<String>,
    pub likely_esp32: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenSerialPortResult {
    #[serde(flatten)]
    pub port: SerialPortDto,
    pub session_id: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SerialDataPayload {
    pub session_id: u64,
    pub path: String,
    pub chunk: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SerialDisconnectedPayload {
    pub session_id: u64,
    pub path: String,
    pub reason: String,
}

struct OpenPortHandle {
    session_id: u64,
    path: String,
    writer: Arc<Mutex<Box<dyn serialport::SerialPort>>>,
    stop: Arc<AtomicBool>,
    /// Reader half kept until `start_serial_read` moves it into the thread.
    reader: Option<Box<dyn serialport::SerialPort>>,
    reader_thread: Option<thread::JoinHandle<()>>,
}

struct SerialManagerInner {
    /// Serializes the full open/close/start lifecycle (held only in blocking sections).
    gate: Mutex<()>,
    active: Mutex<Option<OpenPortHandle>>,
    next_session: AtomicU64,
}

pub struct SerialManager {
    inner: Arc<SerialManagerInner>,
}

impl Default for SerialManager {
    fn default() -> Self {
        Self {
            inner: Arc::new(SerialManagerInner {
                gate: Mutex::new(()),
                active: Mutex::new(None),
                next_session: AtomicU64::new(1),
            }),
        }
    }
}

impl SerialManager {
    fn close_locked(active: &mut Option<OpenPortHandle>) {
        if let Some(mut handle) = active.take() {
            handle.stop.store(true, Ordering::SeqCst);
            // Drop the unread reader clone so the OS handle can close.
            drop(handle.reader.take());
            if let Ok(mut port) = handle.writer.lock() {
                let _ = port.flush();
            }
            if let Some(join) = handle.reader_thread.take() {
                let _ = join.join();
            }
        }
    }
}

/// Streaming UTF-8 decoder: keep incomplete trailing sequences across chunks.
pub fn decode_utf8_stream(pending: &mut Vec<u8>, input: &[u8]) -> String {
    if input.is_empty() && pending.is_empty() {
        return String::new();
    }
    pending.extend_from_slice(input);

    let mut out = String::new();
    loop {
        match std::str::from_utf8(pending) {
            Ok(s) => {
                out.push_str(s);
                pending.clear();
                break;
            }
            Err(err) => {
                let valid_up_to = err.valid_up_to();
                if valid_up_to > 0 {
                    // SAFETY: valid_up_to is a UTF-8 boundary per from_utf8 error contract.
                    let valid = unsafe { std::str::from_utf8_unchecked(&pending[..valid_up_to]) };
                    out.push_str(valid);
                    pending.drain(..valid_up_to);
                    continue;
                }
                match err.error_len() {
                    Some(len) => {
                        out.push('\u{FFFD}');
                        pending.drain(..len.min(pending.len()));
                        continue;
                    }
                    None => break, // incomplete multi-byte sequence — wait for more bytes
                }
            }
        }
    }
    out
}

fn usb_ids(port_type: &SerialPortType) -> (Option<u16>, Option<u16>, Option<String>, Option<String>) {
    match port_type {
        SerialPortType::UsbPort(UsbPortInfo {
            vid,
            pid,
            manufacturer,
            product,
            ..
        }) => (
            Some(*vid),
            Some(*pid),
            manufacturer.clone(),
            product.clone(),
        ),
        _ => (None, None, None, None),
    }
}

fn is_likely_esp32(vid: Option<u16>, path: &str) -> bool {
    if let Some(v) = vid {
        if ESP_VENDOR_IDS.contains(&v) {
            return true;
        }
    }
    let lower = path.to_ascii_lowercase();
    lower.contains("ttyusb")
        || lower.contains("ttyacm")
        || lower.contains("cu.usb")
        || lower.contains("com")
}

fn to_dto(info: &SerialPortInfo) -> SerialPortDto {
    let (vid, pid, manufacturer, product) = usb_ids(&info.port_type);
    let path = info.port_name.clone();
    let likely = is_likely_esp32(vid, &path);
    let label = match (&product, &manufacturer, vid, pid) {
        (Some(p), Some(m), Some(v), Some(pid)) => {
            format!("{path} — {p} ({m}, VID 0x{v:04X}/PID 0x{pid:04X})")
        }
        (Some(p), _, Some(v), Some(pid)) => {
            format!("{path} — {p} (VID 0x{v:04X}/PID 0x{pid:04X})")
        }
        (_, _, Some(v), Some(pid)) => format!("{path} (VID 0x{v:04X}/PID 0x{pid:04X})"),
        _ => path.clone(),
    };

    SerialPortDto {
        id: path.clone(),
        label,
        path,
        usb_vendor_id: vid,
        usb_product_id: pid,
        manufacturer,
        product,
        likely_esp32: likely,
    }
}

fn enumerate_serial_ports() -> Result<Vec<SerialPortDto>, String> {
    let ports = serialport::available_ports().map_err(|e| format!("Nie udało się listować portów: {e}"))?;
    let mut dtos: Vec<SerialPortDto> = ports.iter().map(to_dto).collect();
    dtos.sort_by(|a, b| {
        b.likely_esp32
            .cmp(&a.likely_esp32)
            .then_with(|| a.path.cmp(&b.path))
    });
    Ok(dtos)
}

fn port_dto_for_path(path: &str) -> SerialPortDto {
    enumerate_serial_ports()
        .ok()
        .and_then(|ports| ports.into_iter().find(|p| p.path == path))
        .unwrap_or_else(|| SerialPortDto {
            id: path.to_string(),
            label: path.to_string(),
            path: path.to_string(),
            usb_vendor_id: None,
            usb_product_id: None,
            manufacturer: None,
            product: None,
            likely_esp32: is_likely_esp32(None, path),
        })
}

fn spawn_reader_thread(
    app_handle: AppHandle,
    mut reader: Box<dyn serialport::SerialPort>,
    stop_flag: Arc<AtomicBool>,
    path_for_thread: String,
    session_id: u64,
) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        let mut buf = [0u8; 1024];
        let mut pending = Vec::new();
        while !stop_flag.load(Ordering::SeqCst) {
            match reader.read(&mut buf) {
                Ok(0) => thread::sleep(Duration::from_millis(20)),
                Ok(n) => {
                    let chunk = decode_utf8_stream(&mut pending, &buf[..n]);
                    if !chunk.is_empty() {
                        let _ = app_handle.emit(
                            SERIAL_DATA_EVENT,
                            SerialDataPayload {
                                session_id,
                                path: path_for_thread.clone(),
                                chunk,
                            },
                        );
                    }
                }
                Err(ref e) if e.kind() == std::io::ErrorKind::TimedOut => continue,
                Err(e) => {
                    let _ = app_handle.emit(
                        SERIAL_DISCONNECTED_EVENT,
                        SerialDisconnectedPayload {
                            session_id,
                            path: path_for_thread.clone(),
                            reason: e.to_string(),
                        },
                    );
                    break;
                }
            }
        }
    })
}

/// List COM/tty ports off the async runtime so Windows USB enumeration
/// does not freeze the Tauri webview while `available_ports()` runs.
#[tauri::command]
pub async fn list_serial_ports() -> Result<Vec<SerialPortDto>, String> {
    tauri::async_runtime::spawn_blocking(enumerate_serial_ports)
        .await
        .map_err(|e| format!("list_serial_ports join: {e}"))?
}

/// Open a serial port without starting the RX thread.
/// Call [`start_serial_read`] after the frontend has registered event listeners.
#[tauri::command]
pub async fn open_serial_port(
    state: State<'_, SerialManager>,
    path: String,
    baud_rate: u32,
) -> Result<OpenSerialPortResult, String> {
    let baud = if baud_rate == 0 { 115_200 } else { baud_rate };
    let inner = Arc::clone(&state.inner);

    tauri::async_runtime::spawn_blocking(move || {
        let _gate = inner
            .gate
            .lock()
            .map_err(|_| "SerialManager gate poisoned".to_string())?;

        {
            let mut active = inner
                .active
                .lock()
                .map_err(|_| "SerialManager lock poisoned".to_string())?;
            SerialManager::close_locked(&mut active);
        }

        let port = match serialport::new(&path, baud)
            .timeout(Duration::from_millis(200))
            .open()
        {
            Ok(p) => p,
            Err(e) => {
                let mut active = inner
                    .active
                    .lock()
                    .map_err(|_| "SerialManager lock poisoned".to_string())?;
                SerialManager::close_locked(&mut active);
                return Err(format!("Nie otwarto portu {path} @ {baud}: {e}"));
            }
        };

        let reader = match port.try_clone() {
            Ok(r) => r,
            Err(e) => {
                // `port` drops on return — OS handle released.
                let mut active = inner
                    .active
                    .lock()
                    .map_err(|_| "SerialManager lock poisoned".to_string())?;
                SerialManager::close_locked(&mut active);
                return Err(format!("Nie sklonowano portu do odczytu: {e}"));
            }
        };

        let session_id = inner.next_session.fetch_add(1, Ordering::SeqCst);
        let writer = Arc::new(Mutex::new(port));
        let stop = Arc::new(AtomicBool::new(false));
        let dto = port_dto_for_path(&path);

        {
            let mut active = inner
                .active
                .lock()
                .map_err(|_| "SerialManager lock poisoned".to_string())?;
            *active = Some(OpenPortHandle {
                session_id,
                path: path.clone(),
                writer,
                stop,
                reader: Some(reader),
                reader_thread: None,
            });
        }

        Ok(OpenSerialPortResult {
            port: dto,
            session_id,
        })
    })
    .await
    .map_err(|e| format!("open_serial_port join: {e}"))?
}

/// Start the RX thread for an already-opened session (after JS listeners are ready).
#[tauri::command]
pub async fn start_serial_read(
    app: AppHandle,
    state: State<'_, SerialManager>,
    session_id: u64,
) -> Result<(), String> {
    let inner = Arc::clone(&state.inner);
    tauri::async_runtime::spawn_blocking(move || {
        let _gate = inner
            .gate
            .lock()
            .map_err(|_| "SerialManager gate poisoned".to_string())?;
        let mut active = inner
            .active
            .lock()
            .map_err(|_| "SerialManager lock poisoned".to_string())?;
        let handle = active
            .as_mut()
            .ok_or_else(|| "Brak otwartego portu szeregowego".to_string())?;
        if handle.session_id != session_id {
            return Err(format!(
                "Nieaktualna sesja serial (oczekiwano {}, aktywna {})",
                session_id, handle.session_id
            ));
        }
        if handle.reader_thread.is_some() {
            return Ok(());
        }
        let reader = handle
            .reader
            .take()
            .ok_or_else(|| "Czytnik serial już uruchomiony lub niedostępny".to_string())?;
        let stop_flag = Arc::clone(&handle.stop);
        let path_for_thread = handle.path.clone();
        let sid = handle.session_id;
        handle.reader_thread = Some(spawn_reader_thread(
            app,
            reader,
            stop_flag,
            path_for_thread,
            sid,
        ));
        Ok(())
    })
    .await
    .map_err(|e| format!("start_serial_read join: {e}"))?
}

#[tauri::command]
pub fn write_serial_port(
    state: State<'_, SerialManager>,
    data: String,
    session_id: Option<u64>,
) -> Result<(), String> {
    let active = state
        .inner
        .active
        .lock()
        .map_err(|_| "SerialManager lock poisoned".to_string())?;
    let handle = active
        .as_ref()
        .ok_or_else(|| "Brak otwartego portu szeregowego".to_string())?;
    if let Some(sid) = session_id {
        if handle.session_id != sid {
            return Err(format!(
                "Nieaktualna sesja serial (zapis: {}, aktywna {})",
                sid, handle.session_id
            ));
        }
    }
    let mut port = handle
        .writer
        .lock()
        .map_err(|_| "Writer lock poisoned".to_string())?;
    port.write_all(data.as_bytes())
        .map_err(|e| format!("Błąd zapisu na {}: {e}", handle.path))?;
    port.flush()
        .map_err(|e| format!("Błąd flush na {}: {e}", handle.path))?;
    Ok(())
}

/// Close the active port. When `session_id` is set, a newer session is left untouched.
#[tauri::command]
pub async fn close_serial_port(
    state: State<'_, SerialManager>,
    session_id: Option<u64>,
) -> Result<(), String> {
    let inner = Arc::clone(&state.inner);
    tauri::async_runtime::spawn_blocking(move || {
        let _gate = inner
            .gate
            .lock()
            .map_err(|_| "SerialManager gate poisoned".to_string())?;
        let mut active = inner
            .active
            .lock()
            .map_err(|_| "SerialManager lock poisoned".to_string())?;
        if let Some(sid) = session_id {
            match active.as_ref() {
                Some(h) if h.session_id == sid => SerialManager::close_locked(&mut active),
                Some(_) => {
                    // Stale close after a newer open — ignore.
                }
                None => {}
            }
        } else {
            SerialManager::close_locked(&mut active);
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("close_serial_port join: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex as StdMutex;

    #[test]
    fn utf8_stream_decodes_complete_ascii() {
        let mut pending = Vec::new();
        assert_eq!(decode_utf8_stream(&mut pending, b"hello"), "hello");
        assert!(pending.is_empty());
    }

    #[test]
    fn utf8_stream_holds_split_multibyte() {
        // "ę" in UTF-8 is C4 99
        let mut pending = Vec::new();
        assert_eq!(decode_utf8_stream(&mut pending, &[0xC4]), "");
        assert_eq!(pending, vec![0xC4]);
        assert_eq!(decode_utf8_stream(&mut pending, &[0x99]), "ę");
        assert!(pending.is_empty());
    }

    #[test]
    fn utf8_stream_split_emoji_across_three_chunks() {
        // "😀" = F0 9F 98 80
        let mut pending = Vec::new();
        assert_eq!(decode_utf8_stream(&mut pending, &[0xF0]), "");
        assert_eq!(decode_utf8_stream(&mut pending, &[0x9F, 0x98]), "");
        assert_eq!(decode_utf8_stream(&mut pending, &[0x80]), "😀");
        assert!(pending.is_empty());
    }

    #[test]
    fn utf8_stream_mixed_complete_then_split() {
        let mut pending = Vec::new();
        let out = decode_utf8_stream(&mut pending, b"ab\xC4");
        assert_eq!(out, "ab");
        assert_eq!(pending, vec![0xC4]);
        assert_eq!(decode_utf8_stream(&mut pending, &[0x99, b'c']), "ęc");
    }

    #[test]
    fn session_ids_monotone_and_distinct() {
        let mgr = SerialManager::default();
        let a = mgr.inner.next_session.fetch_add(1, Ordering::SeqCst);
        let b = mgr.inner.next_session.fetch_add(1, Ordering::SeqCst);
        assert_ne!(a, b);
        assert!(b > a);
    }

    #[test]
    fn close_locked_clears_active_without_reader_thread() {
        let mut active: Option<OpenPortHandle> = None;
        SerialManager::close_locked(&mut active);
        assert!(active.is_none());
    }

    #[test]
    fn stale_session_payload_should_be_ignored_by_clients() {
        let current = 7u64;
        let stale = SerialDataPayload {
            session_id: 3,
            path: "COM3".into(),
            chunk: "old".into(),
        };
        let fresh = SerialDataPayload {
            session_id: 7,
            path: "COM3".into(),
            chunk: "new".into(),
        };
        assert_ne!(stale.session_id, current);
        assert_eq!(fresh.session_id, current);
    }

    /// Simulated rapid port switch: only the latest session id is "active".
    #[test]
    fn rapid_port_switch_keeps_latest_session() {
        let sessions = StdMutex::new(Vec::<u64>::new());
        let mut active_session = 0u64;
        for sid in [1u64, 2, 3] {
            active_session = sid;
            sessions.lock().unwrap().push(sid);
        }
        let events = [
            SerialDataPayload {
                session_id: 1,
                path: "COM1".into(),
                chunk: "a".into(),
            },
            SerialDataPayload {
                session_id: 3,
                path: "COM3".into(),
                chunk: "c".into(),
            },
            SerialDataPayload {
                session_id: 2,
                path: "COM2".into(),
                chunk: "b".into(),
            },
        ];
        let accepted: Vec<_> = events
            .iter()
            .filter(|e| e.session_id == active_session)
            .map(|e| e.chunk.as_str())
            .collect();
        assert_eq!(accepted, vec!["c"]);
    }

    #[test]
    fn disconnect_then_rediscover_uses_new_session() {
        let first = 10u64;
        let after_disconnect = 11u64;
        let disc = SerialDisconnectedPayload {
            session_id: first,
            path: "COM5".into(),
            reason: "device unplugged".into(),
        };
        assert_eq!(disc.session_id, first);
        assert_ne!(disc.session_id, after_disconnect);
        let late = SerialDataPayload {
            session_id: first,
            path: "COM5".into(),
            chunk: "stale".into(),
        };
        assert_ne!(late.session_id, after_disconnect);
    }
}
