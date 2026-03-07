use serde::{Deserialize, Serialize};

/// Information about a local file for diff computation.
#[derive(Debug, Clone)]
pub struct LocalFileInfo {
    /// Relative path from the sync root directory (using forward slashes).
    pub path: String,
    /// File size in bytes.
    pub size: u64,
    /// Last modified time as an ISO 8601 string.
    pub modified: String,
}

/// Information about a remote S3 object for diff computation.
#[derive(Debug, Clone)]
pub struct RemoteObjectInfo {
    /// Relative key from the sync prefix (using forward slashes).
    pub path: String,
    /// Object size in bytes.
    pub size: u64,
    /// Last modified time as an ISO 8601 string.
    pub modified: String,
}

/// A single entry in the diff result, describing what action to take.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffEntry {
    /// The relative path (common key between local and remote).
    pub path: String,
    /// Size of the local file, if it exists.
    pub local_size: Option<u64>,
    /// Size of the remote object, if it exists.
    pub remote_size: Option<u64>,
    /// Last modified time of the local file (ISO 8601), if it exists.
    pub local_modified: Option<String>,
    /// Last modified time of the remote object (ISO 8601), if it exists.
    pub remote_modified: Option<String>,
    /// The action to take: "upload", "download", or "skip".
    pub action: String,
}

/// Compute the diff between local files and remote objects based on the sync direction.
///
/// - `"upload"`: new or modified local files should be uploaded; remote-only files are skipped.
/// - `"download"`: new or modified remote objects should be downloaded; local-only files are skipped.
/// - `"bidirectional"`: the newer file wins; if same timestamp, skip.
pub fn compute_diff(
    local_files: Vec<LocalFileInfo>,
    remote_objects: Vec<RemoteObjectInfo>,
    direction: &str,
) -> Vec<DiffEntry> {
    use std::collections::HashMap;

    let mut local_map: HashMap<String, LocalFileInfo> = HashMap::new();
    for f in local_files {
        local_map.insert(f.path.clone(), f);
    }

    let mut remote_map: HashMap<String, RemoteObjectInfo> = HashMap::new();
    for o in remote_objects {
        remote_map.insert(o.path.clone(), o);
    }

    // Collect all unique paths
    let mut all_paths: Vec<String> = local_map
        .keys()
        .chain(remote_map.keys())
        .cloned()
        .collect::<std::collections::HashSet<String>>()
        .into_iter()
        .collect();
    all_paths.sort();

    let mut entries = Vec::new();

    for path in all_paths {
        let local = local_map.get(&path);
        let remote = remote_map.get(&path);

        let entry = match (local, remote, direction) {
            // --- Both exist ---
            (Some(l), Some(r), "upload") => {
                // Upload if local is newer or different size
                let action = if l.size != r.size || l.modified > r.modified {
                    "upload"
                } else {
                    "skip"
                };
                DiffEntry {
                    path,
                    local_size: Some(l.size),
                    remote_size: Some(r.size),
                    local_modified: Some(l.modified.clone()),
                    remote_modified: Some(r.modified.clone()),
                    action: action.to_string(),
                }
            }
            (Some(l), Some(r), "download") => {
                // Download if remote is newer or different size
                let action = if r.size != l.size || r.modified > l.modified {
                    "download"
                } else {
                    "skip"
                };
                DiffEntry {
                    path,
                    local_size: Some(l.size),
                    remote_size: Some(r.size),
                    local_modified: Some(l.modified.clone()),
                    remote_modified: Some(r.modified.clone()),
                    action: action.to_string(),
                }
            }
            (Some(l), Some(r), _) => {
                // Bidirectional: newer wins
                let action = if l.modified > r.modified {
                    "upload"
                } else if r.modified > l.modified {
                    "download"
                } else if l.size != r.size {
                    // Same timestamp but different size — prefer remote (arbitrary)
                    "download"
                } else {
                    "skip"
                };
                DiffEntry {
                    path,
                    local_size: Some(l.size),
                    remote_size: Some(r.size),
                    local_modified: Some(l.modified.clone()),
                    remote_modified: Some(r.modified.clone()),
                    action: action.to_string(),
                }
            }

            // --- Local only ---
            (Some(l), None, "upload") | (Some(l), None, "bidirectional") => DiffEntry {
                path,
                local_size: Some(l.size),
                remote_size: None,
                local_modified: Some(l.modified.clone()),
                remote_modified: None,
                action: "upload".to_string(),
            },
            (Some(l), None, _) => {
                // download direction: local-only file is skipped
                DiffEntry {
                    path,
                    local_size: Some(l.size),
                    remote_size: None,
                    local_modified: Some(l.modified.clone()),
                    remote_modified: None,
                    action: "skip".to_string(),
                }
            }

            // --- Remote only ---
            (None, Some(r), "download") | (None, Some(r), "bidirectional") => DiffEntry {
                path,
                local_size: None,
                remote_size: Some(r.size),
                local_modified: None,
                remote_modified: Some(r.modified.clone()),
                action: "download".to_string(),
            },
            (None, Some(r), _) => {
                // upload direction: remote-only file is skipped
                DiffEntry {
                    path,
                    local_size: None,
                    remote_size: Some(r.size),
                    local_modified: None,
                    remote_modified: Some(r.modified.clone()),
                    action: "skip".to_string(),
                }
            }

            // Should not happen
            (None, None, _) => continue,
        };

        entries.push(entry);
    }

    entries
}
