//! Build ESP32 firmware from generated sketch via PlatformIO or arduino-cli.

use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::thread;
use std::time::Instant;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolchainInfo {
    pub platformio: Option<String>,
    pub arduino_cli: Option<String>,
    pub preferred: Option<String>,
    pub available: bool,
    /// `sidecar` | `path` | `none`
    pub source: String,
    pub hint: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildResult {
    pub ok: bool,
    pub tool: String,
    pub project_dir: Option<String>,
    pub firmware_path: Option<String>,
    pub exit_code: Option<i32>,
    pub message: String,
}

fn which(bin: &str) -> Option<PathBuf> {
    let candidates = if cfg!(windows) {
        vec![
            format!("{bin}.exe"),
            format!("{bin}.cmd"),
            format!("{bin}.bat"),
            bin.to_string(),
        ]
    } else {
        vec![bin.to_string()]
    };

    for name in candidates {
        let mut cmd = if cfg!(windows) {
            let mut c = Command::new("where");
            c.arg(&name);
            c
        } else {
            let mut c = Command::new("which");
            c.arg(&name);
            c
        };
        if let Ok(output) = cmd.output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Some(line) = stdout.lines().next() {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() {
                        return Some(PathBuf::from(trimmed));
                    }
                }
            }
        }
    }
    None
}

fn path_is_executable_candidate(p: &Path) -> bool {
    p.is_file()
}

/// Sidecar / offline PlatformIO locations (no user PATH required).
fn sidecar_pio_candidates(app: &AppHandle) -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Ok(env) = std::env::var("ESP32_STUDIO_PIO") {
        out.push(PathBuf::from(env));
    }
    if let Ok(dir) = app.path().app_local_data_dir() {
        let base = dir.join("sidecar").join("platformio");
        if cfg!(windows) {
            out.push(base.join("penv").join("Scripts").join("pio.exe"));
            out.push(base.join("penv").join("Scripts").join("platformio.exe"));
            out.push(base.join("pio.exe"));
        } else {
            out.push(base.join("penv").join("bin").join("pio"));
            out.push(base.join("penv").join("bin").join("platformio"));
            out.push(base.join("pio"));
        }
    }
    if let Ok(res) = app.path().resource_dir() {
        let base = res.join("sidecar").join("platformio");
        if cfg!(windows) {
            out.push(base.join("penv").join("Scripts").join("pio.exe"));
            out.push(base.join("pio.exe"));
        } else {
            out.push(base.join("penv").join("bin").join("pio"));
            out.push(base.join("pio"));
        }
    }
    out
}

fn resolve_pio(app: &AppHandle) -> Option<(PathBuf, &'static str)> {
    for cand in sidecar_pio_candidates(app) {
        if path_is_executable_candidate(&cand) {
            return Some((cand, "sidecar"));
        }
    }
    which("pio")
        .or_else(|| which("platformio"))
        .map(|p| (p, "path"))
}

fn resolve_arduino_cli() -> Option<PathBuf> {
    which("arduino-cli")
}

fn emit_log(app: &AppHandle, line: impl Into<String>) {
    let _ = app.emit("build-log", line.into());
}

fn version_of(bin: &Path) -> Option<String> {
    let output = Command::new(bin).arg("--version").output().ok()?;
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let line = text.lines().next()?.trim();
    if line.is_empty() {
        None
    } else {
        Some(line.to_string())
    }
}

#[tauri::command]
pub fn get_firmware_toolchain_info(app: AppHandle) -> ToolchainInfo {
    let pio = resolve_pio(&app);
    let arduino = resolve_arduino_cli();
    let preferred = if pio.is_some() {
        Some("platformio".into())
    } else if arduino.is_some() {
        Some("arduino-cli".into())
    } else {
        None
    };

    let source = match &pio {
        Some((_, "sidecar")) => "sidecar".to_string(),
        Some((_, _)) => "path".to_string(),
        None if arduino.is_some() => "path".to_string(),
        None => "none".to_string(),
    };

    let hint = match (&pio, &arduino) {
        (Some((p, src)), Some(a)) => format!(
            "PlatformIO ({src}) + arduino-cli. {} · {}",
            version_of(p).unwrap_or_else(|| p.display().to_string()),
            version_of(a).unwrap_or_else(|| a.display().to_string())
        ),
        (Some((p, src)), None) => format!(
            "PlatformIO ({src}): {}",
            version_of(p).unwrap_or_else(|| p.display().to_string())
        ),
        (None, Some(a)) => format!(
            "arduino-cli: {}",
            version_of(a).unwrap_or_else(|| a.display().to_string())
        ),
        (None, None) => {
            if cfg!(windows) {
                "Brak toolchainu. Sidecar: scripts/windows/Install-PlatformIoSidecar.ps1 — albo `pio` / arduino-cli w PATH.".into()
            } else {
                "Brak toolchainu. Sidecar: scripts/unix/install-platformio-sidecar.sh — albo `pio` / arduino-cli w PATH.".into()
            }
        }
    };

    ToolchainInfo {
        available: preferred.is_some(),
        preferred: preferred.clone(),
        platformio: pio.map(|(p, _)| p.display().to_string()),
        arduino_cli: arduino.map(|p| p.display().to_string()),
        source,
        hint,
    }
}

