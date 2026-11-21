//! Buffer cold-start open targets until the UI is ready to receive them.
//!
//! Tauri emits argv / deep-link / single-instance opens during `setup`, but React
//! registers its listener only after mount. Events emitted with no listener are
//! dropped — so we stash paths until `take_pending_open_paths` marks the UI ready.

use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager, State};

struct PendingInner {
    ready: bool,
    paths: Vec<String>,
}

impl Default for PendingInner {
    fn default() -> Self {
        Self {
            ready: false,
            paths: Vec::new(),
        }
    }
}

/// Startup / early open targets waiting for the frontend.
///
/// Readiness and the path buffer share one mutex so an open that races the
/// initial drain cannot observe `ready == false`, pause across
/// `take_and_mark_ready`, then push into an emptied buffer that nobody drains.
#[derive(Default)]
pub struct PendingOpenPaths {
    inner: Mutex<PendingInner>,
}

/// Result of trying to enqueue while holding the readiness lock.
pub enum EnqueueDecision {
    /// UI not ready — paths were appended to the buffer.
    Buffered,
    /// UI ready — caller must emit live (`app-open-paths`).
    EmitLive(Vec<String>),
}

impl PendingOpenPaths {
    /// Drain buffered paths and mark the UI ready so later opens emit live.
    pub fn take_and_mark_ready(&self) -> Vec<String> {
        self.inner
            .lock()
            .map(|mut inner| {
                inner.ready = true;
                std::mem::take(&mut inner.paths)
            })
            .unwrap_or_default()
    }

    /// Atomically either buffer paths or hand them back for live emit.
    pub fn enqueue(&self, paths: Vec<String>) -> EnqueueDecision {
        if paths.is_empty() {
            return EnqueueDecision::Buffered;
        }
        match self.inner.lock() {
            Ok(mut inner) => {
                if inner.ready {
                    EnqueueDecision::EmitLive(paths)
                } else {
                    inner.paths.extend(paths);
                    EnqueueDecision::Buffered
                }
            }
            Err(_) => EnqueueDecision::EmitLive(paths),
        }
    }

    /// True after the frontend has claimed the startup buffer.
    pub fn is_ready(&self) -> bool {
        self.inner
            .lock()
            .map(|inner| inner.ready)
            .unwrap_or(false)
    }

    #[cfg(test)]
    fn pending_len(&self) -> usize {
        self.inner.lock().map(|inner| inner.paths.len()).unwrap_or(0)
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
    match state.enqueue(paths) {
        EnqueueDecision::Buffered => {}
        EnqueueDecision::EmitLive(paths) => {
            let _ = app.emit("app-open-paths", paths);
        }
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
        assert!(matches!(
            buf.enqueue(vec![
                "esp32studio://open?path=%2Ftmp%2Fdemo.esp32studio".into(),
                "/tmp/demo.esp32studio".into(),
            ]),
            EnqueueDecision::Buffered
        ));
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
    fn second_instance_after_ready_emits_live() {
        let buf = PendingOpenPaths::default();
        let _ = buf.take_and_mark_ready();
        assert!(buf.is_ready());
        match buf.enqueue(vec!["/tmp/second.esp32studio".into()]) {
            EnqueueDecision::EmitLive(paths) => {
                assert_eq!(paths, vec!["/tmp/second.esp32studio".to_string()]);
            }
            EnqueueDecision::Buffered => panic!("expected live emit after ready"),
        }
        assert_eq!(buf.pending_len(), 0);
    }

    #[test]
    fn enqueue_during_drain_cannot_strand_paths() {
        // Simulate the race Codex flagged: observe not-ready, then drain flips
        // ready, then a late enqueue must still emit (not push into a dead buffer).
        let buf = PendingOpenPaths::default();
        assert!(matches!(
            buf.enqueue(vec!["/tmp/cold.esp32studio".into()]),
            EnqueueDecision::Buffered
        ));
        let drained = buf.take_and_mark_ready();
        assert_eq!(drained, vec!["/tmp/cold.esp32studio".to_string()]);

        // Any open that loses the race and calls enqueue after drain must EmitLive.
        match buf.enqueue(vec!["/tmp/raced.esp32studio".into()]) {
            EnqueueDecision::EmitLive(paths) => {
                assert_eq!(paths, vec!["/tmp/raced.esp32studio".to_string()]);
            }
            EnqueueDecision::Buffered => panic!("raced open stranded in buffer"),
        }
        assert_eq!(buf.pending_len(), 0);
        assert!(buf.take_and_mark_ready().is_empty());
    }

    #[test]
    fn polish_space_and_percent_names_round_trip_in_buffer() {
        let buf = PendingOpenPaths::default();
        let names = vec![
            "/tmp/zażółć projekt.esp32studio".to_string(),
            "/tmp/my file.esp32studio".to_string(),
            "/tmp/100%.esp32studio".to_string(),
        ];
        assert!(matches!(buf.enqueue(names.clone()), EnqueueDecision::Buffered));
        assert_eq!(buf.take_and_mark_ready(), names);
    }
}
