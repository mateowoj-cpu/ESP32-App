//! Constrained native HTTP(S) GET for WebView-blocked destinations
//! (e.g. custom `http://homeassistant.local` weather endpoints under CSP).

use std::process::{Command, Stdio};

use url::Url;

use crate::process_util::{hide_console, which};

const MAX_BYTES: usize = 256 * 1024;
const TIMEOUT_SECS: &str = "15";

/// Validate and normalize a URL allowed for the native weather/integration fetch.
pub fn validate_fetch_url(raw: &str) -> Result<String, String> {
    let parsed = Url::parse(raw.trim()).map_err(|e| format!("Nieprawidłowy URL: {e}"))?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("Dozwolone tylko http(s)".into());
    }
    if parsed.host_str().is_none() {
        return Err("URL musi mieć host".into());
    }
    // Reject credentials in URL — custom weather endpoints should not embed secrets this way.
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("URL z użytkownikiem/hasłem jest niedozwolony".into());
    }
    Ok(parsed.as_str().to_string())
}

/// GET `url` via system `curl` with size/time limits. Used when WebView CSP blocks `http:`.
#[tauri::command]
pub fn fetch_url_text(url: String) -> Result<String, String> {
    let safe = validate_fetch_url(&url)?;
    let curl = which("curl").ok_or_else(|| {
        "Brak `curl` w PATH — wymagany do pobrania niestandardowego endpointu pogodowego.".to_string()
    })?;

    let mut cmd = Command::new(&curl);
    cmd.args([
        "-fsSL",
        "--max-time",
        TIMEOUT_SECS,
        "--max-filesize",
        &MAX_BYTES.to_string(),
        "--proto-redir",
        "=http,https",
        "--",
        &safe,
    ])
    .stdin(Stdio::null())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());
    hide_console(&mut cmd);

    let output = cmd
        .output()
        .map_err(|e| format!("Nie uruchomiono curl: {e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let detail = stderr.trim();
        if detail.is_empty() {
            return Err(format!(
                "curl zakończył się błędem (status {})",
                output.status
            ));
        }
        return Err(format!("curl: {detail}"));
    }
    if output.stdout.len() > MAX_BYTES {
        return Err(format!(
            "Odpowiedź przekracza limit {MAX_BYTES} bajtów"
        ));
    }
    String::from_utf8(output.stdout).map_err(|e| format!("Odpowiedź nie jest UTF-8: {e}"))
}

#[cfg(test)]
mod tests {
    use super::validate_fetch_url;

    #[test]
    fn accepts_http_local_weather() {
        let u = validate_fetch_url("http://homeassistant.local:8123/api/states/sensor.temp").unwrap();
        assert!(u.starts_with("http://homeassistant.local:8123/"));
    }

    #[test]
    fn rejects_non_http_and_embedded_creds() {
        assert!(validate_fetch_url("file:///etc/passwd").is_err());
        assert!(validate_fetch_url("javascript:alert(1)").is_err());
        assert!(validate_fetch_url("http://user:pass@evil.example/x").is_err());
    }
}
