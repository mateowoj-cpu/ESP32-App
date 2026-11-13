//! Channel-aware updater (stable / beta) using UpdaterBuilder::endpoints.

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;
use url::Url;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelUpdateInfo {
    pub version: String,
    pub body: Option<String>,
    pub date: Option<String>,
    pub channel: String,
}

fn endpoints_for(channel: &str) -> Result<Vec<Url>, String> {
    let list: &[&str] = match channel {
        "beta" => &[
            "https://github.com/mateowoj-cpu/ESP32-App/releases/latest/download/latest-beta.json",
            "https://github.com/mateowoj-cpu/ESP32-App/releases/download/beta-channel/latest.json",
        ],
        _ => &[
            "https://github.com/mateowoj-cpu/ESP32-App/releases/latest/download/latest.json",
        ],
    };
    list.iter()
        .map(|u| Url::parse(u).map_err(|e| format!("Bad updater URL {u}: {e}")))
        .collect()
}

fn normalize_channel(channel: &str) -> &str {
    if channel.eq_ignore_ascii_case("beta") {
        "beta"
    } else {
        "stable"
    }
}

#[tauri::command]
pub async fn check_update_channel(
    app: AppHandle,
    channel: String,
) -> Result<Option<ChannelUpdateInfo>, String> {
    let channel = normalize_channel(&channel).to_string();
    let endpoints = endpoints_for(&channel)?;
    let updater = app
        .updater_builder()
        .endpoints(endpoints)
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?;

    match updater.check().await.map_err(|e| e.to_string())? {
        Some(update) => Ok(Some(ChannelUpdateInfo {
            version: update.version.clone(),
            body: update.body.clone(),
            date: update.date.map(|d| d.to_string()),
            channel,
        })),
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn download_and_install_channel(app: AppHandle, channel: String) -> Result<(), String> {
    let channel = normalize_channel(&channel).to_string();
    let endpoints = endpoints_for(&channel)?;
    let updater = app
        .updater_builder()
        .endpoints(endpoints)
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?;

    let Some(update) = updater.check().await.map_err(|e| e.to_string())? else {
        return Err("Brak dostępnej aktualizacji dla wybranego kanału.".into());
    };

    update
        .download_and_install(|_chunk, _progress| {}, || {})
        .await
        .map_err(|e| e.to_string())?;

    app.restart();
    #[allow(unreachable_code)]
    Ok(())
}
