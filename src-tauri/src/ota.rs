//! Wi‑Fi OTA upload via espota.py (ArduinoOTA) or HTTP Update endpoint.
//! Also exposes LAN mDNS discovery for ArduinoOTA / HTTP Update hosts.
//!
//! Credentials are masked in log representations at the source. A single
//! in-flight operation handle is held until the child process ends; cancel
//! and timeout produce distinct statuses.

use std::collections::BTreeMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus, Stdio};
use std::thread;
use std::time::{Duration, Instant};

use mdns_sd::{ServiceDaemon, ServiceEvent};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OtaToolInfo {
    pub available: bool,
    pub command: Option<Vec<String>>,
    pub source: String,
    pub hint: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OtaResult {
    pub ok: bool,
    pub exit_code: Option<i32>,
    pub method: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
}

/// One in-flight OTA child. Released only after the waiter observes process end.
struct OtaOpHandle {
    pid: u32,
    cancel_requested: AtomicBool,
}

static OTA_OP: Mutex<Option<OtaOpHandle>> = Mutex::new(None);

#[derive(Debug, PartialEq, Eq)]
enum WaitOutcome {
    Exited(ExitStatus),
    TimedOut,
    Cancelled,
}

fn begin_ota(pid: u32) -> Result<(), String> {
    let mut guard = OTA_OP
        .lock()
        .map_err(|_| "OTA lock poisoned".to_string())?;
    if guard.is_some() {
        return Err("OTA już trwa — anuluj bieżącą operację lub poczekaj na koniec.".into());
    }
    *guard = Some(OtaOpHandle {
        pid,
        cancel_requested: AtomicBool::new(false),
    });
    Ok(())
}

fn release_ota() {
    if let Ok(mut guard) = OTA_OP.lock() {
        *guard = None;
    }
}

fn request_ota_cancel() -> Result<bool, String> {
    let guard = OTA_OP
        .lock()
        .map_err(|_| "OTA lock poisoned".to_string())?;
    match guard.as_ref() {
        Some(op) => {
            op.cancel_requested.store(true, Ordering::SeqCst);
            let pid = op.pid;
            drop(guard);
            kill_pid(pid)?;
            Ok(true)
        }
        None => Ok(false),
    }
}

fn ota_cancel_requested() -> bool {
    OTA_OP
        .lock()
        .ok()
        .and_then(|g| g.as_ref().map(|op| op.cancel_requested.load(Ordering::SeqCst)))
        .unwrap_or(false)
}

fn kill_pid(pid: u32) -> Result<(), String> {
    if cfg!(windows) {
        let mut cmd = Command::new("taskkill");
        cmd.args(["/PID", &pid.to_string(), "/T", "/F"])
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        hide_console(&mut cmd);
        let status = cmd
            .status()
            .map_err(|e| format!("taskkill failed: {e}"))?;
        if status.success() {
            Ok(())
        } else {
            Err(format!("taskkill exit {:?}", status.code()))
        }
    } else {
        let mut cmd = Command::new("kill");
        cmd.args(["-TERM", &pid.to_string()])
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        hide_console(&mut cmd);
        let status = cmd.status().map_err(|e| format!("kill failed: {e}"))?;
        if status.success() {
            Ok(())
        } else {
            Err(format!("kill exit {:?}", status.code()))
        }
    }
}

/// Mask `-a <password>` (espota auth) in argv for log/UI/diagnostics.
fn mask_args_for_log(args: &[String]) -> Vec<String> {
    let mut out = Vec::with_capacity(args.len());
    let mut mask_next = false;
    for arg in args {
        if mask_next {
            out.push("***".into());
            mask_next = false;
            continue;
        }
        if arg == "-a" || arg == "--auth" || arg == "--password" {
            out.push(arg.clone());
            mask_next = true;
        } else if let Some(rest) = arg
            .strip_prefix("-a=")
            .or_else(|| arg.strip_prefix("--auth="))
            .or_else(|| arg.strip_prefix("--password="))
        {
            if !rest.is_empty() {
                let prefix = &arg[..arg.len() - rest.len()];
                out.push(format!("{prefix}***"));
            } else {
                out.push(arg.clone());
            }
        } else {
            out.push(arg.clone());
        }
    }
    out
}

fn format_command_for_log(bin: &str, args: &[String]) -> String {
    let masked = mask_args_for_log(args);
    format!("$ {} {}", bin, masked.join(" "))
}

/// Redact a known secret from any child stdout/stderr line before emit.
fn redact_secret_in_line(line: &str, secret: Option<&str>) -> String {
    match secret {
        Some(pw) if !pw.is_empty() && line.contains(pw) => line.replace(pw, "***"),
        _ => line.to_string(),
    }
}

fn classify_ota_error(message: &str, exit_code: Option<i32>) -> &'static str {
    let lower = message.to_lowercase();
    if lower.contains("cancel") || lower.contains("anulow") {
        return "cancelled";
    }
    if lower.contains("timeout") || lower.contains("timed out") || lower.contains("przekroczy") {
        return "timeout";
    }
    if lower.contains("password") || lower.contains("auth") || lower.contains("unauthorized")
        || lower.contains("401") || lower.contains("hasło") || lower.contains("haslo")
    {
        return "auth";
    }
    if lower.contains("espota") && (lower.contains("nie znaleziono") || lower.contains("not found") || lower.contains("brak"))
        || lower.contains("curl") && lower.contains("path")
    {
        return "tool";
    }
    if lower.contains("already in progress") || lower.contains("już trwa") {
        return "busy";
    }
    if lower.contains("network") || lower.contains("connection") || lower.contains("timed")
        || lower.contains("unreachable") || lower.contains("refused") || lower.contains("no route")
        || exit_code == Some(7) || exit_code == Some(28)
    {
        return "network";
    }
    "generic"
}

