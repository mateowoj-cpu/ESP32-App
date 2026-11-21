//! Detect / configure free ESP32 host tools (Arduino, PlatformIO, esptool, IDF, Wokwi, host IDEs).

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use url::Url;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ToolPathOverrides {
    pub platformio: Option<String>,
    pub arduino_cli: Option<String>,
    pub esptool: Option<String>,
    pub arduino_ide: Option<String>,
    pub idf: Option<String>,
    pub wokwi_cli: Option<String>,
    pub vscode: Option<String>,
    pub sloeber: Option<String>,
    pub b4r: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolProbe {
    pub id: String,
    pub label: String,
    pub available: bool,
    pub path: Option<String>,
    pub version: Option<String>,
    /// `override` | `env` | `sidecar` | `path` | `none`
    pub source: String,
    pub free: bool,
    pub hint: String,
    pub homepage: Option<String>,
    /// `cli` | `ide`
    pub kind: String,
    /// Allowlisted winget id when install via winget is offered
    pub winget_id: Option<String>,
    /// Official download / marketplace URL (never a random mirror)
    pub install_url: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExternalToolsStatus {
    pub tools: Vec<ToolProbe>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenResult {
    pub ok: bool,
    pub message: String,
    pub path: Option<String>,
}

use crate::process_util::{hide_console, which};

fn path_is_file(p: &Path) -> bool {
    p.is_file()
}

fn overrides_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("tool-paths.json"))
}

pub fn load_overrides(app: &AppHandle) -> ToolPathOverrides {
    let Ok(path) = overrides_path(app) else {
        return ToolPathOverrides::default();
    };
    let Ok(raw) = fs::read_to_string(path) else {
        return ToolPathOverrides::default();
    };
    serde_json::from_str(&raw).unwrap_or_default()
}

fn save_overrides(app: &AppHandle, overrides: &ToolPathOverrides) -> Result<(), String> {
    let path = overrides_path(app)?;
    let raw = serde_json::to_string_pretty(overrides).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}

fn clean_override(value: Option<String>) -> Option<String> {
    value.and_then(|s| {
        let t = s.trim().to_string();
        if t.is_empty() {
            None
        } else {
            Some(t)
        }
    })
}

fn version_of(bin: &Path, args: &[&str]) -> Option<String> {
    let mut cmd = Command::new(bin);
    cmd.args(args);
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

fn resolve_override_file(raw: &str) -> Option<PathBuf> {
    let p = PathBuf::from(raw.trim());
    if path_is_file(&p) {
        Some(p)
    } else {
        None
    }
}

/// Public helpers used by firmware_build / flash resolve chains.
pub fn override_platformio(app: &AppHandle) -> Option<PathBuf> {
    let o = load_overrides(app);
    o.platformio
        .as_deref()
        .and_then(resolve_override_file)
}

pub fn override_arduino_cli(app: &AppHandle) -> Option<PathBuf> {
    let o = load_overrides(app);
    o.arduino_cli
        .as_deref()
        .and_then(resolve_override_file)
}

pub fn override_esptool(app: &AppHandle) -> Option<PathBuf> {
    let o = load_overrides(app);
    o.esptool.as_deref().and_then(resolve_override_file)
}

fn sidecar_pio(app: &AppHandle) -> Option<(PathBuf, &'static str)> {
    if let Ok(env) = std::env::var("ESP32_STUDIO_PIO") {
        let p = PathBuf::from(&env);
        if path_is_file(&p) {
            return Some((p, "env"));
        }
    }
    if let Ok(dir) = app.path().app_local_data_dir() {
        let base = dir.join("sidecar").join("platformio");
        let cands: Vec<PathBuf> = if cfg!(windows) {
            vec![
                base.join("penv").join("Scripts").join("pio.exe"),
                base.join("penv").join("Scripts").join("platformio.exe"),
                base.join("pio.exe"),
            ]
        } else {
            vec![
                base.join("penv").join("bin").join("pio"),
                base.join("penv").join("bin").join("platformio"),
                base.join("pio"),
            ]
        };
        for c in cands {
            if path_is_file(&c) {
                return Some((c, "sidecar"));
            }
        }
    }
    if let Ok(res) = app.path().resource_dir() {
        let base = res.join("sidecar").join("platformio");
        let cands: Vec<PathBuf> = if cfg!(windows) {
            vec![
                base.join("penv").join("Scripts").join("pio.exe"),
                base.join("pio.exe"),
            ]
        } else {
            vec![
                base.join("penv").join("bin").join("pio"),
                base.join("pio"),
            ]
        };
        for c in cands {
            if path_is_file(&c) {
                return Some((c, "sidecar"));
            }
        }
    }
    None
}

fn probe_platformio(app: &AppHandle) -> ToolProbe {
    if let Some(p) = override_platformio(app) {
        return ToolProbe {
            id: "platformio".into(),
            label: "PlatformIO CLI".into(),
            available: true,
            version: version_of(&p, &["--version"]),
            path: Some(p.display().to_string()),
            source: "override".into(),
            free: true,
            hint: "PlatformIO (ścieżka z ustawień)".into(),
            homepage: Some("https://platformio.org/".into()),
            kind: "cli".into(),
            winget_id: None,
            install_url: None,
        };
    }
    if let Some((p, src)) = sidecar_pio(app) {
        return ToolProbe {
            id: "platformio".into(),
            label: "PlatformIO CLI".into(),
            available: true,
            version: version_of(&p, &["--version"]),
            path: Some(p.display().to_string()),
            source: src.into(),
            free: true,
            hint: format!("PlatformIO ({src})"),
            homepage: Some("https://platformio.org/".into()),
            kind: "cli".into(),
            winget_id: None,
            install_url: None,
        };
    }
    if let Some(p) = which("pio").or_else(|| which("platformio")) {
        return ToolProbe {
            id: "platformio".into(),
            label: "PlatformIO CLI".into(),
            available: true,
            version: version_of(&p, &["--version"]),
            path: Some(p.display().to_string()),
            source: "path".into(),
            free: true,
            hint: "PlatformIO w PATH".into(),
            homepage: Some("https://platformio.org/".into()),
            kind: "cli".into(),
            winget_id: None,
            install_url: None,
        };
    }
    ToolProbe {
        id: "platformio".into(),
        label: "PlatformIO CLI".into(),
        available: false,
        path: None,
        version: None,
        source: "none".into(),
        free: true,
        hint: "Brak PlatformIO — sidecar lub `pip install platformio`.".into(),
        homepage: Some("https://platformio.org/install/cli".into()),
        kind: "cli".into(),
        winget_id: None,
        install_url: None,
    }
}

fn probe_arduino_cli(app: &AppHandle) -> ToolProbe {
    if let Some(p) = override_arduino_cli(app) {
        return ToolProbe {
            id: "arduino-cli".into(),
            label: "Arduino CLI".into(),
            available: true,
            version: version_of(&p, &["version"]),
            path: Some(p.display().to_string()),
            source: "override".into(),
            free: true,
            hint: "arduino-cli (ścieżka z ustawień)".into(),
            homepage: Some("https://arduino.github.io/arduino-cli/".into()),
            kind: "cli".into(),
            winget_id: None,
            install_url: None,
        };
    }
    if let Some(p) = which("arduino-cli") {
        return ToolProbe {
            id: "arduino-cli".into(),
            label: "Arduino CLI".into(),
            available: true,
            version: version_of(&p, &["version"]),
            path: Some(p.display().to_string()),
            source: "path".into(),
            free: true,
            hint: "arduino-cli w PATH".into(),
            homepage: Some("https://arduino.github.io/arduino-cli/".into()),
            kind: "cli".into(),
            winget_id: None,
            install_url: None,
        };
    }
    ToolProbe {
        id: "arduino-cli".into(),
        label: "Arduino CLI".into(),
        available: false,
        path: None,
        version: None,
        source: "none".into(),
        free: true,
        hint: "Brak arduino-cli w PATH.".into(),
        homepage: Some("https://arduino.github.io/arduino-cli/latest/installation/".into()),
        kind: "cli".into(),
        winget_id: None,
        install_url: None,
    }
}

fn probe_esptool(app: &AppHandle) -> ToolProbe {
    if let Some(p) = override_esptool(app) {
        return ToolProbe {
            id: "esptool".into(),
            label: "esptool".into(),
            available: true,
            version: version_of(&p, &["version"]),
            path: Some(p.display().to_string()),
            source: "override".into(),
            free: true,
            hint: "esptool (ścieżka z ustawień)".into(),
            homepage: Some("https://github.com/espressif/esptool".into()),
            kind: "cli".into(),
            winget_id: None,
            install_url: None,
        };
    }
    if let Some(p) = which("esptool").or_else(|| which("esptool.py")) {
        return ToolProbe {
            id: "esptool".into(),
            label: "esptool".into(),
            available: true,
            version: version_of(&p, &["version"]),
            path: Some(p.display().to_string()),
            source: "path".into(),
            free: true,
            hint: "esptool w PATH".into(),
            homepage: Some("https://github.com/espressif/esptool".into()),
            kind: "cli".into(),
            winget_id: None,
            install_url: None,
        };
    }
    // python -m esptool
    let pys: &[&str] = if cfg!(windows) {
        &["py", "python", "python3"]
    } else {
        &["python3", "python"]
    };
    for py in pys {
        let Some(py_path) = which(py) else { continue };
        let mut probe = Command::new(&py_path);
        if *py == "py" {
            probe.args(["-3", "-m", "esptool", "version"]);
        } else {
            probe.args(["-m", "esptool", "version"]);
        }
        hide_console(&mut probe);
        if let Ok(output) = probe.output() {
            if output.status.success() {
                let ver = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .unwrap_or("esptool")
                    .trim()
                    .to_string();
                return ToolProbe {
                    id: "esptool".into(),
                    label: "esptool".into(),
                    available: true,
                    version: Some(ver),
                    path: Some(format!("{} -m esptool", py_path.display())),
                    source: "path".into(),
                    free: true,
                    hint: "esptool przez Python module".into(),
                    homepage: Some("https://github.com/espressif/esptool".into()),
                    kind: "cli".into(),
                    winget_id: None,
                    install_url: None,
                };
            }
        }
    }
    ToolProbe {
        id: "esptool".into(),
        label: "esptool".into(),
        available: false,
        path: None,
        version: None,
        source: "none".into(),
        free: true,
        hint: "Brak esptool — `pip install esptool`.".into(),
        homepage: Some("https://docs.espressif.com/projects/esptool/".into()),
        kind: "cli".into(),
        winget_id: None,
        install_url: None,
    }
}

fn arduino_ide_candidates(overrides: &ToolPathOverrides) -> Vec<(PathBuf, &'static str)> {
    let mut out = Vec::new();
    if let Some(raw) = overrides.arduino_ide.as_deref() {
        let p = PathBuf::from(raw.trim());
        if path_is_file(&p) || p.exists() {
            out.push((p, "override"));
        }
    }
    if cfg!(windows) {
        let bases = [
            std::env::var("LOCALAPPDATA").ok().map(PathBuf::from),
            std::env::var("ProgramFiles").ok().map(PathBuf::from),
            std::env::var("ProgramFiles(x86)").ok().map(PathBuf::from),
        ];
        for base in bases.into_iter().flatten() {
            out.push((
                base.join("Programs")
                    .join("Arduino IDE")
                    .join("Arduino IDE.exe"),
                "path",
            ));
            out.push((base.join("Arduino IDE").join("Arduino IDE.exe"), "path"));
            out.push((base.join("Arduino").join("arduino.exe"), "path"));
        }
    } else if cfg!(target_os = "macos") {
        out.push((
            PathBuf::from("/Applications/Arduino IDE.app/Contents/MacOS/Arduino IDE"),
            "path",
        ));
        out.push((
            PathBuf::from("/Applications/Arduino.app/Contents/MacOS/Arduino"),
            "path",
        ));
    } else {
        for name in ["arduino-ide", "arduino"] {
            if let Some(p) = which(name) {
                out.push((p, "path"));
            }
        }
    }
    if let Some(p) = which("arduino-ide").or_else(|| which("arduino")) {
        out.push((p, "path"));
    }
    out
}

fn probe_arduino_ide(app: &AppHandle) -> ToolProbe {
    let o = load_overrides(app);
    for (p, src) in arduino_ide_candidates(&o) {
        if path_is_file(&p) || (cfg!(target_os = "macos") && p.exists()) {
            return ToolProbe {
                id: "arduino-ide".into(),
                label: "Arduino IDE".into(),
                available: true,
                version: None,
                path: Some(p.display().to_string()),
                source: src.into(),
                free: true,
                hint: format!("Arduino IDE ({src})"),
                homepage: Some("https://www.arduino.cc/en/software".into()),
                kind: "cli".into(),
                winget_id: None,
                install_url: None,
            };
        }
    }
    ToolProbe {
        id: "arduino-ide".into(),
        label: "Arduino IDE".into(),
        available: false,
        path: None,
        version: None,
        source: "none".into(),
        free: true,
        hint: "Arduino IDE nie wykryte — możesz nadal otworzyć folder szkicu w systemie.".into(),
        homepage: Some("https://www.arduino.cc/en/software".into()),
        kind: "cli".into(),
        winget_id: None,
        install_url: None,
    }
}

fn probe_idf(app: &AppHandle) -> ToolProbe {
    let o = load_overrides(app);
    if let Some(raw) = o.idf.as_deref() {
        if let Some(p) = resolve_override_file(raw) {
            return ToolProbe {
                id: "esp-idf".into(),
                label: "ESP-IDF (idf.py)".into(),
                available: true,
                version: version_of(&p, &["--version"]),
                path: Some(p.display().to_string()),
                source: "override".into(),
                free: true,
                hint: "ESP-IDF wykryte (ustawienia). Studio buduje framework Arduino — IDF jest opcjonalne.".into(),
                homepage: Some("https://docs.espressif.com/projects/esp-idf/".into()),
                kind: "cli".into(),
                winget_id: None,
                install_url: None,
            };
        }
    }
    if let Ok(idf_path) = std::env::var("IDF_PATH") {
        let p = PathBuf::from(&idf_path).join("tools").join("idf.py");
        if path_is_file(&p) {
            return ToolProbe {
                id: "esp-idf".into(),
                label: "ESP-IDF (idf.py)".into(),
                available: true,
                version: version_of(&p, &["--version"]),
                path: Some(p.display().to_string()),
                source: "env".into(),
                free: true,
                hint: "ESP-IDF przez IDF_PATH (detect-only).".into(),
                homepage: Some("https://docs.espressif.com/projects/esp-idf/".into()),
                kind: "cli".into(),
                winget_id: None,
                install_url: None,
            };
        }
    }
    if let Some(p) = which("idf.py") {
        return ToolProbe {
            id: "esp-idf".into(),
            label: "ESP-IDF (idf.py)".into(),
            available: true,
            version: version_of(&p, &["--version"]),
            path: Some(p.display().to_string()),
            source: "path".into(),
            free: true,
            hint: "idf.py w PATH (detect-only).".into(),
            homepage: Some("https://docs.espressif.com/projects/esp-idf/".into()),
            kind: "cli".into(),
            winget_id: None,
            install_url: None,
        };
    }
    ToolProbe {
        id: "esp-idf".into(),
        label: "ESP-IDF (idf.py)".into(),
        available: false,
        path: None,
        version: None,
        source: "none".into(),
        free: true,
        hint: "ESP-IDF nie wykryte (opcjonalne; Studio używa Arduino framework).".into(),
        homepage: Some("https://docs.espressif.com/projects/esp-idf/en/latest/esp32/get-started/".into()),
        kind: "cli".into(),
        winget_id: None,
        install_url: None,
    }
}

fn probe_wokwi(app: &AppHandle) -> ToolProbe {
    let o = load_overrides(app);
    if let Some(raw) = o.wokwi_cli.as_deref() {
        if let Some(p) = resolve_override_file(raw) {
            return ToolProbe {
                id: "wokwi".into(),
                label: "Wokwi CLI".into(),
                available: true,
                version: version_of(&p, &["--version"]),
                path: Some(p.display().to_string()),
                source: "override".into(),
                free: true,
                hint: "Wokwi CLI (ścieżka z ustawień). Symulator web też jest darmowy.".into(),
                homepage: Some("https://docs.wokwi.com/wokwi-ci/cli-installation".into()),
                kind: "cli".into(),
                winget_id: None,
                install_url: None,
            };
        }
    }
    if let Some(p) = which("wokwi-cli") {
        return ToolProbe {
            id: "wokwi".into(),
            label: "Wokwi CLI".into(),
            available: true,
            version: version_of(&p, &["--version"]),
            path: Some(p.display().to_string()),
            source: "path".into(),
            free: true,
            hint: "wokwi-cli w PATH. Możesz też otworzyć darmowy edytor web.".into(),
            homepage: Some("https://wokwi.com/".into()),
            kind: "cli".into(),
            winget_id: None,
            install_url: None,
        };
    }
    ToolProbe {
        id: "wokwi".into(),
        label: "Wokwi (web / CLI)".into(),
        available: false,
        path: None,
        version: None,
        source: "none".into(),
        free: true,
        hint: "CLI nie wykryte — otwórz darmowy symulator web Wokwi.".into(),
        homepage: Some("https://wokwi.com/arduino/new?template=esp32".into()),
        kind: "cli".into(),
        winget_id: None,
        install_url: None,
    }
}

pub fn open_path_os(path: &Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        let mut cmd = Command::new("explorer");
        cmd.arg(path);
        hide_console(&mut cmd);
        cmd.spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let _ = Command::new("xdg-open").arg(path).spawn();
    }
    Ok(())
}

pub fn open_url_os(url: &str) -> Result<(), String> {
    let parsed = Url::parse(url).map_err(|e| format!("Nieprawidłowy URL: {e}"))?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("Dozwolone tylko http(s)".into());
    }
    #[cfg(windows)]
    {
        // Hide the cmd.exe console; `start` still opens the default browser UI.
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", "start", "", url]);
        hide_console(&mut cmd);
        cmd.spawn().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let _ = Command::new("xdg-open").arg(url).spawn();
    }
    Ok(())
}

