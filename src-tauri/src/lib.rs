mod desktop;
mod diagnostics;
mod firmware_build;
mod flash;
mod host_ides;
mod open_paths;
mod ota;
mod pc_agent;
mod process_util;
mod serial;
mod tools;
mod update_channel;

use desktop::{
    get_desktop_status, set_app_autostart, set_close_to_tray, set_pc_agent_autostart,
    show_main_window, DesktopPrefs,
};
use diagnostics::{
    append_diagnostics_log, export_diagnostics_zip, get_diagnostics_log_path,
    open_diagnostics_folder, set_diagnostics_enabled, DiagnosticsState,
};
use firmware_build::{build_firmware_from_sketch, get_firmware_toolchain_info};
use flash::{flash_write_firmware, get_esptool_info, read_open_file};
use host_ides::{
    install_platformio_vscode_extension, open_host_ide_download, start_winget_install,
};
use open_paths::{enqueue_open_args, enqueue_open_paths, take_pending_open_paths, PendingOpenPaths};
use tools::{
    export_and_open_arduino_ide, get_external_tools_status, get_tool_path_overrides,
    open_external_url, open_path_in_os, open_wokwi_simulator, set_tool_path_overrides,
};
use ota::{cancel_ota_firmware, discover_ota_hosts, flash_ota_firmware, get_ota_tool_info};
use pc_agent::{get_pc_agent_info, start_pc_agent, stop_pc_agent, PcAgentState};
use serial::{
    close_serial_port, list_serial_ports, open_serial_port, write_serial_port, SerialManager,
};
use update_channel::{check_update_channel, download_and_install_channel};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // Second instance: forward open targets (live emit once UI is ready).
            enqueue_open_args(app, &argv);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .manage(SerialManager::default())
        .manage(PcAgentState::default())
        .manage(DesktopPrefs::default())
        .manage(DiagnosticsState::default())
        .manage(PendingOpenPaths::default())
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
            get_external_tools_status,
            get_tool_path_overrides,
            set_tool_path_overrides,
            open_path_in_os,
            open_external_url,
            export_and_open_arduino_ide,
            open_wokwi_simulator,
            start_winget_install,
            open_host_ide_download,
            install_platformio_vscode_extension,
            get_ota_tool_info,
            flash_ota_firmware,
            cancel_ota_firmware,
            discover_ota_hosts,
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
            open_diagnostics_folder,
            export_diagnostics_zip,
            take_pending_open_paths
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
                    enqueue_open_paths(&handle, urls);
                });

                desktop::setup_tray(app.handle())?;
                desktop::attach_close_to_tray(app.handle());
            }

            // Cold start (first instance): buffer argv until the UI takes them.
            let args: Vec<String> = std::env::args().skip(1).collect();
            enqueue_open_args(app.handle(), &args);

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building ESP32 Display Studio (Tauri)")
        .run(|app_handle, event| {
            match event {
                tauri::RunEvent::Exit => {
                    if let Some(state) = app_handle.try_state::<PcAgentState>() {
                        pc_agent::stop_on_exit(&state);
                    }
                }
                // macOS Open With / Finder file associations deliver file URLs here.
                #[cfg(any(target_os = "macos", target_os = "ios"))]
                tauri::RunEvent::Opened { urls } => {
                    let paths: Vec<String> = urls.iter().map(|u| u.to_string()).collect();
                    enqueue_open_paths(app_handle, paths);
                }
                _ => {}
            }
        });
}
