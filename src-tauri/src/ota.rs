//! Wi‑Fi OTA upload via espota.py (ArduinoOTA) or HTTP Update endpoint.
//! Also exposes LAN mDNS discovery for ArduinoOTA / HTTP Update hosts.

use std::collections::BTreeMap;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
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

    if method == "http" || method == "http-update" {
        return flash_ota_http(&app, &host, port, &firmware);
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
    if let Some(pw) = password {
        let trimmed = pw.trim();
        if !trimmed.is_empty() {
            args.push("-a".into());
            args.push(trimmed.to_string());
        }
    }

    emit_log(
        &app,
        format!(
            "$ {} {}  (source={source}, host={host}, port={port})",
            bin,
            args.join(" ")
        ),
    );

    let mut child = Command::new(bin)
        .args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Nie uruchomiono espota: {e}"))?;

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

    let status = child.wait().map_err(|e| format!("espota wait failed: {e}"))?;
    let _ = t_out.join();
    let _ = t_err.join();
    let code = status.code();

    if status.success() {
        emit_log(&app, "OTA (espota) zakończone sukcesem.".to_string());
        Ok(OtaResult {
            ok: true,
            exit_code: code,
            method: "espota".into(),
            message: format!("Firmware wgrany OTA na {host}:{port}."),
        })
    } else {
        let message = format!(
            "espota zakończył się kodem {:?}. Sprawdź IP, hasło OTA i czy szkic ma ArduinoOTA.begin().",
            code
        );
        emit_log(&app, message.clone());
        Ok(OtaResult {
            ok: false,
            exit_code: code,
            method: "espota".into(),
            message,
        })
    }
}

fn flash_ota_http(
    app: &AppHandle,
    host: &str,
    port: u16,
    firmware: &Path,
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
        format!(
            "$ {} {}  (HTTP Update)",
            curl.display(),
            args.join(" ")
        ),
    );

    let mut child = Command::new(&curl)
        .args(&args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
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

    let status = child.wait().map_err(|e| format!("curl wait failed: {e}"))?;
    let _ = t_out.join();
    let _ = t_err.join();
    let code = status.code();

    if status.success() {
        emit_log(app, "OTA (HTTP) zakończone sukcesem.".to_string());
        Ok(OtaResult {
            ok: true,
            exit_code: code,
            method: "http".into(),
            message: format!("Firmware wgrany HTTP Update → {url}"),
        })
    } else {
        let message = format!(
            "HTTP Update nieudany (kod {:?}). Upewnij się, że szkic obsługuje POST /update na porcie {port}.",
            code
        );
        emit_log(app, message.clone());
        Ok(OtaResult {
            ok: false,
            exit_code: code,
            method: "http".into(),
            message,
        })
    }
}
