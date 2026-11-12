//! Helpers to locate / launch the bundled Windows PC agent sidecar.

use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Manager, State};

#[derive(Default)]
pub struct PcAgentState {
    child: Mutex<Option<Child>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PcAgentInfo {
    pub available: bool,
    pub path: Option<String>,
    pub running: bool,
    pub hint: String,
}

fn candidate_paths(app: &AppHandle) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        paths.push(resource_dir.join("resources/windows/esp32-pc-agent.exe"));
        paths.push(resource_dir.join("windows/esp32-pc-agent.exe"));
        paths.push(resource_dir.join("esp32-pc-agent.exe"));
    }

    if let Ok(exe_dir) = app.path().executable_dir() {
        paths.push(exe_dir.join("esp32-pc-agent.exe"));
        paths.push(exe_dir.join("binaries/esp32-pc-agent.exe"));
    }

    // Dev fallback: repo layout when running `tauri dev` from source tree.
    paths.push(PathBuf::from("src-tauri/resources/windows/esp32-pc-agent.exe"));
    paths.push(PathBuf::from("src-tauri/binaries/esp32-pc-agent-x86_64-pc-windows-msvc.exe"));
    paths.push(PathBuf::from("tools/pc-agent/dist/esp32-pc-agent.exe"));

    paths
}

fn resolve_agent_path(app: &AppHandle) -> Option<PathBuf> {
    candidate_paths(app).into_iter().find(|p| p.is_file())
}

fn is_running(state: &PcAgentState) -> bool {
    let mut guard = match state.child.lock() {
        Ok(g) => g,
        Err(_) => return false,
    };
    if let Some(child) = guard.as_mut() {
        match child.try_wait() {
            Ok(None) => true,
            Ok(Some(_)) => {
                *guard = None;
                false
            }
            Err(_) => {
                *guard = None;
                false
            }
        }
    } else {
        false
    }
}

#[tauri::command]
pub fn get_pc_agent_info(app: AppHandle, state: State<'_, PcAgentState>) -> PcAgentInfo {
    let path = resolve_agent_path(&app);
    let running = is_running(&state);
    PcAgentInfo {
        available: path.is_some(),
        path: path.as_ref().map(|p| p.display().to_string()),
        running,
        hint: if path.is_some() {
            "Znaleziono esp32-pc-agent.exe — możesz uruchomić go z poziomu Studio.".to_string()
        } else {
            "Brak spakowanego .exe. Pobierz z Releases albo zbuduj: scripts/windows/Build-PcAgent.ps1"
                .to_string()
        },
    }
}

#[tauri::command]
pub fn start_pc_agent(
    app: AppHandle,
    state: State<'_, PcAgentState>,
    host: String,
    port: u16,
) -> Result<PcAgentInfo, String> {
    if is_running(&state) {
        return Ok(get_pc_agent_info(app, state));
    }

    let path = resolve_agent_path(&app).ok_or_else(|| {
        "Nie znaleziono esp32-pc-agent.exe w zasobach aplikacji. Zbuduj agenta lub dołącz go do releasu.".to_string()
    })?;

    let child = Command::new(&path)
        .arg("--host")
        .arg(host)
        .arg("--port")
        .arg(port.to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Nie uruchomiono agenta PC ({}): {e}", path.display()))?;

    let mut guard = state
        .child
        .lock()
        .map_err(|_| "PcAgentState lock poisoned".to_string())?;
    *guard = Some(child);

    Ok(PcAgentInfo {
        available: true,
        path: Some(path.display().to_string()),
        running: true,
        hint: "Agent PC uruchomiony w tle.".to_string(),
    })
}

#[tauri::command]
pub fn stop_pc_agent(state: State<'_, PcAgentState>) -> Result<bool, String> {
    let mut guard = state
        .child
        .lock()
        .map_err(|_| "PcAgentState lock poisoned".to_string())?;
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
        return Ok(true);
    }
    Ok(false)
}

/// Best-effort cleanup when the app exits.
pub fn stop_on_exit(state: &PcAgentState) {
    if let Ok(mut guard) = state.child.lock() {
        if let Some(mut child) = guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}
