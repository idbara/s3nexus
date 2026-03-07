use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;

use tauri::AppHandle;
use tokio::sync::{Mutex, Semaphore};
use tokio_util::sync::CancellationToken;

use crate::db::models::{TransferProgressEvent, TransferTask};
use crate::error::AppError;
use crate::transfer::download::download_with_progress;
use crate::transfer::events::emit_transfer_progress;
use crate::transfer::multipart::{multipart_upload, MultipartConfig};
use crate::transfer::throttle::BandwidthThrottle;

/// Threshold above which multipart upload is used (100 MB).
const MULTIPART_THRESHOLD: u64 = 100 * 1024 * 1024;

/// Maximum number of concurrent transfers.
const MAX_CONCURRENT_TRANSFERS: usize = 10;

/// Internal mutable state for a single transfer.
struct TransferTaskState {
    task: TransferTask,
    cancel_token: CancellationToken,
}

/// Manages concurrent S3 transfers (uploads and downloads).
///
/// The struct is cheaply cloneable because all interior state is
/// wrapped in `Arc`.
#[derive(Clone)]
pub struct TransferManager {
    tasks: Arc<Mutex<HashMap<String, TransferTaskState>>>,
    semaphore: Arc<Semaphore>,
    throttle: Arc<BandwidthThrottle>,
}

impl TransferManager {
    /// Create a new `TransferManager` with a 10-permit concurrency semaphore
    /// and no bandwidth limit.
    pub fn new() -> Self {
        Self {
            tasks: Arc::new(Mutex::new(HashMap::new())),
            semaphore: Arc::new(Semaphore::new(MAX_CONCURRENT_TRANSFERS)),
            throttle: Arc::new(BandwidthThrottle::new(0)), // 0 = unlimited
        }
    }

    // ---------------------------------------------------------------
    // Upload
    // ---------------------------------------------------------------