fn board_env(profile: &str) -> (&'static str, &'static str, &'static str) {
    // (pio env name, pio board, arduino FQBN)
    match profile {
        "esp32s3" => ("esp32s3", "esp32-s3-devkitc-1", "esp32:esp32:esp32s3"),
        "esp32c3" => ("esp32c3", "esp32-c3-devkitm-1", "esp32:esp32:esp32c3"),
        "esp32s2" => ("esp32s2", "esp32-s2-saola-1", "esp32:esp32:esp32s2"),
        "esp32c6" => ("esp32c6", "esp32-c6-devkitc-1", "esp32:esp32:esp32c6"),
        _ => ("esp32dev", "esp32dev", "esp32:esp32:esp32"),
    }
}

fn ensure_platformio_ini(ini: &str, profile: &str) -> String {
    let (env, board, _) = board_env(profile);
    if ini.contains("[env:") {
        // Prefer caller-provided ini; still rewrite board if template env:esp32dev
        if profile != "esp32" && profile != "esp32dev" && ini.contains("[env:esp32dev]") {
            return ini
                .replace("[env:esp32dev]", &format!("[env:{env}]"))
                .replace("board = esp32dev", &format!("board = {board}"));
        }
        return ini.to_string();
    }
    format!(
        "[env:{env}]\nplatform = espressif32\nboard = {board}\nframework = arduino\nmonitor_speed = 115200\n"
    )
}

fn write_project(
    root: &Path,
    sketch_name: &str,
    sketch_source: &str,
    platformio_ini: &str,
    profile: &str,
) -> Result<(), String> {
    let src = root.join("src");
    fs::create_dir_all(&src).map_err(|e| e.to_string())?;
    let ini = ensure_platformio_ini(platformio_ini, profile);
    fs::write(root.join("platformio.ini"), ini).map_err(|e| e.to_string())?;

    // Single translation unit for PlatformIO (Arduino framework)
    let _ = sketch_name;
    for entry in fs::read_dir(&src).into_iter().flatten().flatten() {
        let path = entry.path();
        if path.is_file() {
            let _ = fs::remove_file(path);
        }
    }
    fs::write(src.join("main.cpp"), sketch_source).map_err(|e| e.to_string())?;
    Ok(())
}

fn run_streaming(app: &AppHandle, bin: &Path, args: &[String], cwd: &Path) -> Result<i32, String> {
    emit_log(
        app,
        format!("$ {} {}  (cwd={})", bin.display(), args.join(" "), cwd.display()),
    );

    let mut child = Command::new(bin)
        .args(args)
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Nie uruchomiono {}: {e}", bin.display()))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let app_out = app.clone();
    let app_err = app.clone();
    let t_out = thread::spawn(move || {
        if let Some(out) = stdout {
            for line in BufReader::new(out).lines().flatten() {
                emit_log(&app_out, line);
            }
        }
    });
    let t_err = thread::spawn(move || {
        if let Some(err) = stderr {
            for line in BufReader::new(err).lines().flatten() {
                emit_log(&app_err, line);
            }
        }
    });

    let started = Instant::now();
    let status = child.wait().map_err(|e| e.to_string())?;
    let _ = t_out.join();
    let _ = t_err.join();
    emit_log(
        app,
        format!(
            "Proces zakończony kodem {:?} po {:.1}s",
            status.code(),
            started.elapsed().as_secs_f32()
        ),
    );
    Ok(status.code().unwrap_or(-1))
}

fn find_firmware_bin(root: &Path, env: &str) -> Option<PathBuf> {
    let candidates = [
        root.join(format!(".pio/build/{env}/firmware.bin")),
        root.join("build").join("firmware.bin"),
    ];
    for c in candidates {
        if c.is_file() {
            return Some(c);
        }
    }

    // arduino-cli output-dir: search *.bin
    let build_dir = root.join("build");
    if build_dir.is_dir() {
        if let Ok(entries) = fs::read_dir(&build_dir) {
            let mut bins: Vec<PathBuf> = entries
                .flatten()
                .map(|e| e.path())
                .filter(|p| {
                    p.extension()
                        .and_then(|e| e.to_str())
                        .map(|e| e.eq_ignore_ascii_case("bin"))
                        .unwrap_or(false)
                })
                .collect();
            // Prefer *.ino.bin over bootloader/partitions
            bins.sort_by_key(|p| {
                let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if name.contains("bootloader") || name.contains("partitions") {
                    2
                } else if name.ends_with(".ino.bin") || name == "firmware.bin" {
                    0
                } else {
                    1
                }
            });
            if let Some(p) = bins.into_iter().next() {
                return Some(p);
            }
        }
    }
    None
}

