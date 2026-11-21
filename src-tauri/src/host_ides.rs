//! Detect host IDEs (Arduino IDE, VS Code + PlatformIO, Sloeber, B4R)
//! and offer safe install guidance (official URLs / allowlisted winget — never silent malware).

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use tauri::AppHandle;

use crate::process_util::{hide_console, which};
use crate::tools::{open_url_os, OpenResult, ToolPathOverrides, ToolProbe};

/// Allowlisted winget package IDs only (official Microsoft community catalog).
pub const WINGET_ALLOWLIST: &[&str] = &[
    "ArduinoSA.IDE.stable",
    "Microsoft.VisualStudioCode",
];

const ARDUINO_DOWNLOAD: &str = "https://www.arduino.cc/en/software";
const VSCODE_DOWNLOAD: &str = "https://code.visualstudio.com/";
const PIO_EXT_MARKET: &str =
    "https://marketplace.visualstudio.com/items?itemName=platformio.platformio-ide";
const SLOEBER_DOWNLOAD: &str = "https://eclipse.baeyens.it/";
const B4R_DOWNLOAD: &str = "https://www.b4x.com/b4r.html";
const PIO_EXT_ID: &str = "platformio.platformio-ide";

fn path_is_file(p: &Path) -> bool {
    p.is_file()
}

fn path_exists(p: &Path) -> bool {
    p.exists()
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
}

fn vscode_extensions_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Some(home) = home_dir() {
        roots.push(home.join(".vscode").join("extensions"));
        roots.push(home.join(".vscode-insiders").join("extensions"));
        // Cursor / VSCodium-compatible layouts occasionally mirror the same folder name
        roots.push(home.join(".vscode-oss").join("extensions"));
    }
    if cfg!(windows) {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            let local = PathBuf::from(local);
            roots.push(
                local
                    .join("Programs")
                    .join("Microsoft VS Code")
                    .join("resources")
                    .join("app")
                    .join("extensions"),
            );
        }
    }
    roots
}

fn find_platformio_extension() -> Option<PathBuf> {
    for root in vscode_extensions_roots() {
        let Ok(entries) = fs::read_dir(&root) else {
            continue;
        };
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            if name.to_ascii_lowercase().starts_with(PIO_EXT_ID) {
                return Some(entry.path());
            }
        }
    }
    None
}

fn vscode_candidates(overrides: &ToolPathOverrides) -> Vec<(PathBuf, &'static str)> {
    let mut out = Vec::new();
    if let Some(raw) = overrides.vscode.as_deref() {
        let p = PathBuf::from(raw.trim());
        if path_is_file(&p) || path_exists(&p) {
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
                    .join("Microsoft VS Code")
                    .join("Code.exe"),
                "path",
            ));
            out.push((
                base.join("Microsoft VS Code").join("Code.exe"),
                "path",
            ));
            out.push((
                base.join("Programs")
                    .join("Microsoft VS Code Insiders")
                    .join("Code - Insiders.exe"),
                "path",
            ));
        }
    } else if cfg!(target_os = "macos") {
        out.push((
            PathBuf::from("/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"),
            "path",
        ));
        out.push((
            PathBuf::from(
                "/Applications/Visual Studio Code.app/Contents/MacOS/Electron",
            ),
            "path",
        ));
    }
    if let Some(p) = which("code").or_else(|| which("code-insiders")) {
        out.push((p, "path"));
    }
    out
}

fn find_vscode(overrides: &ToolPathOverrides) -> Option<(PathBuf, &'static str)> {
    for (p, src) in vscode_candidates(overrides) {
        if path_is_file(&p) || (cfg!(target_os = "macos") && path_exists(&p)) {
            return Some((p, src));
        }
    }
    None
}

