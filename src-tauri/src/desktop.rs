//! Tray helpers, app/agent autostart, close-to-tray preference.

use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};

use serde::Serialize;
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{
    menu::{Menu, MenuItem},
    AppHandle, Manager, State, WindowEvent,
};
use tauri_plugin_autostart::ManagerExt;

use crate::pc_agent::{start_pc_agent, stop_pc_agent, PcAgentState};

pub struct DesktopPrefs {
    pub close_to_tray: AtomicBool,
}

impl Default for DesktopPrefs {
    fn default() -> Self {
        Self {
            close_to_tray: AtomicBool::new(false),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopStatus {
    pub app_autostart: bool,
    pub agent_autostart: bool,
    pub close_to_tray: bool,
    pub tray_available: bool,
    pub hint: String,
}

fn startup_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        let appdata = std::env::var_os("APPDATA")?;
        Some(PathBuf::from(appdata).join(r"Microsoft\Windows\Start Menu\Programs\Startup"))
    }
    #[cfg(not(windows))]
    {
        let home = std::env::var_os("HOME")?;
        Some(PathBuf::from(home).join(".config/autostart"))
    }
}

fn agent_autostart_path() -> Option<PathBuf> {
    let dir = startup_dir()?;
    #[cfg(windows)]
    {
        Some(dir.join("ESP32-PC-Agent.bat"))
    }
    #[cfg(not(windows))]
    {
        Some(dir.join("esp32-pc-agent.desktop"))
    }
}

fn agent_exe_candidates(app: &AppHandle) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(resource_dir) = app.path().resource_dir() {
        paths.push(resource_dir.join("resources/windows/esp32-pc-agent.exe"));
        paths.push(resource_dir.join("esp32-pc-agent.exe"));
        paths.push(resource_dir.join("resources/unix/esp32-pc-agent"));
        paths.push(resource_dir.join("esp32-pc-agent"));
    }
    if let Ok(exe_dir) = app.path().executable_dir() {
        paths.push(exe_dir.join("esp32-pc-agent.exe"));
        paths.push(exe_dir.join("esp32-pc-agent"));
    }
    paths.push(PathBuf::from(
        "src-tauri/binaries/esp32-pc-agent-x86_64-pc-windows-msvc.exe",
    ));
    paths.push(PathBuf::from("tools/pc-agent/dist/esp32-pc-agent.exe"));
    paths.push(PathBuf::from("tools/pc-agent/dist/esp32-pc-agent"));
    paths.push(PathBuf::from("tools/pc-agent/esp32_pc_agent.py"));
    paths
}

fn resolve_agent_launch(app: &AppHandle) -> Option<(String, Vec<String>)> {
    for path in agent_exe_candidates(app) {
        if !path.is_file() {
            continue;
        }
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if ext == "py" {
            let py = if cfg!(windows) { "python" } else { "python3" };
            return Some((py.into(), vec![path.display().to_string()]));
        }
        return Some((path.display().to_string(), Vec::new()));
    }
    None
}

#[tauri::command]
pub fn get_desktop_status(app: AppHandle, prefs: State<'_, DesktopPrefs>) -> DesktopStatus {
    let app_autostart = app.autolaunch().is_enabled().unwrap_or(false);
    let agent_autostart = agent_autostart_path()
        .map(|p| p.is_file())
        .unwrap_or(false);
    DesktopStatus {
        app_autostart,
        agent_autostart,
        close_to_tray: prefs.close_to_tray.load(Ordering::Relaxed),
        tray_available: true,
        hint: "Tray + autostart gotowe w shellu Tauri.".into(),
    }
}

#[tauri::command]
pub fn set_app_autostart(app: AppHandle, enabled: bool) -> Result<bool, String> {
    if enabled {
        app.autolaunch()
            .enable()
            .map_err(|e| format!("Nie włączono autostartu aplikacji: {e}"))?;
    } else {
        app.autolaunch()
            .disable()
            .map_err(|e| format!("Nie wyłączono autostartu aplikacji: {e}"))?;
    }
    Ok(app.autolaunch().is_enabled().unwrap_or(enabled))
}

