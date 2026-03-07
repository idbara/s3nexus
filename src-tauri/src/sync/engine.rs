use std::path::Path;

use walkdir::WalkDir;

use crate::db::models::{SyncAction, SyncPlan, SyncResult};
use crate::error::AppError;
use crate::sync::diff::{compute_diff, LocalFileInfo, RemoteObjectInfo};

/// Collect all local files under `local_path`, returning their relative paths,
/// sizes, and last-modified times.
fn collect_local_files(local_path: &str) -> Result<Vec<LocalFileInfo>, AppError> {
    let base = Path::new(local_path);
    if !base.exists() {
        return Err(AppError::InvalidInput(format!(
            "Local path does not exist: {}",
            local_path
        )));
    }
    if !base.is_dir() {
        return Err(AppError::InvalidInput(format!(
            "Local path is not a directory: {}",
            local_path
        )));
    }

    let mut files = Vec::new();

    for entry in WalkDir::new(base).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() {
            continue;
        }

        let abs_path = entry.path();
        let rel_path = abs_path
            .strip_prefix(base)
            .map_err(|e| AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string())))?;

        // Normalize path separators to forward slashes
        let rel_str = rel_path
            .to_string_lossy()
            .replace('\\', "/");

        let metadata = entry.metadata().map_err(|e| {
            AppError::Io(std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))
        })?;

        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| {
                let datetime: chrono::DateTime<chrono::Utc> = t.into();
                Some(datetime.to_rfc3339())
            })
            .unwrap_or_default();

        files.push(LocalFileInfo {
            path: rel_str,
            size: metadata.len(),
            modified,
        });
    }

    Ok(files)
}

/// List all remote objects under `prefix` in the bucket (recursive, no delimiter).
async fn collect_remote_objects(
    client: &aws_sdk_s3::Client,
    bucket: &str,
    prefix: &str,
) -> Result<Vec<RemoteObjectInfo>, AppError> {
    let mut objects = Vec::new();
    let mut continuation_token: Option<String> = None;

    loop {
        let mut req = client
            .list_objects_v2()
            .bucket(bucket)
            .prefix(prefix)
            .max_keys(1000);

        if let Some(ref token) = continuation_token {
            req = req.continuation_token(token);
        }

        let resp = req
            .send()
            .await
            .map_err(|e| AppError::S3(format!("Failed to list objects: {}", e)))?;

        for obj in resp.contents() {
            let full_key = obj.key().unwrap_or_default().to_string();

            // Compute relative path by stripping the prefix
            let rel_path = if prefix.is_empty() {
                full_key.clone()
            } else {
                full_key
                    .strip_prefix(prefix)
                    .unwrap_or(&full_key)
                    .to_string()
            };

            // Skip "directory markers" (keys ending in '/' with 0 size)
            if rel_path.is_empty() || rel_path.ends_with('/') {
                continue;
            }

            let modified = obj
                .last_modified()
                .map(|d| d.to_string())
                .unwrap_or_default();

            objects.push(RemoteObjectInfo {
                path: rel_path,
                size: obj.size().unwrap_or(0) as u64,
                modified,
            });
        }

        if resp.is_truncated().unwrap_or(false) {
            continuation_token = resp.next_continuation_token().map(|s| s.to_string());
        } else {
            break;
        }
    }

    Ok(objects)
}

/// Preview what a sync operation would do, returning a plan without executing it.
pub async fn sync_preview(
    client: &aws_sdk_s3::Client,
    bucket: &str,
    prefix: &str,
    local_path: &str,
    direction: &str,
) -> Result<SyncPlan, AppError> {
    let local_files = collect_local_files(local_path)?;
    let remote_objects = collect_remote_objects(client, bucket, prefix).await?;

    let diff_entries = compute_diff(local_files, remote_objects, direction);

    let mut to_upload = Vec::new();
    let mut to_download = Vec::new();
    let mut to_skip = Vec::new();
    let mut total_bytes: u64 = 0;

    for entry in diff_entries {
        match entry.action.as_str() {
            "upload" => {
                let size = entry.local_size.unwrap_or(0);
                total_bytes += size;
                let reason = if entry.remote_size.is_none() {
                    "new file".to_string()
                } else {
                    "modified locally".to_string()
                };
                to_upload.push(SyncAction {
                    path: entry.path,
                    action: "upload".to_string(),
                    size,
                    reason,
                });
            }
            "download" => {
                let size = entry.remote_size.unwrap_or(0);
                total_bytes += size;
                let reason = if entry.local_size.is_none() {
                    "new remote file".to_string()
                } else {
                    "modified remotely".to_string()
                };
                to_download.push(SyncAction {
                    path: entry.path,
                    action: "download".to_string(),
                    size,
                    reason,
                });
            }
            _ => {
                let size = entry.local_size.or(entry.remote_size).unwrap_or(0);
                to_skip.push(SyncAction {
                    path: entry.path,
                    action: "skip".to_string(),
                    size,
                    reason: "up to date".to_string(),
                });
            }
        }
    }

    Ok(SyncPlan {
        to_upload,
        to_download,
        to_skip,
        total_bytes,
    })
}

/// Execute a sync operation: compute the plan, then perform the uploads/downloads.
pub async fn sync_execute(
    client: &aws_sdk_s3::Client,
    bucket: &str,
    prefix: &str,
    local_path: &str,
    direction: &str,
) -> Result<SyncResult, AppError> {
    let plan = sync_preview(client, bucket, prefix, local_path, direction).await?;

    let mut uploaded: u32 = 0;
    let mut downloaded: u32 = 0;
    let skipped: u32 = plan.to_skip.len() as u32;
    let mut failed: u32 = 0;
    let mut errors: Vec<String> = Vec::new();

    // Execute uploads
    for action in &plan.to_upload {
        let local_file_path = Path::new(local_path).join(&action.path);
        let remote_key = if prefix.is_empty() {
            action.path.clone()
        } else {
            format!("{}{}", prefix, action.path)
        };

        match crate::s3::operations::upload_object(
            client,
            bucket,
            &remote_key,
            &local_file_path.to_string_lossy(),
        )
        .await
        {
            Ok(()) => {
                uploaded += 1;
            }
            Err(e) => {
                failed += 1;
                errors.push(format!("Upload failed for {}: {}", action.path, e));
            }
        }
    }

    // Execute downloads
    for action in &plan.to_download {
        let local_file_path = Path::new(local_path).join(&action.path);
        let remote_key = if prefix.is_empty() {
            action.path.clone()
        } else {
            format!("{}{}", prefix, action.path)
        };

        match crate::s3::operations::download_object(
            client,
            bucket,
            &remote_key,
            &local_file_path.to_string_lossy(),
        )
        .await
        {
            Ok(()) => {
                downloaded += 1;
            }
            Err(e) => {
                failed += 1;
                errors.push(format!("Download failed for {}: {}", action.path, e));
            }
        }
    }

    Ok(SyncResult {
        uploaded,
        downloaded,
        skipped,
        failed,
        errors,
    })
}
