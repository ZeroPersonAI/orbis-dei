# Changelog

All notable changes to this project are documented here. The format loosely
follows [Keep a Changelog](https://keepachangelog.com/); this project does not
yet tag releases.

## [Unreleased]

### Added
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

### Added
- Per-instance **coupling level** (`mirror` / `gated` / `open`) — a single
  selectable knob for how strongly an organism is coupled to the world. It
  replaces the old global network/tool toggles: `mirror` = no network, no tools
  (a closed mirror that only metabolizes its own corpus + operator stimuli);
  `gated` = tools on, network limited to the allowlisted hosts; `open` = tools
  on, raw network (red-warned each loop). Selectable when creating an instance
  (defaults to `mirror`) and switchable live in the instance header. The
  underlying sandbox / allowlist / warning / invariants are unchanged. Existing
  instances are migrated from the previous global settings so behavior is
  preserved; the host allowlist stays global (shared by Gated-coupled instances).

### Removed
- Global `network_access` and `allow_tool_execution` settings — superseded by the
  per-instance coupling level above.
- Cost / budget tracking. The dollar-spend badge, the daily/monthly budget and
  per-instance quota settings, the pre-flight budget refusals, the per-model
  pricing table, and the `inference_calls.cost_usd` column are all gone (an
  automatic migration drops the column from existing databases). The governor
  keeps its rate-limit buckets (RPM/ITPM/OTPM) and circuit breaker, and
  per-call token counts are still recorded — only the money figures were removed.

### Changed
- The project is English-only — UI, organism constitution and loop prompts, and
  all generated text. (Earlier exploratory multilingual support was removed.)
- Default organism templates are generic and self-contained: no run/incarnation
  history, personal names, or references to predecessor archive files a fresh
  instance never has. A new instance reads as a freshly born, first-of-its-kind
  organism at Loop 1.
- Settings UI text corrected: secrets are stored in an encrypted file in the
  data directory, not the macOS Keychain.
- Loop robustness — self-correcting phases. A phase that fails a *mechanical*
  check (too-thin SC-001 output, or a Review not beginning with `PASS`/`FAIL`)
  is now re-called up to twice with the concrete failure reason appended, before
  the loop fails. Integrity failures (a deliberate Review `FAIL`, SP-I invariant
  violations, missing prior-phase files) still roll back immediately and are
  never retried.
- Loop robustness — a single rolled-back loop no longer kills the daemon. Soft
  failures are retried on the next loop; the daemon only stops on an
  unrecoverable config error or after three consecutive failures, so a transient
  thin loop can no longer park an instance in `error`.

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
