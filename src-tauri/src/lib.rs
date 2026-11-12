mod serial;

use serial::{
    close_serial_port, list_serial_ports, open_serial_port, write_serial_port, SerialManager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SerialManager::default())
        .invoke_handler(tauri::generate_handler![
            list_serial_ports,
            open_serial_port,
            write_serial_port,
            close_serial_port
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
        .run(tauri::generate_context!())
        .expect("error while running ESP32 Display Studio (Tauri)");
}
