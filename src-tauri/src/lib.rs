mod commands;
mod crypto;
mod db;
mod error;
mod monitor;
mod s3;
mod state;
mod sync;
mod transfer;

use state::AppState;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            let database = db::Database::new(&app_data_dir)
                .expect("Failed to initialize database");

            let transfer_manager = transfer::manager::TransferManager::new();

            app.manage(AppState {
                db: Mutex::new(database),
                transfer_manager,
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Phase 1: Profiles
            commands::profiles::create_profile,
            commands::profiles::get_profiles,
            commands::profiles::update_profile,
            commands::profiles::delete_profile,
            commands::profiles::test_connection,
            // Phase 1: Buckets
            commands::buckets::list_buckets,
            // Phase 1: Objects
            commands::objects::list_objects,
            commands::objects::upload_file,
            commands::objects::download_file,
            commands::objects::delete_objects,
            commands::objects::rename_object,
            commands::objects::create_folder,
            // Phase 2: Transfers
            commands::transfers::upload_files,
            commands::transfers::download_files,
            commands::transfers::pause_transfer,
            commands::transfers::resume_transfer,
            commands::transfers::cancel_transfer,
            commands::transfers::get_transfers,
            commands::transfers::clear_completed_transfers,
            // Phase 3: Presigned URLs
            commands::presigned::generate_presigned_url,
            // Phase 3: ACL
            commands::acl::get_object_acl,
            commands::acl::set_object_acl,
            commands::acl::get_bucket_acl,
            // Phase 3: Bucket Policies
            commands::policies::get_bucket_policy,
            commands::policies::set_bucket_policy,
            commands::policies::delete_bucket_policy,
            // Phase 3: Preview
            commands::preview::preview_object,
            // Phase 3: Versioning
            commands::versioning::get_bucket_versioning,
            commands::versioning::list_object_versions,
            commands::versioning::restore_object_version,
            commands::versioning::delete_object_version,
            // Phase 4: Sync
            commands::sync_cmd::sync_preview,
            commands::sync_cmd::sync_execute,
            // Phase 4: Monitor
            commands::monitor_cmd::create_monitor,
            commands::monitor_cmd::list_monitors,
            commands::monitor_cmd::stop_monitor,
            commands::monitor_cmd::delete_monitor,
            // Phase 4: Settings
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::settings::set_bandwidth_limit,
            commands::settings::get_bandwidth_limit,
            // Local filesystem
            commands::local_fs::list_directory,
            commands::local_fs::get_home_directory,
            commands::local_fs::get_drives,
            commands::local_fs::create_local_directory,
            commands::local_fs::delete_local_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