fn ota_fail(method: &str, message: String, exit_code: Option<i32>) -> OtaResult {
    let code = classify_ota_error(&message, exit_code).to_string();
    OtaResult {
        ok: false,
        exit_code,
        method: method.into(),
        message,
        error_code: Some(code),
    }
}

fn ota_ok(method: &str, message: String, exit_code: Option<i32>) -> OtaResult {
    OtaResult {
        ok: true,
        exit_code,
        method: method.into(),
        message,
        error_code: None,
    }
}

fn ota_fail_cancelled(method: &str) -> OtaResult {
    OtaResult {
        ok: false,
        exit_code: None,
        method: method.into(),
        message: "OTA anulowane przez użytkownika.".into(),
        error_code: Some("cancelled".into()),
    }
}

fn ota_fail_timeout(method: &str, secs: u64) -> OtaResult {
    OtaResult {
        ok: false,
        exit_code: None,
        method: method.into(),
        message: format!("{method} timeout after {secs}s"),
        error_code: Some("timeout".into()),
    }
}

#[tauri::command]
pub fn cancel_ota_firmware() -> Result<bool, String> {
    request_ota_cancel()
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredOtaHost {
    /// Preferred connect target: IPv4 if known, otherwise hostname (e.g. `esp32-display.local`).
    pub host: String,
    pub hostname: String,
    pub addresses: Vec<String>,
    pub port: u16,
    pub service: String,
    pub fullname: String,
}

use crate::process_util::{hide_console, which};

fn python_bins() -> Vec<&'static str> {
    if cfg!(windows) {
        vec!["py", "python", "python3"]
    } else {
        vec!["python3", "python"]
    }
}

fn sidecar_espota_candidates(app: &AppHandle) -> Vec<PathBuf> {
    let mut out = Vec::new();
    if let Ok(env) = std::env::var("ESP32_STUDIO_ESPOTA") {
        out.push(PathBuf::from(env));
    }
    if let Ok(dir) = app.path().app_local_data_dir() {
        out.push(dir.join("sidecar").join("ota").join("espota.py"));
        out.push(dir.join("sidecar").join("platformio").join("espota.py"));
    }
    if let Ok(res) = app.path().resource_dir() {
        out.push(res.join("sidecar").join("ota").join("espota.py"));
        out.push(res.join("ota").join("espota.py"));
    }
    out
}

fn path_is_usable(p: &Path) -> bool {
    p.is_file()
}