pub fn probe_vscode_platformio(overrides: &ToolPathOverrides) -> ToolProbe {
    let vscode = find_vscode(overrides);
    let ext = find_platformio_extension();
    match (vscode, ext) {
        (Some((code, src)), Some(ext_path)) => ToolProbe {
            id: "vscode-platformio".into(),
            label: "VS Code + PlatformIO".into(),
            available: true,
            version: None,
            path: Some(format!(
                "{} (+ {})",
                code.display(),
                ext_path.display()
            )),
            source: src.into(),
            free: true,
            hint: "VS Code + rozszerzenie PlatformIO IDE wykryte.".into(),
            homepage: Some(PIO_EXT_MARKET.into()),
            kind: "ide".into(),
            winget_id: Some("Microsoft.VisualStudioCode".into()),
            install_url: Some(VSCODE_DOWNLOAD.into()),
        },
        (Some((code, src)), None) => ToolProbe {
            id: "vscode-platformio".into(),
            label: "VS Code + PlatformIO".into(),
            available: false,
            version: None,
            path: Some(code.display().to_string()),
            source: src.into(),
            free: true,
            hint: "VS Code jest, ale brak rozszerzenia PlatformIO IDE — zainstaluj z Marketplace.".into(),
            homepage: Some(PIO_EXT_MARKET.into()),
            kind: "ide".into(),
            winget_id: Some("Microsoft.VisualStudioCode".into()),
            install_url: Some(PIO_EXT_MARKET.into()),
        },
        (None, Some(ext_path)) => ToolProbe {
            id: "vscode-platformio".into(),
            label: "VS Code + PlatformIO".into(),
            available: false,
            version: None,
            path: Some(ext_path.display().to_string()),
            source: "path".into(),
            free: true,
            hint: "Rozszerzenie PlatformIO znalezione, ale nie wykryto VS Code.".into(),
            homepage: Some(VSCODE_DOWNLOAD.into()),
            kind: "ide".into(),
            winget_id: Some("Microsoft.VisualStudioCode".into()),
            install_url: Some(VSCODE_DOWNLOAD.into()),
        },
        (None, None) => ToolProbe {
            id: "vscode-platformio".into(),
            label: "VS Code + PlatformIO".into(),
            available: false,
            path: None,
            version: None,
            source: "none".into(),
            free: true,
            hint: "Brak VS Code / PlatformIO IDE — winget lub oficjalna strona + Marketplace.".into(),
            homepage: Some(VSCODE_DOWNLOAD.into()),
            kind: "ide".into(),
            winget_id: Some("Microsoft.VisualStudioCode".into()),
            install_url: Some(VSCODE_DOWNLOAD.into()),
        },
    }
}

fn sloeber_candidates(overrides: &ToolPathOverrides) -> Vec<(PathBuf, &'static str)> {
    let mut out = Vec::new();
    if let Some(raw) = overrides.sloeber.as_deref() {
        let p = PathBuf::from(raw.trim());
        if path_is_file(&p) || path_exists(&p) {
            out.push((p, "override"));
        }
    }
    if cfg!(windows) {
        let bases = [
            std::env::var("LOCALAPPDATA").ok().map(PathBuf::from),
            std::env::var("ProgramFiles").ok().map(PathBuf::from),
            std::env::var("ProgramFiles(x86)").ok().map(PathBuf::from),
            home_dir(),
        ];
        for base in bases.into_iter().flatten() {
            out.push((base.join("Sloeber").join("sloeber.exe"), "path"));
            out.push((base.join("Sloeber").join("eclipse.exe"), "path"));
            out.push((base.join("sloeber").join("sloeber.exe"), "path"));
            out.push((base.join("sloeber").join("eclipse.exe"), "path"));
            out.push((
                base.join("ArduinoEclipse")
                    .join("arduinoEclipse")
                    .join("eclipse.exe"),
                "path",
            ));
        }
    } else if cfg!(target_os = "macos") {
        out.push((
            PathBuf::from("/Applications/Sloeber.app/Contents/MacOS/Sloeber"),
            "path",
        ));
        out.push((
            PathBuf::from("/Applications/eclipse_arduino.app/Contents/MacOS/eclipse"),
            "path",
        ));
    } else if let Some(home) = home_dir() {
        out.push((home.join("sloeber").join("sloeber"), "path"));
        out.push((home.join("sloeber").join("eclipse"), "path"));
        out.push((home.join("ArduinoEclipse").join("eclipse"), "path"));
    }
    if let Some(p) = which("sloeber").or_else(|| which("eclipse")) {
        // Only accept eclipse if a sibling sloeber/arduino plugin marker exists
        let parent = p.parent().unwrap_or(p.as_path());
        let looks_sloeber = parent.join("configuration").exists()
            && (parent.join("plugins").exists()
                || parent
                    .file_name()
                    .map(|n| n.to_string_lossy().to_ascii_lowercase().contains("sloeber"))
                    .unwrap_or(false));
        if p.file_name()
            .map(|n| n.to_string_lossy().to_ascii_lowercase().contains("sloeber"))
            .unwrap_or(false)
            || looks_sloeber
        {
            out.push((p, "path"));
        }
    }
    out
}

