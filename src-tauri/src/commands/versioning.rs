use crate::crypto::CryptoManager;
use crate::db::models::{ObjectVersion, Profile};
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

/// Get the versioning status of a bucket.
/// Returns "Enabled", "Suspended", or "Disabled".
#[tauri::command]
pub async fn get_bucket_versioning(
    state: tauri::State<'_, AppState>,
    profile_id: String,
    bucket: String,
) -> Result<String, AppError> {
    let (client, _profile) = get_client(&state, &profile_id).await?;

    let resp = client
        .get_bucket_versioning()
        .bucket(&bucket)
        .send()
        .await
        .map_err(|e| AppError::S3(format!("Failed to get bucket versioning: {}", e)))?;

    let status = match resp.status() {
        Some(s) => s.as_str().to_string(),
        // When versioning has never been enabled, status is None
        None => "Disabled".to_string(),
    };

    Ok(status)
}

/// List all versions of an object in a versioning-enabled bucket.
#[tauri::command]
pub async fn list_object_versions(
    state: tauri::State<'_, AppState>,
    profile_id: String,
    bucket: String,
    key: String,
) -> Result<Vec<ObjectVersion>, AppError> {
    let (client, _profile) = get_client(&state, &profile_id).await?;

    let mut versions = Vec::new();
    let mut key_marker: Option<String> = None;
    let mut version_id_marker: Option<String> = None;

    loop {
        let mut req = client
            .list_object_versions()
            .bucket(&bucket)
            .prefix(&key);

        if let Some(ref km) = key_marker {
            req = req.key_marker(km);
        }
        if let Some(ref vim) = version_id_marker {
            req = req.version_id_marker(vim);
        }

        let resp = req
            .send()
            .await
            .map_err(|e| AppError::S3(format!("Failed to list object versions: {}", e)))?;

        // Collect object versions (non-delete-markers)
        for v in resp.versions() {
            // Only include versions that match the exact key
            let v_key = v.key().unwrap_or_default();
            if v_key != key {
                continue;
            }

            versions.push(ObjectVersion {
                version_id: v
                    .version_id()
                    .unwrap_or("null")
                    .to_string(),
                is_latest: v.is_latest().unwrap_or(false),
                last_modified: v
                    .last_modified()
                    .map(|d| d.to_string())
                    .unwrap_or_default(),
                size: v.size().unwrap_or(0) as u64,
                is_delete_marker: false,
            });
        }

        // Collect delete markers
        for dm in resp.delete_markers() {
            let dm_key = dm.key().unwrap_or_default();
            if dm_key != key {
                continue;
            }

            versions.push(ObjectVersion {
                version_id: dm
                    .version_id()
                    .unwrap_or("null")
                    .to_string(),
                is_latest: dm.is_latest().unwrap_or(false),
                last_modified: dm
                    .last_modified()
                    .map(|d| d.to_string())
                    .unwrap_or_default(),
                size: 0,
                is_delete_marker: true,
            });
        }

        if resp.is_truncated().unwrap_or(false) {
            key_marker = resp.next_key_marker().map(|s| s.to_string());
            version_id_marker = resp.next_version_id_marker().map(|s| s.to_string());
        } else {
            break;
        }
    }

    Ok(versions)
}

/// Restore a specific version of an object by copying it as the latest version.
#[tauri::command]
pub async fn restore_object_version(
    state: tauri::State<'_, AppState>,
    profile_id: String,
    bucket: String,
    key: String,
    version_id: String,
) -> Result<(), AppError> {
    let (client, _profile) = get_client(&state, &profile_id).await?;

    // Copy the specific version onto itself to make it the latest.
    // The CopySource format is: /bucket/key?versionId=id
    // We need to percent-encode the key for URL safety.
    let encoded_key = key
        .split('/')
        .map(|segment| {
            segment
                .bytes()
                .map(|b| {
                    if b.is_ascii_alphanumeric()
                        || b == b'-'
                        || b == b'_'
                        || b == b'.'
                        || b == b'~'
                    {
                        format!("{}", b as char)
                    } else {
                        format!("%{:02X}", b)
                    }
                })
                .collect::<String>()
        })
        .collect::<Vec<_>>()
        .join("/");

    let copy_source = format!(
        "{}/{}?versionId={}",
        bucket, encoded_key, version_id
    );

    client
        .copy_object()
        .bucket(&bucket)
        .copy_source(&copy_source)
        .key(&key)
        .send()
        .await
        .map_err(|e| {
            AppError::S3(format!(
                "Failed to restore version {} of {}: {}",
                version_id, key, e
            ))
        })?;

    Ok(())
}

/// Delete a specific version of an object.
#[tauri::command]
pub async fn delete_object_version(
    state: tauri::State<'_, AppState>,
    profile_id: String,
    bucket: String,
    key: String,
    version_id: String,
) -> Result<(), AppError> {
    let (client, _profile) = get_client(&state, &profile_id).await?;

    client
        .delete_object()
        .bucket(&bucket)
        .key(&key)
        .version_id(&version_id)
        .send()
        .await
        .map_err(|e| {
            AppError::S3(format!(
                "Failed to delete version {} of {}: {}",
                version_id, key, e
            ))
        })?;

    Ok(())
}
