# Orbis Dei — Node.js Server Port

Port the Tauri app (Rust backend + React frontend) to a Node.js server.
Backend logic ported faithfully; frontend reused with only the Tauri-coupling
layer (4 files) swapped for HTTP + WebSocket.

## Architecture
- **Server**: Express (HTTP) + `ws` (events). TypeScript run via `tsx`.
- **DB**: `better-sqlite3` (same schema as Rust).
- **Git**: system `git` via child_process (replaces git2).
- **Secrets**: encrypted JSON file in data dir (replaces OS keychain).
- **File watch**: `chokidar` (replaces notify) → `corpus:changed` over WS.
- **Sandbox**: macOS `sandbox-exec` (kept; server runs on darwin).
- **Frontend**: copied verbatim into `web/`; only `lib/tauri-bindings.ts`,
  `lib/loop-events.ts`, `lib/daemon-events.ts`, `lib/corpus-events.ts` rewritten.

## Tasks
- [x] Explore Rust backend (core, inference, persistence, commands) + frontend
- [x] Copy templates + frontend sources
- [x] Project setup: package.json, tsconfig, .gitignore
- [x] Foundation: error, events bus, paths/fs, git, secrets, db schema, settings, templates loader, AppState
- [x] Inference: providers (anthropic/openai), router, prompt, governor (pricing/buckets/breaker/budget/queue)
- [x] Core cycle: stateMd, electResult, episodic, expandIo, expandLog, sandbox, invariants, run_one_cycle
- [x] Orchestrator (daemons) + auto_mode
- [x] Instance bootstrap
- [x] HTTP command routes (all 47) + WS event bridge
- [x] Telegram bot (optional, gated)
- [x] Frontend adaptation (4 coupling files) + vite config + package.json
- [x] Wire server to serve built frontend
- [x] Verify: install, typecheck, boot server, create instance, run a loop (mocked)

## Review

Built a faithful Node.js/TypeScript port of the Tauri app's Rust backend, run
via `tsx` (no build step for the server). The React frontend is reused verbatim
except for a new `web/src/lib/transport.ts` that re-implements `invoke`/`listen`
over HTTP + WebSocket; the four Tauri-coupling files now import from it.

Substitutions: rusqlite→better-sqlite3, git2→system git, OS keychain→AES-256-GCM
secret file, notify→chokidar, Tauri events→an EventBus broadcast over `/ws`.
macOS `sandbox-exec` is kept as-is for tool execution.

Verification performed:
- `tsc --noEmit` on the server: clean.
- `web` build (`tsc && vite build`): clean, produces `dist/`.
- Booted the server and exercised the command chain over HTTP: create_instance
  (full on-disk layout + git genesis commit), list_instances, inject_stimulus,
  list_inbox, get_drift_metrics, get_invariants_snapshot (all 7 SP-I/SC checks
  pass).
- Ran two full 6-phase loops against a mock Anthropic endpoint: all phases ran,
  invariants passed, episodic files written, expand applied a FILE_WRITE, the
  inbox stimulus was archived to processed/, state.md rebuilt with the new
  counter, and each loop produced a `loop NNNNN: integrate` git commit. Loop
  counter advanced 1→2→3; 12 loop_events recorded.
- Confirmed the server serves the built frontend (index.html + assets) and that
  DB state survives a restart.

Known notes (documented in README): tool sandbox is macOS-only; the default
`governor_otpm` (8000) throttles full-`max_tokens` loops — raise it for speed.
