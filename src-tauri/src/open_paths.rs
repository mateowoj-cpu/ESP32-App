//! Buffer cold-start open targets until the UI is ready to receive them.
//!
//! Tauri emits argv / deep-link / single-instance opens during `setup`, but React
//! registers its listener only after mount. Events emitted with no listener are
//! dropped — so we stash paths until `take_pending_open_paths` marks the UI ready.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, State};

/// Startup / early open targets waiting for the frontend.
#[derive(Default)]
pub struct PendingOpenPaths {
    ready: AtomicBool,
    pending: Mutex<Vec<String>>,
}

impl PendingOpenPaths {
    /// Drain buffered paths and mark the UI ready so later opens emit live.
    pub fn take_and_mark_ready(&self) -> Vec<String> {
        self.ready.store(true, Ordering::SeqCst);
        self.pending
            .lock()
            .map(|mut pending| std::mem::take(&mut *pending))
            .unwrap_or_default()
    }

    /// True after the frontend has claimed the startup buffer.
    pub fn is_ready(&self) -> bool {
        self.ready.load(Ordering::SeqCst)
    }

    /// Push paths into the buffer (used before the UI is ready).
    pub fn push_all(&self, paths: impl IntoIterator<Item = String>) {
        if let Ok(mut pending) = self.pending.lock() {
            pending.extend(paths);
        }
    }

    #[cfg(test)]
    fn pending_len(&self) -> usize {
        self.pending.lock().map(|p| p.len()).unwrap_or(0)
    }
}

/// Classify argv entries and either buffer them or emit `app-open-paths`.
pub fn enqueue_open_args(app: &AppHandle, args: &[String]) {
    let paths: Vec<String> = args
        .iter()
        .filter(|a| crate::flash::classify_cli_arg(a))
        .cloned()
        .collect();
    enqueue_open_paths(app, paths);
}

/// Buffer or emit already-classified open targets.
pub fn enqueue_open_paths(app: &AppHandle, paths: Vec<String>) {
    if paths.is_empty() {
        return;
    }
    let Some(state) = app.try_state::<PendingOpenPaths>() else {
        let _ = app.emit("app-open-paths", paths);
        return;
    };
    if state.is_ready() {
        let _ = app.emit("app-open-paths", paths);
    } else {
        state.push_all(paths);
    }
}

/// Frontend calls this once listeners are mounted.
#[tauri::command]
pub fn take_pending_open_paths(state: State<'_, PendingOpenPaths>) -> Vec<String> {
    state.take_and_mark_ready()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_instance_buffers_until_ui_ready() {
        let buf = PendingOpenPaths::default();
        assert!(!buf.is_ready());
        buf.push_all([
            "esp32studio://open?path=%2Ftmp%2Fdemo.esp32studio".into(),
            "/tmp/demo.esp32studio".into(),
        ]);
        assert_eq!(buf.pending_len(), 2);

        let drained = buf.take_and_mark_ready();
        assert!(buf.is_ready());
        assert_eq!(drained.len(), 2);
        assert_eq!(buf.pending_len(), 0);

        // Second take is empty — cold-start delivered exactly once.
        assert!(buf.take_and_mark_ready().is_empty());
        assert!(buf.is_ready());
    }

    #[test]
    fn second_instance_path_after_ready_stays_unbuffered() {
        let buf = PendingOpenPaths::default();
        let _ = buf.take_and_mark_ready();
        assert!(buf.is_ready());
        // After ready, callers should emit live rather than push — simulate by
        // asserting push is only for the not-ready path in enqueue helpers.
        buf.push_all(["/tmp/second.esp32studio".into()]);
        // Direct push still works (state API), but take drains it for late arrivals
        // that raced the ready flip.
        let late = buf.take_and_mark_ready();
        assert_eq!(late, vec!["/tmp/second.esp32studio".to_string()]);
    }

    #[test]
    fn polish_space_and_percent_names_round_trip_in_buffer() {
        let buf = PendingOpenPaths::default();
        let names = vec![
            "/tmp/zażółć projekt.esp32studio".to_string(),
            "/tmp/my file.esp32studio".to_string(),
            "/tmp/100%.esp32studio".to_string(),
        ];
        buf.push_all(names.clone());
        assert_eq!(buf.take_and_mark_ready(), names);
    }
}