    /// Queue an upload transfer.
    ///
    /// Returns the transfer ID immediately. The upload runs in a
    /// background tokio task.
    pub async fn queue_upload(
        &self,
        app: AppHandle,
        client: aws_sdk_s3::Client,
        mut task: TransferTask,
    ) -> Result<String, AppError> {
        let transfer_id = task.id.clone();
        task.status = "queued".to_string();
        task.transfer_type = "upload".to_string();

        // Determine file size
        let metadata = std::fs::metadata(&task.file_path)?;
        task.file_size = metadata.len();

        let cancel_token = CancellationToken::new();

        {
            let mut tasks = self.tasks.lock().await;
            tasks.insert(
                transfer_id.clone(),
                TransferTaskState {
                    task: task.clone(),
                    cancel_token: cancel_token.clone(),
                },
            );
        }

        // Emit queued event
        emit_transfer_progress(
            &app,
            TransferProgressEvent {
                transfer_id: transfer_id.clone(),
                status: "queued".to_string(),
                bytes_transferred: 0,
                total_bytes: task.file_size,
                speed_bps: 0,
                eta_seconds: None,
                parts_completed: 0,
                parts_total: 0,
                error: None,
            },
        );

        let tasks_map = self.tasks.clone();
        let semaphore = self.semaphore.clone();
        let throttle = self.throttle.clone();
        let tid = transfer_id.clone();

        tokio::spawn(async move {
            // Acquire a concurrency permit (blocks until available)
            let _permit = match semaphore.acquire().await {
                Ok(p) => p,
                Err(_) => return,
            };

            // Mark as in-progress
            {
                let mut tasks = tasks_map.lock().await;
                if let Some(state) = tasks.get_mut(&tid) {
                    state.task.status = "in_progress".to_string();
                }
            }
            emit_transfer_progress(
                &app,
                TransferProgressEvent {
                    transfer_id: tid.clone(),
                    status: "in_progress".to_string(),
                    bytes_transferred: 0,
                    total_bytes: task.file_size,
                    speed_bps: 0,
                    eta_seconds: None,
                    parts_completed: 0,
                    parts_total: 0,
                    error: None,
                },
            );

            let start_time = Instant::now();
            let file_size = task.file_size;
            let bucket = task.bucket.clone();
            let key = task.key.clone();
            let file_path = task.file_path.clone();

            let result = if file_size > MULTIPART_THRESHOLD {
                // ---- multipart upload ----
                let config = MultipartConfig::default();
                let part_size = config.part_size as u64;
                let total_parts = ((file_size + part_size - 1) / part_size) as u32;

                // Update parts_total
                {
                    let mut tasks = tasks_map.lock().await;
                    if let Some(state) = tasks.get_mut(&tid) {
                        state.task.parts_total = total_parts;
                    }
                }

                let tasks_for_cb = tasks_map.clone();
                let app_for_cb = app.clone();
                let tid_for_cb = tid.clone();
                let throttle_for_cb = throttle.clone();

                let progress_cb = move |bytes_transferred: u64, total: u64| {
                    // Apply throttling (best-effort from sync context)
                    let throttle_ref = throttle_for_cb.clone();
                    // We cannot easily await in a sync callback, so we use
                    // try_acquire semantic via spawn_blocking or simply skip.
                    // Instead, the throttle is applied in the manager below.

                    let parts_done =
                        (bytes_transferred / part_size.max(1)) as u32;

                    let elapsed = start_time.elapsed().as_secs_f64();
                    let speed = if elapsed > 0.0 {
                        (bytes_transferred as f64 / elapsed) as u64
                    } else {
                        0
                    };
                    let remaining = total.saturating_sub(bytes_transferred);
                    let eta = if speed > 0 {
                        Some(remaining / speed)
                    } else {
                        None
                    };

                    // Fire-and-forget update — we hold no await here
                    let tasks_ref = tasks_for_cb.clone();
                    let app_ref = app_for_cb.clone();
                    let tid_ref = tid_for_cb.clone();
                    // Use blocking-friendly path: we just do the lock in a
                    // spawned blocking task to avoid blocking the runtime.
                    tokio::spawn(async move {
                        // Throttle
                        throttle_ref.acquire(part_size).await;

                        let mut tasks = tasks_ref.lock().await;
                        if let Some(state) = tasks.get_mut(&tid_ref) {
                            state.task.bytes_transferred = bytes_transferred;
                            state.task.speed_bps = speed;
                            state.task.eta_seconds = eta;
                            state.task.parts_completed = parts_done;
                        }
                        emit_transfer_progress(
                            &app_ref,
                            TransferProgressEvent {
                                transfer_id: tid_ref.clone(),
                                status: "in_progress".to_string(),
                                bytes_transferred,
                                total_bytes: total,
                                speed_bps: speed,
                                eta_seconds: eta,
                                parts_completed: parts_done,
                                parts_total: ((total + part_size - 1) / part_size) as u32,
                                error: None,
                            },
                        );
                    });
                };

                multipart_upload(
                    &client,
                    &bucket,
                    &key,
                    &file_path,
                    &config,
                    progress_cb,
                    cancel_token.clone(),
                )
                .await
            } else {
                // ---- simple PutObject upload ----
                simple_upload(
                    &client,
                    &bucket,
                    &key,
                    &file_path,
                    file_size,
                    tasks_map.clone(),
                    app.clone(),
                    tid.clone(),
                    start_time,
                    throttle.clone(),
                    cancel_token.clone(),
                )
                .await
            };

            // ---- finalize ----
            let final_status;
            let error_msg;
            match result {
                Ok(()) => {
                    final_status = "completed".to_string();
                    error_msg = None;
                }
                Err(ref e) => {
                    let msg = e.to_string();
                    if msg.contains("cancelled") {
                        // Could be paused or cancelled — check current status
                        let tasks = tasks_map.lock().await;
                        if let Some(state) = tasks.get(&tid) {
                            if state.task.status == "paused" {
                                // Don't overwrite paused status
                                return;
                            }
                        }
                        final_status = "cancelled".to_string();
                    } else {
                        final_status = "failed".to_string();
                    }
                    error_msg = Some(msg);
                }
            }

            {
                let mut tasks = tasks_map.lock().await;
                if let Some(state) = tasks.get_mut(&tid) {
                    state.task.status = final_status.clone();
                    state.task.error = error_msg.clone();
                    if final_status == "completed" {
                        state.task.bytes_transferred = file_size;
                    }
                }
            }

            emit_transfer_progress(
                &app,
                TransferProgressEvent {
                    transfer_id: tid.clone(),
                    status: final_status,
                    bytes_transferred: file_size,
                    total_bytes: file_size,
                    speed_bps: 0,
                    eta_seconds: None,
                    parts_completed: 0,
                    parts_total: 0,
                    error: error_msg,
                },
            );
        });

        Ok(transfer_id)
    }

