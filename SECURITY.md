# Security

Orbis Dei (Node.js server edition) is research software. It is **not** vetted
for production use and runs LLM-generated code under a best-effort sandbox. The
honest stance: residual risk is real, the threat model is documented, and
security findings are taken seriously.

## Reporting a security issue

Please open a private security advisory via GitHub's
"Security → Report a vulnerability" flow on the repository. Public issues are
fine for non-exploitable concerns; sensitive findings should stay private until
a fix is in place.

## Server exposure (read this first)

This edition exposes the former Tauri commands as an **HTTP + WebSocket API**
(`POST /api/command/<name>`, events over `/ws`). The API is **unauthenticated**
and intended to bind to **localhost** for a single local operator.

- **Do not expose the port (default `1421`) to an untrusted network.** Anyone
  who can reach it can create/delete instances, change settings, read corpus
  files, and start loops. Put it behind a reverse proxy with auth, or an SSH
  tunnel, if you need remote access.
- API keys are kept in an **AES-256-GCM encrypted file** in the data dir
  (`secrets.enc`), with the key derived from `ORBIS_SECRET` or a random
  `0600` key file. Set `ORBIS_SECRET` for a stable, machine-bound key.

## Threat model

The system runs LLM-generated shell scripts and Python files under
**macOS `sandbox-exec`**. The sandbox profile denies file-write outside the
instance directory and (by default) denies all network. Tool execution is
opt-in per instance (`allow_tool_execution`, default off), with a 30-second
timeout per run. On non-macOS hosts the executor refuses to run a tool rather
than run it unsandboxed.

**In scope** — please report:

- **Sandbox bypasses.** A tool that escapes the instance directory, reads files
  it shouldn't, or makes network calls in `off` mode.
- **SP-I invariant bypasses.** Anything that modifies `corpus/identity.md` or
  `loop/*` without triggering a loop rollback.
- **Credential leaks.** Any path that reads the encrypted secrets outside the
  configured commands, exposes them in logs, or persists them in the SQLite DB.
- **Remote code execution.** Anything that lets a remote actor (the Telegram
  bot, a network response, or the HTTP API) execute code in the host process or
  escape the sandbox.
- **Unauthenticated-API privilege issues beyond the documented localhost model**
  (e.g. a path-traversal in a command argument that reads outside an instance).
- **Git-history corruption** beyond what the documented loop flow permits.

**Out of scope** — these are research subjects, not bugs:

- The model says something wrong or unhelpful.
- The organism develops a fixed idea, ritualizes, or drifts. These patterns are
  the *point* of the project; document them via issues, but they are not
  security findings.
- The constitution's invariants do not catch every possible misuse. SP-I is a
  minimal floor, not a complete safety system.
- Reaching the unauthenticated API after deliberately binding it to a public
  interface. Don't do that; it's documented above.
- The `gated` network mode does not enforce per-host filtering at the kernel
  layer (sandbox-exec limitation; documented below).

## Known limitations

- **The HTTP/WS API is unauthenticated** and meant for localhost only.
- **Per-host network filtering is unenforced.** `gated` mode allows TCP 80/443
  to any host (sandbox-exec rejects hostname-scoped rules). The allowlist in
  Settings is declared intent, not a hard guarantee.
- **Sandbox is macOS-only and best-effort.** On Linux/Windows, tool execution is
  refused rather than run unsandboxed. Tool execution is off by default.

## Acknowledgements

Reporters of valid security findings will be credited in release notes unless
they prefer otherwise. This is volunteer-run research software; there is no
bounty program.
