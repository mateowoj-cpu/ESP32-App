//! Locate / launch the PC agent: Windows keeps the bundled .exe;
//! macOS / Linux may run the canonical Python source with a local Python install.

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

enum AgentLaunch {
    Exe(PathBuf),
    Python(PathBuf),
}

fn candidate_paths(app: &AppHandle) -> Vec<PathBuf> {
    let mut paths = Vec::new();

    if let Ok(resource_dir) = app.path().resource_dir() {
        paths.push(resource_dir.join("resources/windows/esp32-pc-agent.exe"));
        paths.push(resource_dir.join("windows/esp32-pc-agent.exe"));
        paths.push(resource_dir.join("esp32-pc-agent.exe"));
        paths.push(resource_dir.join("resources/unix/esp32-pc-agent"));
        paths.push(resource_dir.join("esp32-pc-agent"));
        paths.push(resource_dir.join("resources/pc-agent/esp32_pc_agent.py"));
        paths.push(resource_dir.join("esp32_pc_agent.py"));
    }

    if let Ok(exe_dir) = app.path().executable_dir() {
        paths.push(exe_dir.join("esp32-pc-agent.exe"));
        paths.push(exe_dir.join("binaries/esp32-pc-agent.exe"));
        paths.push(exe_dir.join("esp32-pc-agent"));
        paths.push(exe_dir.join("esp32_pc_agent.py"));
    }

    // Dev fallback: repo layout when running `tauri dev` from source tree.
    paths.push(PathBuf::from("src-tauri/resources/windows/esp32-pc-agent.exe"));
    paths.push(PathBuf::from(
        "src-tauri/binaries/esp32-pc-agent-x86_64-pc-windows-msvc.exe",
    ));
    paths.push(PathBuf::from("tools/pc-agent/dist/esp32-pc-agent.exe"));
    paths.push(PathBuf::from("tools/pc-agent/dist/esp32-pc-agent"));
    paths.push(PathBuf::from("tools/pc-agent/esp32_pc_agent.py"));

    paths
}

fn resolve_agent_launch(app: &AppHandle) -> Option<AgentLaunch> {
    for path in candidate_paths(app) {
        if !path.is_file() {
            continue;
        }
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if ext == "py" {
            // Windows keeps the EXE as the preferred runtime; skip .py when an .exe exists.
            #[cfg(windows)]
            {
                continue;
            }
            #[cfg(not(windows))]
            {
                return Some(AgentLaunch::Python(path));
            }
        }
        if ext == "exe" {
            #[cfg(windows)]
            {
                return Some(AgentLaunch::Exe(path));
            }
            #[cfg(not(windows))]
            {
                continue;
            }
        }
        // Extensionless unix binary
        #[cfg(not(windows))]
        {
            return Some(AgentLaunch::Exe(path));
        }
    }
    None
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

fn info_for_launch(launch: Option<&AgentLaunch>, running: bool) -> PcAgentInfo {
    match launch {
        Some(AgentLaunch::Exe(path)) => PcAgentInfo {
            available: true,
            path: Some(path.display().to_string()),
            running,
            hint: "Znaleziono esp32-pc-agent.exe — możesz uruchomić go z poziomu Studio."
                .to_string(),
        },
        Some(AgentLaunch::Python(path)) => PcAgentInfo {
            available: true,
            path: Some(path.display().to_string()),
            running,
            hint: "Znaleziono esp32_pc_agent.py — Studio uruchomi go przez lokalny Python 3 (pip install psutil requests)."
                .to_string(),
        },
        None => PcAgentInfo {
            available: false,
            path: None,
            running,
            hint: {
                #[cfg(windows)]
                {
                    "Brak spakowanego .exe. Pobierz z Releases albo zbuduj: scripts/windows/Build-PcAgent.ps1"
                        .to_string()
                }
                #[cfg(not(windows))]
                {
                    "Brak agenta PC. Na macOS/Linux zainstaluj Python 3, zależności (pip install psutil requests) i trzymaj tools/pc-agent/esp32_pc_agent.py w drzewie źródłowym / zasobach."
                        .to_string()
                }
            },
        },
    }
}

#[tauri::command]
pub fn get_pc_agent_info(app: AppHandle, state: State<'_, PcAgentState>) -> PcAgentInfo {
    let launch = resolve_agent_launch(&app);
    let running = is_running(&state);
    info_for_launch(launch.as_ref(), running)
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

    let launch = resolve_agent_launch(&app).ok_or_else(|| {
        #[cfg(windows)]
        {
            "Nie znaleziono esp32-pc-agent.exe w zasobach aplikacji. Zbuduj agenta lub dołącz go do releasu.".to_string()
        }
        #[cfg(not(windows))]
        {
            "Nie znaleziono esp32_pc_agent.py. Zainstaluj Python 3 i zależności, albo dołącz skrypt do zasobów aplikacji.".to_string()
        }
    })?;

    let path_display = match &launch {
        AgentLaunch::Exe(p) | AgentLaunch::Python(p) => p.display().to_string(),
    };

    let mut agent_cmd = match &launch {
        AgentLaunch::Exe(path) => Command::new(path),
        AgentLaunch::Python(path) => {
            let mut cmd = Command::new("python3");
            cmd.arg(path);
            cmd
        }
    };
    agent_cmd
        .arg("--host")
        .arg(&host)
        .arg("--port")
        .arg(port.to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    crate::process_util::hide_console(&mut agent_cmd);
    let child = agent_cmd.spawn().map_err(|e| {
        format!(
            "Nie uruchomiono agenta PC ({}): {e}. Na macOS/Linux upewnij się, że python3 i pakiety psutil/requests są dostępne.",
            path_display
        )
    })?;

    let mut guard = state
        .child
        .lock()
        .map_err(|_| "PcAgentState lock poisoned".to_string())?;
    *guard = Some(child);

    Ok(PcAgentInfo {
        available: true,
        path: Some(path_display),
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
