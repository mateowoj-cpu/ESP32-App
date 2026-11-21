//! Thin wrapper around system `esptool` for flashing ESP32 firmware (.bin).

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use std::thread;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EsptoolInfo {
    pub available: bool,
    pub command: Option<Vec<String>>,
    /// Display path — same string Settings shows for the esptool probe.
    pub path: Option<String>,
    /// `override` | `env` | `sidecar` | `path` | `none`
    pub source: String,
    pub version: Option<String>,
    pub hint: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlashResult {
    pub ok: bool,
    pub exit_code: Option<i32>,
    pub message: String,
}

use crate::process_util::hide_console;
use crate::toolchain::{self, ResolvedCommand};

/// Shared resolve: override → env → sidecar → PATH (same as Settings).
fn resolve_esptool_command(app: &AppHandle) -> Option<ResolvedCommand> {
    toolchain::resolve_esptool(app)
}

#[tauri::command]
pub fn get_esptool_info(app: AppHandle) -> EsptoolInfo {
    match resolve_esptool_command(&app) {
        Some(hit) => {
            let version = toolchain::esptool_version(&hit.argv);
            let path = hit.display_path();
            EsptoolInfo {
                available: true,
                version: version.clone(),
                command: Some(hit.argv.clone()),
                path: Some(path),
                source: hit.source.into(),
                hint: format!(
                    "esptool gotowy{} [{}]",
                    version
                        .map(|v| format!(" ({v})"))
                        .unwrap_or_default(),
                    hit.source
                ),
            }
        }
        None => EsptoolInfo {
            available: false,
            command: None,
            path: None,
            source: toolchain::SRC_NONE.into(),
            version: None,
            hint: "Brak esptool. Zainstaluj: pip install esptool (albo `pip install esptool` w PATH)."
                .into(),
        },
    }
}

fn emit_log(app: &AppHandle, line: impl Into<String>) {
    let _ = app.emit("flash-log", line.into());
}

fn validate_firmware_path(path: &str) -> Result<PathBuf, String> {
    let p = PathBuf::from(path);
    if !p.is_file() {
        return Err(format!("Plik firmware nie istnieje: {path}"));
    }
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !matches!(ext.as_str(), "bin" | "elf") {
        return Err("Flash helper obsługuje pliki .bin / .elf (zbuduj firmware w Arduino/PlatformIO).".into());
    }
    Ok(p)
}

fn normalize_port(port: &str) -> String {
    port.trim().to_string()
}

#[tauri::command]
pub fn flash_write_firmware(
    app: AppHandle,
    port: String,
    baud: u32,
    chip: String,
    firmware_path: String,
    flash_offset: Option<String>,
) -> Result<FlashResult, String> {
    let hit = resolve_esptool_command(&app).ok_or_else(|| {
        "Nie znaleziono esptool. Zainstaluj: pip install esptool".to_string()
    })?;
    let firmware = validate_firmware_path(&firmware_path)?;
    let port = normalize_port(&port);
    if port.is_empty() {
        return Err("Podaj port COM / serial (np. COM3).".into());
    }
    let baud = if baud == 0 { 460800 } else { baud };
    let chip = if chip.trim().is_empty() {
        "auto".to_string()
    } else {
        chip.trim().to_string()
    };
    let offset = flash_offset
        .unwrap_or_else(|| "0x1000".into())
        .trim()
        .to_string();

    let (bin, prefix) = hit
        .argv
        .split_first()
        .ok_or_else(|| "Pusta komenda esptool".to_string())?;

    let mut args: Vec<String> = prefix.iter().cloned().collect();
    args.extend([
        "--chip".into(),
        chip.clone(),
        "--port".into(),
        port.clone(),
        "--baud".into(),
        baud.to_string(),
        "write_flash".into(),
        "-z".into(),
        offset.clone(),
        firmware.display().to_string(),
    ]);

    emit_log(
        &app,
        format!(
            "$ {} {}  (chip={chip}, port={port}, baud={baud}, offset={offset}, source={})",
            bin,
            args.join(" "),
            hit.source
        ),
    );

    let mut flash_cmd = Command::new(bin);
    flash_cmd
        .args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    hide_console(&mut flash_cmd);
    let mut child = flash_cmd
        .spawn()
        .map_err(|e| format!("Nie uruchomiono esptool: {e}"))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let app_out = app.clone();
    let app_err = app.clone();

    let t_out = thread::spawn(move || {
        if let Some(out) = stdout {
            let reader = BufReader::new(out);
            for line in reader.lines().flatten() {
                emit_log(&app_out, line);
            }
        }
    });
    let t_err = thread::spawn(move || {
        if let Some(err) = stderr {
            let reader = BufReader::new(err);
            for line in reader.lines().flatten() {
                emit_log(&app_err, line);
            }
        }
    });

    let status = child
        .wait()
        .map_err(|e| format!("esptool wait failed: {e}"))?;
    let _ = t_out.join();
    let _ = t_err.join();

    let code = status.code();
    if status.success() {
        emit_log(&app, "Flash zakończony sukcesem.".to_string());
        Ok(FlashResult {
            ok: true,
            exit_code: code,
            message: "Firmware wgrany.".into(),
        })
    } else {
        let message = format!(
            "esptool zakończył się kodem {:?}. Sprawdź port COM, sterownik i tryb boot (BOOT+RESET).",
            code
        );
        emit_log(&app, message.clone());
        Ok(FlashResult {
            ok: false,
            exit_code: code,
            message,
        })
    }
}

#[tauri::command]
pub fn read_open_file(path: String) -> Result<OpenFilePayload, String> {
    let p = PathBuf::from(path.trim());
    if !p.is_file() {
        return Err(format!("Plik nie istnieje: {}", p.display()));
    }
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let kind = match ext.as_str() {
        "esp32studio" | "json" => "project",
        "ino" => "sketch",
        "bin" | "elf" => "firmware",
        _ => "unknown",
    };
    // Limit size for project/sketch text (~2 MiB)
    let meta = std::fs::metadata(&p).map_err(|e| e.to_string())?;
    if meta.len() > 2 * 1024 * 1024 && kind != "firmware" {
        return Err("Plik jest zbyt duży (>2 MiB).".into());
    }

    let content = if kind == "firmware" {
        None
    } else {
        Some(std::fs::read_to_string(&p).map_err(|e| e.to_string())?)
    };

    Ok(OpenFilePayload {
        path: p.display().to_string(),
        kind: kind.into(),
        content,
        file_name: p
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("file")
            .to_string(),
    })
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenFilePayload {
    pub path: String,
    pub kind: String,
    pub file_name: String,
    pub content: Option<String>,
}

pub fn classify_cli_arg(arg: &str) -> bool {
    let p = Path::new(arg);
    if !p.exists() {
        // deep link URLs
        return arg.starts_with("esp32studio://") || arg.starts_with("esp32studio:");
    }
    matches!(
        p.extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_ascii_lowercase()
            .as_str(),
        "esp32studio" | "json" | "ino" | "bin" | "elf"
    )
}
