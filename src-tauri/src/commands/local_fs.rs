use crate::db::models::{DriveInfo, LocalFileEntry};
use crate::error::AppError;
use chrono::{DateTime, Utc};
use std::fs;
use std::path::Path;

#[tauri::command]
pub async fn list_directory(path: String) -> Result<Vec<LocalFileEntry>, AppError> {
    let dir = Path::new(&path);
    if !dir.is_dir() {
        return Err(AppError::InvalidInput(format!(
            "Not a directory: {}",
            path
        )));
    }

    let mut entries = Vec::new();
    let read_dir = fs::read_dir(dir)?;

    for entry_result in read_dir {
        let entry = match entry_result {
            Ok(e) => e,
            Err(_) => continue, // skip permission errors
        };

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        let file_name = entry.file_name().to_string_lossy().to_string();
        let file_path = entry
            .path()
            .to_string_lossy()
            .to_string()
            .replace('\\', "/");

        let modified = metadata
            .modified()
            .ok()
            .map(|t| {
                let dt: DateTime<Utc> = t.into();
                dt.to_rfc3339()
            });

        let is_hidden = is_hidden_file(&file_name, &entry.path());
        let is_symlink = entry
            .file_type()
            .map(|ft| ft.is_symlink())
            .unwrap_or(false);
        let readonly = metadata.permissions().readonly();

        entries.push(LocalFileEntry {
            name: file_name,
            path: file_path,
            size: if metadata.is_dir() { 0 } else { metadata.len() },
            modified,
            is_directory: metadata.is_dir(),
            is_hidden,
            is_symlink,
            readonly,
        });
    }

    // Sort: directories first, then files, both alphabetically (case-insensitive)
    entries.sort_by(|a, b| {
        b.is_directory
            .cmp(&a.is_directory)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

#[tauri::command]
pub async fn get_home_directory() -> Result<String, AppError> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string().replace('\\', "/"))
        .ok_or_else(|| AppError::NotFound("Could not determine home directory".to_string()))
}

#[tauri::command]
pub async fn get_drives() -> Result<Vec<DriveInfo>, AppError> {
    let mut drives = Vec::new();

    #[cfg(target_os = "windows")]
    {
        for letter in b'A'..=b'Z' {
            let drive_path = format!("{}:\\", letter as char);
            if Path::new(&drive_path).exists() {
                drives.push(DriveInfo {
                    name: format!("{}:", letter as char),
                    path: drive_path,
                });
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        drives.push(DriveInfo {
            name: "/".to_string(),
            path: "/".to_string(),
        });
    }

    Ok(drives)
}

#[tauri::command]
pub async fn create_local_directory(path: String) -> Result<(), AppError> {
    fs::create_dir_all(&path)?;
    Ok(())
}

#[tauri::command]
pub async fn delete_local_files(paths: Vec<String>) -> Result<(), AppError> {
    for file_path in &paths {
        let p = Path::new(file_path);
        if !p.exists() {
            continue;
        }
        if p.is_dir() {
            fs::remove_dir_all(p)?;
        } else {
            fs::remove_file(p)?;
        }
    }
    Ok(())
}

fn is_hidden_file(name: &str, _path: &Path) -> bool {
    if name.starts_with('.') {
        return true;
    }

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::fs::MetadataExt;
        if let Ok(metadata) = _path.metadata() {
            const FILE_ATTRIBUTE_HIDDEN: u32 = 0x2;
            return metadata.file_attributes() & FILE_ATTRIBUTE_HIDDEN != 0;
        }
    }

    false
}
