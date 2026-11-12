mod flash;
mod pc_agent;
mod serial;

use flash::{flash_write_firmware, get_esptool_info, read_open_file};
use pc_agent::{get_pc_agent_info, start_pc_agent, stop_pc_agent, PcAgentState};
use serial::{
    close_serial_port, list_serial_ports, open_serial_port, write_serial_port, SerialManager,
};
use tauri::{Emitter, Manager};

fn emit_open_paths(app: &tauri::AppHandle, args: &[String]) {
    let paths: Vec<String> = args
        .iter()
        .filter(|a| flash::classify_cli_arg(a))
        .cloned()
        .collect();
    if !paths.is_empty() {
        let _ = app.emit("app-open-paths", paths);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            emit_open_paths(app, &argv);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .manage(SerialManager::default())
        .manage(PcAgentState::default())
        .invoke_handler(tauri::generate_handler![
            list_serial_ports,
            open_serial_port,
            write_serial_port,
            close_serial_port,
            get_pc_agent_info,
            start_pc_agent,
            stop_pc_agent,
            get_esptool_info,
            flash_write_firmware,
            read_open_file
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Deep links: esp32studio://open?path=... or esp32studio://import/<file>
            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let handle = app.handle().clone();
                let _ = app.deep_link().on_open_url(move |event| {
                    let urls: Vec<String> = event.urls().iter().map(|u| u.to_string()).collect();
                    let _ = handle.emit("app-open-paths", urls);
                });
            }

            // Cold start: files / URLs passed as CLI args
            let args: Vec<String> = std::env::args().skip(1).collect();
            emit_open_paths(app.handle(), &args);

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building ESP32 Display Studio (Tauri)")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(state) = app_handle.try_state::<PcAgentState>() {
                    pc_agent::stop_on_exit(&state);
                }
            }
        });
}
