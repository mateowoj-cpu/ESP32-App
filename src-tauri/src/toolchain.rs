//! Shared PlatformIO / esptool resolution.
//!
//! Single order for Settings probes and build/flash execution:
//! **override → env → sidecar → PATH**.
//! Every hit returns a stable `source` label so the UI path matches the binary
//! that build / flash actually spawn.

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Manager};

use crate::process_util::{hide_console, which};
use crate::tools::{override_esptool, override_platformio};

/// Labels returned to UI / IPC (`camelCase` JSON elsewhere maps these as-is).
pub const SRC_OVERRIDE: &str = "override";
pub const SRC_ENV: &str = "env";
pub const SRC_SIDECAR: &str = "sidecar";
pub const SRC_PATH: &str = "path";
pub const SRC_NONE: &str = "none";

/// Cap for `--version` / `version` probes so a hung tool cannot block Settings.
pub const VERSION_PROBE_TIMEOUT: Duration = Duration::from_secs(8);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedBinary {
    pub path: PathBuf,
    pub source: &'static str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedCommand {
    /// argv prefix used to invoke the tool (may be multi-arg for `python -m esptool`).
    pub argv: Vec<String>,
    pub source: &'static str,
}

impl ResolvedCommand {
    /// Path string shown in Settings — must match what flash uses.
    pub fn display_path(&self) -> String {
        if self.argv.len() >= 3
            && self.argv.iter().any(|a| a == "-m")
            && self.argv.last().map(|s| s.as_str()) == Some("esptool")
        {
            // Keep Settings readable: "…/python -m esptool"
            format!("{} -m esptool", self.argv[0])
        } else if let Some(first) = self.argv.first() {
            first.clone()
        } else {
            String::new()
        }
    }
}

fn path_is_file(p: &Path) -> bool {
    p.is_file()
}

fn kill_pid(pid: u32) {
    #[cfg(windows)]
    {
        let mut cmd = Command::new("taskkill");
        cmd.args(["/PID", &pid.to_string(), "/T", "/F"])
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        hide_console(&mut cmd);
        let _ = cmd.status();
    }
    #[cfg(not(windows))]
    {
        let mut cmd = Command::new("kill");
        cmd.args(["-KILL", &pid.to_string()])
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        hide_console(&mut cmd);
        let _ = cmd.status();
    }
}

/// Run a short probe with a hard timeout; kill the child if it hangs.
pub fn output_with_timeout(mut cmd: Command, timeout: Duration) -> Option<std::process::Output> {
    hide_console(&mut cmd);
    cmd.stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let child = cmd.spawn().ok()?;
    let pid = child.id();
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let _ = tx.send(child.wait_with_output());
    });
    match rx.recv_timeout(timeout) {
        Ok(Ok(output)) => Some(output),
        Ok(Err(_)) => None,
        Err(_) => {
            kill_pid(pid);
            // Reap so we do not leave a zombie; ignore late output.
            let _ = rx.recv_timeout(Duration::from_secs(2));
            None
        }
    }
}

/// Probe `bin args…` for a version line (first non-empty stdout/stderr line).
pub fn version_of(bin: &Path, args: &[&str]) -> Option<String> {
    let mut cmd = Command::new(bin);
    cmd.args(args);
    let output = output_with_timeout(cmd, VERSION_PROBE_TIMEOUT)?;
    first_version_line(&output, true)
}

/// Probe a multi-arg command (e.g. `python -m esptool version`).
pub fn version_of_argv(argv: &[String], version_args: &[&str]) -> Option<String> {
    let (bin, prefix) = argv.split_first()?;
    let mut cmd = Command::new(bin);
    cmd.args(prefix).args(version_args);
    let output = output_with_timeout(cmd, VERSION_PROBE_TIMEOUT)?;
    first_version_line(&output, true)
}

fn first_version_line(output: &std::process::Output, require_success: bool) -> Option<String> {
    if require_success && !output.status.success() {
        return None;
    }
    let text = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    let line = text.lines().next()?.trim();
    if line.is_empty() {
        None
    } else {
        Some(line.to_string())
    }
}

