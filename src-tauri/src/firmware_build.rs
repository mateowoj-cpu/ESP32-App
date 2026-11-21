//! Build ESP32 firmware from generated sketch via PlatformIO or arduino-cli.
//!
//! Each build gets an isolated artifact directory. Auto-flash requires a trusted
//! write plan derived from toolchain metadata (`flasher_args.json`). Shared
//! `.pio` / `build` caches are never used as the flash source of truth.

use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
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

/// One esptool `write_flash` segment (offset + file + role).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FlashSegment {
    pub offset: String,
    pub path: String,
    /// `bootloader` | `partition-table` | `boot-app0` | `app` | `other`
    pub role: String,
}

/// Verified (or explicitly manual) write plan returned to the UI / flash command.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FlashPlan {
    pub build_id: String,
    /// `otaApp` | `usbFullSet` | `manual`
    pub image_kind: String,
    pub chip_family: String,
    pub segments: Vec<FlashSegment>,
    /// Path suitable for OTA (app image only).
    pub ota_path: Option<String>,
    pub metadata_trusted: bool,
    pub artifact_dir: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildResult {
    pub ok: bool,
    pub tool: String,
    pub project_dir: Option<String>,
    /// Convenience: OTA/app path when available (never a bootloader/partition alone).
    pub firmware_path: Option<String>,
    pub exit_code: Option<i32>,
    pub message: String,
    pub build_id: Option<String>,
    pub image_kind: Option<String>,
    pub chip_family: Option<String>,
    pub flash_plan: Option<FlashPlan>,
    /// True only when USB auto-flash may proceed with `flash_plan`.
    pub auto_flash_allowed: bool,
}

use crate::process_util::{hide_console, which};

/// Global build session: serializes builds and tracks the last auto-flash plan.
struct BuildSession {
    building: AtomicBool,
    seq: AtomicU64,
    last_auto: Mutex<Option<FlashPlan>>,
}

impl BuildSession {
    fn global() -> &'static BuildSession {
        static SESSION: OnceLock<BuildSession> = OnceLock::new();
        SESSION.get_or_init(|| BuildSession {
            building: AtomicBool::new(false),
            seq: AtomicU64::new(1),
            last_auto: Mutex::new(None),
        })
    }

    fn try_begin(&self) -> Result<(), String> {
        if self
            .building
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return Err(
                "Trwa już inna kompilacja — poczekaj na zakończenie (równoległe buildy są zablokowane)."
                    .into(),
            );
        }
        // New build always invalidates the previous auto-flash result.
        if let Ok(mut guard) = self.last_auto.lock() {
            *guard = None;
        }
        Ok(())
    }

    fn end_success(&self, plan: Option<FlashPlan>) {
        if let Ok(mut guard) = self.last_auto.lock() {
            *guard = plan.filter(|p| p.metadata_trusted && p.image_kind == "usbFullSet");
        }
        self.building.store(false, Ordering::SeqCst);
    }

    fn end_failure(&self) {
        if let Ok(mut guard) = self.last_auto.lock() {
            *guard = None;
        }
        self.building.store(false, Ordering::SeqCst);
    }

    fn next_build_id(&self) -> String {
        let n = self.seq.fetch_add(1, Ordering::SeqCst);
        let ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0);
        format!("b{ms}-{n}")
    }

    fn last_auto_plan(&self) -> Option<FlashPlan> {
        self.last_auto.lock().ok().and_then(|g| g.clone())
    }
}

/// Test/reset hook — clears session state between unit tests.
#[cfg(test)]
pub fn reset_build_session_for_tests() {
    let s = BuildSession::global();
    s.building.store(false, Ordering::SeqCst);
    if let Ok(mut g) = s.last_auto.lock() {
        *g = None;
    }
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
    if let Some(p) = crate::tools::override_platformio(app) {
        return Some((p, "override"));
    }
    for cand in sidecar_pio_candidates(app) {
        if path_is_executable_candidate(&cand) {
            let src = if std::env::var("ESP32_STUDIO_PIO")
                .ok()
                .map(|e| PathBuf::from(e) == cand)
                .unwrap_or(false)
            {
                "env"
            } else {
                "sidecar"
            };
            return Some((cand, src));
        }
    }
    which("pio")
        .or_else(|| which("platformio"))
        .map(|p| (p, "path"))
}

fn resolve_arduino_cli(app: &AppHandle) -> Option<(PathBuf, &'static str)> {
    if let Some(p) = crate::tools::override_arduino_cli(app) {
        return Some((p, "override"));
    }
    which("arduino-cli").map(|p| (p, "path"))
}

fn emit_log(app: &AppHandle, line: impl Into<String>) {
    let _ = app.emit("build-log", line.into());
}