/// Resolve espota as `[python, espota.py]` or a direct executable.
fn resolve_espota_command(app: &AppHandle) -> Option<(Vec<String>, String)> {
    for cand in sidecar_espota_candidates(app) {
        if path_is_usable(&cand) {
            for py in python_bins() {
                let Some(py_path) = which(py) else { continue };
                let cmd = if py == "py" {
                    vec![
                        py_path.display().to_string(),
                        "-3".into(),
                        cand.display().to_string(),
                    ]
                } else {
                    vec![py_path.display().to_string(), cand.display().to_string()]
                };
                return Some((cmd, format!("sidecar:{}", cand.display())));
            }
        }
    }

    if let Some(path) = which("espota") {
        return Some((vec![path.display().to_string()], "path:espota".into()));
    }
    if let Some(path) = which("espota.py") {
        for py in python_bins() {
            let Some(py_path) = which(py) else { continue };
            let cmd = if py == "py" {
                vec![
                    py_path.display().to_string(),
                    "-3".into(),
                    path.display().to_string(),
                ]
            } else {
                vec![py_path.display().to_string(), path.display().to_string()]
            };
            return Some((cmd, "path:espota.py".into()));
        }
    }

    // python -c "import espota" is uncommon; try module form used by some installs
    for py in python_bins() {
        let Some(py_path) = which(py) else { continue };
        let mut probe = Command::new(&py_path);
        if py == "py" {
            probe.args(["-3", "-c", "import runpy"]);
        } else {
            probe.args(["-c", "import runpy"]);
        }
        hide_console(&mut probe);
        // Keep looking for espota.py under common Arduino package trees
        let home = dirs_home();
        let mut search = Vec::new();
        if let Some(h) = home {
            search.push(
                h.join("AppData")
                    .join("Local")
                    .join("Arduino15")
                    .join("packages")
                    .join("esp32")
                    .join("tools"),
            );
            search.push(h.join(".platformio").join("packages"));
            search.push(h.join("Library").join("Arduino15").join("packages").join("esp32").join("tools"));
        }
        for root in search {
            if let Some(found) = find_named_file(&root, "espota.py", 6) {
                let cmd = if py == "py" {
                    vec![
                        py_path.display().to_string(),
                        "-3".into(),
                        found.display().to_string(),
                    ]
                } else {
                    vec![py_path.display().to_string(), found.display().to_string()]
                };
                return Some((cmd, format!("arduino-tools:{}", found.display())));
            }
        }
    }

    None
}

fn dirs_home() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
}

fn find_named_file(root: &Path, name: &str, max_depth: usize) -> Option<PathBuf> {
    if max_depth == 0 || !root.is_dir() {
        return None;
    }
    let entries = std::fs::read_dir(root).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() {
            if path.file_name().and_then(|n| n.to_str()) == Some(name) {
                return Some(path);
            }
        } else if path.is_dir() {
            if let Some(found) = find_named_file(&path, name, max_depth - 1) {
                return Some(found);
            }
        }
    }
    None
}

fn emit_log(app: &AppHandle, line: impl Into<String>) {
    let _ = app.emit("ota-log", line.into());
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
    if ext != "bin" {
        return Err("OTA wymaga pliku .bin (zbuduj firmware w Studio).".into());
    }
    Ok(p)
}

fn looks_like_ipv4(host: &str) -> bool {
    let parts: Vec<_> = host.split('.').collect();
    if parts.len() != 4 {
        return false;
    }
    parts.iter().all(|p| p.parse::<u8>().is_ok())
}

#[tauri::command]
pub fn get_ota_tool_info(app: AppHandle) -> OtaToolInfo {
    match resolve_espota_command(&app) {
        Some((command, source)) => OtaToolInfo {
            available: true,
            command: Some(command),
            source: source.clone(),
            hint: format!("espota gotowy ({source})"),
        },
        None => OtaToolInfo {
            available: false,
            command: None,
            source: "none".into(),
            hint: "Brak espota.py. Uruchom scripts/windows/Install-PlatformIoSidecar.ps1 albo zainstaluj rdzeń Arduino ESP32.".into(),
        },
    }
}

fn trim_mdns_dot(s: &str) -> String {
    s.trim_end_matches('.').to_string()
}

fn preferred_host(hostname: &str, addresses: &[String]) -> String {
    if let Some(ipv4) = addresses.iter().find(|a| a.parse::<std::net::Ipv4Addr>().is_ok()) {
        return ipv4.clone();
    }
    if !hostname.is_empty() {
        return hostname.to_string();
    }
    addresses.first().cloned().unwrap_or_default()
}

