mod pc_agent;
mod serial;

use pc_agent::{get_pc_agent_info, start_pc_agent, stop_pc_agent, PcAgentState};
use serial::{
    close_serial_port, list_serial_ports, open_serial_port, write_serial_port, SerialManager,
};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(SerialManager::default())
        .manage(PcAgentState::default())
        .invoke_handler(tauri::generate_handler![
            list_serial_ports,
            open_serial_port,
            write_serial_port,
            close_serial_port,
            get_pc_agent_info,
            start_pc_agent,
            stop_pc_agent
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
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