    // ---------------------------------------------------------------
    // Download
    // ---------------------------------------------------------------

    /// Queue a download transfer.
    ///
    /// Returns the transfer ID immediately. The download runs in a
    /// background tokio task.
    pub async fn queue_download(
        &self,
        app: AppHandle,
        client: aws_sdk_s3::Client,
        mut task: TransferTask,
    ) -> Result<String, AppError> {
        let transfer_id = task.id.clone();
        task.status = "queued".to_string();
        task.transfer_type = "download".to_string();

        let cancel_token = CancellationToken::new();

        {
            let mut tasks = self.tasks.lock().await;
            tasks.insert(
                transfer_id.clone(),
                TransferTaskState {
                    task: task.clone(),
                    cancel_token: cancel_token.clone(),
                },
            );
        }

        emit_transfer_progress(
            &app,
            TransferProgressEvent {
                transfer_id: transfer_id.clone(),
                status: "queued".to_string(),
                bytes_transferred: 0,
                total_bytes: task.file_size,
                speed_bps: 0,
                eta_seconds: None,
                parts_completed: 0,
                parts_total: 0,
                error: None,
            },
        );

        let tasks_map = self.tasks.clone();
        let semaphore = self.semaphore.clone();
        let throttle = self.throttle.clone();
        let tid = transfer_id.clone();

        tokio::spawn(async move {
            let _permit = match semaphore.acquire().await {
                Ok(p) => p,
                Err(_) => return,
            };

            // Mark as in-progress
            {
                let mut tasks = tasks_map.lock().await;
                if let Some(state) = tasks.get_mut(&tid) {
                    state.task.status = "in_progress".to_string();
                }
            }
            emit_transfer_progress(
                &app,
                TransferProgressEvent {
                    transfer_id: tid.clone(),
                    status: "in_progress".to_string(),
                    bytes_transferred: 0,
                    total_bytes: task.file_size,
                    speed_bps: 0,
                    eta_seconds: None,
                    parts_completed: 0,
                    parts_total: 0,
                    error: None,
                },
            );

            let start_time = Instant::now();
            let file_size = task.file_size;
            let bucket = task.bucket.clone();
            let key = task.key.clone();
            let save_path = task.file_path.clone();

            let tasks_for_cb = tasks_map.clone();
            let app_for_cb = app.clone();
            let tid_for_cb = tid.clone();
            let throttle_for_cb = throttle.clone();

            let progress_cb = move |bytes_transferred: u64, total: u64| {
                let elapsed = start_time.elapsed().as_secs_f64();
                let speed = if elapsed > 0.0 {
                    (bytes_transferred as f64 / elapsed) as u64
                } else {
                    0
                };
                let remaining = total.saturating_sub(bytes_transferred);
                let eta = if speed > 0 {
                    Some(remaining / speed)
                } else {
                    None
                };

                let tasks_ref = tasks_for_cb.clone();
                let app_ref = app_for_cb.clone();
                let tid_ref = tid_for_cb.clone();
                let throttle_ref = throttle_for_cb.clone();
                let chunk_size = 256 * 1024u64; // match download buffer

                tokio::spawn(async move {
                    throttle_ref.acquire(chunk_size).await;

                    let mut tasks = tasks_ref.lock().await;
                    if let Some(state) = tasks.get_mut(&tid_ref) {
                        state.task.bytes_transferred = bytes_transferred;
                        state.task.speed_bps = speed;
                        state.task.eta_seconds = eta;
                    }
                    emit_transfer_progress(
                        &app_ref,
                        TransferProgressEvent {
                            transfer_id: tid_ref.clone(),
                            status: "in_progress".to_string(),
                            bytes_transferred,
                            total_bytes: total,
                            speed_bps: speed,
                            eta_seconds: eta,
                            parts_completed: 0,
                            parts_total: 0,
                            error: None,
                        },
                    );
                });
            };

            let result = download_with_progress(
                &client,
                &bucket,
                &key,
                &save_path,
                progress_cb,
                cancel_token.clone(),
            )
            .await;

            // ---- finalize ----
            let final_status;
            let error_msg;
            match result {
                Ok(()) => {
                    final_status = "completed".to_string();
                    error_msg = None;
                }
                Err(ref e) => {
                    let msg = e.to_string();
                    if msg.contains("cancelled") {
                        let tasks = tasks_map.lock().await;
                        if let Some(state) = tasks.get(&tid) {
                            if state.task.status == "paused" {
                                return;
                            }
                        }
                        final_status = "cancelled".to_string();
                    } else {
                        final_status = "failed".to_string();
                    }
                    error_msg = Some(msg);
                }
            }

            // Determine final bytes transferred
            let final_bytes = if final_status == "completed" {
                file_size
            } else {
                let tasks = tasks_map.lock().await;
                tasks
                    .get(&tid)
                    .map(|s| s.task.bytes_transferred)
                    .unwrap_or(0)
            };

            {
                let mut tasks = tasks_map.lock().await;
                if let Some(state) = tasks.get_mut(&tid) {
                    state.task.status = final_status.clone();
                    state.task.error = error_msg.clone();
                    state.task.bytes_transferred = final_bytes;
                }
            }

            emit_transfer_progress(
                &app,
                TransferProgressEvent {
                    transfer_id: tid.clone(),
                    status: final_status,
                    bytes_transferred: final_bytes,
                    total_bytes: file_size,
                    speed_bps: 0,
                    eta_seconds: None,
                    parts_completed: 0,
                    parts_total: 0,
                    error: error_msg,
                },
            );
        });

        Ok(transfer_id)
    }