fn export_sketch_dir(app: &AppHandle, sketch_name: &str) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("arduino-export");
    fs::create_dir_all(&base).map_err(|e| e.to_string())?;
    let safe: String = sketch_name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect();
    let name = if safe.is_empty() {
        "esp32_display_studio".into()
    } else {
        safe
    };
    let dir = base.join(&name);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[tauri::command]
pub fn get_tool_path_overrides(app: AppHandle) -> ToolPathOverrides {
    load_overrides(&app)
}

#[tauri::command]
pub fn set_tool_path_overrides(
    app: AppHandle,
    platformio: Option<String>,
    arduino_cli: Option<String>,
    esptool: Option<String>,
    arduino_ide: Option<String>,
    idf: Option<String>,
    wokwi_cli: Option<String>,
    vscode: Option<String>,
    sloeber: Option<String>,
    b4r: Option<String>,
) -> Result<ToolPathOverrides, String> {
    let next = ToolPathOverrides {
        platformio: clean_override(platformio),
        arduino_cli: clean_override(arduino_cli),
        esptool: clean_override(esptool),
        arduino_ide: clean_override(arduino_ide),
        idf: clean_override(idf),
        wokwi_cli: clean_override(wokwi_cli),
        vscode: clean_override(vscode),
        sloeber: clean_override(sloeber),
        b4r: clean_override(b4r),
    };
    save_overrides(&app, &next)?;
    Ok(next)
}

