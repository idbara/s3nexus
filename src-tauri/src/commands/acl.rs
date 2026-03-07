use crate::crypto::CryptoManager;
use crate::db::models::{AclGrant, ObjectAcl, Profile};
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

/// Map S3 ACL grants to our AclGrant struct.
fn map_grants(grants: &[aws_sdk_s3::types::Grant]) -> Vec<AclGrant> {
    grants
        .iter()
        .map(|g| {
            let (grantee, grantee_type) = match g.grantee() {
                Some(grantee) => {
                    let gtype = grantee.r#type().as_str().to_string();

                    let name = grantee
                        .display_name()
                        .map(|s| s.to_string())
                        .or_else(|| grantee.uri().map(|s| s.to_string()))
                        .or_else(|| grantee.id().map(|s| s.to_string()))
                        .unwrap_or_else(|| "Unknown".to_string());

                    (name, gtype)
                }
                None => ("Unknown".to_string(), "Unknown".to_string()),
            };

            let permission = g
                .permission()
                .map(|p| p.as_str().to_string())
                .unwrap_or_else(|| "Unknown".to_string());

            AclGrant {
                grantee,
                grantee_type,
                permission,
            }
        })
        .collect()
}

/// Get the ACL for an object.
#[tauri::command]
pub async fn get_object_acl(
    state: tauri::State<'_, AppState>,
    profile_id: String,
    bucket: String,
    key: String,
) -> Result<ObjectAcl, AppError> {
    let (client, _profile) = get_client(&state, &profile_id).await?;

    let resp = client
        .get_object_acl()
        .bucket(&bucket)
        .key(&key)
        .send()
        .await
        .map_err(|e| AppError::S3(format!("Failed to get object ACL: {}", e)))?;

    let owner = resp
        .owner()
        .and_then(|o| o.display_name())
        .map(|s| s.to_string());

    let grants = map_grants(resp.grants());

    Ok(ObjectAcl { owner, grants })
}

/// Set the ACL for an object using a canned ACL string.
#[tauri::command]
pub async fn set_object_acl(
    state: tauri::State<'_, AppState>,
    profile_id: String,
    bucket: String,
    key: String,
    acl: String,
) -> Result<(), AppError> {
    let (client, _profile) = get_client(&state, &profile_id).await?;

    let canned_acl = match acl.as_str() {
        "private" => aws_sdk_s3::types::ObjectCannedAcl::Private,
        "public-read" => aws_sdk_s3::types::ObjectCannedAcl::PublicRead,
        "public-read-write" => aws_sdk_s3::types::ObjectCannedAcl::PublicReadWrite,
        "authenticated-read" => aws_sdk_s3::types::ObjectCannedAcl::AuthenticatedRead,
        _ => {
            return Err(AppError::InvalidInput(format!(
                "Invalid canned ACL '{}'. Valid values: private, public-read, public-read-write, authenticated-read",
                acl
            )));
        }
    };

    client
        .put_object_acl()
        .bucket(&bucket)
        .key(&key)
        .acl(canned_acl)
        .send()
        .await
        .map_err(|e| AppError::S3(format!("Failed to set object ACL: {}", e)))?;

    Ok(())
}

/// Get the ACL for a bucket.
#[tauri::command]
pub async fn get_bucket_acl(
    state: tauri::State<'_, AppState>,
    profile_id: String,
    bucket: String,
) -> Result<ObjectAcl, AppError> {
    let (client, _profile) = get_client(&state, &profile_id).await?;

    let resp = client
        .get_bucket_acl()
        .bucket(&bucket)
        .send()
        .await
        .map_err(|e| AppError::S3(format!("Failed to get bucket ACL: {}", e)))?;

    let owner = resp
        .owner()
        .and_then(|o| o.display_name())
        .map(|s| s.to_string());

    let grants = map_grants(resp.grants());

    Ok(ObjectAcl { owner, grants })
}
