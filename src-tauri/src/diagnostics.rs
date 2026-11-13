//! Opt-in local diagnostics log for flash/COM (no cloud telemetry).
//! Faza 12: export a support ZIP (log + manifest) — still local-only.

use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Manager, State};
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

pub struct DiagnosticsState {
    pub enabled: AtomicBool,
}

impl Default for DiagnosticsState {
    fn default() -> Self {
        Self {
            enabled: AtomicBool::new(false),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DiagnosticsManifest {
    exported_at_unix: u64,
    app_name: String,
    os: String,
    arch: String,
    diagnostics_enabled: bool,
    log_present: bool,
    log_bytes: u64,
    note: String,
}

fn logs_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("diagnostics");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn log_file(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(logs_dir(app)?.join("studio.log"))
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn add_file_to_zip(zip: &mut ZipWriter<File>, name: &str, path: &Path) -> Result<(), String> {
    let mut f = File::open(path).map_err(|e| e.to_string())?;
    let mut buf = Vec::new();
    f.read_to_end(&mut buf).map_err(|e| e.to_string())?;
    zip.start_file(name, SimpleFileOptions::default())
        .map_err(|e| e.to_string())?;
    zip.write_all(&buf).map_err(|e| e.to_string())?;
    Ok(())
}

fn add_bytes_to_zip(zip: &mut ZipWriter<File>, name: &str, bytes: &[u8]) -> Result<(), String> {
    zip.start_file(name, SimpleFileOptions::default())
        .map_err(|e| e.to_string())?;
    zip.write_all(bytes).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn set_diagnostics_enabled(state: State<'_, DiagnosticsState>, enabled: bool) {
    state.enabled.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
pub fn get_diagnostics_log_path(app: AppHandle) -> Result<String, String> {
    Ok(log_file(&app)?.display().to_string())
}

#[tauri::command]
pub fn open_diagnostics_folder(app: AppHandle) -> Result<(), String> {
    let dir = logs_dir(&app)?;
    #[cfg(windows)]
    {
        Command::new("explorer")
            .arg(dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(dir)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let _ = Command::new("xdg-open").arg(&dir).spawn();
    }
    Ok(())
}

#[tauri::command]
pub fn append_diagnostics_log(
    app: AppHandle,
    state: State<'_, DiagnosticsState>,
    category: String,
    line: String,
) -> Result<(), String> {
    if !state.enabled.load(Ordering::Relaxed) {
        return Ok(());
    }
    let path = log_file(&app)?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
    let secs = now_secs();
    writeln!(file, "[{secs}] [{category}] {line}").map_err(|e| e.to_string())?;
    Ok(())
}

/// Pack local diagnostics into a ZIP for support (opt-in log; no cloud upload).
/// If `dest_path` is empty/None, writes next to the log under `diagnostics/`.
#[tauri::command]
pub fn export_diagnostics_zip(
    app: AppHandle,
    state: State<'_, DiagnosticsState>,
    dest_path: Option<String>,
) -> Result<String, String> {
    let dir = logs_dir(&app)?;
    let log_path = log_file(&app)?;
    let log_present = log_path.is_file();
    let log_bytes = if log_present {
        fs::metadata(&log_path).map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };

    let dest = match dest_path.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(p) => PathBuf::from(p),
        None => dir.join(format!("esp32-studio-diagnostics-{}.zip", now_secs())),
    };

    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let file = File::create(&dest).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(file);

    let manifest = DiagnosticsManifest {
        exported_at_unix: now_secs(),
        app_name: "ESP32 Display Studio".into(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        diagnostics_enabled: state.enabled.load(Ordering::Relaxed),
        log_present,
        log_bytes,
        note: "Local diagnostics only — not uploaded by Studio. Attach to a support issue if needed."
            .into(),
    };
    let manifest_json =
        serde_json::to_vec_pretty(&manifest).map_err(|e| e.to_string())?;
    add_bytes_to_zip(&mut zip, "manifest.json", &manifest_json)?;

    if log_present {
        add_file_to_zip(&mut zip, "studio.log", &log_path)?;
    } else {
        add_bytes_to_zip(
            &mut zip,
            "studio.log",
            b"(no studio.log yet - enable diagnostics and run Build/Flash/OTA once)\n",
        )?;
    }

    // Include any extra *.log / *.txt already in the diagnostics folder (future-proof).
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            if name == "studio.log" || name.ends_with(".zip") {
                continue;
            }
            if name.ends_with(".log") || name.ends_with(".txt") || name.ends_with(".json") {
                let _ = add_file_to_zip(&mut zip, &format!("extra/{name}"), &path);
            }
        }
    }

    zip.finish().map_err(|e| e.to_string())?;
    Ok(dest.display().to_string())
}