/// Browse LAN for ArduinoOTA (`_arduino._tcp`) and HTTP Update (`_http._tcp`) services.
#[tauri::command]
pub fn discover_ota_hosts(timeout_ms: Option<u64>) -> Result<Vec<DiscoveredOtaHost>, String> {
    let timeout = Duration::from_millis(timeout_ms.unwrap_or(2800).clamp(800, 12_000));
    let mdns = ServiceDaemon::new().map_err(|e| format!("mDNS daemon: {e}"))?;

    let service_types = ["_arduino._tcp.local.", "_http._tcp.local."];
    let mut receivers = Vec::new();
    for ty in service_types {
        match mdns.browse(ty) {
            Ok(rx) => receivers.push((ty.to_string(), rx)),
            Err(e) => {
                // One service type failing should not abort the whole scan.
                eprintln!("mDNS browse {ty}: {e}");
            }
        }
    }
    if receivers.is_empty() {
        let _ = mdns.shutdown();
        return Err("Nie udało się uruchomić przeglądania mDNS.".into());
    }

    let mut found: BTreeMap<String, DiscoveredOtaHost> = BTreeMap::new();
    let deadline = Instant::now() + timeout;

    while Instant::now() < deadline {
        let mut progressed = false;
        for (_ty, rx) in &receivers {
            match rx.recv_timeout(Duration::from_millis(40)) {
                Ok(ServiceEvent::ServiceResolved(info)) => {
                    progressed = true;
                    if !info.is_valid() {
                        continue;
                    }
                    let hostname = trim_mdns_dot(&info.host);
                    let mut addresses: Vec<String> = info
                        .addresses
                        .iter()
                        .filter(|a| a.is_ipv4())
                        .map(|a| a.to_string())
                        .collect();
                    if addresses.is_empty() {
                        addresses = info.addresses.iter().map(|a| a.to_string()).collect();
                    }
                    addresses.sort();
                    addresses.dedup();
                    let host = preferred_host(&hostname, &addresses);
                    if host.is_empty() {
                        continue;
                    }
                    let key = format!("{host}:{}", info.port);
                    found.insert(
                        key,
                        DiscoveredOtaHost {
                            host,
                            hostname,
                            addresses,
                            port: info.port,
                            service: trim_mdns_dot(&info.ty_domain),
                            fullname: trim_mdns_dot(&info.fullname),
                        },
                    );
                }
                Ok(_) => {
                    progressed = true;
                }
                Err(_) => {}
            }
        }
        if !progressed {
            thread::sleep(Duration::from_millis(30));
        }
    }

    for ty in service_types {
        let _ = mdns.stop_browse(ty);
    }
    let _ = mdns.shutdown();

    Ok(found.into_values().collect())
}