pub fn probe_sloeber(overrides: &ToolPathOverrides) -> ToolProbe {
    for (p, src) in sloeber_candidates(overrides) {
        if path_is_file(&p) || (cfg!(target_os = "macos") && path_exists(&p)) {
            return ToolProbe {
                id: "sloeber".into(),
                label: "Sloeber".into(),
                available: true,
                version: None,
                path: Some(p.display().to_string()),
                source: src.into(),
                free: true,
                hint: format!("Sloeber / Arduino Eclipse ({src})"),
                homepage: Some(SLOEBER_DOWNLOAD.into()),
                kind: "ide".into(),
                winget_id: None,
                install_url: Some(SLOEBER_DOWNLOAD.into()),
            };
        }
    }
    ToolProbe {
        id: "sloeber".into(),
        label: "Sloeber".into(),
        available: false,
        path: None,
        version: None,
        source: "none".into(),
        free: true,
        hint: "Sloeber nie wykryte — pobierz z oficjalnej strony eclipse.baeyens.it (brak winget).".into(),
        homepage: Some(SLOEBER_DOWNLOAD.into()),
        kind: "ide".into(),
        winget_id: None,
        install_url: Some(SLOEBER_DOWNLOAD.into()),
    }
}

fn b4r_candidates(overrides: &ToolPathOverrides) -> Vec<(PathBuf, &'static str)> {
    let mut out = Vec::new();
    if let Some(raw) = overrides.b4r.as_deref() {
        let p = PathBuf::from(raw.trim());
        if path_is_file(&p) || path_exists(&p) {
            out.push((p, "override"));
        }
    }
    if cfg!(windows) {
        let bases = [
            std::env::var("ProgramFiles").ok().map(PathBuf::from),
            std::env::var("ProgramFiles(x86)").ok().map(PathBuf::from),
            std::env::var("LOCALAPPDATA").ok().map(PathBuf::from),
        ];
        for base in bases.into_iter().flatten() {
            out.push((
                base.join("Anywhere Software").join("B4R").join("B4R.exe"),
                "path",
            ));
            out.push((base.join("B4R").join("B4R.exe"), "path"));
            out.push((
                base.join("Programs")
                    .join("Anywhere Software")
                    .join("B4R")
                    .join("B4R.exe"),
                "path",
            ));
        }
    } else if cfg!(target_os = "macos") {
        out.push((
            PathBuf::from("/Applications/B4R.app/Contents/MacOS/B4R"),
            "path",
        ));
    }
    if let Some(p) = which("B4R").or_else(|| which("b4r")) {
        out.push((p, "path"));
    }
    out
}

pub fn probe_b4r(overrides: &ToolPathOverrides) -> ToolProbe {
    for (p, src) in b4r_candidates(overrides) {
        if path_is_file(&p) || (cfg!(target_os = "macos") && path_exists(&p)) {
            return ToolProbe {
                id: "b4r".into(),
                label: "B4R".into(),
                available: true,
                version: None,
                path: Some(p.display().to_string()),
                source: src.into(),
                free: true,
                hint: format!("B4R ({src})"),
                homepage: Some(B4R_DOWNLOAD.into()),
                kind: "ide".into(),
                winget_id: None,
                install_url: Some(B4R_DOWNLOAD.into()),
            };
        }
    }
    ToolProbe {
        id: "b4r".into(),
        label: "B4R".into(),
        available: false,
        path: None,
        version: None,
        source: "none".into(),
        free: true,
        hint: "B4R nie wykryte — pobierz z oficjalnej strony B4X (brak winget).".into(),
        homepage: Some(B4R_DOWNLOAD.into()),
        kind: "ide".into(),
        winget_id: None,
        install_url: Some(B4R_DOWNLOAD.into()),
    }
}

/// Enrich Arduino IDE probe with install metadata (detect stays in tools.rs).
pub fn with_arduino_ide_install(mut probe: ToolProbe) -> ToolProbe {
    probe.kind = "ide".into();
    probe.winget_id = Some("ArduinoSA.IDE.stable".into());
    probe.install_url = Some(ARDUINO_DOWNLOAD.into());
    if probe.homepage.is_none() {
        probe.homepage = Some(ARDUINO_DOWNLOAD.into());
    }
    if !probe.available {
        probe.hint =
            "Arduino IDE nie wykryte — winget ArduinoSA.IDE.stable lub oficjalne pobieranie."
                .into();
    }
    probe
}