    // ---------------------------------------------------------------
    // Pause / Resume / Cancel
    // ---------------------------------------------------------------

    /// Pause a running transfer by cancelling its token and marking
    /// the status as `"paused"`.
    pub async fn pause_transfer(&self, transfer_id: &str) -> Result<(), AppError> {
        let mut tasks = self.tasks.lock().await;
        let state = tasks
            .get_mut(transfer_id)
            .ok_or_else(|| AppError::NotFound(format!("Transfer {transfer_id} not found")))?;

        if state.task.status != "in_progress" && state.task.status != "queued" {
            return Err(AppError::Transfer(format!(
                "Cannot pause transfer in '{}' status",
                state.task.status
            )));
        }

        state.cancel_token.cancel();
        state.task.status = "paused".to_string();
        Ok(())
    }

    /// Resume a paused transfer by re-queuing it.
    ///
    /// Note: for simplicity this restarts the transfer from scratch.
    /// True resumable uploads would require persisting multipart state.
    pub async fn resume_transfer(
        &self,
        app: AppHandle,
        client: aws_sdk_s3::Client,
        transfer_id: &str,
    ) -> Result<(), AppError> {
        let task = {
            let mut tasks = self.tasks.lock().await;
            let state = tasks
                .get_mut(transfer_id)
                .ok_or_else(|| {
                    AppError::NotFound(format!("Transfer {transfer_id} not found"))
                })?;

            if state.task.status != "paused" {
                return Err(AppError::Transfer(format!(
                    "Cannot resume transfer in '{}' status",
                    state.task.status
                )));
            }

            // Remove the old entry — queue_upload/download will re-insert
            let old_state = tasks.remove(transfer_id).unwrap();
            let mut task = old_state.task;
            task.bytes_transferred = 0;
            task.speed_bps = 0;
            task.eta_seconds = None;
            task.parts_completed = 0;
            task.error = None;
            task
        };

        match task.transfer_type.as_str() {
            "upload" => {
                self.queue_upload(app, client, task).await?;
            }
            "download" => {
                self.queue_download(app, client, task).await?;
            }
            other => {
                return Err(AppError::Transfer(format!(
                    "Unknown transfer type: {other}"
                )));
            }
        }

        Ok(())
    }

