// Shared TypeScript interfaces matching Rust structs

export interface Profile {
  id: string;
  name: string;
  provider: string;
  region: string;
  endpoint_url: string | null;
  path_style: boolean;
  proxy_type: string | null;
  proxy_host: string | null;
  proxy_port: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileInput {
  name: string;
  provider: string;
  access_key: string;
  secret_key: string;
  region?: string;
  endpoint_url?: string;
  path_style?: boolean;
}

export interface BucketInfo {
  name: string;
  creation_date: string | null;
  region: string | null;
}

export interface ObjectInfo {
  key: string;
  display_name: string;
  size: number;
  last_modified: string | null;
  is_folder: boolean;
  storage_class: string | null;
  e_tag: string | null;
}

export interface ListObjectsResult {
  objects: ObjectInfo[];
  common_prefixes: string[];
  continuation_token: string | null;
  is_truncated: boolean;
}

export interface TransferTask {
  id: string;
  transfer_type: "upload" | "download";
  file_name: string;
  file_path: string;
  file_size: number;
  bucket: string;
  key: string;
  profile_id: string;
  status: "queued" | "in_progress" | "paused" | "completed" | "failed" | "cancelled";
  bytes_transferred: number;
  speed_bps: number;
  eta_seconds: number | null;
  parts_completed: number;
  parts_total: number;
  error: string | null;
  created_at: string;
}

export interface TransferProgressEvent {
  transfer_id: string;
  status: string;
  bytes_transferred: number;
  total_bytes: number;
  speed_bps: number;
  eta_seconds: number | null;
  parts_completed: number;
  parts_total: number;
  error: string | null;
}

export interface PresignedUrlResult {
  url: string;
  expires_at: string;
  operation: string;
}

export interface ObjectAcl {
  owner: string | null;
  grants: AclGrant[];
}

export interface AclGrant {
  grantee: string;
  grantee_type: string;
  permission: string;
}

export interface ObjectVersion {
  version_id: string;
  is_latest: boolean;
  last_modified: string;
  size: number;
  is_delete_marker: boolean;
}

export interface SyncAction {
  path: string;
  action: string;
  size: number;
  reason: string;
}

export interface SyncPlan {
  to_upload: SyncAction[];
  to_download: SyncAction[];
  to_skip: SyncAction[];
  total_bytes: number;
}

export interface SyncResult {
  uploaded: number;
  downloaded: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export interface MonitorConfig {
  id: string;
  profile_id: string;
  bucket: string;
  prefix: string;
  local_path: string;
  delete_on_remote: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PreviewResult {
  content_type: string;
  size: number;
  data: PreviewData;
}

export type PreviewData =
  | { type: "Text"; content: string }
  | { type: "Image"; content: string }
  | { type: "Unsupported"; content: string };

export interface LocalFileEntry {
  name: string;
  path: string;
  size: number;
  modified: string | null;
  is_directory: boolean;
  is_hidden: boolean;
  is_symlink: boolean;
  readonly: boolean;
}

export interface DriveInfo {
  name: string;
  path: string;
}

export interface AppError {
  kind: string;
  message: string;
}
