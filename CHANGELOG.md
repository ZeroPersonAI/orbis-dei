# Changelog

All notable changes to this project are documented here. The format loosely
follows [Keep a Changelog](https://keepachangelog.com/); this project does not
yet tag releases.

## [Unreleased]

### Added
- Initial Node.js server edition: a faithful TypeScript port of the Orbis Dei
  Tauri/Rust habitat.
  - Express + WebSocket host; all 47 commands as `POST /api/command/<name>`,
    events broadcast over `/ws`.
  - Six-phase metabolic loop, governor (pricing / rate-limit buckets / circuit
    breaker / budget / weighted-fair queue), orchestrator (daemons + boredom +
    auto-resume), auto-mode operator agent, stimulus system, telemetry chat,
    optional Telegram bot.
  - Substitutions vs. the original: `better-sqlite3` (same schema), system
    `git`, AES-256-GCM encrypted secret store, `chokidar` file watching. macOS
    `sandbox-exec` kept for tool execution; refused (not run unsandboxed) on
    other platforms.
  - React frontend reused verbatim except `web/src/lib/transport.ts`, which
    re-implements `invoke`/`listen` over HTTP + WebSocket.
- Global `unhandledRejection` / `uncaughtException` handlers so a background
  daemon or auto-mode error logs a stack trace instead of silently exiting.

### Fixed
- Pause now emits `daemon:stopped` immediately (instead of only when the
  in-flight cycle reaches a cancellation checkpoint), so the instance view's
  Pause button reacts instantly.
- Instance view now reflects a pause everywhere immediately: the Dashboard
  status badge re-fetches on daemon/loop transitions (not only on corpus file
  changes), and the loop phase indicator resets to idle when the daemon stops
  (a cooperatively-cancelled loop emits no terminal loop event).
