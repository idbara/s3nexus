use aws_sdk_s3::primitives::ByteStream;
use std::path::Path;

use crate::db::models::{BucketInfo, ListObjectsResult, ObjectInfo};
use crate::error::AppError;

/// List all buckets accessible by the client.
pub async fn list_buckets(
    client: &aws_sdk_s3::Client,
) -> Result<Vec<BucketInfo>, AppError> {
    let resp = client
        .list_buckets()
        .send()
        .await
        .map_err(|e| AppError::S3(e.to_string()))?;

    let buckets = resp
        .buckets()
        .iter()
        .map(|b| BucketInfo {
            name: b.name().unwrap_or_default().to_string(),
            creation_date: b.creation_date().map(|d| d.to_string()),
            region: None,
        })
        .collect();

    Ok(buckets)
}

/// List objects in a bucket with the given prefix, using ListObjectsV2.
/// Returns both objects (files) and common prefixes (folders) when delimiter is '/'.
pub async fn list_objects(
    client: &aws_sdk_s3::Client,
    bucket: &str,
    prefix: &str,
    continuation_token: Option<&str>,
) -> Result<ListObjectsResult, AppError> {
    let mut req = client
        .list_objects_v2()
        .bucket(bucket)
        .prefix(prefix)
        .delimiter("/")
        .max_keys(1000);

    if let Some(token) = continuation_token {
        req = req.continuation_token(token);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| AppError::S3(e.to_string()))?;

    // Collect common prefixes (virtual folders)
    let common_prefixes: Vec<String> = resp
        .common_prefixes()
        .iter()
        .filter_map(|cp| cp.prefix().map(|p| p.to_string()))
        .collect();

    // Build folder ObjectInfo entries from common prefixes
    let mut objects: Vec<ObjectInfo> = common_prefixes
        .iter()
        .map(|cp| {
            let display_name = compute_display_name(cp, prefix);
            ObjectInfo {
                key: cp.clone(),
                display_name,
                size: 0,
                last_modified: None,
                is_folder: true,
                storage_class: None,
                e_tag: None,
            }
        })
        .collect();

    // Build file ObjectInfo entries from object contents
    for obj in resp.contents() {
        let key = obj.key().unwrap_or_default().to_string();

        // Skip the prefix itself if it appears as an object (the "folder marker")
        if key == prefix {
            continue;
        }

        let display_name = compute_display_name(&key, prefix);

        objects.push(ObjectInfo {
            key,
            display_name,
            size: obj.size().unwrap_or(0).max(0) as u64,
            last_modified: obj.last_modified().map(|d| d.to_string()),
            is_folder: false,
            storage_class: obj.storage_class().map(|s| s.as_str().to_string()),
            e_tag: obj.e_tag().map(|s| s.to_string()),
        });
    }

    let next_token = resp
        .next_continuation_token()
        .map(|s| s.to_string());

    let is_truncated = resp.is_truncated().unwrap_or(false);

    Ok(ListObjectsResult {
        objects,
        common_prefixes,
        continuation_token: next_token,
        is_truncated,
    })
}

/// Upload a local file to S3 using a simple PutObject (suitable for small files).
pub async fn upload_object(
    client: &aws_sdk_s3::Client,
    bucket: &str,
    key: &str,
    file_path: &str,
) -> Result<(), AppError> {
    let body = ByteStream::from_path(Path::new(file_path))
        .await
        .map_err(|e| AppError::S3(format!("Failed to read file {}: {}", file_path, e)))?;

    client
        .put_object()
        .bucket(bucket)
        .key(key)
        .body(body)
        .send()
        .await
        .map_err(|e| AppError::S3(e.to_string()))?;

    Ok(())
}

/// Download an object from S3 and save it to a local path.
pub async fn download_object(
    client: &aws_sdk_s3::Client,
    bucket: &str,
    key: &str,
    save_path: &str,
) -> Result<(), AppError> {
    let resp = client
        .get_object()
        .bucket(bucket)
        .key(key)
        .send()
        .await
        .map_err(|e| AppError::S3(e.to_string()))?;

    let bytes = resp
        .body
        .collect()
        .await
        .map_err(|e| AppError::S3(format!("Failed to read response body: {}", e)))?;

    // Ensure the parent directory exists
    if let Some(parent) = Path::new(save_path).parent() {
        std::fs::create_dir_all(parent)?;
    }

    std::fs::write(save_path, bytes.into_bytes())?;

    Ok(())
}

