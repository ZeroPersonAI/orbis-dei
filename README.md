# Orbis Dei

A Node.js server that hosts autopoietic organisms. Each organism runs a
six-phase metabolic loop (observe → diverge → elect → expand → review →
integrate), isolated with its own corpus, git history, and constitution.

Autopoiesis – a system's ability to create and sustain itself – marks the
decisive shift from AI as a tool to AI as an autonomous living entity. It is the
theoretical key to true AGI: a system that is organizationally closed,
self-repairing, and capable of survival. Yet today's models lack the existential
risk.

The backend is TypeScript (run via `tsx`); the frontend is React + Vite. They
talk over an HTTP + WebSocket API.

## Architecture

| Concern      | Implementation                                          |
| ------------ | ------------------------------------------------------- |
| Host         | Express HTTP + `ws` WebSocket                           |
| Commands     | `POST /api/command/<name>` (JSON args)                  |
| Events       | broadcast over `/ws` as `{ event, payload }`            |
| Database     | `better-sqlite3`                                        |
| Git          | system `git` (per-loop commits, rollback anchor)        |
| Secrets      | AES-256-GCM encrypted file in the data dir              |
| File watch   | `chokidar` (drives the live `corpus:changed` event)     |
| Tool sandbox | macOS `sandbox-exec` (refused, not run, on other OSes)  |

The frontend reaches the backend through a single transport layer
(`web/src/lib/transport.ts`): `invoke` posts to the command endpoint and
`listen` subscribes to the WebSocket event stream.

## Layout

```
src/                 server (TypeScript, run via tsx)
  server.ts          Express + WebSocket entrypoint
  state.ts           AppState (db, governor, orchestrator, auto-mode, secrets, events)
  commands/index.ts  the command handlers
  core/              instance bootstrap, the cycle, orchestrator, auto-mode, stimulus, chat
  inference/         providers (Anthropic/OpenAI/Gemini), router, prompt, governor
  persistence/       db, fs, git, settings, secrets
assets/templates/    the corpus / loop / standing-concern templates an instance is born with
web/                 the React frontend (Vite)
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

API keys, models, budgets, rate limits, network policy, and the Telegram bot are
all configured at runtime through the Settings UI.

## Notes

- Tool execution uses macOS `sandbox-exec`, so it runs only on macOS; on other
  platforms a tool is refused rather than run unsandboxed. With
  `allow_tool_execution` off (the default), Expand-phase tools are skipped, and
  the full loop works on any platform.
- The Governor's default output-token budget (`governor_otpm` = 8000) throttles
  loops that request the full 16k `max_tokens`; raise it in Settings for faster
  loops.
- The HTTP/WS API is unauthenticated and meant to bind to localhost. See
  [SECURITY.md](SECURITY.md) before exposing it to a network.

---

Built by [ZeroPerson LLC](https://zeroperson.ai) — zeroperson.ai · MIT licensed.
