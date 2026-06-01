# Orbis Dei — Node.js Server Edition

A Node.js server port of the Orbis Dei habitat (originally a Tauri desktop app).
It hosts autopoietic organisms that each run a six-phase metabolic loop
(observe → diverge → elect → expand → review → integrate), isolated with their
own corpus, git history, and constitution.
Autopoiesis – a system's ability to create and sustain itself – marks the decisive shift from AI as a tool to AI as an autonomous living entity. It is the theoretical key to true AGI: a system that is organizationally closed, self-repairing, and capable of survival. Yet today's models lack the existential risk.

The Rust backend was ported faithfully to TypeScript; the React frontend is
reused almost verbatim — only its Tauri coupling layer was swapped for HTTP +
WebSocket (`web/src/lib/transport.ts`).

## Architecture

| Concern        | Tauri original            | This port                                  |
| -------------- | ------------------------- | ------------------------------------------ |
| Host           | Tauri window              | Express HTTP + `ws` WebSocket              |
| Commands       | `#[tauri::command]`       | `POST /api/command/<name>` (JSON args)     |
| Events         | `app.emit(name, payload)` | broadcast over `/ws` as `{event, payload}` |
| DB             | rusqlite                  | `better-sqlite3` (same schema)             |
| Git            | git2 crate                | system `git` via child_process             |
| Secrets        | OS keychain               | AES-256-GCM encrypted file in the data dir |
| File watch     | notify crate              | `chokidar`                                 |
| Tool sandbox   | macOS `sandbox-exec`      | macOS `sandbox-exec` (unchanged)           |

All 47 commands and every event name/payload match the original contract, so
the frontend works unchanged.

## Layout

```
src/                 server (TypeScript, run via tsx)
  server.ts          Express + WebSocket entrypoint
  state.ts           AppState (db, governor, orchestrator, auto-mode, secrets, events)
  commands/index.ts  the 47 command handlers
  core/              instance bootstrap, the cycle, orchestrator, auto-mode, stimulus, chat
  inference/         providers (Anthropic/OpenAI/Gemini), router, prompt, governor
  persistence/       db, fs, git, settings, secrets
assets/templates/    the corpus/loop/standing-concern templates (verbatim from the original)
web/                 the React frontend (Vite); only lib/transport.ts is new
```

## Run

```bash
# 1. install + build everything
npm run setup          # = npm install && npm run build:web

# 2. start the server (serves API + built frontend)
npm start              # http://localhost:1421
```

Then open <http://localhost:1421>, go to Settings, add an Anthropic (or OpenAI /
Gemini) API key, create an instance, and press Play.

### Development

```bash
npm run dev                      # server with reload (tsx watch)
cd web && npm run dev            # Vite dev server on :5173, proxies /api + /ws to :1421
```

## Configuration

- `PORT` — HTTP port (default `1421`).
- `ORBIS_DATA_DIR` — habitat data directory (default: the OS app-data dir +
  `OrbisDei`, e.g. `~/Library/Application Support/OrbisDei` on macOS).
- `ORBIS_SECRET` — optional passphrase for the encrypted secret store. If unset,
  a random key file (`.secret-key`, mode 0600) is created in the data dir.

API keys, models, budgets, rate limits, network policy, and the Telegram bot
are all configured at runtime through the Settings UI.

## Notes

- Tool execution uses macOS `sandbox-exec` (the server is expected to run on
  macOS, as the original app did). With `allow_tool_execution` off (default),
  Expand-phase tools are skipped.
- The Governor's default output-token budget (`governor_otpm` = 8000) throttles
  loops that request the full 16k `max_tokens`; raise it in Settings for faster
  loops.
