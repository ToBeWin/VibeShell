# VibeShell v2 Roadmap

## Current Reality

The repository is between prototype and product.

What exists:

- strong visual direction
- working desktop shell
- basic SSH path
- first-pass SFTP support
- AI panel and agent scaffolding

What is still incomplete:

- terminal reliability
- session correctness
- FTP completeness
- provider breadth
- plugin system
- mature i18n and theming
- performance discipline

## Phase 1: Foundation

Goal: turn the current prototype into a stable base.

### Outcomes

- pane/session model is authoritative
- current pane always matches current terminal
- SSH state is explicit and trustworthy
- SFTP is a real first-class path
- UI shell is modular enough for continued work

### Workstreams

#### 1. Workspace shell

- reduce `App.tsx`
- isolate workspace state concerns
- remove server-selection and pane-selection drift

#### 2. Session runtime

- make pane bind to one session only
- make session lifecycle explicit
- add disconnect and cleanup behavior
- remove accidental host/user-based implicit coupling

#### 3. SSH

- input/output stability
- focus correctness
- connection status accuracy
- error surfacing
- known_hosts management

#### 4. Remote files

- keep SFTP as primary path
- keep FTP/FTPS as compatibility path
- unify file session behavior

## Phase 2: Product MVP

Goal: make the product clearly useful and demoable.

### Outcomes

- multi-session SSH workspace
- usable SFTP file management
- AI command explain and log analysis
- first cloud model support
- English and Chinese both usable
- multiple polished built-in themes

### Workstreams

#### 1. SSH and workspace

- stable multi-pane
- session switching
- reconnect flows
- command history and scrollback hygiene

#### 2. SFTP and FTP

- upload/download polish
- rename/delete/new directory polish
- FTP/FTPS parity improvements

#### 3. AI

- provider gateway
- explain command
- analyze error
- analyze logs
- generate shell script
- generate python script

#### 4. UX

- application modals
- consistent empty/loading/error states
- command palette foundation

## Phase 3: Platform

Goal: move from product to extensible platform.

### Outcomes

- plugin host
- theme packs
- locale packs
- project/session memory
- more providers

### Workstreams

- plugin SDK
- permissions model
- theme token system
- namespace-based i18n resources
- local memory and retrieval layer

## Phase 4: Excellence

Goal: compete on polish, speed, and depth.

### Outcomes

- low-latency terminal feel
- low memory footprint
- refined AI-native workflow
- ecosystem readiness

### Workstreams

- render and bundle optimization
- transport/path performance profiling
- session persistence and restoration
- workflow templates and plugin ecosystem support

## Immediate Next Milestone

The next concrete milestone should be:

### "Workspace and Session Stabilization"

This milestone includes:

- remove remaining pane/server/session drift
- isolate workspace state from UI composition
- make terminal pane connection state authoritative
- stop relying on demo fallback in real SSH panes
- make remote file panel follow pane/session identity cleanly

## Definition of Done for the next milestone

- selecting a host switches to the right pane
- selecting a pane reflects the right host and session
- a connected pane is never shown as demo mode
- an unconnected pane is never shown as connected
- remote file protocol state stays scoped to the current pane
- the main shell component gets meaningfully smaller
