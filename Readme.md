# S3 Nexus

**S3 Nexus** is a lightweight, fast, and fully open-source cross-platform S3 browser. Built with **Tauri v2**, **Rust**, and **React 19** to deliver the best cloud storage management experience on Windows, macOS, and Linux.

## Features

- **Lightweight:** < 100MB RAM thanks to Rust and Tauri engine
- **Cross-Platform:** Runs natively on Windows, macOS (Intel & Apple Silicon), and Linux
- **Wide Compatibility:** Supports AWS S3, MinIO, Cloudflare R2, DigitalOcean Spaces, and other S3-compatible providers
- **Security:** Credentials encrypted locally with AES-256-GCM. No data leaves your computer except to the target S3 endpoint
- **Multipart Upload:** Upload files up to 5GB+ with parallel chunk transfers and auto-retry
- **Transfer Manager:** Queue up to 10 concurrent transfers with pause/resume, progress tracking, and bandwidth throttling
- **File Preview:** Preview images, text, and markdown files without downloading
- **Folder Sync:** One-way or bidirectional sync between local folders and S3 prefixes
- **Dark/Light Mode:** System-aware theming with manual toggle

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Desktop Framework** | [Tauri v2](https://tauri.app/) |
| **Backend** | [Rust](https://www.rust-lang.org/) |
| **Frontend** | [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/) |
| **State Management** | [Zustand](https://zustand.docs.pmnd.rs/) |
| **Storage SDK** | [aws-sdk-rust](https://github.com/awslabs/aws-sdk-rust) |
| **Database** | SQLite (via [rusqlite](https://github.com/rusqlite/rusqlite)) |
| **Encryption** | [ring](https://github.com/briansmith/ring) (AES-256-GCM) |
| **Icons** | [Lucide React](https://lucide.dev/) |

## Getting Started

### Prerequisites

1. **Rust** (stable) — [Install](https://www.rust-lang.org/tools/install)
2. **Node.js** (LTS v20+) — [Install](https://nodejs.org/)
3. **Tauri v2 system dependencies** for your OS:

   **Windows:**
   - Microsoft Visual Studio C++ Build Tools
   - WebView2 (pre-installed on Windows 10/11)

   **macOS:**
   ```bash
   xcode-select --install
   ```

   **Linux (Debian/Ubuntu):**
   ```bash
   sudo apt update
   sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
   ```

   See the full [Tauri Prerequisites Guide](https://tauri.app/start/prerequisites/) for other distributions.

### Installation

```bash
# Clone the repository
git clone https://github.com/username/s3-nexus.git
cd s3-nexus

# Install frontend dependencies
npm install

# Run in development mode (starts both Vite dev server and Rust backend)
npm run tauri dev
```

On the first run, Rust will compile all dependencies (~2-5 minutes). Subsequent runs start in seconds.

### Development Commands

| Command | Description |
|---------|-------------|
| `npm run tauri dev` | Start the app in development mode with hot-reload |
| `npm run tauri build` | Build production installers (.msi, .dmg, .AppImage) |
| `npm run build` | Build frontend only (TypeScript check + Vite bundle) |
| `npm run dev` | Start Vite dev server only (no Rust backend) |
| `npx tsc --noEmit` | Type-check the frontend without building |
| `cd src-tauri && cargo check` | Type-check the Rust backend |
| `cd src-tauri && cargo clippy` | Run Rust linter |
| `cd src-tauri && cargo fmt` | Format Rust code |
| `cd src-tauri && cargo test` | Run Rust tests |

### Dev Server

- Frontend dev server runs on **http://localhost:1420**
- HMR (Hot Module Reload) on port **1421**
- Tauri connects to the Vite dev server and opens the native window
- Changes to `src/` trigger instant hot-reload
- Changes to `src-tauri/src/` trigger Rust recompilation (~5-10s)

## Project Structure

```
s3nexus/
├── src/                            # React frontend
│   ├── App.tsx                     # Root layout
│   ├── App.css                     # Tailwind + custom styles
│   ├── main.tsx                    # Entry point
│   ├── types/index.ts              # TypeScript interfaces (mirrors Rust structs)
│   ├── lib/
│   │   ├── tauri.ts                # Typed IPC wrappers (api.*)
│   │   └── utils.ts                # Formatting utilities
│   ├── stores/                     # Zustand state management
│   │   ├── profileStore.ts         # Profile CRUD + active profile
│   │   ├── explorerStore.ts        # Buckets, objects, navigation
│   │   ├── transferStore.ts        # Transfer queue + progress
│   │   ├── themeStore.ts           # Dark/light/system theme
│   │   ├── toastStore.ts           # Toast notifications
│   │   └── modalStore.ts           # Modal state management
│   └── components/
│       ├── layout/                 # Sidebar, Toolbar, Breadcrumb
│       ├── profiles/               # Profile form and list
│       ├── explorer/               # File table, context menu, modals
│       ├── transfers/              # Transfer panel with progress bars
│       ├── presigned/              # Presigned URL generator
│       ├── acl/                    # ACL permission editor
│       ├── policies/               # Bucket policy JSON editor
│       ├── preview/                # File preview (text/image/markdown)
│       ├── versioning/             # Version history viewer
│       ├── sync/                   # Folder sync UI
│       ├── monitor/                # Folder monitoring UI
│       ├── settings/               # App settings page
│       └── ui/                     # Reusable UI primitives
│
├── src-tauri/                      # Rust backend
│   ├── src/
│   │   ├── lib.rs                  # Tauri setup + command registration
│   │   ├── main.rs                 # Entry point
│   │   ├── state.rs                # AppState (DB + TransferManager)
│   │   ├── error.rs                # AppError enum
│   │   ├── commands/               # Tauri IPC command handlers
│   │   │   ├── profiles.rs         # Profile CRUD + credential helpers
│   │   │   ├── buckets.rs          # Bucket listing
│   │   │   ├── objects.rs          # File operations
│   │   │   ├── transfers.rs        # Transfer queue management
│   │   │   ├── presigned.rs        # Presigned URL generation
│   │   │   ├── acl.rs              # ACL operations
│   │   │   ├── policies.rs         # Bucket policy operations
│   │   │   ├── preview.rs          # File preview
│   │   │   ├── versioning.rs       # Version history
│   │   │   ├── sync_cmd.rs         # Sync commands
│   │   │   ├── monitor_cmd.rs      # Monitor commands
│   │   │   └── settings.rs         # App settings
│   │   ├── crypto/                 # AES-256-GCM encryption
│   │   ├── db/                     # SQLite database layer
│   │   ├── s3/                     # AWS S3 SDK wrappers
│   │   ├── transfer/               # Transfer engine
│   │   │   ├── manager.rs          # Queue coordinator (10 concurrent)
│   │   │   ├── multipart.rs        # Multipart upload engine
│   │   │   ├── download.rs         # Streaming download
│   │   │   ├── events.rs           # Progress event emitter
│   │   │   └── throttle.rs         # Bandwidth rate limiter
│   │   ├── sync/                   # Sync engine (diff + execute)
│   │   └── monitor/                # Filesystem watcher
│   ├── Cargo.toml                  # Rust dependencies
│   ├── tauri.conf.json             # Tauri build configuration
│   └── icons/                      # App icons
│
├── package.json                    # Node dependencies + scripts
├── tsconfig.json                   # TypeScript configuration
├── vite.config.ts                  # Vite build configuration
├── index.html                      # HTML entry point
├── CLAUDE.md                       # AI assistant guidance
└── docs/
    └── Product Requirements Document.md
```

## Architecture

S3 Nexus uses Tauri's two-process model:

```
┌─────────────────────────────────────────────┐
│              Tauri Shell                     │
│  ┌──────────────────┐  ┌─────────────────┐  │
│  │   Rust Backend    │  │  Webview (React) │  │
│  │                   │  │                  │  │
│  │  • S3 SDK calls   │◄─┤  invoke("cmd")   │  │
│  │  • SQLite DB      │──►  • File Explorer │  │
│  │  • Encryption     │  │  • Transfer UI   │  │
│  │  • Transfer Mgr   │  │  • Settings      │  │
│  │  • File Watcher   │  │  • Dark/Light    │  │
│  └──────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────┘
```

### IPC Communication

Frontend calls Rust commands via `invoke()`:

```typescript
// Frontend (TypeScript)
import { api } from "./lib/tauri";
const buckets = await api.listBuckets(profileId);
```

```rust
// Backend (Rust)
#[tauri::command]
pub async fn list_buckets(state: State<'_, AppState>, profile_id: String) -> Result<Vec<BucketInfo>, AppError> {
    // ...
}
```

### Data Flow

1. **Credentials:** User input → AES-256-GCM encrypt → SQLite → decrypt on use → build S3 client
2. **Transfers:** Frontend triggers upload → TransferManager queues → Tokio spawns task → progress events emitted back to UI
3. **File listing:** Frontend requests → Rust calls S3 ListObjectsV2 → returns parsed results

## Build for Production

```bash
# Build installers for your current platform
npm run tauri build
```

Output locations:
- **Windows:** `src-tauri/target/release/bundle/msi/` and `nsis/`
- **macOS:** `src-tauri/target/release/bundle/dmg/`
- **Linux:** `src-tauri/target/release/bundle/appimage/` and `deb/`

## Contributing

We welcome contributions of any kind! Please read the [Contribution Guidelines](Contribution%20Guidelines.md) before submitting.

## License

This project is licensed under the **MIT License**.
