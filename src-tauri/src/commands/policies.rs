use crate::crypto::CryptoManager;
use crate::db::models::Profile;
use crate::error::AppError;
use crate::state::AppState;

async fn get_client(
    state: &AppState,
    profile_id: &str,
) -> Result<(aws_sdk_s3::Client, Profile), AppError> {
    let (profile, access_key, secret_key) = {
        let db = state
            .db
            .lock()
            .map_err(|e| AppError::S3(format!("Failed to lock database: {}", e)))?;

        let crypto = get_or_create_crypto(&db)?;

        let mut stmt = db.conn.prepare(
            "SELECT id, name, provider, region, endpoint_url, path_style,
                    proxy_type, proxy_host, proxy_port,
                    access_key_encrypted, secret_key_encrypted,
                    created_at, updated_at
             FROM profiles WHERE id = ?1",
        )?;

        let (profile, ak_enc, sk_enc) = stmt
            .query_row(rusqlite::params![profile_id], |row| {
                let profile = Profile {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    provider: row.get(2)?,
                    region: row.get::<_, Option<String>>(3)?
                        .unwrap_or_else(|| "us-east-1".to_string()),
                    endpoint_url: row.get(4)?,
                    path_style: row.get::<_, i32>(5)? != 0,
                    proxy_type: row.get(6)?,
                    proxy_host: row.get(7)?,
                    proxy_port: row.get::<_, Option<i32>>(8)?.map(|p| p as u16),
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
                };
                let ak_enc: Vec<u8> = row.get(9)?;
                let sk_enc: Vec<u8> = row.get(10)?;
                Ok((profile, ak_enc, sk_enc))
            })
            .map_err(|e| match e {
                rusqlite::Error::QueryReturnedNoRows => {
                    AppError::NotFound(format!("Profile not found: {}", profile_id))
                }
                other => AppError::Database(other),
            })?;

        let access_key = crypto.decrypt(&ak_enc)?;
        let secret_key = crypto.decrypt(&sk_enc)?;
        (profile, access_key, secret_key)
    };

    let client =
        crate::s3::client::build_s3_client(&profile, &access_key, &secret_key).await?;
    Ok((client, profile))
}

fn get_or_create_crypto(db: &crate::db::Database) -> Result<CryptoManager, AppError> {
    let existing: Option<String> = db
        .conn
        .query_row(
            "SELECT value FROM app_settings WHERE key = 'master_key'",
            [],
            |row| row.get(0),
        )
        .ok();

    match existing {
        Some(encoded) => {
            let key = CryptoManager::master_key_from_string(&encoded)?;
            Ok(CryptoManager::new(&key))
        }
        None => {
            let key = CryptoManager::generate_master_key();
            let encoded = CryptoManager::master_key_to_string(&key);
            db.conn.execute(
                "INSERT INTO app_settings (key, value) VALUES ('master_key', ?1)",
                rusqlite::params![encoded],
            )?;
            Ok(CryptoManager::new(&key))
        }
    }
}

/// Get the bucket policy as a JSON string. Returns None if no policy is set.
#[tauri::command]
pub async fn get_bucket_policy(
    state: tauri::State<'_, AppState>,
    profile_id: String,
    bucket: String,
) -> Result<Option<String>, AppError> {
    let (client, _profile) = get_client(&state, &profile_id).await?;

    match client
        .get_bucket_policy()
        .bucket(&bucket)
        .send()
        .await
    {
        Ok(resp) => {
            let policy = resp.policy().map(|s| s.to_string());
            Ok(policy)
        }
        Err(err) => {
            // S3 returns NoSuchBucketPolicy when no policy is set.
            // Treat this as a successful response with None.
            let err_str = err.to_string();
            if err_str.contains("NoSuchBucketPolicy")
                || err_str.contains("The bucket policy does not exist")
                || err_str.contains("404")
            {
                Ok(None)
            } else {
                Err(AppError::S3(format!(
                    "Failed to get bucket policy: {}",
                    err_str
                )))
            }
        }
    }
}

/// Set the bucket policy from a JSON string.
#[tauri::command]
pub async fn set_bucket_policy(
    state: tauri::State<'_, AppState>,
    profile_id: String,
    bucket: String,
    policy_json: String,
) -> Result<(), AppError> {
    // Validate that the policy is valid JSON
    serde_json::from_str::<serde_json::Value>(&policy_json)
        .map_err(|e| AppError::InvalidInput(format!("Invalid JSON policy: {}", e)))?;

    let (client, _profile) = get_client(&state, &profile_id).await?;

    client
        .put_bucket_policy()
        .bucket(&bucket)
        .policy(&policy_json)
        .send()
        .await
        .map_err(|e| AppError::S3(format!("Failed to set bucket policy: {}", e)))?;

    Ok(())
}

/// Delete the bucket policy.
#[tauri::command]
pub async fn delete_bucket_policy(
    state: tauri::State<'_, AppState>,
    profile_id: String,
    bucket: String,
) -> Result<(), AppError> {
    let (client, _profile) = get_client(&state, &profile_id).await?;

    client
        .delete_bucket_policy()
        .bucket(&bucket)
        .send()
        .await
        .map_err(|e| AppError::S3(format!("Failed to delete bucket policy: {}", e)))?;

    Ok(())
}
