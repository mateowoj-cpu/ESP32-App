//! Channel-aware updater (stable / beta) using UpdaterBuilder::endpoints.
//!
//! Beta must never use stable `releases/latest`. Package-kind detection drives the
//! manual-download path for DEB and other non-updater installs.

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;
use url::Url;

const RELEASES_URL: &str = "https://github.com/mateowoj-cpu/ESP32-App/releases/latest";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelUpdateInfo {
    pub version: String,
    pub body: Option<String>,
    pub date: Option<String>,
    pub channel: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInstallInfo {
    pub os: String,
    pub package_kind: String,
    pub updater_supported: bool,
    pub manual_download_recommended: bool,
    pub releases_url: String,
}

fn endpoints_for(channel: &str) -> Result<Vec<Url>, String> {
    // Beta: dedicated tag only — never `releases/latest` (that is the stable channel).
    let list: &[&str] = match channel {
        "beta" => &[
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

fn detect_package_kind() -> &'static str {
    let exe = std::env::current_exe()
        .ok()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    let lower = exe.to_ascii_lowercase();

    #[cfg(target_os = "linux")]
    {
        if lower.contains(".appimage") || lower.contains("/tmp/.mount_") {
            return "appimage";
        }
        // System packages (DEB / RPM-style prefixes) do not use the Tauri updater.
        if lower.starts_with("/usr/") || lower.starts_with("/opt/") {
            return "deb";
        }
        "unknown"
    }
    #[cfg(target_os = "windows")]
    {
        let _ = lower;
        "nsis"
    }
    #[cfg(target_os = "macos")]
    {
        let _ = lower;
        "dmg"
    }
    #[cfg(not(any(target_os = "linux", target_os = "windows", target_os = "macos")))]
    {
        let _ = lower;
        "unknown"
    }
}

fn install_info_for_kind(kind: &str) -> UpdateInstallInfo {
    let (updater_supported, manual) = match kind {
        "appimage" | "nsis" | "msi" | "dmg" => (true, false),
        "deb" => (false, true),
        _ => (false, true),
    };
    UpdateInstallInfo {
        os: std::env::consts::OS.to_string(),
        package_kind: kind.to_string(),
        updater_supported,
        manual_download_recommended: manual,
        releases_url: RELEASES_URL.to_string(),
    }
}

#[tauri::command]
pub fn get_update_install_info() -> UpdateInstallInfo {
    install_info_for_kind(detect_package_kind())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn beta_endpoints_skip_stable_latest() {
        let urls = endpoints_for("beta").expect("parse");
        for u in urls {
            assert!(
                !u.as_str().contains("/releases/latest/"),
                "beta must not use stable latest: {u}"
            );
        }
    }

    #[test]
    fn deb_recommends_manual() {
        let info = install_info_for_kind("deb");
        assert!(!info.updater_supported);
        assert!(info.manual_download_recommended);
    }

    #[test]
    fn appimage_supports_updater() {
        let info = install_info_for_kind("appimage");
        assert!(info.updater_supported);
        assert!(!info.manual_download_recommended);
    }
}