    /// Cancel a transfer. This cancels the token and marks the status
    /// as `"cancelled"`.
    pub async fn cancel_transfer(&self, transfer_id: &str) -> Result<(), AppError> {
        let mut tasks = self.tasks.lock().await;
        let state = tasks.get_mut(transfer_id).ok_or_else(|| {
            AppError::NotFound(format!("Transfer {transfer_id} not found"))
        })?;

        state.cancel_token.cancel();
        state.task.status = "cancelled".to_string();
        Ok(())
    }

    // ---------------------------------------------------------------
    // Queries
    // ---------------------------------------------------------------

    /// Return a snapshot of all current transfer tasks.
    pub async fn get_transfers(&self) -> Vec<TransferTask> {
        let tasks = self.tasks.lock().await;
        tasks.values().map(|s| s.task.clone()).collect()
    }

    /// Remove completed, cancelled, and failed transfers from the list.
    pub async fn clear_completed(&self) {
        let mut tasks = self.tasks.lock().await;
        tasks.retain(|_, state| {
            !matches!(
                state.task.status.as_str(),
                "completed" | "cancelled" | "failed"
            )
        });
    }

    // ---------------------------------------------------------------
    // Bandwidth throttle
    // ---------------------------------------------------------------

    /// Set the global bandwidth limit in bytes per second.
    /// Pass `0` to disable throttling.
    pub fn set_bandwidth_limit(&self, bytes_per_second: u64) {
        if bytes_per_second == 0 {
            self.throttle.disable();
        } else {
            self.throttle.set_limit(bytes_per_second);
        }
    }

    /// Get the current bandwidth limit.
    /// Returns `u64::MAX` when throttling is disabled.
    pub fn get_bandwidth_limit(&self) -> u64 {
        self.throttle.get_limit()
    }
}

// ---------------------------------------------------------------
// Simple (non-multipart) upload helper
// ---------------------------------------------------------------

/// Upload a small file using a single PutObject call with progress.
async fn simple_upload(
    client: &aws_sdk_s3::Client,
    bucket: &str,
    key: &str,
    file_path: &str,
    file_size: u64,
    tasks_map: Arc<Mutex<HashMap<String, TransferTaskState>>>,
    app: AppHandle,
    transfer_id: String,
    start_time: Instant,
    throttle: Arc<BandwidthThrottle>,
    cancel_token: CancellationToken,
) -> Result<(), AppError> {
    use tokio::io::AsyncReadExt;

    if cancel_token.is_cancelled() {
        return Err(AppError::Transfer("Transfer cancelled".into()));
    }

    // Read the entire file into memory (it is <= 100 MB)
    let mut file = tokio::fs::File::open(file_path)
        .await
        .map_err(|e| AppError::Io(e))?;

    let mut data = Vec::with_capacity(file_size as usize);
    file.read_to_end(&mut data)
        .await
        .map_err(|e| AppError::Io(e))?;

    // Apply throttle for the whole payload
    throttle.acquire(file_size).await;

    if cancel_token.is_cancelled() {
        return Err(AppError::Transfer("Transfer cancelled".into()));
    }

    let body = aws_sdk_s3::primitives::ByteStream::from(data);

    client
        .put_object()
        .bucket(bucket)
        .key(key)
        .body(body)
        .send()
        .await
        .map_err(|e| AppError::Transfer(format!("PutObject failed: {e}")))?;

    // Report 100 % progress
    let elapsed = start_time.elapsed().as_secs_f64();
    let speed = if elapsed > 0.0 {
        (file_size as f64 / elapsed) as u64
    } else {
        0
    };

    {
        let mut tasks = tasks_map.lock().await;
        if let Some(state) = tasks.get_mut(&transfer_id) {
            state.task.bytes_transferred = file_size;
            state.task.speed_bps = speed;
            state.task.eta_seconds = Some(0);
        }
    }

    emit_transfer_progress(
        &app,
        TransferProgressEvent {
            transfer_id,
            status: "in_progress".to_string(),
            bytes_transferred: file_size,
            total_bytes: file_size,
            speed_bps: speed,
            eta_seconds: Some(0),
            parts_completed: 0,
            parts_total: 0,
            error: None,
        },
    );

    Ok(())
}