#[tauri::command]
pub fn flash_ota_firmware(
    app: AppHandle,
    host: String,
    port: Option<u16>,
    password: Option<String>,
    firmware_path: String,
    method: Option<String>,
    timeout_ms: Option<u64>,
) -> Result<OtaResult, String> {
    let host = host.trim().to_string();
    if host.is_empty() {
        return Err("Podaj adres IP ESP32 w sieci Wi‑Fi.".into());
    }
    if !looks_like_ipv4(&host) && !host.contains('.') {
        return Err("Host OTA powinien być adresem IPv4 (np. 192.168.1.50) lub nazwą mDNS.".into());
    }
    let firmware = validate_firmware_path(&firmware_path)?;
    let port = port.unwrap_or(3232);
    let method = method.unwrap_or_else(|| "espota".into()).to_lowercase();
    let timeout = Duration::from_millis(timeout_ms.unwrap_or(180_000).clamp(5_000, 900_000));

    if method == "http" || method == "http-update" {
        return flash_ota_http(&app, &host, port, &firmware, timeout);
    }

    let (cmd, source) = resolve_espota_command(&app).ok_or_else(|| {
        "Nie znaleziono espota.py. Zainstaluj sidecar (Install-PlatformIoSidecar.ps1) lub rdzeń Arduino-ESP32.".to_string()
    })?;

    let (bin, prefix) = cmd
        .split_first()
        .ok_or_else(|| "Pusta komenda espota".to_string())?;

    let mut args: Vec<String> = prefix.iter().cloned().collect();
    args.extend([
        "-i".into(),
        host.clone(),
        "-p".into(),
        port.to_string(),
        "-f".into(),
        firmware.display().to_string(),
    ]);
    let secret = password
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string);
    if let Some(ref pw) = secret {
        args.push("-a".into());
        args.push(pw.clone());
    }

    emit_log(
        &app,
        format!(
            "{}  (source={source}, host={host}, port={port})",
            format_command_for_log(bin, &args),
        ),
    );

    let mut ota_cmd = Command::new(bin);
    ota_cmd
        .args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    hide_console(&mut ota_cmd);
    let mut child = ota_cmd
        .spawn()
        .map_err(|e| format!("Nie uruchomiono espota: {e}"))?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let app_out = app.clone();
    let app_err = app.clone();
    let secret_out = secret.clone();
    let secret_err = secret.clone();

    let t_out = thread::spawn(move || {
        if let Some(out) = stdout {
            for line in BufReader::new(out).lines().flatten() {
                emit_log(&app_out, redact_secret_in_line(&line, secret_out.as_deref()));
            }
        }
    });
    let t_err = thread::spawn(move || {
        if let Some(err) = stderr {
            for line in BufReader::new(err).lines().flatten() {
                emit_log(&app_err, redact_secret_in_line(&line, secret_err.as_deref()));
            }
        }
    });

    if let Err(e) = begin_ota(child.id()) {
        let _ = child.kill();
        let _ = child.wait();
        let _ = t_out.join();
        let _ = t_err.join();
        return Ok(ota_fail("espota", e, None));
    }

    let outcome = wait_child_with_timeout(&mut child, timeout, "espota");
    release_ota();
    let _ = t_out.join();
    let _ = t_err.join();

    match outcome {
        Ok(WaitOutcome::Exited(status)) => {
            let code = status.code();
            if status.success() {
                emit_log(&app, "OTA (espota) zakończone sukcesem.".to_string());
                Ok(ota_ok(
                    "espota",
                    format!("Firmware wgrany OTA na {host}:{port}."),
                    code,
                ))
            } else {
                let message = format!(
                    "espota zakończył się kodem {:?}. Sprawdź IP, hasło OTA i czy szkic ma ArduinoOTA.begin().",
                    code
                );
                emit_log(&app, message.clone());
                Ok(ota_fail("espota", message, code))
            }
        }
        Ok(WaitOutcome::TimedOut) => {
            let result = ota_fail_timeout("espota", timeout.as_secs());
            emit_log(&app, result.message.clone());
            Ok(result)
        }
        Ok(WaitOutcome::Cancelled) => {
            let result = ota_fail_cancelled("espota");
            emit_log(&app, result.message.clone());
            Ok(result)
        }
        Err(message) => {
            emit_log(&app, message.clone());
            Ok(ota_fail("espota", message, None))
        }
    }
}

fn wait_child_with_timeout(
    child: &mut std::process::Child,
    timeout: Duration,
    label: &str,
) -> Result<WaitOutcome, String> {
    let deadline = Instant::now() + timeout;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                if ota_cancel_requested() {
                    return Ok(WaitOutcome::Cancelled);
                }
                return Ok(WaitOutcome::Exited(status));
            }
            Ok(None) => {
                if ota_cancel_requested() {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Ok(WaitOutcome::Cancelled);
                }
                if Instant::now() >= deadline {
                    let pid = child.id();
                    let _ = kill_pid(pid);
                    let _ = child.kill();
                    let _ = child.wait();
                    return Ok(WaitOutcome::TimedOut);
                }
                thread::sleep(Duration::from_millis(120));
            }
            Err(e) => return Err(format!("{label} try_wait failed: {e}")),
        }
    }
}

