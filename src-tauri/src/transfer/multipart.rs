use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::types::{CompletedMultipartUpload, CompletedPart};
use tokio::io::AsyncReadExt;
use tokio::sync::Semaphore;
use tokio_util::sync::CancellationToken;

use crate::error::AppError;

/// Configuration for multipart uploads.
#[derive(Debug, Clone)]
pub struct MultipartConfig {
    /// Size of each part in bytes.
    pub part_size: usize,
    /// Maximum number of parts uploaded concurrently.
    pub max_concurrent_parts: usize,
    /// Maximum retries per part on failure.
    pub max_retries: u32,
}

impl Default for MultipartConfig {
    fn default() -> Self {
        Self {
            part_size: 10 * 1024 * 1024, // 10 MB
            max_concurrent_parts: 4,
            max_retries: 3,
        }
    }
}

/// Upload a file using the S3 multipart upload API.
///
/// The file is split into chunks of `config.part_size` bytes. Up to
/// `config.max_concurrent_parts` parts are uploaded in parallel.
/// Progress is reported via `progress_callback(bytes_uploaded_so_far, total_bytes)`.
///
/// Cancellation is checked via `cancel_token`. If cancelled the multipart
/// upload is aborted on the server side.
pub async fn multipart_upload(
    client: &aws_sdk_s3::Client,
    bucket: &str,
    key: &str,
    file_path: &str,
    config: &MultipartConfig,
    progress_callback: impl Fn(u64, u64) + Send + Sync + 'static,
    cancel_token: CancellationToken,
) -> Result<(), AppError> {
    // ---- determine file size ----
    let metadata = std::fs::metadata(file_path)?;
    let file_size = metadata.len();

    // ---- initiate multipart upload ----
    let create_resp = client
        .create_multipart_upload()
        .bucket(bucket)
        .key(key)
        .send()
        .await
        .map_err(|e| AppError::Transfer(format!("CreateMultipartUpload failed: {e}")))?;

    let upload_id = create_resp
        .upload_id()
        .ok_or_else(|| AppError::Transfer("No upload_id returned".into()))?
        .to_string();

    // ---- compute part boundaries ----
    let part_size = config.part_size as u64;
    let total_parts = ((file_size + part_size - 1) / part_size) as u32;

    struct PartSpec {
        part_number: i32,
        offset: u64,
        length: usize,
    }

    let mut parts: Vec<PartSpec> = Vec::with_capacity(total_parts as usize);
    let mut offset: u64 = 0;
    for i in 0..total_parts {
        let remaining = file_size - offset;
        let len = std::cmp::min(remaining, part_size) as usize;
        parts.push(PartSpec {
            part_number: (i + 1) as i32,
            offset,
            length: len,
        });
        offset += len as u64;
    }

    // ---- shared state for progress ----
    let bytes_uploaded = Arc::new(AtomicU64::new(0));
    let progress_callback = Arc::new(progress_callback);

    // ---- upload parts concurrently ----
    let semaphore = Arc::new(Semaphore::new(config.max_concurrent_parts));
    let mut handles = Vec::with_capacity(parts.len());

    for part_spec in parts {
        let client = client.clone();
        let bucket = bucket.to_string();
        let key = key.to_string();
        let upload_id = upload_id.clone();
        let file_path = file_path.to_string();
        let sem = semaphore.clone();
        let cancel = cancel_token.clone();
        let bytes_up = bytes_uploaded.clone();
        let cb = progress_callback.clone();
        let max_retries = config.max_retries;

        let handle = tokio::spawn(async move {
            let _permit = sem
                .acquire()
                .await
                .map_err(|e| AppError::Transfer(format!("Semaphore error: {e}")))?;

            // Check cancellation before starting
            if cancel.is_cancelled() {
                return Err(AppError::Transfer("Transfer cancelled".into()));
            }

            // Read this part's bytes from the file
            let mut file = tokio::fs::File::open(&file_path)
                .await
                .map_err(|e| AppError::Io(e))?;

            use tokio::io::AsyncSeekExt;
            file.seek(std::io::SeekFrom::Start(part_spec.offset))
                .await
                .map_err(|e| AppError::Io(e))?;

            let mut buf = vec![0u8; part_spec.length];
            file.read_exact(&mut buf)
                .await
                .map_err(|e| AppError::Io(e))?;

            // Retry loop
            let mut last_err: Option<AppError> = None;
            for attempt in 0..=max_retries {
                if cancel.is_cancelled() {
                    return Err(AppError::Transfer("Transfer cancelled".into()));
                }

                if attempt > 0 {
                    // Exponential backoff: 1s, 2s, 4s, ...
                    let delay = std::time::Duration::from_secs(1 << (attempt - 1));
                    tokio::time::sleep(delay).await;
                }

                let body = ByteStream::from(buf.clone());

                let result = client
                    .upload_part()
                    .bucket(&bucket)
                    .key(&key)
                    .upload_id(&upload_id)
                    .part_number(part_spec.part_number)
                    .body(body)
                    .send()
                    .await;

                match result {
                    Ok(resp) => {
                        let etag = resp
                            .e_tag()
                            .ok_or_else(|| {
                                AppError::Transfer("No ETag in UploadPart response".into())
                            })?
                            .to_string();

                        // Update progress
                        let uploaded =
                            bytes_up.fetch_add(part_spec.length as u64, Ordering::Relaxed)
                                + part_spec.length as u64;
                        cb(uploaded, file_size);

                        return Ok(CompletedPart::builder()
                            .part_number(part_spec.part_number)
                            .e_tag(etag)
                            .build());
                    }
                    Err(e) => {
                        last_err =
                            Some(AppError::Transfer(format!("UploadPart failed: {e}")));
                    }
                }
            }

            Err(last_err.unwrap_or_else(|| AppError::Transfer("Unknown upload error".into())))
        });

        handles.push(handle);
    }

    // ---- collect results ----
    let mut completed_parts: Vec<CompletedPart> = Vec::with_capacity(handles.len());
    let mut first_error: Option<AppError> = None;

    for handle in handles {
        match handle.await {
            Ok(Ok(part)) => {
                completed_parts.push(part);
            }
            Ok(Err(e)) => {
                if first_error.is_none() {
                    first_error = Some(e);
                }
                // Signal all other tasks to stop
                cancel_token.cancel();
            }
            Err(join_err) => {
                if first_error.is_none() {
                    first_error = Some(AppError::Transfer(format!("Task panicked: {join_err}")));
                }
                cancel_token.cancel();
            }
        }
    }

    // ---- on failure or cancellation: abort ----
    if let Some(err) = first_error {
        let _ = client
            .abort_multipart_upload()
            .bucket(bucket)
            .key(key)
            .upload_id(&upload_id)
            .send()
            .await;
        return Err(err);
    }

    if cancel_token.is_cancelled() {
        let _ = client
            .abort_multipart_upload()
            .bucket(bucket)
            .key(key)
            .upload_id(&upload_id)
            .send()
            .await;
        return Err(AppError::Transfer("Transfer cancelled".into()));
    }

    // ---- sort parts by part number and complete ----
    completed_parts.sort_by_key(|p| p.part_number());

    let completed_upload = CompletedMultipartUpload::builder()
        .set_parts(Some(completed_parts))
        .build();

    client
        .complete_multipart_upload()
        .bucket(bucket)
        .key(key)
        .upload_id(&upload_id)
        .multipart_upload(completed_upload)
        .send()
        .await
        .map_err(|e| AppError::Transfer(format!("CompleteMultipartUpload failed: {e}")))?;

    Ok(())
}
