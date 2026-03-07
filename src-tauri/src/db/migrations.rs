use rusqlite::Connection;
use crate::error::AppError;

pub fn run(conn: &Connection) -> Result<(), AppError> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            provider TEXT NOT NULL,
            access_key_encrypted BLOB NOT NULL,
            secret_key_encrypted BLOB NOT NULL,
            region TEXT DEFAULT 'us-east-1',
            endpoint_url TEXT,
            path_style INTEGER DEFAULT 0,
            proxy_type TEXT,
            proxy_host TEXT,
            proxy_port INTEGER,
            proxy_username_encrypted BLOB,
            proxy_password_encrypted BLOB,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS transfer_state (
            id TEXT PRIMARY KEY,
            profile_id TEXT NOT NULL,
            transfer_type TEXT NOT NULL,
            bucket TEXT NOT NULL,
            key TEXT NOT NULL,
            file_path TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            upload_id TEXT,
            parts_completed TEXT,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS folder_monitors (
            id TEXT PRIMARY KEY,
            profile_id TEXT NOT NULL,
            bucket TEXT NOT NULL,
            prefix TEXT NOT NULL DEFAULT '',
            local_path TEXT NOT NULL,
            delete_on_remote INTEGER DEFAULT 0,
            active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        ",
    )?;
    Ok(())
}
