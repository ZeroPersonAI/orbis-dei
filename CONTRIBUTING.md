# Contributing

Thanks for considering a contribution. Orbis Dei is research-grade software —
small, careful, and explicit about its limits. Please read this short note first
so the shape of the project stays coherent.

## Setup

```sh
npm install            # server deps
npm run build:web      # install + build the React frontend into web/dist
npm start              # http://localhost:1421  (serves API + frontend)
```

Development:

```sh
npm run dev                    # server with reload (tsx watch)
cd web && npm run dev          # Vite dev server on :5173, proxies /api + /ws → :1421
npm run typecheck              # tsc --noEmit on the server
```

Requirements: **Node.js ≥ 18** (for global `fetch`) and **git** on `PATH`. The
server runs via `tsx` — no build step. Tool execution (Expand phase) uses macOS
`sandbox-exec`; on Linux/Windows it is refused rather than run unsandboxed, so
the loop still works with tool execution off (the default).

## Code style

- **TypeScript**: keep `npm run typecheck` (`tsc --noEmit`) clean. ESM modules,
  explicit `.ts` import extensions, `fetch` over HTTP libraries.
- **Frontend**: React 19 + Tailwind 4. Mimic the closest existing component. The
  transport layer (`web/src/lib/transport.ts`) is the only seam to the backend —
  keep it thin.
- **Behavioural contracts.** Marker strings, thresholds, and the episodic file
  format are a contract other modules parse — change loop / inference / governor
  behaviour deliberately, with the parsers in mind.
- **Comments**: only where the *why* is non-obvious.
- **Tests / verification**: for non-trivial logic, exercise it end-to-end
  against the running server (create an instance, run a loop). Note what you ran
  in the PR.

## Architectural commitments (easy to miss)

- **Mechanical SP-I in code, not LLM-introspected.** The Review-phase invariant
  checks (`src/core/cycle/invariants.ts`) are the floor; the LLM is the
  qualitative layer on top. Don't move integrity checks into prompts.
- **Read/write firewall.** The Observe chat is read-only (`src/core/chat.ts`
  exposes only read tools); the Composer shapes input. One LLM call should not
  do both.
- **Append-only episodic + git.** No deletes, no rewrites of past loops.
  `git reset --hard` to the pre-loop anchor is the only rollback path.
- **Operator-as-environment.** The operator is not a user (the system does not
  obey) and not a developer (no in-app code editing). Stimuli + read-only
  inspection + daemon control are the operator's surface area.

## What's especially welcome

- **Cross-platform tool sandbox.** `src/core/cycle/sandbox.ts` is the seam —
  Linux via `bubblewrap`/`firejail`, Windows via a container primitive.
- **Auth for the HTTP/WS API** so it can be exposed beyond localhost safely.
- **Per-host network enforcement** via a userspace HTTP proxy (`gated` mode
  currently enforces ports, not hosts).
- Honest bug reports about ritualization or drift in long-running instances.

## What's likely to be declined

- Removing the mechanical SP-I invariants in favour of LLM-judgment-only.
- Letting the chat tab also inject stimuli (the read/write firewall is
  intentional).
- Persistent chat history in the Telegram bot.
- Anything that obscures the difference between operator intent and organism
  output.

## Discussions before big changes

For a substantial feature, open an issue first and outline the plan. Issues and
PRs may be in German or English — both are fine; just don't switch mid-sentence.
