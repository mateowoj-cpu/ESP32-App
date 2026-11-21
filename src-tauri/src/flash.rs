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

use crate::process_util::{hide_console, which};

fn python_bins() -> Vec<&'static str> {
    if cfg!(windows) {
        vec!["py", "python", "python3"]
    } else {
        vec!["python3", "python"]
    }
}

/// Resolve how to invoke esptool: override → direct binary → `python -m esptool`.
fn resolve_esptool_command(app: &AppHandle) -> Option<Vec<String>> {
    if let Some(path) = crate::tools::override_esptool(app) {
        return Some(vec![path.display().to_string()]);
    }
    if let Some(path) = which("esptool") {
        return Some(vec![path.display().to_string()]);
    }
    if let Some(path) = which("esptool.py") {
        return Some(vec![path.display().to_string()]);
    }

    for py in python_bins() {
        let Some(py_path) = which(py) else { continue };
        let mut probe = Command::new(&py_path);
        if py == "py" {
            probe.args(["-3", "-m", "esptool", "version"]);
        } else {
            probe.args(["-m", "esptool", "version"]);
        }
        hide_console(&mut probe);
        if let Ok(output) = probe.output() {
            if output.status.success() {
                return if py == "py" {
                    Some(vec![
                        py_path.display().to_string(),
                        "-3".into(),
                        "-m".into(),
                        "esptool".into(),
                    ])
                } else {
                    Some(vec![
                        py_path.display().to_string(),
                        "-m".into(),
                        "esptool".into(),
                    ])
                };
            }
        }
    }
    None
}

fn run_version(cmd: &[String]) -> Option<String> {
    let (bin, args) = cmd.split_first()?;
    let mut version_cmd = Command::new(bin);
    version_cmd.args(args).arg("version");
    hide_console(&mut version_cmd);
    let output = version_cmd.output().ok()?;
    if !output.status.success() {
        // older esptool may use --version
        let mut version_cmd2 = Command::new(bin);
        version_cmd2.args(args).arg("--version");
        hide_console(&mut version_cmd2);
        let output2 = version_cmd2.output().ok()?;
        if !output2.status.success() {
            return None;
        }
        let text = String::from_utf8_lossy(&output2.stdout);
        let err = String::from_utf8_lossy(&output2.stderr);
        let combined = format!("{text}{err}").trim().to_string();
        return if combined.is_empty() {
            Some("esptool".into())
        } else {
            Some(combined.lines().next().unwrap_or("esptool").to_string())
        };
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let err = String::from_utf8_lossy(&output.stderr);
    let combined = format!("{text}{err}").trim().to_string();
    Some(
        combined
            .lines()
            .next()
            .unwrap_or("esptool")
            .trim()
            .to_string(),
    )
}

#[tauri::command]
pub fn get_esptool_info(app: AppHandle) -> EsptoolInfo {
    match resolve_esptool_command(&app) {
        Some(command) => {
            let version = run_version(&command);
            let override_hint = crate::tools::override_esptool(&app).is_some();
            EsptoolInfo {
                available: true,
                version: version.clone(),
                command: Some(command),
                hint: format!(
                    "esptool gotowy{}{}",
                    version
                        .map(|v| format!(" ({v})"))
                        .unwrap_or_default(),
                    if override_hint { " [override]" } else { "" }
                ),
            }
        }
        None => EsptoolInfo {
            available: false,
            command: None,
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
    let cmd = resolve_esptool_command(&app).ok_or_else(|| {
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

    let (bin, prefix) = cmd
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
            "$ {} {}  (chip={chip}, port={port}, baud={baud}, offset={offset})",
            bin,
            args.join(" ")
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

/// Extensions accepted for argv / deep-link / Open With targets.
pub const ALLOWED_OPEN_EXTENSIONS: &[&str] = &["esp32studio", "json", "ino", "bin", "elf"];

fn open_file_kind(ext: &str) -> Option<&'static str> {
    match ext {
        "esp32studio" | "json" => Some("project"),
        "ino" => Some("sketch"),
        "bin" | "elf" => Some("firmware"),
        _ => None,
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
    let kind = open_file_kind(&ext).ok_or_else(|| {
        format!(
            "Niedozwolone rozszerzenie '.{}'. Dozwolone: {}.",
            ext,
            ALLOWED_OPEN_EXTENSIONS.join(", ")
        )
    })?;
    // Limit size for project/sketch text (~2 MiB). Firmware: metadata only.
    let meta = std::fs::metadata(&p).map_err(|e| e.to_string())?;
    if meta.len() > 2 * 1024 * 1024 && kind != "firmware" {
        return Err("Plik jest zbyt duży (>2 MiB).".into());
    }

    let content = if kind == "firmware" {
        None
    } else {
        // Only read content for explicitly allowed text project/sketch types.
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
    let trimmed = arg.trim();
    if trimmed.starts_with("esp32studio://")
        || trimmed.starts_with("esp32studio:")
        || trimmed.starts_with("file:")
    {
        return true;
    }
    let p = Path::new(trimmed);
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    // Allow specific extensions even before the file exists on disk (cold start
    // / Open With paths that arrive slightly before the FS view is ready).
    ALLOWED_OPEN_EXTENSIONS.iter().any(|allowed| *allowed == ext)
}

#[cfg(test)]
mod open_file_tests {
    use super::*;

    #[test]
    fn classify_allows_scheme_and_extensions() {
        assert!(classify_cli_arg("esp32studio://open?path=%2Ftmp%2Fx.esp32studio"));
        assert!(classify_cli_arg("file:///tmp/zażółć%20projekt.esp32studio"));
        assert!(classify_cli_arg("/tmp/my file.esp32studio"));
        assert!(classify_cli_arg("/tmp/100%.ino"));
        assert!(classify_cli_arg(r"C:\proj\demo.bin"));
        assert!(!classify_cli_arg("/tmp/secrets.txt"));
        assert!(!classify_cli_arg("--autostart"));
    }

    #[test]
    fn open_file_kind_gates_content_types() {
        assert_eq!(open_file_kind("esp32studio"), Some("project"));
        assert_eq!(open_file_kind("json"), Some("project"));
        assert_eq!(open_file_kind("ino"), Some("sketch"));
        assert_eq!(open_file_kind("bin"), Some("firmware"));
        assert_eq!(open_file_kind("elf"), Some("firmware"));
        assert_eq!(open_file_kind("txt"), None);
        assert_eq!(open_file_kind("exe"), None);
    }
}