/// Pure resolve: override → env → sidecar files → PATH binaries.
pub fn resolve_binary_order(
    override_path: Option<&Path>,
    env_path: Option<&Path>,
    sidecar_candidates: &[PathBuf],
    path_candidates: &[PathBuf],
) -> Option<ResolvedBinary> {
    if let Some(p) = override_path {
        if path_is_file(p) {
            return Some(ResolvedBinary {
                path: p.to_path_buf(),
                source: SRC_OVERRIDE,
            });
        }
    }
    if let Some(p) = env_path {
        if path_is_file(p) {
            return Some(ResolvedBinary {
                path: p.to_path_buf(),
                source: SRC_ENV,
            });
        }
    }
    for cand in sidecar_candidates {
        if path_is_file(cand) {
            return Some(ResolvedBinary {
                path: cand.clone(),
                source: SRC_SIDECAR,
            });
        }
    }
    for cand in path_candidates {
        if path_is_file(cand) {
            return Some(ResolvedBinary {
                path: cand.clone(),
                source: SRC_PATH,
            });
        }
    }
    None
}

pub fn platformio_sidecar_candidates(
    local_data: Option<&Path>,
    resource_dir: Option<&Path>,
) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let push_base = |out: &mut Vec<PathBuf>, base: PathBuf| {
        if cfg!(windows) {
            out.push(base.join("penv").join("Scripts").join("pio.exe"));
            out.push(base.join("penv").join("Scripts").join("platformio.exe"));
            out.push(base.join("pio.exe"));
        } else {
            out.push(base.join("penv").join("bin").join("pio"));
            out.push(base.join("penv").join("bin").join("platformio"));
            out.push(base.join("pio"));
        }
    };
    if let Some(dir) = local_data {
        push_base(&mut out, dir.join("sidecar").join("platformio"));
    }
    if let Some(res) = resource_dir {
        let base = res.join("sidecar").join("platformio");
        if cfg!(windows) {
            out.push(base.join("penv").join("Scripts").join("pio.exe"));
            out.push(base.join("pio.exe"));
        } else {
            out.push(base.join("penv").join("bin").join("pio"));
            out.push(base.join("pio"));
        }
    }
    out
}

pub fn esptool_sidecar_candidates(
    local_data: Option<&Path>,
    resource_dir: Option<&Path>,
) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let push_base = |out: &mut Vec<PathBuf>, base: PathBuf| {
        if cfg!(windows) {
            out.push(base.join("penv").join("Scripts").join("esptool.exe"));
            out.push(base.join("penv").join("Scripts").join("esptool.py"));
            out.push(base.join("esptool.exe"));
        } else {
            out.push(base.join("penv").join("bin").join("esptool"));
            out.push(base.join("penv").join("bin").join("esptool.py"));
            out.push(base.join("esptool"));
        }
    };
    if let Some(dir) = local_data {
        push_base(&mut out, dir.join("sidecar").join("platformio"));
    }
    if let Some(res) = resource_dir {
        push_base(&mut out, res.join("sidecar").join("platformio"));
    }
    out
}

fn env_file(var: &str) -> Option<PathBuf> {
    std::env::var(var).ok().and_then(|raw| {
        let p = PathBuf::from(raw.trim());
        if path_is_file(&p) {
            Some(p)
        } else {
            None
        }
    })
}

fn app_dirs(app: &AppHandle) -> (Option<PathBuf>, Option<PathBuf>) {
    let local = app.path().app_local_data_dir().ok();
    let resource = app.path().resource_dir().ok();
    (local, resource)
}

/// Shared PlatformIO resolve used by Settings and firmware build.
pub fn resolve_platformio(app: &AppHandle) -> Option<ResolvedBinary> {
    let override_path = override_platformio(app);
    let env_path = env_file("ESP32_STUDIO_PIO");
    let (local, resource) = app_dirs(app);
    let sidecar = platformio_sidecar_candidates(local.as_deref(), resource.as_deref());
    let path_bins: Vec<PathBuf> = which("pio")
        .into_iter()
        .chain(which("platformio"))
        .collect();
    resolve_binary_order(
        override_path.as_deref(),
        env_path.as_deref(),
        &sidecar,
        &path_bins,
    )
}

