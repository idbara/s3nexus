use tokio::io::AsyncWriteExt;
use tokio_util::sync::CancellationToken;

use crate::error::AppError;

/// Download an S3 object to a local file with progress reporting.
///
/// Progress is reported via `progress_callback(bytes_downloaded_so_far, total_bytes)`.
/// The `cancel_token` is checked between chunks; if cancelled the partial file
/// is left on disk (the caller can clean it up or use it for resumption later).
pub async fn download_with_progress(
    client: &aws_sdk_s3::Client,
    bucket: &str,
    key: &str,
    save_path: &str,
    progress_callback: impl Fn(u64, u64) + Send + Sync + 'static,
    cancel_token: CancellationToken,
) -> Result<(), AppError> {
    let resp = client
        .get_object()
        .bucket(bucket)
        .key(key)
        .send()
        .await
        .map_err(|e| AppError::Transfer(format!("GetObject failed: {e}")))?;

    let total_bytes = resp.content_length().unwrap_or(0) as u64;

    // Ensure parent directory exists
    if let Some(parent) = std::path::Path::new(save_path).parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| AppError::Io(e))?;
    }

    let mut file = tokio::fs::File::create(save_path)
        .await
        .map_err(|e| AppError::Io(e))?;

    let mut stream = resp.body.into_async_read();
    let mut bytes_downloaded: u64 = 0;
    let mut buf = vec![0u8; 256 * 1024]; // 256 KB buffer

    loop {
        // Check cancellation before each read
        if cancel_token.is_cancelled() {
            // Flush what we have so far; caller decides whether to clean up
            let _ = file.flush().await;
            return Err(AppError::Transfer("Transfer cancelled".into()));
        }

        use tokio::io::AsyncReadExt;
        let n = stream
            .read(&mut buf)
            .await
            .map_err(|e| AppError::Io(e))?;

        if n == 0 {
            break;
        }

        file.write_all(&buf[..n])
            .await
            .map_err(|e| AppError::Io(e))?;

        bytes_downloaded += n as u64;
        progress_callback(bytes_downloaded, total_bytes);
    }

    file.flush().await.map_err(|e| AppError::Io(e))?;

    Ok(())
}