fn version_of(bin: &Path) -> Option<String> {
    let mut cmd = Command::new(bin);
    cmd.arg("--version");
    hide_console(&mut cmd);
    let output = cmd.output().ok()?;
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
    let arduino = resolve_arduino_cli(&app);
    let preferred = if pio.is_some() {
        Some("platformio".into())
    } else if arduino.is_some() {
        Some("arduino-cli".into())
    } else {
        None
    };

    let source = match (&pio, &arduino) {
        (Some((_, src)), _) => (*src).to_string(),
        (None, Some((_, src))) => (*src).to_string(),
        (None, None) => "none".to_string(),
    };

    let hint = match (&pio, &arduino) {
        (Some((p, src)), Some((a, asrc))) => format!(
            "PlatformIO ({src}) + arduino-cli ({asrc}). {} · {}",
            version_of(p).unwrap_or_else(|| p.display().to_string()),
            version_of(a).unwrap_or_else(|| a.display().to_string())
        ),
        (Some((p, src)), None) => format!(
            "PlatformIO ({src}): {}",
            version_of(p).unwrap_or_else(|| p.display().to_string())
        ),
        (None, Some((a, asrc))) => format!(
            "arduino-cli ({asrc}): {}",
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
        arduino_cli: arduino.map(|(p, _)| p.display().to_string()),
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

fn chip_family_from_profile(profile: &str) -> &'static str {
    match profile {
        "esp32s3" => "esp32s3",
        "esp32c3" => "esp32c3",
        "esp32s2" => "esp32s2",
        "esp32c6" => "esp32c6",
        _ => "esp32",
    }
}

fn ensure_platformio_ini(ini: &str, profile: &str) -> String {
    let (env, board, _) = board_env(profile);
    if ini.contains("[env:") {
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

    let mut build_cmd = Command::new(bin);
    build_cmd
        .args(args)
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    hide_console(&mut build_cmd);
    let mut child = build_cmd
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

fn workspace_root(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("firmware-build")
        .join("workspace");
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    Ok(base)
}

fn artifacts_root(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("firmware-build")
        .join("artifacts");
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    Ok(base)
}

/// Classify a binary filename into a flash role. Never treats bootloader/partitions as app.
pub fn classify_bin_role(file_name: &str) -> &'static str {
    let n = file_name.to_ascii_lowercase();
    if n.contains("bootloader") {
        "bootloader"
    } else if n.contains("partitions") || n.contains("partition-table") || n.contains("partition_table")
    {
        "partition-table"
    } else if n.contains("boot_app0") || n.contains("boot-app0") {
        "boot-app0"
    } else if n.ends_with(".ino.bin")
        || n == "firmware.bin"
        || n.ends_with(".app.bin")
        || (n.ends_with(".bin")
            && !n.contains("merged")
            && !n.contains("bootloader")
            && !n.contains("partition"))
    {
        // Prefer explicit app names; generic *.bin may still be "other" if ambiguous.
        if n.ends_with(".ino.bin") || n == "firmware.bin" || n.ends_with(".app.bin") {
            "app"
        } else if n.contains("merged") {
            "other"
        } else {
            "other"
        }
    } else {
        "other"
    }
}

fn parse_offset_u32(offset: &str) -> Result<u32, String> {
    let s = offset.trim();
    let s = s.strip_prefix("0x").or_else(|| s.strip_prefix("0X")).unwrap_or(s);
    u32::from_str_radix(s, 16).map_err(|_| format!("Nieprawidłowy offset flash: {offset}"))
}

/// Parse ESP-IDF / PlatformIO `flasher_args.json` into ordered segments.
pub fn parse_flasher_args_json(
    json_text: &str,
    base_dir: &Path,
) -> Result<Vec<(String /*offset*/, PathBuf, String /*role*/)>, String> {
    let v: serde_json::Value =
        serde_json::from_str(json_text).map_err(|e| format!("flasher_args.json: {e}"))?;

    let mut pairs: Vec<(u32, String, PathBuf, String)> = Vec::new();

    if let Some(files) = v.get("flash_files").and_then(|x| x.as_object()) {
        for (offset, file_val) in files {
            let file_name = file_val
                .as_str()
                .ok_or_else(|| format!("flash_files[{offset}] nie jest stringiem"))?;
            let path = resolve_flash_file(base_dir, file_name);
            if !path.is_file() {
                return Err(format!(
                    "Brak pliku z flasher_args.json: {} (offset {offset})",
                    path.display()
                ));
            }
            let role = classify_bin_role(
                path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or(file_name),
            );
            let off = parse_offset_u32(offset)?;
            pairs.push((off, normalize_offset_hex(off), path, role.to_string()));
        }
    } else {
        // Fallback: bootloader / partition-table / app objects
        for key in ["bootloader", "partition-table", "app"] {
            if let Some(obj) = v.get(key).and_then(|x| x.as_object()) {
                let offset = obj
                    .get("offset")
                    .and_then(|x| x.as_str())
                    .ok_or_else(|| format!("{key}.offset brak"))?;
                let file_name = obj
                    .get("file")
                    .and_then(|x| x.as_str())
                    .ok_or_else(|| format!("{key}.file brak"))?;
                let path = resolve_flash_file(base_dir, file_name);
                if !path.is_file() {
                    return Err(format!("Brak pliku {key}: {}", path.display()));
                }
                let role = match key {
                    "bootloader" => "bootloader",
                    "partition-table" => "partition-table",
                    "app" => "app",
                    _ => classify_bin_role(file_name),
                };
                let off = parse_offset_u32(offset)?;
                pairs.push((off, normalize_offset_hex(off), path, role.to_string()));
            }
        }
        if let Some(extra) = v.get("extra").and_then(|x| x.as_object()) {
            for (file_name, offset_val) in extra {
                let offset = offset_val
                    .as_str()
                    .ok_or_else(|| format!("extra[{file_name}] nie jest stringiem"))?;
                let path = resolve_flash_file(base_dir, file_name);
                if !path.is_file() {
                    return Err(format!("Brak pliku extra: {}", path.display()));
                }
                let role = classify_bin_role(file_name);
                let off = parse_offset_u32(offset)?;
                pairs.push((off, normalize_offset_hex(off), path, role.to_string()));
            }
        }
    }

    if pairs.is_empty() {
        return Err("flasher_args.json nie zawiera flash_files ani bootloader/app".into());
    }

    pairs.sort_by_key(|(off, _, _, _)| *off);
    Ok(pairs
        .into_iter()
        .map(|(_, offset, path, role)| (offset, path, role))
        .collect())
}

fn resolve_flash_file(base_dir: &Path, file_name: &str) -> PathBuf {
    let p = PathBuf::from(file_name);
    if p.is_absolute() {
        p
    } else {
        base_dir.join(file_name)
    }
}

fn normalize_offset_hex(off: u32) -> String {
    format!("0x{off:X}")
}

/// Validate segment roles vs offsets. Rejects app-at-bootloader-address style mistakes.
pub fn validate_flash_segments(
    segments: &[(String, PathBuf, String)],
    chip_family: &str,
) -> Result<(), String> {
    if segments.is_empty() {
        return Err("Pusty plan zapisu".into());
    }
    let mut seen_offsets = std::collections::HashSet::new();
    let mut has_app = false;
    for (offset, path, role) in segments {
        if !path.is_file() {
            return Err(format!("Segment nie istnieje: {}", path.display()));
        }
        let off = parse_offset_u32(offset)?;
        if !seen_offsets.insert(off) {
            return Err(format!("Zduplikowany offset {offset}"));
        }
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if name.contains("bootloader") && role != "bootloader" {
            return Err(format!(
                "Niespójny plan: plik bootloadera z rolą {role} @ {offset}"
            ));
        }
        if (name.contains("partitions") || name.contains("partition")) && role != "partition-table"
        {
            return Err(format!(
                "Niespójny plan: plik partycji z rolą {role} @ {offset}"
            ));
        }
        match role.as_str() {
            "bootloader" => {
                // Classic ESP32 uses 0x1000; C3/S3/C6 often 0x0.
                let ok = match chip_family {
                    "esp32c3" | "esp32s3" | "esp32c6" | "esp32s2" => off == 0x0 || off == 0x1000,
                    _ => off == 0x1000 || off == 0x0,
                };
                if !ok {
                    return Err(format!(
                        "Bootloader @ {offset} nie pasuje do rodziny {chip_family}"
                    ));
                }
            }
            "partition-table" => {
                if off != 0x8000 {
                    return Err(format!("Partition table oczekiwana @ 0x8000, jest {offset}"));
                }
            }
            "app" => {
                has_app = true;
                // App must never sit at the classic bootloader slot alone-as-if-full-image default.
                if off == 0x1000 {
                    return Err(
                        "Obraz aplikacji nie może być planowany pod 0x1000 (adres bootloadera)"
                            .into(),
                    );
                }
                if off != 0x10000 && off != 0x20000 {
                    // Allow other app offsets from metadata, but not bootloader/partition slots.
                    if off == 0x0 || off == 0x8000 || off == 0xE000 {
                        return Err(format!(
                            "Obraz aplikacji @ {offset} koliduje z slotem bootloader/partycji"
                        ));
                    }
                }
            }
            "boot-app0" => {
                if off != 0xE000 {
                    return Err(format!("boot_app0 oczekiwany @ 0xE000, jest {offset}"));
                }
            }
            _ => {}
        }
    }
    if !has_app {
        return Err("Plan USB bez segmentu aplikacji (app) — odrzucono".into());
    }
    Ok(())
}

/// Find a clear application binary in a directory (never bootloader/partitions).
pub fn find_app_bin_in_dir(dir: &Path) -> Option<PathBuf> {
    if !dir.is_dir() {
        return None;
    }
    let mut apps: Vec<PathBuf> = Vec::new();
    let Ok(entries) = fs::read_dir(dir) else {
        return None;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if !name
            .rsplit('.')
            .next()
            .map(|e| e.eq_ignore_ascii_case("bin"))
            .unwrap_or(false)
        {
            continue;
        }
        if classify_bin_role(name) == "app" {
            apps.push(path);
        }
    }
    apps.sort_by_key(|p| {
        let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
        if name == "firmware.bin" || name.ends_with(".ino.bin") {
            0
        } else {
            1
        }
    });
    apps.into_iter().next()
}

/// PlatformIO-only discovery: look solely under `.pio/build/<env>/`.
pub fn discover_platformio_outputs(
    workspace: &Path,
    env: &str,
) -> (Option<PathBuf> /*flasher_args*/, Option<PathBuf> /*app*/) {
    let build_dir = workspace.join(".pio").join("build").join(env);
    let flasher = build_dir.join("flasher_args.json");
    let flasher = if flasher.is_file() {
        Some(flasher)
    } else {
        None
    };
    let app = {
        let firmware = build_dir.join("firmware.bin");
        if firmware.is_file() {
            Some(firmware)
        } else {
            find_app_bin_in_dir(&build_dir)
        }
    };
    (flasher, app)
}

/// Arduino-cli-only discovery: look solely under the per-build output directory.
pub fn discover_arduino_outputs(
    out_dir: &Path,
) -> (Option<PathBuf> /*flasher_args*/, Option<PathBuf> /*app*/) {
    let flasher = out_dir.join("flasher_args.json");
    let flasher = if flasher.is_file() {
        Some(flasher)
    } else {
        None
    };
    let app = find_app_bin_in_dir(out_dir);
    (flasher, app)
}

fn copy_file_to_artifacts(src: &Path, dest_dir: &Path) -> Result<PathBuf, String> {
    fs::create_dir_all(dest_dir).map_err(|e| e.to_string())?;
    let name = src
        .file_name()
        .ok_or_else(|| format!("Brak nazwy pliku: {}", src.display()))?;
    let dest = dest_dir.join(name);
    fs::copy(src, &dest).map_err(|e| format!("Kopiowanie {} → {}: {e}", src.display(), dest.display()))?;
    Ok(dest)
}

/// Build an isolated artifact directory + FlashPlan from toolchain outputs.
pub fn materialize_build_artifacts(
    artifact_dir: &Path,
    build_id: &str,
    chip_family: &str,
    tool: &str,
    flasher_args: Option<&Path>,
    app_bin: Option<&Path>,
) -> Result<FlashPlan, String> {
    if artifact_dir.exists() {
        let _ = fs::remove_dir_all(artifact_dir);
    }
    fs::create_dir_all(artifact_dir).map_err(|e| e.to_string())?;

    if let Some(args_path) = flasher_args {
        let text = fs::read_to_string(args_path).map_err(|e| e.to_string())?;
        let base = args_path.parent().unwrap_or(Path::new("."));
        let parsed = parse_flasher_args_json(&text, base)?;
        validate_flash_segments(&parsed, chip_family)?;

        let mut segments = Vec::new();
        let mut ota_path = None;
        for (offset, path, role) in &parsed {
            let dest = copy_file_to_artifacts(path, artifact_dir)?;
            if role == "app" {
                ota_path = Some(dest.display().to_string());
            }
            segments.push(FlashSegment {
                offset: offset.clone(),
                path: dest.display().to_string(),
                role: role.clone(),
            });
        }

        let plan = FlashPlan {
            build_id: build_id.to_string(),
            image_kind: "usbFullSet".into(),
            chip_family: chip_family.to_string(),
            segments,
            ota_path,
            metadata_trusted: true,
            artifact_dir: artifact_dir.display().to_string(),
        };
        write_manifest(artifact_dir, &plan)?;
        return Ok(plan);
    }

    // No trusted USB metadata: at most expose an OTA app image (auto USB flash blocked).
    let Some(app) = app_bin else {
        return Err(
            "Brak wiarygodnych metadanych flash (flasher_args.json) i brak obrazu aplikacji".into(),
        );
    };
    let name = app
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if classify_bin_role(&name) != "app" {
        return Err(format!(
            "Odrzucono nie-aplikacyjny obraz jako firmware: {name}"
        ));
    }
    let dest = copy_file_to_artifacts(app, artifact_dir)?;
    let plan = FlashPlan {
        build_id: build_id.to_string(),
        image_kind: "otaApp".into(),
        chip_family: chip_family.to_string(),
        segments: vec![],
        ota_path: Some(dest.display().to_string()),
        metadata_trusted: false,
        artifact_dir: artifact_dir.display().to_string(),
    };
    write_manifest(artifact_dir, &plan)?;
    let _ = tool;
    Ok(plan)
}

fn write_manifest(artifact_dir: &Path, plan: &FlashPlan) -> Result<(), String> {
    let path = artifact_dir.join("manifest.json");
    let text = serde_json::to_string_pretty(plan).map_err(|e| e.to_string())?;
    fs::write(path, text).map_err(|e| e.to_string())
}

#[allow(dead_code)]
pub fn read_manifest(artifact_dir: &Path) -> Result<FlashPlan, String> {
    let path = artifact_dir.join("manifest.json");
    let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| format!("manifest.json: {e}"))
}

/// Build a manual (user-picked) plan — never auto-flash-trusted.
#[allow(dead_code)]
pub fn manual_flash_plan(
    build_id: &str,
    chip_family: &str,
    path: &Path,
    offset: &str,
) -> Result<FlashPlan, String> {
    if !path.is_file() {
        return Err(format!("Plik nie istnieje: {}", path.display()));
    }
    let _ = parse_offset_u32(offset)?;
    let role = classify_bin_role(
        path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("firmware.bin"),
    );
    Ok(FlashPlan {
        build_id: build_id.to_string(),
        image_kind: "manual".into(),
        chip_family: chip_family.to_string(),
        segments: vec![FlashSegment {
            offset: offset.trim().to_string(),
            path: path.display().to_string(),
            role: role.to_string(),
        }],
        ota_path: if role == "app" {
            Some(path.display().to_string())
        } else {
            None
        },
        metadata_trusted: false,
        artifact_dir: path
            .parent()
            .unwrap_or(Path::new("."))
            .display()
            .to_string(),
    })
}

/// Reject inconsistent plans before esptool runs.
pub fn assert_plan_flashable(plan: &FlashPlan, expected_build_id: Option<&str>) -> Result<(), String> {
    if let Some(id) = expected_build_id {
        if plan.build_id != id {
            return Err(format!(
                "Plan build_id={} nie pasuje do oczekiwanego {id} (wynik unieważniony?)",
                plan.build_id
            ));
        }
    }
    match plan.image_kind.as_str() {
        "usbFullSet" => {
            if !plan.metadata_trusted {
                return Err("Plan USB bez zaufanych metadanych — auto-flash zablokowany".into());
            }
            if plan.segments.is_empty() {
                return Err("Plan USB bez segmentów".into());
            }
            let tuples: Vec<(String, PathBuf, String)> = plan
                .segments
                .iter()
                .map(|s| (s.offset.clone(), PathBuf::from(&s.path), s.role.clone()))
                .collect();
            validate_flash_segments(&tuples, &plan.chip_family)?;
            // Auto USB flash only while this build is still the session's current result.
            match BuildSession::global().last_auto_plan() {
                Some(current) if current.build_id == plan.build_id => Ok(()),
                Some(_) => Err(
                    "Nowszy build unieważnił ten plan — zbuduj ponownie przed flash".into(),
                ),
                None => Err(
                    "Brak aktywnego wyniku auto-flash (unieważniony lub wygasły) — zbuduj ponownie"
                        .into(),
                ),
            }
        }
        "manual" => {
            if plan.segments.len() != 1 {
                return Err("Plan ręczny wymaga dokładnie jednego segmentu".into());
            }
            let s = &plan.segments[0];
            if !PathBuf::from(&s.path).is_file() {
                return Err(format!("Plik ręczny nie istnieje: {}", s.path));
            }
            let _ = parse_offset_u32(&s.offset)?;
            Ok(())
        }
        "otaApp" => Err(
            "Obraz OTA (sama aplikacja) nie nadaje się do auto USB flash bez metadanych adresów"
                .into(),
        ),
        other => Err(format!("Nieznany image_kind: {other}")),
    }
}

fn fail_result(tool: &str, project_dir: Option<String>, message: impl Into<String>) -> BuildResult {
    BuildResult {
        ok: false,
        tool: tool.into(),
        project_dir,
        firmware_path: None,
        exit_code: None,
        message: message.into(),
        build_id: None,
        image_kind: None,
        chip_family: None,
        flash_plan: None,
        auto_flash_allowed: false,
    }
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
    let session = BuildSession::global();
    session.try_begin()?;

    let result = (|| {
        if sketch_source.trim().is_empty() {
            return Ok(fail_result(
                "none",
                None,
                "Pusty szkic — wygeneruj kod C++ najpierw.",
            ));
        }

        let profile = if board_profile.trim().is_empty() {
            "esp32".to_string()
        } else {
            board_profile.trim().to_lowercase()
        };
        let chip_family = chip_family_from_profile(&profile).to_string();
        let (env, _board, fqbn) = board_env(&profile);
        let sketch_name = sketch_name
            .unwrap_or_else(|| "esp32_display_studio".into())
            .chars()
            .map(|c| {
                if c.is_ascii_alphanumeric() || c == '_' {
                    c
                } else {
                    '_'
                }
            })
            .collect::<String>();

        let build_id = session.next_build_id();
        let root = workspace_root(&app)?;
        let artifact_dir = artifacts_root(&app)?.join(&build_id);

        emit_log(
            &app,
            format!("Nowy build_id={build_id} (poprzedni wynik auto-flash unieważniony)"),
        );

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
        let arduino = resolve_arduino_cli(&app);

        let use_pio = match tool_pref.as_str() {
            "arduino-cli" | "arduino" => false,
            "platformio" | "pio" => true,
            _ => pio.is_some(),
        };

        if use_pio {
            let Some((pio_bin, pio_src)) = pio else {
                return Ok(fail_result(
                    "platformio",
                    Some(root.display().to_string()),
                    if cfg!(windows) {
                        "PlatformIO niedostępne (sidecar ani PATH). Uruchom Install-PlatformIoSidecar.ps1."
                    } else {
                        "PlatformIO niedostępne (sidecar ani PATH). Uruchom scripts/unix/install-platformio-sidecar.sh."
                    },
                ));
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
            if code != 0 {
                return Ok(BuildResult {
                    ok: false,
                    tool: "platformio".into(),
                    project_dir: Some(root.display().to_string()),
                    firmware_path: None,
                    exit_code: Some(code),
                    message: format!("PlatformIO zakończył się kodem {code}. Zobacz log build."),
                    build_id: Some(build_id),
                    image_kind: None,
                    chip_family: Some(chip_family),
                    flash_plan: None,
                    auto_flash_allowed: false,
                });
            }

            let (flasher, app_bin) = discover_platformio_outputs(&root, env);
            return finalize_artifacts(
                &app,
                "platformio",
                pio_src,
                &root,
                &artifact_dir,
                &build_id,
                &chip_family,
                flasher.as_deref(),
                app_bin.as_deref(),
                code,
            );
        }

        let Some((arduino_bin, arduino_src)) = arduino else {
            return Ok(fail_result(
                "none",
                Some(root.display().to_string()),
                "Brak PlatformIO (sidecar/PATH) i arduino-cli.",
            ));
        };

        // Isolated per-build output — never reuse shared build/ or .pio paths.
        let sketch_dir = root.join("arduino_sketch").join(&sketch_name);
        fs::create_dir_all(&sketch_dir).map_err(|e| e.to_string())?;
        fs::write(sketch_dir.join(format!("{sketch_name}.ino")), &sketch_source)
            .map_err(|e| e.to_string())?;
        let out_dir = root.join("arduino_out").join(&build_id);
        if out_dir.exists() {
            let _ = fs::remove_dir_all(&out_dir);
        }
        fs::create_dir_all(&out_dir).map_err(|e| e.to_string())?;

        emit_log(
            &app,
            format!(
                "Używam arduino-cli ({arduino_src}): {} → {}",
                arduino_bin.display(),
                out_dir.display()
            ),
        );

        let args = vec![
            "compile".into(),
            "--fqbn".into(),
            fqbn.to_string(),
            "--output-dir".into(),
            out_dir.display().to_string(),
            sketch_dir.display().to_string(),
        ];
        let code = run_streaming(&app, &arduino_bin, &args, &root)?;
        if code != 0 {
            return Ok(BuildResult {
                ok: false,
                tool: "arduino-cli".into(),
                project_dir: Some(root.display().to_string()),
                firmware_path: None,
                exit_code: Some(code),
                message: format!(
                    "arduino-cli zakończył się kodem {code}. Zainstaluj core: arduino-cli core install esp32:esp32"
                ),
                build_id: Some(build_id),
                image_kind: None,
                chip_family: Some(chip_family),
                flash_plan: None,
                auto_flash_allowed: false,
            });
        }

        let (flasher, app_bin) = discover_arduino_outputs(&out_dir);
        finalize_artifacts(
            &app,
            "arduino-cli",
            arduino_src,
            &root,
            &artifact_dir,
            &build_id,
            &chip_family,
            flasher.as_deref(),
            app_bin.as_deref(),
            code,
        )
    })();

    match &result {
        Ok(r) if r.ok && r.auto_flash_allowed => {
            session.end_success(r.flash_plan.clone());
        }
        Ok(r) if r.ok => {
            // OTA-only success: keep last_auto cleared (already cleared at begin).
            session.end_success(None);
            let _ = r;
        }
        _ => {
            session.end_failure();
        }
    }

    result
}

fn finalize_artifacts(
    app: &AppHandle,
    tool: &str,
    tool_src: &str,
    root: &Path,
    artifact_dir: &Path,
    build_id: &str,
    chip_family: &str,
    flasher: Option<&Path>,
    app_bin: Option<&Path>,
    code: i32,
) -> Result<BuildResult, String> {
    match materialize_build_artifacts(artifact_dir, build_id, chip_family, tool, flasher, app_bin) {
        Ok(plan) => {
            let auto = plan.metadata_trusted && plan.image_kind == "usbFullSet";
            let firmware_path = plan
                .ota_path
                .clone()
                .or_else(|| plan.segments.iter().find(|s| s.role == "app").map(|s| s.path.clone()));
            emit_log(
                app,
                format!(
                    "Artefakty → {} | kind={} trusted={} auto_flash={}",
                    plan.artifact_dir, plan.image_kind, plan.metadata_trusted, auto
                ),
            );
            let message = if auto {
                format!(
                    "Zbudowano ({tool_src}/{tool}): USB plan {} segment(s), build_id={build_id}",
                    plan.segments.len()
                )
            } else if plan.ota_path.is_some() {
                format!(
                    "Zbudowano ({tool_src}/{tool}): obraz OTA OK, ale brak zaufanych metadanych USB — auto-flash zablokowany (build_id={build_id})"
                )
            } else {
                format!("Zbudowano ({tool_src}/{tool}), build_id={build_id}")
            };
            Ok(BuildResult {
                ok: true,
                tool: tool.into(),
                project_dir: Some(root.display().to_string()),
                firmware_path,
                exit_code: Some(code),
                message,
                build_id: Some(build_id.to_string()),
                image_kind: Some(plan.image_kind.clone()),
                chip_family: Some(chip_family.to_string()),
                flash_plan: Some(plan),
                auto_flash_allowed: auto,
            })
        }
        Err(e) => {
            emit_log(app, format!("Artefakty: {e}"));
            Ok(BuildResult {
                ok: false,
                tool: tool.into(),
                project_dir: Some(root.display().to_string()),
                firmware_path: None,
                exit_code: Some(code),
                message: format!(
                    "Build zakończony, ale nie przygotowano wiarygodnego planu flash: {e}"
                ),
                build_id: Some(build_id.to_string()),
                image_kind: None,
                chip_family: Some(chip_family.to_string()),
                flash_plan: None,
                auto_flash_allowed: false,
            })
        }
    }
}

/// Expose last auto plan to flash module (session check).
#[allow(dead_code)]
pub fn current_auto_flash_plan() -> Option<FlashPlan> {
    BuildSession::global().last_auto_plan()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Barrier};
    use std::thread;

    fn write(path: &Path, contents: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, contents).unwrap();
    }

    fn sample_flasher_args() -> String {
        r#"{
  "flash_files": {
    "0x1000": "bootloader.bin",
    "0x8000": "partitions.bin",
    "0xe000": "boot_app0.bin",
    "0x10000": "firmware.bin"
  }
}"#
        .to_string()
    }

    #[test]
    fn classify_never_treats_bootloader_as_app() {
        assert_eq!(classify_bin_role("bootloader.bin"), "bootloader");
        assert_eq!(classify_bin_role("sketch.ino.bootloader.bin"), "bootloader");
        assert_eq!(classify_bin_role("partitions.bin"), "partition-table");
        assert_eq!(classify_bin_role("firmware.bin"), "app");
        assert_eq!(classify_bin_role("sketch.ino.bin"), "app");
    }

    #[test]
    fn pio_then_arduino_does_not_pick_pio_bin() {
        let tmp = std::env::temp_dir().join(format!(
            "esp32-studio-pio-arduino-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let _ = fs::remove_dir_all(&tmp);
        fs::create_dir_all(&tmp).unwrap();

        // Stale PIO cache with a firmware.bin
        write(
            &tmp.join(".pio/build/esp32dev/firmware.bin"),
            "OLD_PIO_APP",
        );
        write(
            &tmp.join(".pio/build/esp32dev/flasher_args.json"),
            &sample_flasher_args(),
        );
        write(&tmp.join(".pio/build/esp32dev/bootloader.bin"), "BL");
        write(&tmp.join(".pio/build/esp32dev/partitions.bin"), "PT");
        write(&tmp.join(".pio/build/esp32dev/boot_app0.bin"), "BA");

        // Fresh Arduino out dir for this build only
        let arduino_out = tmp.join("arduino_out/b-test-1");
        write(&arduino_out.join("sketch.ino.bin"), "NEW_ARDUINO_APP");

        let (pio_flasher, pio_app) = discover_platformio_outputs(&tmp, "esp32dev");
        assert!(pio_flasher.is_some());
        assert_eq!(
            pio_app.as_ref().unwrap().file_name().unwrap(),
            "firmware.bin"
        );

        let (ard_flasher, ard_app) = discover_arduino_outputs(&arduino_out);
        assert!(ard_flasher.is_none());
        assert_eq!(
            ard_app.as_ref().unwrap().file_name().unwrap(),
            "sketch.ino.bin"
        );
        // Arduino discovery must not walk into .pio
        let content = fs::read_to_string(ard_app.unwrap()).unwrap();
        assert_eq!(content, "NEW_ARDUINO_APP");

        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn stale_file_not_selected_as_current_app() {
        let tmp = std::env::temp_dir().join(format!(
            "esp32-studio-stale-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let _ = fs::remove_dir_all(&tmp);
        let old_out = tmp.join("arduino_out/b-old");
        let new_out = tmp.join("arduino_out/b-new");
        write(&old_out.join("old.ino.bin"), "STALE");
        write(&new_out.join("fresh.ino.bin"), "FRESH");

        let (_, app) = discover_arduino_outputs(&new_out);
        let content = fs::read_to_string(app.unwrap()).unwrap();
        assert_eq!(content, "FRESH");

        // Old dir is never consulted when we pass the new out dir
        let (_, old_app) = discover_arduino_outputs(&old_out);
        assert!(old_app.is_some());
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn bootloader_only_rejected() {
        let tmp = std::env::temp_dir().join(format!(
            "esp32-studio-bl-only-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let _ = fs::remove_dir_all(&tmp);
        write(&tmp.join("bootloader.bin"), "BL_ONLY");
        assert!(find_app_bin_in_dir(&tmp).is_none());

        let art = tmp.join("artifacts");
        let err = materialize_build_artifacts(&art, "b1", "esp32", "platformio", None, None)
            .unwrap_err();
        assert!(
            err.contains("metadanych") || err.contains("aplikacji"),
            "unexpected: {err}"
        );

        // Passing bootloader as "app" must fail
        let bl = tmp.join("bootloader.bin");
        let err2 =
            materialize_build_artifacts(&art, "b2", "esp32", "platformio", None, Some(&bl))
                .unwrap_err();
        assert!(err2.contains("Odrzucono") || err2.contains("nie-aplikacyjny"));
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn trusted_usb_plan_from_flasher_args() {
        let tmp = std::env::temp_dir().join(format!(
            "esp32-studio-plan-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let _ = fs::remove_dir_all(&tmp);
        let build = tmp.join("pio");
        write(&build.join("bootloader.bin"), "BL");
        write(&build.join("partitions.bin"), "PT");
        write(&build.join("boot_app0.bin"), "BA");
        write(&build.join("firmware.bin"), "APP");
        write(&build.join("flasher_args.json"), &sample_flasher_args());

        let art = tmp.join("artifacts/b1");
        let plan = materialize_build_artifacts(
            &art,
            "b1",
            "esp32",
            "platformio",
            Some(&build.join("flasher_args.json")),
            Some(&build.join("firmware.bin")),
        )
        .unwrap();

        assert_eq!(plan.image_kind, "usbFullSet");
        assert!(plan.metadata_trusted);
        assert_eq!(plan.segments.len(), 4);
        assert!(plan.ota_path.as_ref().unwrap().contains("firmware.bin"));
        reset_build_session_for_tests();
        let session = BuildSession::global();
        session.try_begin().unwrap();
        session.end_success(Some(plan.clone()));
        assert_plan_flashable(&plan, Some("b1")).unwrap();
        reset_build_session_for_tests();
        let _ = fs::remove_dir_all(&tmp);
    }

    #[test]
    fn app_at_bootloader_offset_rejected() {
        let tmp = std::env::temp_dir().join(format!(
            "esp32-studio-bad-off-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        write(&tmp, "APP");
        let segs = vec![("0x1000".to_string(), tmp.clone(), "app".to_string())];
        let err = validate_flash_segments(&segs, "esp32").unwrap_err();
        assert!(err.contains("0x1000"));
        let _ = fs::remove_file(&tmp);
    }

    #[test]
    fn second_build_failure_invalidates_previous_auto() {
        reset_build_session_for_tests();
        let session = BuildSession::global();
        session.try_begin().unwrap();
        let plan = FlashPlan {
            build_id: "b-ok".into(),
            image_kind: "usbFullSet".into(),
            chip_family: "esp32".into(),
            segments: vec![],
            ota_path: None,
            metadata_trusted: true,
            artifact_dir: "/tmp".into(),
        };
        session.end_success(Some(plan));
        assert!(session.last_auto_plan().is_some());

        // Second build starts → invalidates
        session.try_begin().unwrap();
        assert!(session.last_auto_plan().is_none());
        // Failure leaves it cleared
        session.end_failure();
        assert!(session.last_auto_plan().is_none());
        reset_build_session_for_tests();
    }

    #[test]
    fn concurrent_builds_rejected() {
        reset_build_session_for_tests();
        let session = BuildSession::global();
        session.try_begin().unwrap();

        let barrier = Arc::new(Barrier::new(3));
        let mut handles = vec![];
        for _ in 0..2 {
            let b = Arc::clone(&barrier);
            handles.push(thread::spawn(move || {
                b.wait();
                BuildSession::global().try_begin()
            }));
        }
        barrier.wait();
        let results: Vec<_> = handles.into_iter().map(|h| h.join().unwrap()).collect();
        assert!(results.iter().all(|r| r.is_err()));

        session.end_failure();
        reset_build_session_for_tests();
    }

    #[test]
    fn ota_only_plan_blocks_usb_assert() {
        let plan = FlashPlan {
            build_id: "b-ota".into(),
            image_kind: "otaApp".into(),
            chip_family: "esp32".into(),
            segments: vec![],
            ota_path: Some("/tmp/firmware.bin".into()),
            metadata_trusted: false,
            artifact_dir: "/tmp".into(),
        };
        let err = assert_plan_flashable(&plan, None).unwrap_err();
        assert!(err.contains("OTA") || err.contains("auto USB"));
    }
}
