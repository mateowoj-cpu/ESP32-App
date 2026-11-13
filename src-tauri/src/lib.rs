mod desktop;
mod diagnostics;
mod firmware_build;
mod flash;
mod ota;
mod pc_agent;
mod serial;
mod update_channel;

use desktop::{
    get_desktop_status, set_app_autostart, set_close_to_tray, set_pc_agent_autostart,
    show_main_window, DesktopPrefs,
};
use diagnostics::{
    append_diagnostics_log, get_diagnostics_log_path, open_diagnostics_folder,
    set_diagnostics_enabled, DiagnosticsState,
};
use firmware_build::{build_firmware_from_sketch, get_firmware_toolchain_info};
use flash::{flash_write_firmware, get_esptool_info, read_open_file};
use ota::{flash_ota_firmware, get_ota_tool_info};
use pc_agent::{get_pc_agent_info, start_pc_agent, stop_pc_agent, PcAgentState};
use serial::{
    close_serial_port, list_serial_ports, open_serial_port, write_serial_port, SerialManager,
};
use update_channel::{check_update_channel, download_and_install_channel};
use tauri::{Emitter, Manager};
use tauri_plugin_autostart::MacosLauncher;

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
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            emit_open_paths(app, &argv);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .manage(SerialManager::default())
        .manage(PcAgentState::default())
        .manage(DesktopPrefs::default())
        .manage(DiagnosticsState::default())
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
            read_open_file,
            get_firmware_toolchain_info,
            build_firmware_from_sketch,
            get_ota_tool_info,
            flash_ota_firmware,
            get_desktop_status,
            set_app_autostart,
            set_pc_agent_autostart,
            set_close_to_tray,
            show_main_window,
            check_update_channel,
            download_and_install_channel,
            set_diagnostics_enabled,
            append_diagnostics_log,
            get_diagnostics_log_path,
            open_diagnostics_folder
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(desktop)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let handle = app.handle().clone();
                let _ = app.deep_link().on_open_url(move |event| {
                    let urls: Vec<String> = event.urls().iter().map(|u| u.to_string()).collect();
                    let _ = handle.emit("app-open-paths", urls);
                });

                desktop::setup_tray(app.handle())?;
                desktop::attach_close_to_tray(app.handle());
            }

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
