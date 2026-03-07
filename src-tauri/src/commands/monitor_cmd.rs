use crate::db::models::MonitorConfig;
use crate::error::AppError;
use crate::state::AppState;

/// Create a new folder monitor configuration and store it in the database.
#[tauri::command]
pub async fn create_monitor(
    state: tauri::State<'_, AppState>,
    profile_id: String,
    bucket: String,
    prefix: String,
    local_path: String,
    delete_on_remote: bool,
) -> Result<MonitorConfig, AppError> {
    // Validate that the local path exists and is a directory
    let path = std::path::Path::new(&local_path);
    if !path.exists() {
        return Err(AppError::InvalidInput(format!(
            "Local path does not exist: {}",
            local_path
        )));
    }
    if !path.is_dir() {
        return Err(AppError::InvalidInput(format!(
            "Local path is not a directory: {}",
            local_path
        )));
    }

    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let monitor = MonitorConfig {
        id: id.clone(),
        profile_id: profile_id.clone(),
        bucket: bucket.clone(),
        prefix: prefix.clone(),
        local_path: local_path.clone(),
        delete_on_remote,
        active: true,
        created_at: now.clone(),
        updated_at: now.clone(),
    };

    {
        let db = state
            .db
            .lock()
            .map_err(|e| AppError::S3(format!("Failed to lock database: {}", e)))?;

        db.conn.execute(
            "INSERT INTO folder_monitors (id, profile_id, bucket, prefix, local_path, delete_on_remote, active, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![
                id,
                profile_id,
                bucket,
                prefix,
                local_path,
                delete_on_remote as i32,
                1, // active
                now,
                now,
            ],
        )?;
    }

    Ok(monitor)
}

/// List all folder monitors from the database.
#[tauri::command]
pub async fn list_monitors(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<MonitorConfig>, AppError> {
    let monitors = {
        let db = state
            .db
            .lock()
            .map_err(|e| AppError::S3(format!("Failed to lock database: {}", e)))?;

        let mut stmt = db.conn.prepare(
            "SELECT id, profile_id, bucket, prefix, local_path, delete_on_remote, active, created_at, updated_at
             FROM folder_monitors
             ORDER BY created_at DESC",
        )?;

        let rows = stmt
            .query_map([], |row| {
                Ok(MonitorConfig {
                    id: row.get(0)?,
                    profile_id: row.get(1)?,
                    bucket: row.get(2)?,
                    prefix: row.get(3)?,
                    local_path: row.get(4)?,
                    delete_on_remote: row.get::<_, i32>(5)? != 0,
                    active: row.get::<_, i32>(6)? != 0,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;

        rows
    };

    Ok(monitors)
}

/// Stop (deactivate) a folder monitor by ID.
#[tauri::command]
pub async fn stop_monitor(
    state: tauri::State<'_, AppState>,
    monitor_id: String,
) -> Result<(), AppError> {
    let now = chrono::Utc::now().to_rfc3339();

    let db = state
        .db
        .lock()
        .map_err(|e| AppError::S3(format!("Failed to lock database: {}", e)))?;

    let updated = db.conn.execute(
        "UPDATE folder_monitors SET active = 0, updated_at = ?1 WHERE id = ?2",
        rusqlite::params![now, monitor_id],
    )?;

    if updated == 0 {
        return Err(AppError::NotFound(format!(
            "Monitor not found: {}",
            monitor_id
        )));
    }

    Ok(())
}

/// Delete a folder monitor by ID.
#[tauri::command]
pub async fn delete_monitor(
    state: tauri::State<'_, AppState>,
    monitor_id: String,
) -> Result<(), AppError> {
    let db = state
        .db
        .lock()
        .map_err(|e| AppError::S3(format!("Failed to lock database: {}", e)))?;

    let deleted = db.conn.execute(
        "DELETE FROM folder_monitors WHERE id = ?1",
        rusqlite::params![monitor_id],
    )?;

    if deleted == 0 {
        return Err(AppError::NotFound(format!(
            "Monitor not found: {}",
            monitor_id
        )));
    }

    Ok(())
}
