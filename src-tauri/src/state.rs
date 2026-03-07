use std::sync::Mutex;
use crate::db::Database;
use crate::transfer::manager::TransferManager;

pub struct AppState {
    pub db: Mutex<Database>,
    pub transfer_manager: TransferManager,
}