#[tauri::command]
pub fn set_pc_agent_autostart(
    app: AppHandle,
    enabled: bool,
    host: String,
    port: u16,
) -> Result<bool, String> {
    let path = agent_autostart_path().ok_or_else(|| "Brak katalogu Startup / autostart".to_string())?;

    if !enabled {
        if path.is_file() {
            fs::remove_file(&path).map_err(|e| e.to_string())?;
        }
        return Ok(false);
    }

    let (bin, prefix_args) = resolve_agent_launch(&app).ok_or_else(|| {
        "Nie znaleziono esp32-pc-agent.exe / .py — zbuduj agenta albo dołącz do releasu.".to_string()
    })?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    #[cfg(windows)]
    {
        let args = [
            prefix_args,
            vec![
                "--host".into(),
                host,
                "--port".into(),
                port.to_string(),
            ],
        ]
        .concat();
        let quoted_args = args
            .iter()
            .map(|a| format!("\"{a}\""))
            .collect::<Vec<_>>()
            .join(" ");
        let body = format!(
            "@echo off\r\nstart \"ESP32 PC Agent\" \"{bin}\" {quoted_args}\r\n"
        );
        fs::write(&path, body).map_err(|e| e.to_string())?;
    }

    #[cfg(not(windows))]
    {
        let mut args = prefix_args;
        args.push("--host".into());
        args.push(host);
        args.push("--port".into());
        args.push(port.to_string());
        let quoted = std::iter::once(bin.as_str())
            .chain(args.iter().map(String::as_str))
            .map(|a| {
                if a.contains(char::is_whitespace) {
                    format!("\"{a}\"")
                } else {
                    a.to_string()
                }
            })
            .collect::<Vec<_>>()
            .join(" ");
        let body = format!(
            "[Desktop Entry]\nType=Application\nName=ESP32 PC Agent\nExec={quoted}\nX-GNOME-Autostart-enabled=true\n"
        );
        fs::write(&path, body).map_err(|e| e.to_string())?;
    }

    Ok(path.is_file())
}

#[tauri::command]
pub fn set_close_to_tray(prefs: State<'_, DesktopPrefs>, enabled: bool) {
    prefs.close_to_tray.store(enabled, Ordering::Relaxed);
}

#[tauri::command]
pub fn show_main_window(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let show_i = MenuItem::with_id(app, "show", "Pokaż Studio", true, None::<&str>)?;
    let agent_start_i =
        MenuItem::with_id(app, "agent_start", "Start agenta PC", true, None::<&str>)?;
    let agent_stop_i = MenuItem::with_id(app, "agent_stop", "Stop agenta PC", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Wyjdź", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_i, &agent_start_i, &agent_stop_i, &quit_i])?;

    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| tauri::Error::InvalidIcon(std::io::Error::other("missing default window icon")))?;

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .tooltip("ESP32 Display Studio")
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                let _ = show_main_window(app.clone());
            }
            "agent_start" => {
                if let Some(state) = app.try_state::<PcAgentState>() {
                    let _ = start_pc_agent(app.clone(), state, "192.168.1.150".into(), 8080);
                }
            }
            "agent_stop" => {
                if let Some(state) = app.try_state::<PcAgentState>() {
                    let _ = stop_pc_agent(state);
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                let _ = show_main_window(app.clone());
            }
        })
        .build(app)?;

    Ok(())
}

pub fn attach_close_to_tray(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let handle = app.clone();
        window.on_window_event(move |event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if let Some(prefs) = handle.try_state::<DesktopPrefs>() {
                    if prefs.close_to_tray.load(Ordering::Relaxed) {
                        api.prevent_close();
                        if let Some(w) = handle.get_webview_window("main") {
                            let _ = w.hide();
                        }
                    }
                }
            }
        });
    }
}