fn project_root(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("firmware-build");
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    Ok(base)
}

#[tauri::command]
pub fn build_firmware_from_sketch(
    app: AppHandle,
    sketch_source: String,
    platformio_ini: String,
    board_profile: String,
    sketch_name: Option<String>,
    preferred_tool: Option<String>,
) -> Result<BuildResult, String> {
    if sketch_source.trim().is_empty() {
        return Err("Pusty szkic — wygeneruj kod C++ najpierw.".into());
    }

    let profile = if board_profile.trim().is_empty() {
        "esp32".to_string()
    } else {
        board_profile.trim().to_lowercase()
    };
    let (env, _board, fqbn) = board_env(&profile);
    let sketch_name = sketch_name
        .unwrap_or_else(|| "esp32_display_studio".into())
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '_' { c } else { '_' })
        .collect::<String>();

    let root = project_root(&app)?;
    // Fresh-ish tree: keep .pio cache for faster rebuilds, rewrite sources
    write_project(
        &root,
        &sketch_name,
        &sketch_source,
        &platformio_ini,
        &profile,
    )?;

    let tool_pref = preferred_tool
        .unwrap_or_else(|| "auto".into())
        .to_lowercase();
    let pio = resolve_pio(&app);
    let arduino = resolve_arduino_cli();

    let use_pio = match tool_pref.as_str() {
        "arduino-cli" | "arduino" => false,
        "platformio" | "pio" => true,
        _ => pio.is_some(),
    };

    if use_pio {
        let Some((pio_bin, pio_src)) = pio else {
            return Ok(BuildResult {
                ok: false,
                tool: "platformio".into(),
                project_dir: Some(root.display().to_string()),
                firmware_path: None,
                exit_code: None,
                message: if cfg!(windows) {
                    "PlatformIO niedostępne (sidecar ani PATH). Uruchom Install-PlatformIoSidecar.ps1.".into()
                } else {
                    "PlatformIO niedostępne (sidecar ani PATH). Uruchom scripts/unix/install-platformio-sidecar.sh.".into()
                },
            });
        };

        emit_log(
            &app,
            format!("Używam PlatformIO ({pio_src}): {}", pio_bin.display()),
        );

        let args = vec![
            "run".into(),
            "-e".into(),
            env.to_string(),
            "-d".into(),
            root.display().to_string(),
        ];
        let code = run_streaming(&app, &pio_bin, &args, &root)?;
        let firmware = find_firmware_bin(&root, env);
        let ok = code == 0 && firmware.is_some();
        return Ok(BuildResult {
            ok,
            tool: "platformio".into(),
            project_dir: Some(root.display().to_string()),
            firmware_path: firmware.as_ref().map(|p| p.display().to_string()),
            exit_code: Some(code),
            message: if ok {
                format!("Zbudowano ({pio_src}): {}", firmware.unwrap().display())
            } else if code != 0 {
                format!("PlatformIO zakończył się kodem {code}. Zobacz log build.")
            } else {
                "Build OK, ale nie znaleziono firmware.bin".into()
            },
        });
    }

    let Some(arduino_bin) = arduino else {
        return Ok(BuildResult {
            ok: false,
            tool: "none".into(),
            project_dir: Some(root.display().to_string()),
            firmware_path: None,
            exit_code: None,
            message: "Brak PlatformIO (sidecar/PATH) i arduino-cli.".into(),
        });
    };

    // arduino-cli wants sketch folder named like the .ino
    let sketch_dir = root.join("arduino_sketch").join(&sketch_name);
    fs::create_dir_all(&sketch_dir).map_err(|e| e.to_string())?;
    fs::write(sketch_dir.join(format!("{sketch_name}.ino")), &sketch_source)
        .map_err(|e| e.to_string())?;
    let out_dir = root.join("build");
    fs::create_dir_all(&out_dir).map_err(|e| e.to_string())?;

    let args = vec![
        "compile".into(),
        "--fqbn".into(),
        fqbn.to_string(),
        "--output-dir".into(),
        out_dir.display().to_string(),
        sketch_dir.display().to_string(),
    ];
    let code = run_streaming(&app, &arduino_bin, &args, &root)?;
    let firmware = find_firmware_bin(&root, env);
    let ok = code == 0 && firmware.is_some();
    Ok(BuildResult {
        ok,
        tool: "arduino-cli".into(),
        project_dir: Some(root.display().to_string()),
        firmware_path: firmware.as_ref().map(|p| p.display().to_string()),
        exit_code: Some(code),
        message: if ok {
            format!("Zbudowano: {}", firmware.unwrap().display())
        } else if code != 0 {
            format!("arduino-cli zakończył się kodem {code}. Zainstaluj core: arduino-cli core install esp32:esp32")
        } else {
            "Build OK, ale nie znaleziono .bin".into()
        },
    })
}
