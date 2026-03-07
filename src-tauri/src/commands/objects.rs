use tauri::State;

use crate::db::models::ListObjectsResult;
use crate::error::AppError;
use crate::s3::{client, operations};
use crate::state::AppState;

use super::profiles::get_credentials;

/// List objects in a bucket with an optional prefix and pagination token.
#[tauri::command]
pub async fn list_objects(
    state: State<'_, AppState>,
    profile_id: String,
    bucket: String,
    prefix: String,
    continuation_token: Option<String>,
) -> Result<ListObjectsResult, AppError> {
    let (access_key, secret_key, profile) = get_credentials(&state, &profile_id)?;

    let s3_client = client::build_s3_client(&profile, &access_key, &secret_key).await?;

    operations::list_objects(
        &s3_client,
        &bucket,
        &prefix,
        continuation_token.as_deref(),
    )
    .await
}

/// Upload a local file to S3 (simple PutObject for small files).
#[tauri::command]
pub async fn upload_file(
    state: State<'_, AppState>,
    profile_id: String,
    bucket: String,
    key: String,
    file_path: String,
) -> Result<(), AppError> {
    let (access_key, secret_key, profile) = get_credentials(&state, &profile_id)?;

    let s3_client = client::build_s3_client(&profile, &access_key, &secret_key).await?;

    operations::upload_object(&s3_client, &bucket, &key, &file_path).await
}

/// Download an object from S3 to a local file path.
#[tauri::command]
pub async fn download_file(
    state: State<'_, AppState>,
    profile_id: String,
    bucket: String,
    key: String,
    save_path: String,
) -> Result<(), AppError> {
    let (access_key, secret_key, profile) = get_credentials(&state, &profile_id)?;

    let s3_client = client::build_s3_client(&profile, &access_key, &secret_key).await?;

    operations::download_object(&s3_client, &bucket, &key, &save_path).await
}

/// Delete one or more objects from a bucket.
#[tauri::command]
pub async fn delete_objects(
    state: State<'_, AppState>,
    profile_id: String,
    bucket: String,
    keys: Vec<String>,
) -> Result<(), AppError> {
    let (access_key, secret_key, profile) = get_credentials(&state, &profile_id)?;

    let s3_client = client::build_s3_client(&profile, &access_key, &secret_key).await?;

    operations::delete_objects(&s3_client, &bucket, keys).await
}

/// Rename (move) an object by copying it to the new key and deleting the original.
#[tauri::command]
pub async fn rename_object(
    state: State<'_, AppState>,
    profile_id: String,
    bucket: String,
    old_key: String,
    new_key: String,
) -> Result<(), AppError> {
    let (access_key, secret_key, profile) = get_credentials(&state, &profile_id)?;

    let s3_client = client::build_s3_client(&profile, &access_key, &secret_key).await?;

    // Copy to new key first
    operations::copy_object(&s3_client, &bucket, &old_key, &new_key).await?;

    // Then delete the original
    operations::delete_objects(&s3_client, &bucket, vec![old_key]).await
}

/// Create a "folder" in S3 by putting an empty object with a trailing slash.
#[tauri::command]
pub async fn create_folder(
    state: State<'_, AppState>,
    profile_id: String,
    bucket: String,
    prefix: String,
) -> Result<(), AppError> {
    let (access_key, secret_key, profile) = get_credentials(&state, &profile_id)?;

    let s3_client = client::build_s3_client(&profile, &access_key, &secret_key).await?;

    // Ensure the key ends with '/' to represent a folder
    let folder_key = if prefix.ends_with('/') {
        prefix
    } else {
        format!("{}/", prefix)
    };

    // Put an empty object to act as the folder marker
    s3_client
        .put_object()
        .bucket(&bucket)
        .key(&folder_key)
        .body(aws_sdk_s3::primitives::ByteStream::from_static(b""))
        .send()
        .await
        .map_err(|e| AppError::S3(e.to_string()))?;

    Ok(())
}