fn winget_bin() -> Option<PathBuf> {
    which("winget")
}

/// Start an allowlisted winget install in a **visible** console (user sees prompts; never silent).
#[tauri::command]
pub fn start_winget_install(package_id: String) -> Result<OpenResult, String> {
    let id = package_id.trim();
    if !WINGET_ALLOWLIST.iter().any(|a| *a == id) {
        return Err(format!(
            "Pakiet winget poza listą dozwolonych: {id}. Dozwolone: {}",
            WINGET_ALLOWLIST.join(", ")
        ));
    }
    if !cfg!(windows) {
        return Err(
            "winget jest dostępny tylko na Windows — użyj oficjalnej strony pobierania.".into(),
        );
    }
    let Some(_winget) = winget_bin() else {
        return Err(
            "Nie znaleziono winget w PATH — zainstaluj App Installer z Microsoft Store."
                .into(),
        );
    };

    // Visible window on purpose: user must see winget / UAC prompts (no silent malware path).
    let mut cmd = Command::new("cmd");
    cmd.args([
        "/C",
        "start",
        "ESP32 Studio — winget",
        "winget",
        "install",
        "--id",
        id,
        "-e",
        "--source",
        "winget",
        "--accept-package-agreements",
        "--accept-source-agreements",
    ]);
    // Do NOT hide_console — start opens a new visible window.
    cmd.spawn()
        .map_err(|e| format!("Nie udało się uruchomić winget: {e}"))?;

    Ok(OpenResult {
        ok: true,
        message: format!(
            "Uruchomiono widoczną instalację winget dla {id}. Potwierdź w oknie winget / UAC."
        ),
        path: None,
    })
}

/// Open official download / Marketplace page for a known host IDE id.
#[tauri::command]
pub fn open_host_ide_download(ide_id: String) -> Result<OpenResult, String> {
    let url = match ide_id.trim() {
        "arduino-ide" => ARDUINO_DOWNLOAD,
        "vscode-platformio" => VSCODE_DOWNLOAD,
        "vscode-platformio-ext" | "platformio-ide" => PIO_EXT_MARKET,
        "sloeber" => SLOEBER_DOWNLOAD,
        "b4r" => B4R_DOWNLOAD,
        other => {
            return Err(format!("Nieznane IDE: {other}"));
        }
    };
    open_url_os(url)?;
    Ok(OpenResult {
        ok: true,
        message: format!("Otwarto oficjalną stronę instalacji: {url}"),
        path: None,
    })
}

/// Install PlatformIO IDE extension via `code --install-extension` when VS Code is present.
#[tauri::command]
pub fn install_platformio_vscode_extension(app: AppHandle) -> Result<OpenResult, String> {
    let overrides = crate::tools::load_overrides(&app);
    let Some((code, _)) = find_vscode(&overrides) else {
        return Err(
            "Nie wykryto VS Code — najpierw zainstaluj VS Code (winget lub oficjalna strona)."
                .into(),
        );
    };
    let mut cmd = Command::new(&code);
    cmd.args(["--install-extension", PIO_EXT_ID]);
    hide_console(&mut cmd);
    let output = cmd
        .output()
        .map_err(|e| format!("Nie udało się uruchomić code --install-extension: {e}"))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    if output.status.success() {
        Ok(OpenResult {
            ok: true,
            message: format!(
                "Zainstalowano / zaktualizowano rozszerzenie {PIO_EXT_ID}."
            ),
            path: Some(code.display().to_string()),
        })
    } else {
        Err(format!(
            "Instalacja rozszerzenia nie powiodła się. {}\n{}",
            stdout.trim(),
            stderr.trim()
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn winget_allowlist_is_curated() {
        assert!(WINGET_ALLOWLIST.contains(&"ArduinoSA.IDE.stable"));
        assert!(WINGET_ALLOWLIST.contains(&"Microsoft.VisualStudioCode"));
        assert!(!WINGET_ALLOWLIST.iter().any(|id| id.contains("..")));
        assert_eq!(WINGET_ALLOWLIST.len(), 2);
    }
}
