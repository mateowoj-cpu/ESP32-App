//! Windows console suppression for background subprocesses.
//!
//! On Windows, `Command::output()` / `spawn()` of console subsystem binaries
//! (`where.exe`, `py.exe`, `.cmd` shims, esptool, pio, …) briefly flash a CMD
//! window. That shows up when USB / Flash Helper or Desktop Settings probe
//! toolchains. Apply [`hide_console`] to every background probe and build /
//! flash / OTA / agent child. GUI launches (explorer, IDE) are also safe to
//! mark — CREATE_NO_WINDOW only suppresses a *new console*, not the GUI.

use std::path::PathBuf;
use std::process::Command;

/// `CREATE_NO_WINDOW` (0x08000000) — do not allocate a console for the child.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

/// Suppress the console window for background children on Windows. No-op elsewhere.
#[inline]
pub fn hide_console(cmd: &mut Command) -> &mut Command {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

/// Locate an executable on PATH via `where` (Windows) / `which` (Unix),
/// without flashing a console window on Windows.
pub fn which(bin: &str) -> Option<PathBuf> {
    let candidates = if cfg!(windows) {
        vec![
            format!("{bin}.exe"),
            format!("{bin}.cmd"),
            format!("{bin}.bat"),
            bin.to_string(),
        ]
    } else {
        vec![bin.to_string()]
    };

    for name in candidates {
        let mut cmd = if cfg!(windows) {
            let mut c = Command::new("where");
            c.arg(&name);
            c
        } else {
            let mut c = Command::new("which");
            c.arg(&name);
            c
        };
        hide_console(&mut cmd);
        if let Ok(output) = cmd.output() {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Some(line) = stdout.lines().next() {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() {
                        return Some(PathBuf::from(trimmed));
                    }
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hide_console_is_chainable() {
        let mut cmd = Command::new("echo");
        let same = hide_console(&mut cmd) as *const Command;
        assert_eq!(same, &cmd as *const Command);
    }

    #[test]
    fn which_finds_common_shell_helper() {
        // `where` / `which` themselves should resolve without panicking.
        #[cfg(windows)]
        {
            assert!(which("where").is_some() || which("cmd").is_some());
        }
        #[cfg(not(windows))]
        {
            assert!(which("sh").is_some() || which("which").is_some());
        }
    }
}
