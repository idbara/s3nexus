use crate::error::AppError;
use crate::state::AppState;

/// Get a setting value by key from the app_settings table.
#[tauri::command]
pub async fn get_setting(
    state: tauri::State<'_, AppState>,
    key: String,
) -> Result<Option<String>, AppError> {
    let db = state
        .db
        .lock()
        .map_err(|e| AppError::S3(format!("Failed to lock database: {}", e)))?;

    let result: Option<String> = db
        .conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = ?1",
            rusqlite::params![key],
            |row| row.get(0),
        )
        .ok();

    Ok(result)
}

/// Set a setting value by key in the app_settings table (upsert).
#[tauri::command]
pub async fn set_setting(
    state: tauri::State<'_, AppState>,
    key: String,
    value: String,
) -> Result<(), AppError> {
    let db = state
        .db
        .lock()
        .map_err(|e| AppError::S3(format!("Failed to lock database: {}", e)))?;

    db.conn.execute(
        "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![key, value],
    )?;

    Ok(())
}

/// Set the bandwidth limit for transfers (bytes per second).
/// Stores the value in app_settings and updates the transfer manager's throttle.
#[tauri::command]
pub async fn set_bandwidth_limit(
    state: tauri::State<'_, AppState>,
    bytes_per_second: u64,
) -> Result<(), AppError> {
    // Persist the setting
    {
        let db = state
            .db
            .lock()
            .map_err(|e| AppError::S3(format!("Failed to lock database: {}", e)))?;

        db.conn.execute(
            "INSERT INTO app_settings (key, value) VALUES ('bandwidth_limit', ?1)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            rusqlite::params![bytes_per_second.to_string()],
        )?;
    }

    // Update the transfer manager's throttle at runtime
    state.transfer_manager.set_bandwidth_limit(bytes_per_second);

    Ok(())
}

/// Get the current bandwidth limit (bytes per second).
/// Returns 0 if no limit is set (unlimited).
#[tauri::command]
pub async fn get_bandwidth_limit(
    state: tauri::State<'_, AppState>,
) -> Result<u64, AppError> {
    let db = state
        .db
        .lock()
        .map_err(|e| AppError::S3(format!("Failed to lock database: {}", e)))?;

    let result: Option<String> = db
        .conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = 'bandwidth_limit'",
            [],
            |row| row.get(0),
        )
        .ok();

    match result {
        Some(val) => {
            let limit = val.parse::<u64>().unwrap_or(0);
            Ok(limit)
        }
        None => Ok(0),
    }
}
