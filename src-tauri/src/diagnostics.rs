//! Opt-in local diagnostics log for flash/COM (no cloud telemetry).

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager, State};

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
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    writeln!(file, "[{secs}] [{category}] {line}").map_err(|e| e.to_string())?;
    Ok(())
}
