use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub region: String,
    pub endpoint_url: Option<String>,
    pub path_style: bool,
    pub proxy_type: Option<String>,
    pub proxy_host: Option<String>,
    pub proxy_port: Option<u16>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileInput {
    pub name: String,
    pub provider: String,
    pub access_key: String,
    pub secret_key: String,
    pub region: Option<String>,
    pub endpoint_url: Option<String>,
    pub path_style: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BucketInfo {
    pub name: String,
    pub creation_date: Option<String>,
    pub region: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectInfo {
    pub key: String,
    pub display_name: String,
    pub size: u64,
    pub last_modified: Option<String>,
    pub is_folder: bool,
    pub storage_class: Option<String>,
    pub e_tag: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListObjectsResult {
    pub objects: Vec<ObjectInfo>,
    pub common_prefixes: Vec<String>,
    pub continuation_token: Option<String>,
    pub is_truncated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferTask {
    pub id: String,
    pub transfer_type: String,
    pub file_name: String,
    pub file_path: String,
    pub file_size: u64,
    pub bucket: String,
    pub key: String,
    pub profile_id: String,
    pub status: String,
    pub bytes_transferred: u64,
    pub speed_bps: u64,
    pub eta_seconds: Option<u64>,
    pub parts_completed: u32,
    pub parts_total: u32,
    pub error: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferProgressEvent {
    pub transfer_id: String,
    pub status: String,
    pub bytes_transferred: u64,
    pub total_bytes: u64,
    pub speed_bps: u64,
    pub eta_seconds: Option<u64>,
    pub parts_completed: u32,
    pub parts_total: u32,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PresignedUrlResult {
    pub url: String,
    pub expires_at: String,
    pub operation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectAcl {
    pub owner: Option<String>,
    pub grants: Vec<AclGrant>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AclGrant {
    pub grantee: String,
    pub grantee_type: String,
    pub permission: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectVersion {
    pub version_id: String,
    pub is_latest: bool,
    pub last_modified: String,
    pub size: u64,
    pub is_delete_marker: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncAction {
    pub path: String,
    pub action: String,
    pub size: u64,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPlan {
    pub to_upload: Vec<SyncAction>,
    pub to_download: Vec<SyncAction>,
    pub to_skip: Vec<SyncAction>,
    pub total_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub uploaded: u32,
    pub downloaded: u32,
    pub skipped: u32,
    pub failed: u32,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitorConfig {
    pub id: String,
    pub profile_id: String,
    pub bucket: String,
    pub prefix: String,
    pub local_path: String,
    pub delete_on_remote: bool,
    pub active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewResult {
    pub content_type: String,
    pub size: u64,
    pub data: PreviewData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "content")]
pub enum PreviewData {
    Text(String),
    Image(String),
    Unsupported(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalFileEntry {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub modified: Option<String>,
    pub is_directory: bool,
    pub is_hidden: bool,
    pub is_symlink: bool,
    pub readonly: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DriveInfo {
    pub name: String,
    pub path: String,
}
