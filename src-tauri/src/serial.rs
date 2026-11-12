//! Native serial (COM / tty) bridge for ESP32 Display Studio.
//!
//! Frontend talks through Tauri commands; RX bytes are pushed as `serial-data` events.

use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
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
pub struct SerialDataPayload {
    pub path: String,
    pub chunk: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SerialDisconnectedPayload {
    pub path: String,
    pub reason: String,
}

struct OpenPortHandle {
    path: String,
    writer: Arc<Mutex<Box<dyn serialport::SerialPort>>>,
    stop: Arc<AtomicBool>,
    reader_thread: Option<thread::JoinHandle<()>>,
}

pub struct SerialManager {
    active: Mutex<Option<OpenPortHandle>>,
}

impl Default for SerialManager {
    fn default() -> Self {
        Self {
            active: Mutex::new(None),
        }
    }
}

impl SerialManager {
    fn close_locked(active: &mut Option<OpenPortHandle>) {
        if let Some(mut handle) = active.take() {
            handle.stop.store(true, Ordering::SeqCst);
            if let Ok(mut port) = handle.writer.lock() {
                let _ = port.flush();
            }
            if let Some(join) = handle.reader_thread.take() {
                let _ = join.join();
            }
        }
    }
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

#[tauri::command]
pub fn list_serial_ports() -> Result<Vec<SerialPortDto>, String> {
    let ports = serialport::available_ports().map_err(|e| format!("Nie udało się listować portów: {e}"))?;
    let mut dtos: Vec<SerialPortDto> = ports.iter().map(to_dto).collect();
    dtos.sort_by(|a, b| {
        b.likely_esp32
            .cmp(&a.likely_esp32)
            .then_with(|| a.path.cmp(&b.path))
    });
    Ok(dtos)
}

#[tauri::command]
pub fn open_serial_port(
    app: AppHandle,
    state: State<'_, SerialManager>,
    path: String,
    baud_rate: u32,
) -> Result<SerialPortDto, String> {
    let baud = if baud_rate == 0 { 115_200 } else { baud_rate };

    {
        let mut active = state
            .active
            .lock()
            .map_err(|_| "SerialManager lock poisoned".to_string())?;
        SerialManager::close_locked(&mut active);
    }

    let port = serialport::new(&path, baud)
        .timeout(Duration::from_millis(200))
        .open()
        .map_err(|e| format!("Nie otwarto portu {path} @ {baud}: {e}"))?;

    let mut reader = port
        .try_clone()
        .map_err(|e| format!("Nie sklonowano portu do odczytu: {e}"))?;
    let writer = Arc::new(Mutex::new(port));
    let stop = Arc::new(AtomicBool::new(false));
    let stop_flag = Arc::clone(&stop);
    let path_for_thread = path.clone();
    let app_handle = app.clone();

    let reader_thread = thread::spawn(move || {
        let mut buf = [0u8; 1024];
        while !stop_flag.load(Ordering::SeqCst) {
            match reader.read(&mut buf) {
                Ok(0) => thread::sleep(Duration::from_millis(20)),
                Ok(n) => {
                    let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                    if !chunk.is_empty() {
                        let _ = app_handle.emit(
                            SERIAL_DATA_EVENT,
                            SerialDataPayload {
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
                            path: path_for_thread.clone(),
                            reason: e.to_string(),
                        },
                    );
                    break;
                }
            }
        }
    });

    let dto = list_serial_ports()?
        .into_iter()
        .find(|p| p.path == path)
        .unwrap_or(SerialPortDto {
            id: path.clone(),
            label: path.clone(),
            path: path.clone(),
            usb_vendor_id: None,
            usb_product_id: None,
            manufacturer: None,
            product: None,
            likely_esp32: is_likely_esp32(None, &path),
        });

    let mut active = state
        .active
        .lock()
        .map_err(|_| "SerialManager lock poisoned".to_string())?;
    *active = Some(OpenPortHandle {
        path,
        writer,
        stop,
        reader_thread: Some(reader_thread),
    });

    Ok(dto)
}

#[tauri::command]
pub fn write_serial_port(state: State<'_, SerialManager>, data: String) -> Result<(), String> {
    let active = state
        .active
        .lock()
        .map_err(|_| "SerialManager lock poisoned".to_string())?;
    let handle = active
        .as_ref()
        .ok_or_else(|| "Brak otwartego portu szeregowego".to_string())?;
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

#[tauri::command]
pub fn close_serial_port(state: State<'_, SerialManager>) -> Result<(), String> {
    let mut active = state
        .active
        .lock()
        .map_err(|_| "SerialManager lock poisoned".to_string())?;
    SerialManager::close_locked(&mut active);
    Ok(())
}