fn flash_ota_http(
    app: &AppHandle,
    host: &str,
    port: u16,
    firmware: &Path,
    timeout: Duration,
) -> Result<OtaResult, String> {
    // Prefer curl (Windows 10+ / macOS / Linux). Endpoint matches generated sketch /update.
    let url = format!("http://{host}:{port}/update");
    let curl = which("curl").ok_or_else(|| {
        "HTTP OTA wymaga `curl` w PATH (Windows 10+ ma curl wbudowany).".to_string()
    })?;

    let args = [
        "-sS".into(),
        "-f".into(),
        "-X".into(),
        "POST".into(),
        "-F".into(),
        format!("firmware=@{}", firmware.display()),
        url.clone(),
    ];

    emit_log(
        app,
        format!("{}  (HTTP Update)", format_command_for_log(&curl.display().to_string(), &args)),
    );

    let mut curl_cmd = Command::new(&curl);
    curl_cmd
        .args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    hide_console(&mut curl_cmd);
    let mut child = curl_cmd
        .spawn()
        .map_err(|e| format!("Nie uruchomiono curl: {e}"))?;

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

    if let Err(e) = begin_ota(child.id()) {
        let _ = child.kill();
        let _ = child.wait();
        let _ = t_out.join();
        let _ = t_err.join();
        return Ok(ota_fail("http", e, None));
    }

    let outcome = wait_child_with_timeout(&mut child, timeout, "curl");
    release_ota();
    let _ = t_out.join();
    let _ = t_err.join();

    match outcome {
        Ok(WaitOutcome::Exited(status)) => {
            let code = status.code();
            if status.success() {
                emit_log(app, "OTA (HTTP) zakończone sukcesem.".to_string());
                Ok(ota_ok(
                    "http",
                    format!("Firmware wgrany HTTP Update → {url}"),
                    code,
                ))
            } else {
                let message = format!(
                    "HTTP Update nieudany (kod {:?}). Upewnij się, że szkic obsługuje POST /update na porcie {port}.",
                    code
                );
                emit_log(app, message.clone());
                Ok(ota_fail("http", message, code))
            }
        }
        Ok(WaitOutcome::TimedOut) => {
            let result = ota_fail_timeout("curl", timeout.as_secs());
            emit_log(app, result.message.clone());
            Ok(result)
        }
        Ok(WaitOutcome::Cancelled) => {
            let result = ota_fail_cancelled("http");
            emit_log(app, result.message.clone());
            Ok(result)
        }
        Err(message) => {
            emit_log(app, message.clone());
            Ok(ota_fail("http", message, None))
        }
    }
}