#[tauri::command]
pub fn get_external_tools_status(app: AppHandle) -> ExternalToolsStatus {
    let overrides = load_overrides(&app);
    ExternalToolsStatus {
        tools: vec![
            probe_platformio(&app),
            probe_arduino_cli(&app),
            probe_esptool(&app),
            crate::host_ides::with_arduino_ide_install(probe_arduino_ide(&app)),
            crate::host_ides::probe_vscode_platformio(&overrides),
            crate::host_ides::probe_sloeber(&overrides),
            crate::host_ides::probe_b4r(&overrides),
            probe_idf(&app),
            probe_wokwi(&app),
        ],
    }
}

#[tauri::command]
pub fn open_path_in_os(path: String) -> Result<OpenResult, String> {
    let p = PathBuf::from(path.trim());
    if !p.exists() {
        return Err(format!("Ścieżka nie istnieje: {}", p.display()));
    }
    open_path_os(&p)?;
    Ok(OpenResult {
        ok: true,
        message: format!("Otwarto: {}", p.display()),
        path: Some(p.display().to_string()),
    })
}

#[tauri::command]
pub fn open_external_url(url: String) -> Result<OpenResult, String> {
    open_url_os(url.trim())?;
    Ok(OpenResult {
        ok: true,
        message: format!("Otwarto URL: {url}"),
        path: None,
    })
}

