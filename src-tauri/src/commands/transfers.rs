use tauri::State;
use crate::db::models::{TransferTask, Profile};
use crate::error::AppError;
use crate::state::AppState;
use crate::commands::profiles::get_credentials;
use crate::s3::client::build_s3_client;
use uuid::Uuid;
use chrono::Utc;
use std::path::Path;

async fn get_client(state: &State<'_, AppState>, profile_id: &str) -> Result<(aws_sdk_s3::Client, Profile), AppError> {
    let (access_key, secret_key, profile) = get_credentials(state, profile_id)?;
    let client = build_s3_client(&profile, &access_key, &secret_key).await?;
    Ok((client, profile))
}

#[tauri::command]
pub async fn upload_files(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    profile_id: String,
    bucket: String,
    prefix: String,
    file_paths: Vec<String>,
) -> Result<Vec<String>, AppError> {
    let (client, _profile) = get_client(&state, &profile_id).await?;
    let mut transfer_ids = Vec::new();

    for file_path in file_paths {
        let path = Path::new(&file_path);
        let file_name = path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".to_string());

        let key = if prefix.is_empty() {
            file_name.clone()
        } else {
            let p = if prefix.ends_with('/') {
                prefix.clone()
            } else {
                format!("{}/", prefix)
            };
            format!("{}{}", p, file_name)
        };

        let file_size = std::fs::metadata(&file_path)
            .map(|m| m.len())
            .unwrap_or(0);

        let task = TransferTask {
            id: Uuid::new_v4().to_string(),
            transfer_type: "upload".to_string(),
            file_name,
            file_path: file_path.clone(),
            file_size,
            bucket: bucket.clone(),
            key,
            profile_id: profile_id.clone(),
            status: "queued".to_string(),
            bytes_transferred: 0,
            speed_bps: 0,
            eta_seconds: None,
            parts_completed: 0,
            parts_total: 0,
            error: None,
            created_at: Utc::now().to_rfc3339(),
        };

        let id = task.id.clone();
        state.transfer_manager.queue_upload(app.clone(), client.clone(), task).await?;
        transfer_ids.push(id);
    }

    Ok(transfer_ids)
}

#[tauri::command]
pub async fn download_files(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    profile_id: String,
    bucket: String,
    keys: Vec<String>,
    save_dir: String,
) -> Result<Vec<String>, AppError> {
    let (client, _profile) = get_client(&state, &profile_id).await?;
    let mut transfer_ids = Vec::new();

    for key in keys {
        let file_name = key
            .rsplit('/')
            .next()
            .unwrap_or(&key)
            .to_string();

        let save_path = Path::new(&save_dir).join(&file_name);

        let task = TransferTask {
            id: Uuid::new_v4().to_string(),
            transfer_type: "download".to_string(),
            file_name,
            file_path: save_path.to_string_lossy().to_string(),
            file_size: 0,
            bucket: bucket.clone(),
            key: key.clone(),
            profile_id: profile_id.clone(),
            status: "queued".to_string(),
            bytes_transferred: 0,
            speed_bps: 0,
            eta_seconds: None,
            parts_completed: 0,
            parts_total: 0,
            error: None,
            created_at: Utc::now().to_rfc3339(),
        };

        let id = task.id.clone();
        state.transfer_manager.queue_download(app.clone(), client.clone(), task).await?;
        transfer_ids.push(id);
    }

    Ok(transfer_ids)
}

#[tauri::command]
pub async fn pause_transfer(
    state: State<'_, AppState>,
    transfer_id: String,
) -> Result<(), AppError> {
    state.transfer_manager.pause_transfer(&transfer_id).await
}

#[tauri::command]
pub async fn resume_transfer(
    state: State<'_, AppState>,
    app: tauri::AppHandle,
    profile_id: String,
    transfer_id: String,
) -> Result<(), AppError> {
    let (client, _profile) = get_client(&state, &profile_id).await?;
    state.transfer_manager.resume_transfer(app, client, &transfer_id).await
}

#[tauri::command]
pub async fn cancel_transfer(
    state: State<'_, AppState>,
    transfer_id: String,
) -> Result<(), AppError> {
    state.transfer_manager.cancel_transfer(&transfer_id).await
}

#[tauri::command]
pub async fn get_transfers(
    state: State<'_, AppState>,
) -> Result<Vec<TransferTask>, AppError> {
    Ok(state.transfer_manager.get_transfers().await)
}

#[tauri::command]
pub async fn clear_completed_transfers(
    state: State<'_, AppState>,
) -> Result<(), AppError> {
    state.transfer_manager.clear_completed().await;
    Ok(())
}
