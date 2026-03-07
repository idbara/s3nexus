import { invoke } from "@tauri-apps/api/core";
import type {
  Profile,
  ProfileInput,
  BucketInfo,
  ListObjectsResult,
  TransferTask,
  PresignedUrlResult,
  ObjectAcl,
  ObjectVersion,
  SyncPlan,
  SyncResult,
  MonitorConfig,
  PreviewResult,
  LocalFileEntry,
  DriveInfo,
} from "../types";

export const api = {
  // Profiles
  createProfile: (input: ProfileInput) =>
    invoke<Profile>("create_profile", { input }),
  getProfiles: () => invoke<Profile[]>("get_profiles"),
  updateProfile: (id: string, input: ProfileInput) =>
    invoke<Profile>("update_profile", { id, input }),
  deleteProfile: (id: string) => invoke<void>("delete_profile", { id }),
  testConnection: (profileId: string) =>
    invoke<boolean>("test_connection", { profileId }),

  // Buckets
  listBuckets: (profileId: string) =>
    invoke<BucketInfo[]>("list_buckets", { profileId }),

  // Objects
  listObjects: (
    profileId: string,
    bucket: string,
    prefix: string,
    continuationToken?: string
  ) =>
    invoke<ListObjectsResult>("list_objects", {
      profileId,
      bucket,
      prefix,
      continuationToken,
    }),
  uploadFile: (
    profileId: string,
    bucket: string,
    key: string,
    filePath: string
  ) => invoke<void>("upload_file", { profileId, bucket, key, filePath }),
  uploadFiles: (
    profileId: string,
    bucket: string,
    prefix: string,
    filePaths: string[]
  ) =>
    invoke<string[]>("upload_files", { profileId, bucket, prefix, filePaths }),
  downloadFile: (
    profileId: string,
    bucket: string,
    key: string,
    savePath: string
  ) => invoke<void>("download_file", { profileId, bucket, key, savePath }),
  deleteObjects: (profileId: string, bucket: string, keys: string[]) =>
    invoke<void>("delete_objects", { profileId, bucket, keys }),
  renameObject: (
    profileId: string,
    bucket: string,
    oldKey: string,
    newKey: string
  ) => invoke<void>("rename_object", { profileId, bucket, oldKey, newKey }),
  createFolder: (profileId: string, bucket: string, prefix: string) =>
    invoke<void>("create_folder", { profileId, bucket, prefix }),

  // Transfers
  pauseTransfer: (transferId: string) =>
    invoke<void>("pause_transfer", { transferId }),
  resumeTransfer: (transferId: string) =>
    invoke<void>("resume_transfer", { transferId }),
  cancelTransfer: (transferId: string) =>
    invoke<void>("cancel_transfer", { transferId }),
  getTransfers: () => invoke<TransferTask[]>("get_transfers"),
  clearCompletedTransfers: () => invoke<void>("clear_completed_transfers"),

  // Presigned
  generatePresignedUrl: (
    profileId: string,
    bucket: string,
    key: string,
    expirySeconds: number,
    operation: string
  ) =>
    invoke<PresignedUrlResult>("generate_presigned_url", {
      profileId,
      bucket,
      key,
      expirySeconds,
      operation,
    }),

  // ACL
  getObjectAcl: (profileId: string, bucket: string, key: string) =>
    invoke<ObjectAcl>("get_object_acl", { profileId, bucket, key }),
  setObjectAcl: (
    profileId: string,
    bucket: string,
    key: string,
    acl: string
  ) => invoke<void>("set_object_acl", { profileId, bucket, key, acl }),

  // Policies
  getBucketPolicy: (profileId: string, bucket: string) =>
    invoke<string | null>("get_bucket_policy", { profileId, bucket }),
  setBucketPolicy: (profileId: string, bucket: string, policyJson: string) =>
    invoke<void>("set_bucket_policy", { profileId, bucket, policyJson }),
  deleteBucketPolicy: (profileId: string, bucket: string) =>
    invoke<void>("delete_bucket_policy", { profileId, bucket }),

  // Preview
  previewObject: (
    profileId: string,
    bucket: string,
    key: string,
    maxBytes?: number
  ) =>
    invoke<PreviewResult>("preview_object", {
      profileId,
      bucket,
      key,
      maxBytes,
    }),

  // Versioning
  getBucketVersioning: (profileId: string, bucket: string) =>
    invoke<string>("get_bucket_versioning", { profileId, bucket }),
  listObjectVersions: (profileId: string, bucket: string, key: string) =>
    invoke<ObjectVersion[]>("list_object_versions", {
      profileId,
      bucket,
      key,
    }),
  restoreObjectVersion: (
    profileId: string,
    bucket: string,
    key: string,
    versionId: string
  ) =>
    invoke<void>("restore_object_version", {
      profileId,
      bucket,
      key,
      versionId,
    }),

  // Sync
  syncPreview: (
    profileId: string,
    bucket: string,
    prefix: string,
    localPath: string,
    direction: string
  ) =>
    invoke<SyncPlan>("sync_preview", {
      profileId,
      bucket,
      prefix,
      localPath,
      direction,
    }),
  syncExecute: (
    profileId: string,
    bucket: string,
    prefix: string,
    localPath: string,
    direction: string
  ) =>
    invoke<SyncResult>("sync_execute", {
      profileId,
      bucket,
      prefix,
      localPath,
      direction,
    }),

  // Monitor
  createMonitor: (
    profileId: string,
    bucket: string,
    prefix: string,
    localPath: string,
    deleteOnRemote: boolean
  ) =>
    invoke<MonitorConfig>("create_monitor", {
      profileId,
      bucket,
      prefix,
      localPath,
      deleteOnRemote,
    }),
  listMonitors: () => invoke<MonitorConfig[]>("list_monitors"),
  stopMonitor: (monitorId: string) =>
    invoke<void>("stop_monitor", { monitorId }),
  deleteMonitor: (monitorId: string) =>
    invoke<void>("delete_monitor", { monitorId }),

  // Transfers - downloads
  downloadFiles: (
    profileId: string,
    bucket: string,
    keys: string[],
    saveDir: string
  ) =>
    invoke<string[]>("download_files", { profileId, bucket, keys, saveDir }),

  // Settings
  getSetting: (key: string) => invoke<string | null>("get_setting", { key }),
  setSetting: (key: string, value: string) =>
    invoke<void>("set_setting", { key, value }),
  setBandwidthLimit: (bytesPerSecond: number) =>
    invoke<void>("set_bandwidth_limit", { bytesPerSecond }),
  getBandwidthLimit: () => invoke<number>("get_bandwidth_limit"),

  // Local filesystem
  listDirectory: (path: string) =>
    invoke<LocalFileEntry[]>("list_directory", { path }),
  getHomeDirectory: () => invoke<string>("get_home_directory"),
  getDrives: () => invoke<DriveInfo[]>("get_drives"),
  createLocalDirectory: (path: string) =>
    invoke<void>("create_local_directory", { path }),
  deleteLocalFiles: (paths: string[]) =>
    invoke<void>("delete_local_files", { paths }),
};
