use tauri::State;
use uuid::Uuid;

use crate::crypto::CryptoManager;
use crate::db::models::{Profile, ProfileInput};
use crate::error::AppError;
use crate::s3::{client, operations};
use crate::state::AppState;

/// Helper: load or create the CryptoManager from the app_settings table.
/// On first call, generates a master key and stores it. On subsequent calls,
/// loads the stored master key.
pub fn get_crypto_manager(state: &State<'_, AppState>) -> Result<CryptoManager, AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(rusqlite::Error::InvalidParameterName(format!(
            "Mutex poisoned: {}",
            e
        )))
    })?;

    // Try to load existing master key
    let key_result: Result<String, _> = db.conn.query_row(
        "SELECT value FROM app_settings WHERE key = 'master_key'",
        [],
        |row| row.get(0),
    );

    let master_key = match key_result {
        Ok(key_str) => CryptoManager::master_key_from_string(&key_str)?,
        Err(rusqlite::Error::QueryReturnedNoRows) => {
            // Generate and store a new master key
            let key = CryptoManager::generate_master_key();
            let key_str = CryptoManager::master_key_to_string(&key);
            db.conn.execute(
                "INSERT INTO app_settings (key, value) VALUES ('master_key', ?1)",
                [&key_str],
            )?;
            key
        }
        Err(e) => return Err(AppError::Database(e)),
    };

    Ok(CryptoManager::new(&master_key))
}

/// Helper: load a profile from the DB by id and decrypt its credentials.
/// Returns (decrypted_access_key, decrypted_secret_key, Profile).
/// Public so that sibling command modules (buckets, objects) can reuse it.
pub fn get_credentials(
    state: &State<'_, AppState>,
    profile_id: &str,
) -> Result<(String, String, Profile), AppError> {
    let crypto = get_crypto_manager(state)?;

    let db = state.db.lock().map_err(|e| {
        AppError::Database(rusqlite::Error::InvalidParameterName(format!(
            "Mutex poisoned: {}",
            e
        )))
    })?;

    let (profile, access_key_enc, secret_key_enc) = db.conn.query_row(
        "SELECT id, name, provider, region, endpoint_url, path_style,
                proxy_type, proxy_host, proxy_port, created_at, updated_at,
                access_key_encrypted, secret_key_encrypted
         FROM profiles WHERE id = ?1",
        [profile_id],
        |row| {
            let profile = Profile {
                id: row.get(0)?,
                name: row.get(1)?,
                provider: row.get(2)?,
                region: row.get::<_, String>(3)?,
                endpoint_url: row.get(4)?,
                path_style: row.get::<_, bool>(5)?,
                proxy_type: row.get(6)?,
                proxy_host: row.get(7)?,
                proxy_port: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            };
            let access_key_enc: Vec<u8> = row.get(11)?;
            let secret_key_enc: Vec<u8> = row.get(12)?;
            Ok((profile, access_key_enc, secret_key_enc))
        },
    ).map_err(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => {
            AppError::NotFound(format!("Profile '{}' not found", profile_id))
        }
        other => AppError::Database(other),
    })?;

    drop(db); // Release the mutex before decryption

    let access_key = crypto.decrypt(&access_key_enc)?;
    let secret_key = crypto.decrypt(&secret_key_enc)?;

    Ok((access_key, secret_key, profile))
}

/// Create a new profile. Encrypts the access and secret keys before storing.
#[tauri::command]
pub async fn create_profile(
    state: State<'_, AppState>,
    input: ProfileInput,
) -> Result<Profile, AppError> {
    let crypto = get_crypto_manager(&state)?;

    let id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let region = input.region.clone().unwrap_or_else(|| "us-east-1".to_string());
    let path_style = input.path_style.unwrap_or(false);

    let access_key_enc = crypto.encrypt(&input.access_key)?;
    let secret_key_enc = crypto.encrypt(&input.secret_key)?;

    let profile = {
        let db = state.db.lock().map_err(|e| {
            AppError::Database(rusqlite::Error::InvalidParameterName(format!(
                "Mutex poisoned: {}",
                e
            )))
        })?;

        db.conn.execute(
            "INSERT INTO profiles (id, name, provider, access_key_encrypted, secret_key_encrypted,
             region, endpoint_url, path_style, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                &id,
                &input.name,
                &input.provider,
                &access_key_enc,
                &secret_key_enc,
                &region,
                &input.endpoint_url,
                path_style,
                &now,
                &now,
            ],
        )?;

        Profile {
            id,
            name: input.name,
            provider: input.provider,
            region,
            endpoint_url: input.endpoint_url,
            path_style,
            proxy_type: None,
            proxy_host: None,
            proxy_port: None,
            created_at: now.clone(),
            updated_at: now,
        }
    };

    Ok(profile)
}

