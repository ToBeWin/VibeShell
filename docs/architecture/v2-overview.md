# VibeShell v2 Overview

## Positioning

VibeShell is an AI-native, extensible, privacy-first terminal workspace for developers, operators, SREs, and infrastructure teams.

It is not just:

- an SSH client
- a terminal emulator
- an AI chat sidebar

It is the combination of:

- terminal workspace
- remote operations cockpit
- AI-assisted troubleshooting surface
- extensible local-first desktop platform

## Product Principles

### 1. Simple, not shallow

The default interface must feel quiet and obvious.
Advanced capabilities should appear when context demands them, not all at once.

### 2. Local-first

The app should work offline by default where possible.
Cloud models are optional, user-configured integrations.

### 3. AI is workflow, not decoration

AI should explain commands, analyze logs, generate scripts, and understand the current session.
It should not exist only as a generic chat box.

### 4. Fast path first

SSH, terminal echo, scroll, pane switching, and file browsing are the product core.
AI must never degrade those paths.

### 5. Extensible by design

Themes, locales, providers, tools, panels, and plugins are platform concerns, not afterthoughts.

## Product Layers

### Terminal and Remote Access

- SSH
- SFTP
- FTP/FTPS
- multi-session
- multi-pane
- multi-tab
- multi-window

### AI Runtime

- provider gateway
- agent orchestration
- command explanation
- log analysis
- shell/python script generation
- session-aware memory

### Platform Layer

- plugins
- themes
- i18n
- settings and profiles
- security and secrets

## Architecture Layers

### Rust Core

- `vibe-core`
  - event model
  - shared errors
  - domain identifiers

- `vibe-session`
  - session registry
  - pane/tab/window lifecycle
  - reconnect and cleanup

- `vibe-ssh`
  - SSH auth
  - PTY
  - known hosts
  - keychain integration

- `vibe-file`
  - SFTP
  - FTP/FTPS
  - remote file operations

- `vibe-ai`
  - provider adapters
  - streaming
  - tool calls

- `vibe-agent`
  - orchestration
  - prompt assembly
  - tool execution

- `vibe-memory`
  - short-term context
  - session memory
  - project memory
  - local RAG

- `vibe-plugin`
  - manifests
  - lifecycle
  - permissions

- `vibe-settings`
  - profiles
  - model settings
  - secret storage

### Frontend Runtime

- `workspace-shell`
  - layout
  - navigation
  - shell composition

- `workspace-state`
  - pane
  - session
  - file panel
  - AI panel

- `terminal-runtime`
  - xterm lifecycle
  - focus
  - selection
  - scrollback
  - terminal event routing

- `ai-ui`
  - chat
  - agent actions
  - result rendering

- `design-system`
  - tokens
  - components
  - themes

- `plugin-host`
  - frontend extensions
  - plugin-contributed panels and commands

## Core Data Model

### Workspace

Top-level shell container for panes, tabs, sessions, AI surfaces, and plugins.

### HostProfile

Saved host definition:

- id
- name
- host
- port
- user
- auth strategy
- tags

### Session

Runtime connection state:

- session id
- host profile id
- transport type
- status
- current pane bindings

### Pane

Visual work unit bound to exactly one active session.

### FileSession

Remote file transport context:

- protocol
- path
- active editor state
- transfer tasks

### AgentTask

Structured AI action:

- action type
- prompt
- context snapshot
- result
- status

## Security Model

### SSH

- known hosts with visible trust flow
- key change detection
- password retrieval from keychain
- future: key auth UI, SSH agent support, jump host support

### AI

- local-first by default
- provider secrets stored locally
- explicit cloud model configuration
- future: data redaction options

### Plugins

Every plugin should declare permissions for:

- filesystem
- network
- SSH session access
- AI context access
- secret access

## User-Facing Differentiators

The product should eventually be strongest in:

- multi-host terminal workflow
- AI-assisted troubleshooting
- script generation for ops tasks
- privacy-first local desktop UX
- extensibility

## Execution Strategy

The product should not be built by feature pile-on.

Execution order:

1. stabilize core shell and session model
2. make SSH and SFTP reliable
3. make AI useful inside the terminal workflow
4. add provider breadth and memory
5. add plugin and platform depth
