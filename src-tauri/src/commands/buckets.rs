use tauri::State;

use crate::db::models::BucketInfo;
use crate::error::AppError;
use crate::s3::{client, operations};
use crate::state::AppState;

use super::profiles::get_credentials;

/// List all buckets accessible by the given profile.
#[tauri::command]
pub async fn list_buckets(
    state: State<'_, AppState>,
    profile_id: String,
) -> Result<Vec<BucketInfo>, AppError> {
    let (access_key, secret_key, profile) = get_credentials(&state, &profile_id)?;

    let s3_client = client::build_s3_client(&profile, &access_key, &secret_key).await?;

    operations::list_buckets(&s3_client).await
}