#[tauri::command]
pub fn export_and_open_arduino_ide(
    app: AppHandle,
    sketch_source: String,
    sketch_name: Option<String>,
) -> Result<OpenResult, String> {
    if sketch_source.trim().is_empty() {
        return Err("Pusty szkic — wygeneruj kod najpierw.".into());
    }
    let name = sketch_name.unwrap_or_else(|| "esp32_display_studio".into());
    let dir = export_sketch_dir(&app, &name)?;
    let folder_name = dir
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("esp32_display_studio")
        .to_string();
    let ino = dir.join(format!("{folder_name}.ino"));
    fs::write(&ino, sketch_source).map_err(|e| e.to_string())?;

    let ide = probe_arduino_ide(&app);
    if let Some(ide_path) = ide.path.as_ref() {
        let mut ide_cmd = Command::new(ide_path);
        ide_cmd.arg(dir.as_os_str());
        hide_console(&mut ide_cmd);
        let status = ide_cmd.spawn();
        if status.is_ok() {
            return Ok(OpenResult {
                ok: true,
                message: format!(
                    "Uruchomiono Arduino IDE z folderem {}",
                    dir.display()
                ),
                path: Some(dir.display().to_string()),
            });
        }
    }

    open_path_os(&dir)?;
    Ok(OpenResult {
        ok: true,
        message: format!(
            "Zapisano szkic w {}. Otwórz folder w Arduino IDE (nazwa folderu = nazwa .ino).",
            dir.display()
        ),
        path: Some(dir.display().to_string()),
    })
}

#[tauri::command]
pub fn open_wokwi_simulator() -> Result<OpenResult, String> {
    let url = "https://wokwi.com/arduino/new?template=esp32";
    open_url_os(url)?;
    Ok(OpenResult {
        ok: true,
        message: "Otwarto darmowy symulator Wokwi (ESP32).".into(),
        path: None,
    })
}
