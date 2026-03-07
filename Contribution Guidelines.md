# Contributing to S3 Nexus

Thank you for taking the time to contribute! We're glad you're here.

## How to Contribute

### 1. Reporting Bugs

- Check if the bug has already been reported in **Issues**.
- If not, create a new issue with the `bug` label. Include the app version, OS, and steps to reproduce.

### 2. Proposing Features

- We're always open to new ideas! Use an issue with the `enhancement` label.
- For large features, open a discussion first to align on the approach.

### 3. Submitting Pull Requests

1. Fork this repository.
2. Create a new branch (`git checkout -b feature/feature-name`).
3. Make your changes following the code standards below.
4. Commit your changes (`git commit -m 'Add feature X'`).
5. Push to your branch (`git push origin feature/feature-name`).
6. Open a Pull Request.

## Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/s3-nexus.git
cd s3-nexus

# Install frontend dependencies
npm install

# Start development mode
npm run tauri dev
```

See the [README](Readme.md#prerequisites) for system prerequisites (Rust, Node.js, Tauri dependencies).

## Code Standards

### Rust (Backend)

- Follow idiomatic Rust conventions
- Use async/await (Tokio) for all I/O operations
- Format code before committing:
  ```bash
  cd src-tauri && cargo fmt
  ```
- Run the linter and fix warnings:
  ```bash
  cd src-tauri && cargo clippy
  ```
- All Tauri commands must return `Result<T, AppError>` for proper error handling
- Lock the database mutex, perform the query, then drop the lock before any async S3 work

### React (Frontend)

- Use functional components with hooks
- Tailwind CSS for all styling — avoid inline styles or CSS modules
- TypeScript strict mode is enforced — no `any` types
- Use Zustand stores for shared state
- Use `api.*` wrappers from `src/lib/tauri.ts` for all backend calls
- Use Lucide React for icons

### Security

- Never commit real credentials, access keys, or secret keys
- Never store credentials in plaintext — always use the CryptoManager
- All user input must be validated before passing to S3 SDK

### Branch Naming

- `feature/description` — New features
- `fix/description` — Bug fixes
- `refactor/description` — Code improvements
- `docs/description` — Documentation changes

## Project Architecture

Before contributing, review the [CLAUDE.md](CLAUDE.md) file for a comprehensive overview of the project architecture, module structure, and key patterns.

### Key Patterns to Follow

- **Adding a new Tauri command:** Create the function in the appropriate `commands/*.rs` file with `#[tauri::command]`, register it in `lib.rs` under `generate_handler![]`, and add the typed wrapper in `src/lib/tauri.ts`.
- **Adding a new store:** Create a Zustand store in `src/stores/`, follow the existing pattern with typed state and actions.
- **Adding S3 operations:** Add the SDK call in `src-tauri/src/s3/operations.rs`, create a command wrapper in the appropriate `commands/*.rs` file.

## Communication

If you have questions, feel free to join the GitHub Discussions or reach out to the project maintainers.