fn python_bins() -> Vec<&'static str> {
    if cfg!(windows) {
        vec!["py", "python", "python3"]
    } else {
        vec!["python3", "python"]
    }
}

fn probe_python_esptool() -> Option<Vec<String>> {
    for py in python_bins() {
        let Some(py_path) = which(py) else { continue };
        let argv = if py == "py" {
            vec![
                py_path.display().to_string(),
                "-3".into(),
                "-m".into(),
                "esptool".into(),
            ]
        } else {
            vec![
                py_path.display().to_string(),
                "-m".into(),
                "esptool".into(),
            ]
        };
        // Timed probe — same timeout as Settings / flash version checks.
        if version_of_argv(&argv, &["version"]).is_some()
            || version_of_argv(&argv, &["--version"]).is_some()
        {
            return Some(argv);
        }
    }
    None
}

/// Shared esptool resolve used by Settings and flash.
pub fn resolve_esptool(app: &AppHandle) -> Option<ResolvedCommand> {
    if let Some(path) = override_esptool(app) {
        return Some(ResolvedCommand {
            argv: vec![path.display().to_string()],
            source: SRC_OVERRIDE,
        });
    }
    if let Some(path) = env_file("ESP32_STUDIO_ESPTOOL") {
        return Some(ResolvedCommand {
            argv: vec![path.display().to_string()],
            source: SRC_ENV,
        });
    }
    let (local, resource) = app_dirs(app);
    for cand in esptool_sidecar_candidates(local.as_deref(), resource.as_deref()) {
        if path_is_file(&cand) {
            return Some(ResolvedCommand {
                argv: vec![cand.display().to_string()],
                source: SRC_SIDECAR,
            });
        }
    }
    if let Some(path) = which("esptool").or_else(|| which("esptool.py")) {
        return Some(ResolvedCommand {
            argv: vec![path.display().to_string()],
            source: SRC_PATH,
        });
    }
    probe_python_esptool().map(|argv| ResolvedCommand {
        argv,
        source: SRC_PATH,
    })
}

