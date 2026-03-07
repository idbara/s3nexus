use std::sync::mpsc;
use std::time::Duration;

use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::db::models::MonitorConfig;
use crate::error::AppError;

/// Event payload emitted when the folder watcher detects a file change.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorFileChangedEvent {
    /// The absolute path of the changed file.
    pub file_path: String,
    /// The kind of change: "create", "modify", or "remove".
    pub change_kind: String,
    /// The associated monitor configuration.
    pub monitor: MonitorConfig,
}

/// Wraps a `notify::RecommendedWatcher` for a single folder monitor.
pub struct FolderWatcher {
    _watcher: RecommendedWatcher,
    /// A sender that, when dropped, signals the debounce thread to stop.
    _stop_tx: mpsc::Sender<()>,
}

impl FolderWatcher {
    /// Start watching the directory specified in `config`.
    ///
    /// File-system events are debounced by 500ms and emitted as
    /// `"monitor-file-changed"` Tauri events.
    pub fn start(config: MonitorConfig, app: AppHandle) -> Result<Self, AppError> {
        let local_path = config.local_path.clone();
        let path = std::path::Path::new(&local_path);

        if !path.exists() || !path.is_dir() {
            return Err(AppError::InvalidInput(format!(
                "Monitor path does not exist or is not a directory: {}",
                local_path
            )));
        }

        // Channel for raw notify events
        let (event_tx, event_rx) = mpsc::channel::<Event>();

        // Channel to signal the debounce thread to stop
        let (stop_tx, stop_rx) = mpsc::channel::<()>();

        // Create the watcher
        let mut watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    let _ = event_tx.send(event);
                }
            },
            Config::default(),
        )
        .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        watcher
            .watch(path, RecursiveMode::Recursive)
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        // Spawn a thread that debounces events (500ms) and emits Tauri events
        let monitor_config = config.clone();
        std::thread::spawn(move || {
            use std::collections::HashMap;

            let debounce_duration = Duration::from_millis(500);
            // Map from file path to the latest change kind
            let mut pending: HashMap<String, String> = HashMap::new();
            let mut last_flush = std::time::Instant::now();

            loop {
                // Check if stop signal was received
                if stop_rx.try_recv().is_ok() {
                    break;
                }

                // Try to receive events with a timeout
                match event_rx.recv_timeout(Duration::from_millis(100)) {
                    Ok(event) => {
                        let change_kind = match event.kind {
                            notify::EventKind::Create(_) => "create",
                            notify::EventKind::Modify(_) => "modify",
                            notify::EventKind::Remove(_) => "remove",
                            _ => continue,
                        };

                        for path in &event.paths {
                            // Only track files, not directories
                            if path.is_file() || !path.exists() {
                                let path_str = path.to_string_lossy().to_string();
                                pending.insert(path_str, change_kind.to_string());
                            }
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {
                        // No events received, check debounce
                    }
                    Err(mpsc::RecvTimeoutError::Disconnected) => {
                        // Watcher was dropped, flush and exit
                        flush_pending(&pending, &monitor_config, &app);
                        break;
                    }
                }

                // Flush pending events if debounce period has elapsed
                if !pending.is_empty()
                    && last_flush.elapsed() >= debounce_duration
                {
                    flush_pending(&pending, &monitor_config, &app);
                    pending.clear();
                    last_flush = std::time::Instant::now();
                }
            }
        });

        Ok(FolderWatcher {
            _watcher: watcher,
            _stop_tx: stop_tx,
        })
    }

    /// Stop the watcher. The underlying `notify` watcher is dropped when
    /// this struct is dropped, and the debounce thread exits via the stop channel.
    pub fn stop(&mut self) {
        // Sending on _stop_tx signals the debounce thread.
        // If the channel is already closed (thread exited), this is a no-op.
        let _ = self._stop_tx.send(());
    }
}

/// Emit debounced file-change events to the Tauri frontend.
fn flush_pending(
    pending: &std::collections::HashMap<String, String>,
    config: &MonitorConfig,
    app: &AppHandle,
) {
    for (file_path, change_kind) in pending {
        let event = MonitorFileChangedEvent {
            file_path: file_path.clone(),
            change_kind: change_kind.clone(),
            monitor: config.clone(),
        };
        let _ = app.emit("monitor-file-changed", event);
    }
}