/// List all stored profiles.
#[tauri::command]
pub async fn get_profiles(
    state: State<'_, AppState>,
) -> Result<Vec<Profile>, AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(rusqlite::Error::InvalidParameterName(format!(
            "Mutex poisoned: {}",
            e
        )))
    })?;

    let mut stmt = db.conn.prepare(
        "SELECT id, name, provider, region, endpoint_url, path_style,
                proxy_type, proxy_host, proxy_port, created_at, updated_at
         FROM profiles ORDER BY name",
    )?;

    let profiles = stmt
        .query_map([], |row| {
            Ok(Profile {
                id: row.get(0)?,
                name: row.get(1)?,
                provider: row.get(2)?,
                region: row.get(3)?,
                endpoint_url: row.get(4)?,
                path_style: row.get::<_, bool>(5)?,
                proxy_type: row.get(6)?,
                proxy_host: row.get(7)?,
                proxy_port: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(profiles)
}

/// Update an existing profile by id. Re-encrypts credentials.
#[tauri::command]
pub async fn update_profile(
    state: State<'_, AppState>,
    id: String,
    input: ProfileInput,
) -> Result<Profile, AppError> {
    let crypto = get_crypto_manager(&state)?;

    let now = chrono::Utc::now().to_rfc3339();
    let region = input.region.clone().unwrap_or_else(|| "us-east-1".to_string());
    let path_style = input.path_style.unwrap_or(false);

    let access_key_enc = crypto.encrypt(&input.access_key)?;
    let secret_key_enc = crypto.encrypt(&input.secret_key)?;

    let profile = {
        let db = state.db.lock().map_err(|e| {
            AppError::Database(rusqlite::Error::InvalidParameterName(format!(
                "Mutex poisoned: {}",
                e
            )))
        })?;

        let rows_affected = db.conn.execute(
            "UPDATE profiles SET name = ?1, provider = ?2, access_key_encrypted = ?3,
             secret_key_encrypted = ?4, region = ?5, endpoint_url = ?6,
             path_style = ?7, updated_at = ?8
             WHERE id = ?9",
            rusqlite::params![
                &input.name,
                &input.provider,
                &access_key_enc,
                &secret_key_enc,
                &region,
                &input.endpoint_url,
                path_style,
                &now,
                &id,
            ],
        )?;

        if rows_affected == 0 {
            return Err(AppError::NotFound(format!("Profile '{}' not found", id)));
        }

        // Fetch the created_at from DB to return the full profile
        let created_at: String = db.conn.query_row(
            "SELECT created_at FROM profiles WHERE id = ?1",
            [&id],
            |row| row.get(0),
        )?;

        Profile {
            id,
            name: input.name,
            provider: input.provider,
            region,
            endpoint_url: input.endpoint_url,
            path_style,
            proxy_type: None,
            proxy_host: None,
            proxy_port: None,
            created_at,
            updated_at: now,
        }
    };

    Ok(profile)
}

/// Delete a profile by id.
#[tauri::command]
pub async fn delete_profile(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), AppError> {
    let db = state.db.lock().map_err(|e| {
        AppError::Database(rusqlite::Error::InvalidParameterName(format!(
            "Mutex poisoned: {}",
            e
        )))
    })?;

    let rows_affected = db.conn.execute("DELETE FROM profiles WHERE id = ?1", [&id])?;

    if rows_affected == 0 {
        return Err(AppError::NotFound(format!("Profile '{}' not found", id)));
    }

    Ok(())
}

/// Test connectivity for a profile by attempting to list buckets.
/// Returns true if the connection succeeds.
#[tauri::command]
pub async fn test_connection(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<bool, AppError> {
    let (access_key, secret_key, profile) = get_credentials(&state, &profile_id)?;

    let s3_client = client::build_s3_client(&profile, &access_key, &secret_key).await?;

    match operations::list_buckets(&s3_client).await {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}
