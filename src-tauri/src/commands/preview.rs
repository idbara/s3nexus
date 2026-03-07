use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};

use crate::crypto::CryptoManager;
use crate::db::models::{PreviewData, PreviewResult, Profile};
use crate::error::AppError;
use crate::state::AppState;

/// Default max bytes for text preview (1 MB).
const DEFAULT_MAX_TEXT_BYTES: u64 = 1_048_576;
/// Default max bytes for image preview (10 MB).
const DEFAULT_MAX_IMAGE_BYTES: u64 = 10_485_760;

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

/// Determine content type from S3 metadata content_type or fall back to file extension.
fn determine_content_type(s3_content_type: Option<&str>, key: &str) -> String {
    if let Some(ct) = s3_content_type {
        if ct != "application/octet-stream" && ct != "binary/octet-stream" {
            return ct.to_string();
        }
    }

    // Fall back to file extension
    let ext = key
        .rsplit('.')
        .next()
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        // Text types
        "txt" => "text/plain",
        "csv" => "text/csv",
        "html" | "htm" => "text/html",
        "css" => "text/css",
        "js" => "text/javascript",
        "ts" => "text/typescript",
        "json" => "application/json",
        "xml" => "application/xml",
        "yaml" | "yml" => "text/yaml",
        "md" => "text/markdown",
        "log" => "text/plain",
        "ini" | "cfg" | "conf" => "text/plain",
        "toml" => "text/plain",
        "rs" => "text/plain",
        "py" => "text/plain",
        "java" => "text/plain",
        "c" | "h" | "cpp" | "hpp" => "text/plain",
        "sh" | "bash" => "text/plain",
        "sql" => "text/plain",
        // Image types
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        // PDF
        "pdf" => "application/pdf",
        // Default
        _ => "application/octet-stream",
    }
    .to_string()
}

/// Check if a content type is a text type that we can preview.
fn is_text_type(content_type: &str) -> bool {
    content_type.starts_with("text/")
        || content_type == "application/json"
        || content_type == "application/xml"
        || content_type == "application/javascript"
}

/// Check if a content type is an image type that we can preview.
fn is_image_type(content_type: &str) -> bool {
    matches!(
        content_type,
        "image/png" | "image/jpeg" | "image/gif" | "image/webp"
    )
}

/// Preview an object from S3. Returns text content, base64-encoded image data,
/// or an unsupported marker with the content type.
#[tauri::command]
pub async fn preview_object(
    state: tauri::State<'_, AppState>,
    profile_id: String,
    bucket: String,
    key: String,
    max_bytes: Option<u64>,
) -> Result<PreviewResult, AppError> {
    let (client, _profile) = get_client(&state, &profile_id).await?;

    // First, do a HEAD request to get content type and size
    let head_resp = client
        .head_object()
        .bucket(&bucket)
        .key(&key)
        .send()
        .await
        .map_err(|e| AppError::S3(format!("Failed to head object: {}", e)))?;

    let object_size = head_resp.content_length().unwrap_or(0) as u64;
    let s3_content_type = head_resp.content_type().map(|s| s.to_string());
    let content_type = determine_content_type(s3_content_type.as_deref(), &key);

    if is_text_type(&content_type) {
        let limit = max_bytes.unwrap_or(DEFAULT_MAX_TEXT_BYTES);
        let fetch_size = std::cmp::min(object_size, limit);

        let mut req = client.get_object().bucket(&bucket).key(&key);

        // Use Range header for partial download when object is larger than limit
        if object_size > limit {
            req = req.range(format!("bytes=0-{}", limit - 1));
        }

        let resp = req
            .send()
            .await
            .map_err(|e| AppError::S3(format!("Failed to get object: {}", e)))?;

        let bytes = resp
            .body
            .collect()
            .await
            .map_err(|e| AppError::S3(format!("Failed to read object body: {}", e)))?;

        let text = String::from_utf8_lossy(&bytes.into_bytes()).to_string();

        Ok(PreviewResult {
            content_type,
            size: fetch_size,
            data: PreviewData::Text(text),
        })
    } else if is_image_type(&content_type) {
        let limit = max_bytes.unwrap_or(DEFAULT_MAX_IMAGE_BYTES);

        if object_size > limit {
            return Err(AppError::InvalidInput(format!(
                "Image too large for preview: {} bytes (limit: {} bytes)",
                object_size, limit
            )));
        }

        let resp = client
            .get_object()
            .bucket(&bucket)
            .key(&key)
            .send()
            .await
            .map_err(|e| AppError::S3(format!("Failed to get object: {}", e)))?;

        let bytes = resp
            .body
            .collect()
            .await
            .map_err(|e| AppError::S3(format!("Failed to read object body: {}", e)))?;

        let encoded = BASE64.encode(bytes.into_bytes());

        Ok(PreviewResult {
            content_type,
            size: object_size,
            data: PreviewData::Image(encoded),
        })
    } else {
        Ok(PreviewResult {
            content_type: content_type.clone(),
            size: object_size,
            data: PreviewData::Unsupported(content_type),
        })
    }
}
