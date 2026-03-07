# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

S3 Nexus is a cross-platform S3 browser/file manager desktop app built with Tauri v2 + Rust (backend) and React 19 + Tailwind CSS v4 (frontend). It targets AWS S3, MinIO, Cloudflare R2, DigitalOcean Spaces, and other S3-compatible providers. Licensed under MIT.

## Tech Stack

- **Desktop framework:** Tauri v2 (Rust backend bridging OS and UI)
- **Backend:** Rust — aws-sdk-s3, Tokio (async runtime), Rusqlite (local SQLite DB), ring (AES-256-GCM encryption)
- **Frontend:** React 19, Tailwind CSS v4, Zustand (state management), Lucide React (icons)
- **Additional frontend:** CodeMirror (JSON policy editor), react-markdown (preview)

## Development Commands

```bash
npm install              # Install frontend dependencies
npm run tauri dev        # Run in development mode (frontend + Rust backend)
npm run build            # Build frontend only (tsc + vite)
npm run tauri build      # Build production installers
npx tsc --noEmit         # Type-check frontend without emitting
cd src-tauri && cargo check  # Type-check Rust backend
```

### Prerequisites

1. Rust (stable)
2. Node.js (LTS)
3. Tauri v2 OS-specific dependencies: https://tauri.app/start/prerequisites/

## Architecture

Tauri two-process model with IPC commands:
- **Rust process:** All S3 operations, credential encryption, SQLite, transfer engine
- **Webview process:** React UI communicates via `invoke()` from `@tauri-apps/api/core`

### Backend Structure (src-tauri/src/)

```
lib.rs              — Tauri builder, plugin registration, command handler registration
state.rs            — AppState (Mutex<Database> + TransferManager)
error.rs            — AppError enum (implements Serialize for IPC)
commands/           — All #[tauri::command] functions organized by feature
  profiles.rs       — CRUD + get_credentials/get_crypto_manager helpers (pub, reused by other commands)
  buckets.rs        — list_buckets
  objects.rs        — list_objects, upload/download/delete/rename/create_folder
  transfers.rs      — upload_files, download_files, pause/resume/cancel, get_transfers
  presigned.rs      — generate_presigned_url
  acl.rs            — get/set object & bucket ACL
  policies.rs       — get/set/delete bucket policy
  preview.rs        — preview_object (text/image/markdown)
  versioning.rs     — get versioning, list/restore/delete versions
  sync_cmd.rs       — sync_preview, sync_execute
  monitor_cmd.rs    — CRUD folder monitors
  settings.rs       — get/set settings, bandwidth limit
crypto/mod.rs       — AES-256-GCM encrypt/decrypt via ring crate
db/                 — SQLite database layer
  mod.rs            — Database struct, connection init, WAL mode
  migrations.rs     — Schema: profiles, app_settings, transfer_state, folder_monitors
  models.rs         — All Rust structs shared across modules (Profile, ObjectInfo, TransferTask, etc.)
s3/
  client.rs         — build_s3_client() from Profile + decrypted credentials
  operations.rs     — S3 SDK wrappers (list_buckets, list_objects, upload, download, delete, copy, head)
transfer/
  manager.rs        — TransferManager: queue uploads/downloads, pause/resume/cancel, 10-concurrent semaphore
  multipart.rs      — Multipart upload engine: parallel parts, retry, abort on failure
  download.rs       — Streaming download with progress and cancellation
  events.rs         — Emit transfer-progress events to frontend
  throttle.rs       — BandwidthThrottle: token bucket rate limiting
sync/
  engine.rs         — sync_preview/sync_execute: compare local vs remote, upload/download diffs
  diff.rs           — compute_diff: size/date comparison for sync decisions
monitor/
  watcher.rs        — FolderWatcher using notify crate: filesystem events with 500ms debounce
```

### Frontend Structure (src/)

```
App.tsx             — Root layout: sidebar (256px) + main area (toolbar, breadcrumb, explorer, transfer panel)
App.css             — Tailwind import + custom theme + animations + prose styling
types/index.ts      — All TypeScript interfaces matching Rust structs
lib/tauri.ts        — Typed invoke wrappers for all Tauri commands (api.*)
lib/utils.ts        — formatBytes, formatDate, formatSpeed, formatEta, getFileIcon
stores/             — Zustand stores
  profileStore.ts   — Profiles, active profile
  explorerStore.ts  — Buckets, current path, objects, selection, search
  transferStore.ts  — Transfer queue, panel toggle
  themeStore.ts     — Dark/light/system theme with localStorage
  toastStore.ts     — Toast notification queue
  modalStore.ts     — Centralized modal state
components/
  layout/           — Sidebar, Toolbar, Breadcrumb
  profiles/         — ProfileForm, ProfileList
  explorer/         — FileExplorer, FileRow, ContextMenu, EmptyState, NewFolderModal, RenameModal, DeleteConfirmModal
  transfers/        — TransferPanel, TransferItem
  presigned/        — PresignedModal
  acl/              — AclEditorModal
  policies/         — PolicyEditorModal (CodeMirror)
  preview/          — PreviewPanel (text/image/markdown)
  versioning/       — VersionHistoryModal
  sync/             — SyncModal
  monitor/          — MonitorList, MonitorSetupModal
  settings/         — SettingsPage (tabs: General, Transfer, Monitors, Proxy)
  ui/               — Button, Modal, Input, Select, Toast (reusable primitives)
```

### Key Patterns

- **Credential flow:** Master key stored in app_settings → CryptoManager encrypts/decrypts access_key and secret_key → S3 client built per-operation
- **IPC pattern:** Frontend calls `api.someCommand()` → invokes Rust `#[tauri::command]` → returns Result<T, AppError>
- **Transfer progress:** Rust emits `transfer-progress` events → frontend listens via `@tauri-apps/api/event` → updates Zustand store
- **Dark mode:** Class-based (`dark` class on `<html>`) using Tailwind `dark:` prefix
- **Commands that need S3:** Use `get_credentials()` from profiles.rs to decrypt keys, then `build_s3_client()` to create client

## Performance Targets

- Startup: < 2 seconds
- Idle RAM: < 100 MB
- Support up to 10 parallel uploads without UI hang
- Handle 5GB+ file uploads without crash or memory leak
- Multipart threshold: 100MB (auto-switches to multipart upload)

## Build Targets

- Windows: .msi / .exe
- macOS: .dmg (Universal binary — Intel + Apple Silicon)
- Linux: .AppImage / .deb

## Documentation

- `Readme.md` — Project overview and setup
- `docs/Product Requirements Document.md` — Full PRD with functional requirements, architecture, and roadmap