/// Delete one or more objects from a bucket.
/// Uses single DeleteObject for individual files (best provider compatibility).
/// For folder keys (ending with `/`), recursively lists children and batch-deletes.
pub async fn delete_objects(
    client: &aws_sdk_s3::Client,
    bucket: &str,
    keys: Vec<String>,
) -> Result<(), AppError> {
    if keys.is_empty() {
        return Ok(());
    }

    // Separate folder keys from file keys
    let mut file_keys: Vec<String> = Vec::new();
    let mut folder_keys: Vec<String> = Vec::new();

    for key in keys {
        if key.ends_with('/') {
            folder_keys.push(key);
        } else {
            file_keys.push(key);
        }
    }

    // Delete individual files using single DeleteObject (most compatible)
    for key in &file_keys {
        client
            .delete_object()
            .bucket(bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| AppError::S3(format!("Failed to delete {}: {}", key, e)))?;
    }

    // Delete folders recursively: list all children, delete one by one
    for folder_key in &folder_keys {
        let mut all_keys = list_all_keys(client, bucket, folder_key).await?;
        // Include the folder marker itself
        all_keys.push(folder_key.clone());
        all_keys.sort();
        all_keys.dedup();

        for key in &all_keys {
            client
                .delete_object()
                .bucket(bucket)
                .key(key)
                .send()
                .await
                .map_err(|e| AppError::S3(format!("Failed to delete {}: {}", key, e)))?;
        }
    }

    Ok(())
}

/// List all object keys under a given prefix (recursive, no delimiter).
async fn list_all_keys(
    client: &aws_sdk_s3::Client,
    bucket: &str,
    prefix: &str,
) -> Result<Vec<String>, AppError> {
    let mut all_keys = Vec::new();
    let mut continuation_token: Option<String> = None;

    loop {
        let mut req = client
            .list_objects_v2()
            .bucket(bucket)
            .prefix(prefix)
            .max_keys(1000);

        if let Some(token) = &continuation_token {
            req = req.continuation_token(token);
        }

        let resp = req
            .send()
            .await
            .map_err(|e| AppError::S3(e.to_string()))?;

        for obj in resp.contents() {
            if let Some(key) = obj.key() {
                all_keys.push(key.to_string());
            }
        }

        if resp.is_truncated() == Some(true) {
            continuation_token = resp.next_continuation_token().map(|s| s.to_string());
        } else {
            break;
        }
    }

    Ok(all_keys)
}

/// Copy an object within the same bucket.
pub async fn copy_object(
    client: &aws_sdk_s3::Client,
    bucket: &str,
    source_key: &str,
    dest_key: &str,
) -> Result<(), AppError> {
    let copy_source = format!("{}/{}", bucket, source_key);

    client
        .copy_object()
        .bucket(bucket)
        .copy_source(&copy_source)
        .key(dest_key)
        .send()
        .await
        .map_err(|e| AppError::S3(e.to_string()))?;

    Ok(())
}

/// Get metadata for a single object (HeadObject).
pub async fn head_object(
    client: &aws_sdk_s3::Client,
    bucket: &str,
    key: &str,
) -> Result<ObjectInfo, AppError> {
    let resp = client
        .head_object()
        .bucket(bucket)
        .key(key)
        .send()
        .await
        .map_err(|e| AppError::S3(e.to_string()))?;

    let is_folder = key.ends_with('/');
    let display_name = key
        .trim_end_matches('/')
        .rsplit('/')
        .next()
        .unwrap_or(key)
        .to_string();

    Ok(ObjectInfo {
        key: key.to_string(),
        display_name,
        size: resp.content_length().unwrap_or(0).max(0) as u64,
        last_modified: resp.last_modified().map(|d| d.to_string()),
        is_folder,
        storage_class: resp.storage_class().map(|s| s.as_str().to_string()),
        e_tag: resp.e_tag().map(|s| s.to_string()),
    })
}

/// Compute a display name by stripping the current prefix from the full key.
/// For example, key "photos/2024/image.jpg" with prefix "photos/2024/" yields "image.jpg".
/// For folders, strips the trailing slash: "photos/2024/" with prefix "photos/" yields "2024".
fn compute_display_name(key: &str, prefix: &str) -> String {
    let stripped = key.strip_prefix(prefix).unwrap_or(key);
    // Remove trailing slash for folder display names
    let stripped = stripped.trim_end_matches('/');
    if stripped.is_empty() {
        key.trim_end_matches('/').to_string()
    } else {
        stripped.to_string()
    }
}
