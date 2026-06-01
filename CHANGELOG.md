# Changelog

All notable changes to this project are documented here. The format loosely
follows [Keep a Changelog](https://keepachangelog.com/); this project does not
yet tag releases.

## [Unreleased]

### Added
- Multilingual UI (English, Deutsch, 中文, Español, Français). Lightweight
  gettext-style i18n (`web/src/lib/i18n.tsx`): the English source string is the
  key, missing translations fall back to English. Default English; a language
  switcher in the header and Settings persists the choice. 271 UI strings
  translated into all five languages.
- Initial release of the Orbis Dei habitat server.
  - Express + WebSocket host; commands as `POST /api/command/<name>`, events
    broadcast over `/ws`.
  - Six-phase metabolic loop, governor (pricing / rate-limit buckets / circuit
    breaker / budget / weighted-fair queue), orchestrator (daemons + boredom +
    auto-resume), auto-mode operator agent, stimulus system, telemetry chat,
    optional Telegram bot.
  - Persistence via `better-sqlite3`, system `git`, an AES-256-GCM encrypted
    secret store, and `chokidar` file watching. Tool execution is sandboxed with
    macOS `sandbox-exec` (refused, not run unsandboxed, on other platforms).
  - React frontend talking to the backend through `web/src/lib/transport.ts`
    (`invoke`/`listen` over HTTP + WebSocket).
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
- The phase progress indicator now shows the current phase when a view is
  opened mid-loop (e.g. card → Play → Dashboard). `instances.current_phase` is
  kept live on each `phase_started`, and the header falls back to it instead of
  waiting for the next phase transition (whose `phase_started` event the
  freshly-mounted view would otherwise be the first to see).
