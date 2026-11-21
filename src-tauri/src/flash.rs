//! Thin wrapper around system `esptool` for flashing ESP32 firmware (.bin).

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use std::thread;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::firmware_build::{assert_plan_flashable, FlashPlan};

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

/// Resolve the write_flash address/file pairs from either a trusted plan or a manual path.
fn resolve_write_pairs(
    firmware_path: Option<String>,
    flash_offset: Option<String>,
    flash_plan: Option<FlashPlan>,
    build_id: Option<String>,
) -> Result<(Vec<(String, PathBuf)>, String /*mode label*/), String> {
    if let Some(plan) = flash_plan {
        assert_plan_flashable(&plan, build_id.as_deref())?;
        if plan.image_kind == "usbFullSet" && !plan.metadata_trusted {
            return Err("Brak wiarygodnych metadanych — auto-flash zablokowany".into());
        }
        if plan.image_kind == "otaApp" {
            return Err(
                "Obraz OTA nie może być wgrany przez auto USB flash bez planu adresów".into(),
            );
        }
        let mut pairs = Vec::new();
        for seg in &plan.segments {
            let p = validate_firmware_path(&seg.path)?;
            pairs.push((seg.offset.clone(), p));
        }
        if pairs.is_empty() {
            return Err("Plan flash nie zawiera segmentów".into());
        }
        let label = format!(
            "plan={} kind={} segments={}",
            plan.build_id,
            plan.image_kind,
            pairs.len()
        );
        return Ok((pairs, label));
    }

    let path = firmware_path.ok_or_else(|| {
        "Podaj ścieżkę firmware albo zweryfikowany flash_plan z buildu".to_string()
    })?;
    let firmware = validate_firmware_path(&path)?;
    // Manual flash requires an explicit offset — never silently default an app image to 0x1000.
    let offset = flash_offset
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| {
            "Ręczny flash wymaga jawnego offsetu (auto 0x1000 usunięte — unikamy złego adresu)"
                .to_string()
        })?;
    let label = format!("manual offset={offset}");
    let _ = build_id;
    Ok((vec![(offset, firmware)], label))
}

#[tauri::command]
pub fn flash_write_firmware(
    app: AppHandle,
    port: String,
    baud: u32,
    chip: String,
    firmware_path: Option<String>,
    flash_offset: Option<String>,
    flash_plan: Option<FlashPlan>,
    build_id: Option<String>,
) -> Result<FlashResult, String> {
    let cmd = resolve_esptool_command(&app).ok_or_else(|| {
        "Nie znaleziono esptool. Zainstaluj: pip install esptool".to_string()
    })?;
    let (pairs, plan_label) =
        resolve_write_pairs(firmware_path, flash_offset, flash_plan, build_id)?;
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
    ]);
    for (offset, path) in &pairs {
        args.push(offset.clone());
        args.push(path.display().to_string());
    }

    emit_log(
        &app,
        format!(
            "$ {} {}  (chip={chip}, port={port}, baud={baud}, {plan_label})",
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
