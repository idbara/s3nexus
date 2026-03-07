use aws_config::Region;
use aws_credential_types::Credentials;
use aws_sdk_s3::config::Builder as S3ConfigBuilder;

use crate::db::models::Profile;
use crate::error::AppError;

/// Build an S3 client from a Profile and its decrypted credentials.
pub async fn build_s3_client(
    profile: &Profile,
    access_key: &str,
    secret_key: &str,
) -> Result<aws_sdk_s3::Client, AppError> {
    let credentials = Credentials::new(
        access_key,
        secret_key,
        None, // session token
        None, // expiry
        "s3nexus",
    );

    let region = Region::new(profile.region.clone());

    let mut config_builder = S3ConfigBuilder::new()
        .region(region)
        .credentials_provider(credentials)
        .behavior_version_latest()
        .force_path_style(profile.path_style);

    // If a custom endpoint is specified (e.g. MinIO, Backblaze, Cloudflare R2),
    // set it on the client configuration.
    if let Some(ref endpoint) = profile.endpoint_url {
        if !endpoint.is_empty() {
            config_builder = config_builder.endpoint_url(endpoint);
        }
    }

    let config = config_builder.build();
    let client = aws_sdk_s3::Client::from_conf(config);

    Ok(client)
}
