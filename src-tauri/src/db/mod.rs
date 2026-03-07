pub mod migrations;
pub mod models;

use rusqlite::Connection;
use std::path::Path;
use crate::error::AppError;

pub struct Database {
    pub conn: Connection,
}

impl Database {
    pub fn new(app_data_dir: &Path) -> Result<Self, AppError> {
        std::fs::create_dir_all(app_data_dir)?;
        let db_path = app_data_dir.join("s3nexus.db");
        let conn = Connection::open(db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        let db = Database { conn };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> Result<(), AppError> {
        migrations::run(&self.conn)
    }
}
