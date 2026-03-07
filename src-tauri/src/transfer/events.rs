use tauri::{AppHandle, Emitter};

use crate::db::models::TransferProgressEvent;

pub fn emit_transfer_progress(app: &AppHandle, event: TransferProgressEvent) {
    let _ = app.emit("transfer-progress", event);
}