/// Run a stub child under the same op-handle / wait / cancel / timeout path used by OTA.
#[cfg(test)]
fn run_stub_ota(
    mut child: std::process::Child,
    timeout: Duration,
) -> Result<WaitOutcome, String> {
    begin_ota(child.id())?;
    let outcome = wait_child_with_timeout(&mut child, timeout, "stub");
    release_ota();
    outcome
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{mpsc, Mutex as StdMutex};
    use std::time::Duration;

    /// Serialize tests that touch the process-global `OTA_OP` handle.
    static TEST_OTA_LOCK: StdMutex<()> = StdMutex::new(());

    fn with_ota_slot<R>(f: impl FnOnce() -> R) -> R {
        let _guard = TEST_OTA_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        release_ota();
        let result = f();
        release_ota();
        result
    }

    /// Cross-platform stub that exits successfully (Unix `true` / Windows `cmd /C exit 0`).
    fn spawn_stub_success() -> std::process::Child {
        if cfg!(windows) {
            Command::new("cmd")
                .args(["/C", "exit", "0"])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .expect("spawn stub success")
        } else {
            Command::new("true")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .expect("spawn stub success")
        }
    }

    /// Cross-platform stub that hangs long enough for cancel/timeout tests.
    fn spawn_stub_hang() -> std::process::Child {
        if cfg!(windows) {
            // ping -n N waits ~N seconds on Windows without needing sleep.exe.
            Command::new("ping")
                .args(["-n", "60", "127.0.0.1"])
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .expect("spawn stub hang")
        } else {
            Command::new("sleep")
                .arg("30")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .expect("spawn stub hang")
        }
    }

    #[test]
    fn mask_args_hides_password_after_dash_a() {
        let args = vec![
            "-i".into(),
            "192.168.1.10".into(),
            "-a".into(),
            "super-secret-ota".into(),
            "-f".into(),
            "app.bin".into(),
        ];
        let masked = mask_args_for_log(&args);
        let joined = masked.join(" ");
        assert!(!joined.contains("super-secret-ota"));
        assert!(joined.contains("-a ***"));
        let log = format_command_for_log("/usr/bin/python", &args);
        assert!(!log.contains("super-secret-ota"));
        assert!(log.contains("-a ***"));
    }

    #[test]
    fn redact_secret_from_child_output() {
        let line = "auth failed for super-secret-ota";
        assert_eq!(
            redact_secret_in_line(line, Some("super-secret-ota")),
            "auth failed for ***"
        );
        assert_eq!(redact_secret_in_line(line, None), line);
    }

    #[test]
    fn classify_distinguishes_timeout_and_cancel() {
        assert_eq!(classify_ota_error("espota timeout after 5s", None), "timeout");
        assert_eq!(
            classify_ota_error("OTA anulowane przez użytkownika.", None),
            "cancelled"
        );
        assert_eq!(ota_fail_timeout("espota", 5).error_code.as_deref(), Some("timeout"));
        assert_eq!(
            ota_fail_cancelled("espota").error_code.as_deref(),
            Some("cancelled")
        );
    }

    #[test]
    fn double_start_rejected_while_handle_held() {
        with_ota_slot(|| {
            begin_ota(42).expect("first begin");
            let err = begin_ota(99).expect_err("second begin must fail");
            assert!(err.contains("już trwa") || err.to_lowercase().contains("already"));
            release_ota();
            begin_ota(7).expect("restart after release");
            release_ota();
        });
    }

    #[test]
    fn cancel_keeps_handle_until_release() {
        with_ota_slot(|| {
            begin_ota(12345).expect("begin");
            {
                let guard = OTA_OP.lock().unwrap();
                assert!(guard.is_some());
                guard
                    .as_ref()
                    .unwrap()
                    .cancel_requested
                    .store(true, Ordering::SeqCst);
            }
            assert!(ota_cancel_requested());
            assert!(OTA_OP.lock().unwrap().is_some(), "handle stays until release");
            release_ota();
            assert!(OTA_OP.lock().unwrap().is_none());
            assert!(!ota_cancel_requested());
        });
    }

    #[test]
    fn stub_process_success_and_restart() {
        with_ota_slot(|| {
            let outcome = run_stub_ota(spawn_stub_success(), Duration::from_secs(5)).expect("wait");
            assert!(matches!(outcome, WaitOutcome::Exited(s) if s.success()));

            let outcome2 =
                run_stub_ota(spawn_stub_success(), Duration::from_secs(5)).expect("wait2");
            assert!(matches!(outcome2, WaitOutcome::Exited(s) if s.success()));
        });
    }

    #[test]
    fn stub_process_timeout() {
        with_ota_slot(|| {
            let outcome =
                run_stub_ota(spawn_stub_hang(), Duration::from_millis(400)).expect("wait");
            assert_eq!(outcome, WaitOutcome::TimedOut);
            begin_ota(1).expect("begin after timeout");
            release_ota();
        });
    }

    #[test]
    fn stub_process_cancel() {
        with_ota_slot(|| {
            let child = spawn_stub_hang();
            let pid = child.id();
            begin_ota(pid).expect("begin");

            let (tx, rx) = mpsc::channel();
            let handle = thread::spawn(move || {
                let mut child = child;
                let outcome = wait_child_with_timeout(&mut child, Duration::from_secs(30), "stub");
                release_ota();
                tx.send(outcome).ok();
            });

            thread::sleep(Duration::from_millis(150));
            request_ota_cancel().expect("cancel");
            let outcome = rx.recv_timeout(Duration::from_secs(5)).expect("outcome");
            let outcome = outcome.expect("wait ok");
            assert_eq!(outcome, WaitOutcome::Cancelled);
            handle.join().expect("join");
            assert!(OTA_OP.lock().unwrap().is_none());
        });
    }

    #[test]
    fn stub_double_start_with_live_process() {
        with_ota_slot(|| {
            let child = spawn_stub_hang();
            begin_ota(child.id()).expect("first");
            let err = begin_ota(999).expect_err("busy");
            assert!(err.contains("już trwa"));
            let _ = request_ota_cancel();
            let mut child = child;
            let _ = child.kill();
            let _ = child.wait();
            release_ota();
        });
    }

    #[test]
    fn password_never_appears_in_fail_messages() {
        let secret = "leaked-password-xyz";
        let args = vec!["-a".into(), secret.into(), "-i".into(), "1.2.3.4".into()];
        let log = format_command_for_log("espota", &args);
        let cancelled = ota_fail_cancelled("espota");
        let timed = ota_fail_timeout("espota", 3);
        let busy = ota_fail("espota", "OTA już trwa — anuluj bieżącą operację.".into(), None);
        for text in [
            log.as_str(),
            cancelled.message.as_str(),
            timed.message.as_str(),
            busy.message.as_str(),
        ] {
            assert!(
                !text.contains(secret),
                "secret leaked in: {text}"
            );
        }
    }
}
