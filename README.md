# VibeShell 🔮

> A modern, AI-native, cross-platform terminal focused on speed, security, and developer flow.  
> **Status:** Beta (`v0.1.0`)

VibeShell is an SSH/SFTP desktop terminal built with a native Rust backend and a modern React frontend. It combines multi-pane terminal workflows, secure credential handling, and integrated AI assistance in a single app.

## Core Vision

1. **Extreme Performance**: GPU-accelerated rendering via xterm + WebGL and low-latency I/O through Rust async networking.
2. **AI-Native Workflow**: Built-in assistant with terminal-aware context and provider abstraction (Ollama/OpenAI/Anthropic).
3. **Privacy First**: Local-first architecture with OS keychain storage and no required cloud account.
4. **Focused UX**: Clean, keyboard-friendly layout with split panes, workspace sessions, and optional Zen mode.

---

## Architecture Overview

### Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Framer Motion, i18next.
- **Terminal**: xterm.js (`@xterm/xterm`, fit addon, WebGL addon).
- **Desktop Runtime**: Tauri 2.
- **Backend**: Rust + Tokio async ecosystem.
- **SSH/SFTP**: `russh`, `russh-sftp`.
- **Security**: `keyring` for secure credential storage.

### Repository Structure

- `src/`: Frontend application code.
  - `src/App.tsx`: Main composition layer for shell UI, panes, modals, and app state orchestration.
  - `src/components/TerminalGrid.tsx`: Split-pane terminal UI and pane lifecycle controls.
  - `src/components/SettingsPanel.tsx`: Provider settings, host key management, and preferences.
  - `src/lib/tauri.ts`: Typed frontend bridge for all backend commands.
  - `src/i18n.ts`: Internationalization setup.
- `src-tauri/src/`: Rust backend implementation.
  - `main.rs`: Tauri entry point and command registration.
  - `ssh/session.rs`: SSH connection lifecycle, PTY setup, and event streaming.
  - `ssh/config.rs`: Host key trust and secure credential operations.
  - `ai/mod.rs`: AI provider gateway and streaming support.
  - `sftp/mod.rs` and `ftp/mod.rs`: Remote file operations over SFTP/FTP.

---

## Implemented Features

- [x] Tauri + Vite integration for native desktop workflows.
- [x] Multi-pane terminal layout with horizontal/vertical splitting.
- [x] SSH connection and terminal streaming with resize support.
- [x] Host key trust workflow and keychain-backed credential storage.
- [x] AI chat panel with configurable providers and streaming responses.
- [x] Server groups, workspace session persistence, and command history.
- [x] Basic remote file operations integrated with active sessions.

---

## Roadmap

### Short-Term

- Improve remote file UX and full capability parity across protocols.
- Harden reconnect behavior and session restoration under edge conditions.
- Expand test coverage for state synchronization and multi-session flows.

### Mid-Term

- Enhanced keyboard-centric navigation for pane/session management.
- Smarter long-context memory and retrieval strategy for AI interactions.
- Packaging and release automation for stable cross-platform distribution.

---

## Development Guide

### Requirements

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) stable toolchain
- Xcode Command Line Tools (macOS)
- Optional: [Ollama](https://ollama.ai/) for local model testing

### Run in Development

```bash
npm install
npm run tauri dev
```

### Build

```bash
npm run build
npm run tauri build
```

### Test

```bash
npm run test
cd src-tauri && cargo test
```