/// esptool version: try `version`, then `--version` (older builds).
pub fn esptool_version(argv: &[String]) -> Option<String> {
    version_of_argv(argv, &["version"]).or_else(|| version_of_argv(argv, &["--version"]))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::io::Write;

    fn touch_file(path: &Path) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        let mut f = fs::File::create(path).unwrap();
        let _ = f.write_all(b"x");
    }

    fn temp_dir(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "esp32-toolchain-{}-{}-{}",
            label,
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn resolve_order_override_beats_env_sidecar_path() {
        let root = temp_dir("order");
        let ov = root.join("override-pio");
        let env = root.join("env-pio");
        let side = root.join("sidecar").join("pio");
        let path = root.join("path-pio");
        touch_file(&ov);
        touch_file(&env);
        touch_file(&side);
        touch_file(&path);

        let hit = resolve_binary_order(
            Some(&ov),
            Some(&env),
            &[side.clone()],
            &[path.clone()],
        )
        .expect("override");
        assert_eq!(hit.source, SRC_OVERRIDE);
        assert_eq!(hit.path, ov);

        let hit = resolve_binary_order(None, Some(&env), &[side.clone()], &[path.clone()])
            .expect("env");
        assert_eq!(hit.source, SRC_ENV);
        assert_eq!(hit.path, env);

        let hit = resolve_binary_order(None, None, &[side.clone()], &[path.clone()]).expect("side");
        assert_eq!(hit.source, SRC_SIDECAR);
        assert_eq!(hit.path, side);

        let hit = resolve_binary_order(None, None, &[], &[path.clone()]).expect("path");
        assert_eq!(hit.source, SRC_PATH);
        assert_eq!(hit.path, path);

        assert!(resolve_binary_order(None, None, &[], &[]).is_none());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn settings_path_matches_build_path_for_same_inputs() {
        // Settings (probe) and build must call the same pure resolver.
        let root = temp_dir("match");
        let ov = root.join("my-pio");
        touch_file(&ov);
        let settings = resolve_binary_order(Some(&ov), None, &[], &[]).unwrap();
        let build = resolve_binary_order(Some(&ov), None, &[], &[]).unwrap();
        assert_eq!(settings.path, build.path);
        assert_eq!(settings.source, build.source);
        assert_eq!(settings.source, SRC_OVERRIDE);
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn esptool_display_path_matches_flash_argv() {
        let cmd = ResolvedCommand {
            argv: vec!["/usr/bin/esptool".into()],
            source: SRC_PATH,
        };
        assert_eq!(cmd.display_path(), "/usr/bin/esptool");
        assert_eq!(cmd.argv[0], cmd.display_path());

        let py = ResolvedCommand {
            argv: vec![
                "/usr/bin/python3".into(),
                "-m".into(),
                "esptool".into(),
            ],
            source: SRC_PATH,
        };
        assert_eq!(py.display_path(), "/usr/bin/python3 -m esptool");
        // Flash still uses the full argv; Settings shows display_path.
        assert_eq!(py.argv[0], "/usr/bin/python3");
    }

    #[test]
    fn platformio_sidecar_layout_includes_penv() {
        let local = temp_dir("pio-side");
        let cands = platformio_sidecar_candidates(Some(&local), None);
        assert!(cands.iter().any(|p| {
            p.ends_with("penv/bin/pio") || p.ends_with(r"penv\Scripts\pio.exe")
        }));
        let _ = fs::remove_dir_all(&local);
    }

    #[test]
    fn esptool_sidecar_layout_includes_penv() {
        let local = temp_dir("esp-side");
        let cands = esptool_sidecar_candidates(Some(&local), None);
        assert!(cands.iter().any(|p| {
            p.ends_with("penv/bin/esptool") || p.ends_with(r"penv\Scripts\esptool.exe")
        }));
        let _ = fs::remove_dir_all(&local);
    }

    #[cfg(unix)]
    #[test]
    fn version_probe_times_out_on_hanging_binary() {
        use std::os::unix::fs::PermissionsExt;
        let root = temp_dir("hang");
        let hang = root.join("hang.sh");
        fs::write(&hang, "#!/bin/sh\nsleep 30\n").unwrap();
        let mut perms = fs::metadata(&hang).unwrap().permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&hang, perms).unwrap();

        let start = std::time::Instant::now();
        let out = output_with_timeout(Command::new(&hang), Duration::from_millis(250));
        assert!(out.is_none(), "hanging probe must time out");
        assert!(
            start.elapsed() < Duration::from_secs(3),
            "timeout should return quickly, got {:?}",
            start.elapsed()
        );
        let _ = fs::remove_dir_all(&root);
    }

    #[cfg(unix)]
    #[test]
    fn version_of_reads_echo_binary() {
        use std::os::unix::fs::PermissionsExt;
        let root = temp_dir("ver");
        let bin = root.join("ver.sh");
        fs::write(&bin, "#!/bin/sh\necho 'pio, version 6.1.0'\n").unwrap();
        let mut perms = fs::metadata(&bin).unwrap().permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&bin, perms).unwrap();
        let ver = version_of(&bin, &[]).expect("version");
        assert!(ver.contains("6.1.0"));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn missing_override_falls_through_to_env() {
        let root = temp_dir("fall");
        let missing = root.join("missing");
        let env = root.join("env-ok");
        touch_file(&env);
        let hit = resolve_binary_order(Some(&missing), Some(&env), &[], &[]).unwrap();
        assert_eq!(hit.source, SRC_ENV);
        assert_eq!(hit.path, env);
        let _ = fs::remove_dir_all(&root);
    }
}
