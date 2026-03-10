# Module Map

## Current Frontend Modules

- [App.tsx](/Users/bingo/workspace/opc/VibeShell/src/App.tsx)
  - still too large
  - currently owns workspace state, AI state, file state, and modal state

- [TerminalGrid.tsx](/Users/bingo/workspace/opc/VibeShell/src/components/TerminalGrid.tsx)
  - owns terminal pane lifecycle
  - should stay focused on terminal runtime only

- [WorkspaceSidebar.tsx](/Users/bingo/workspace/opc/VibeShell/src/components/WorkspaceSidebar.tsx)
  - server navigation
  - global toggles

- [WorkspaceHeader.tsx](/Users/bingo/workspace/opc/VibeShell/src/components/WorkspaceHeader.tsx)
  - current pane summary
  - session actions

- [WorkspaceTabs.tsx](/Users/bingo/workspace/opc/VibeShell/src/components/WorkspaceTabs.tsx)
  - workspace session switching

- [FileBrowserPanel.tsx](/Users/bingo/workspace/opc/VibeShell/src/components/FileBrowserPanel.tsx)
  - remote file UI

- [AiDrawer.tsx](/Users/bingo/workspace/opc/VibeShell/src/components/AiDrawer.tsx)
  - AI shell container

- [AgentPanel.tsx](/Users/bingo/workspace/opc/VibeShell/src/components/AgentPanel.tsx)
  - task-oriented AI action UI

## Current Backend Modules

- [main.rs](/Users/bingo/workspace/opc/VibeShell/src-tauri/src/main.rs)
  - too many commands and state concerns in one file

- [ssh/session.rs](/Users/bingo/workspace/opc/VibeShell/src-tauri/src/ssh/session.rs)
  - runtime session transport

- [ssh/config.rs](/Users/bingo/workspace/opc/VibeShell/src-tauri/src/ssh/config.rs)
  - keychain and known_hosts logic

- [sftp/mod.rs](/Users/bingo/workspace/opc/VibeShell/src-tauri/src/sftp/mod.rs)
  - SFTP transport and file operations

- [ftp/mod.rs](/Users/bingo/workspace/opc/VibeShell/src-tauri/src/ftp/mod.rs)
  - FTP transport and file operations

- [agent/mod.rs](/Users/bingo/workspace/opc/VibeShell/src-tauri/src/agent/mod.rs)
  - agent request/response model

- [app/mod.rs](/Users/bingo/workspace/opc/VibeShell/src-tauri/src/app/mod.rs)
  - provider profile abstraction

## Target Frontend Split

### State

- `src/state/workspace.ts`
- `src/state/files.ts`
- `src/state/agent.ts`
- `src/state/settings.ts`

### Shell

- `src/components/workspace/`
- `src/components/terminal/`
- `src/components/files/`
- `src/components/ai/`
- `src/components/system/`

## Target Backend Split

### Core

- `src-tauri/src/core/`
- `src-tauri/src/session/`
- `src-tauri/src/transport/`
- `src-tauri/src/files/`
- `src-tauri/src/ai/`
- `src-tauri/src/agent/`
- `src-tauri/src/plugin/`

## Refactor Rule

Every new change should either:

- reduce cross-module coupling
- move state closer to its domain
- or improve correctness of pane/session identity

If a change does not do one of those things, it is likely premature.
