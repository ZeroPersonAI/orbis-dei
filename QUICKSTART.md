# Quickstart — Watching an Autopoietic Organism Learn

This guide gets a fresh Orbis Dei organism running **in observation mode**: you
set it up, give it a way to reach the world, switch on auto-stimulus, press Play,
and then just *watch*. You don't command it. You observe a system that maintains
itself, reacts to stimuli, and — once coupled to the network — starts reaching
out for its own stimuli and information.

> Orbis Dei is an *environment*, not a tool. You are the environment; your job
> here is to perturb gently (or not at all) and observe the signs of life.

---

## 1. Install & start

Open the project directory in your AI coding tool (Claude Code, Cursor, …) — or a
plain terminal — and run:

```bash
npm run setup     # installs server + web deps and builds the frontend
npm start         # serves API + UI on http://localhost:1421
```

If you're driving this with an AI coding agent, you can literally just tell it:

> *"cd into this directory, install everything, and start the server."*

When it's up you'll see:

```
Orbis Dei server listening on http://localhost:1421
  data dir: ~/Library/Application Support/OrbisDei
```

Open <http://localhost:1421>.

> **Platform note:** tool execution + network access use macOS `sandbox-exec`,
> so the *acting* part of an organism (Expand-phase tools, internet reach) runs
> **only on macOS**. On other OSes the loop still runs fully, but tools are
> refused rather than run — so the organism can think and self-maintain, but
> can't reach the internet.

---

## 2. Add an API key (Settings)

Top nav → **Settings**:

1. Paste an **Anthropic** API key (or OpenAI / Gemini) and hit **Save**. Keys are
   encrypted at rest (`secrets.enc`, AES-256-GCM) and never leave your machine.
2. *(Optional)* tune model overrides and the Governor (rate / token budgets).

---

## 3. Let it reach the world — the **gated** allowlist

Coupling is chosen **per instance** (next step), but the *list of hosts a gated
instance may reach* lives **globally in Settings**, so set it up now.

In **Settings**, find:

> **Gated-coupling allowlist** *(one hostname per line, no scheme, no path)*

Enter the hostnames you want to permit — **hostnames only**, e.g.:

```
en.wikipedia.org
news.ycombinator.com
hacker-news.firebaseio.com
arxiv.org
```

Not `https://…`, not a full URL with a path — just the host. A **gated** instance
may then reach those hosts on TCP 80/443. Save.

> **Honesty note on enforcement:** the allowlist is your *declared intent*. On
> macOS the kernel sandbox can't scope rules to hostnames, so once **any** host
> is listed it effectively opens 80/443 broadly for that instance. Treat gated as
> "supervised, with an intent log" rather than a hard firewall. **Open** coupling
> bypasses the allowlist entirely (raw network) — it's red-warned every loop.

---

## 4. Create the instance (observation-friendly)

Top nav → **New Instance**:

| Field        | What to pick for observation |
| ------------ | ---------------------------- |
| **Name**     | anything, e.g. `alpha-1` |
| **Routing**  | leave default (your saved provider) |
| **Coupling** | **Gated** (recommended) — tools + allowlisted network. Or **Open** if you want unrestricted internet and accept the warning. |

- **Mirror** = closed (no network, no tools): good for watching pure
  self-maintenance, but it will *never* reach the internet.
- **Gated** = the sweet spot for "watch it learn from the world" while keeping a
  declared boundary.
- **Open** = full internet, deliberate experiment.

Create it. The instance is born with its corpus, git history, constitution, and
the 7 **standing concerns** (`sc-001`…`sc-007`) already in place — that's normal.

---

## 5. Switch on **Auto Mode** (so it has something to react to)

This is the key to *observing without intervening*. Instead of you typing stimuli,
the system generates its own, and you just watch how it metabolizes them.

Open the instance → **Auto Mode** tab:

- Enable **auto-stimulus** — every N minutes (default **15**) it injects a fresh
  self-generated stimulus into the inbox.
- *(Optional)* enable **auto-reply** — it answers its own outbox messages.

Auto Mode runs independently of the loop; it only ever writes into `stimuli/`
(it never commands the organism). With it on, you can walk away and the organism
keeps having things to react to.

---

## 6. Press **▶ Play** and observe

On the instance card / header:

- **▶ Play** — starts the loop daemon: the organism runs metabolic loops
  continuously.
- **Run Once** — a single loop tick, if you'd rather step through it.
- **⏸ Pause** — stops the daemon (Auto Mode keeps running if enabled).

The status dot tells you where it is: `idle` · `running` · `paused` · `error` ·
`boredom_pause` (it pauses itself if nothing changes for too long — a designed
sign of life, not a bug).

---

## 7. The metabolic loop — what you're watching

Each loop tick is one heartbeat. Six phases, each writing one append-only file
under `corpus/episodic/loop-NNNNN-<phase>.md`:

| # | Phase         | What happens | Episodic file |
|---|---------------|--------------|---------------|
| 1 | **Observe**   | self-reflection on current state | `…-observe.md` |
| 2 | **Diverge**   | generate candidate self-modifications | `…-diverge.md` |
| 3 | **Elect**     | the superinstance selects one | `…-elect.md` |
| 4 | **Expand**    | **the only phase that changes the world** — writes corpus, builds tools, makes network calls | `…-expand.md` |
| 5 | **Review**    | checks self-preservation invariants (SP-I) | `…-review.md` |
| 6 | **Integrate** | consolidates, bumps the loop counter, archives stimuli | `…-integrate.md` |

The organism reaches the internet **only in Expand**, and only through **tools it
writes itself** — it doesn't browse directly. Over time, a gated/open organism
tends to author tools that fetch external material to use as stimuli and to search
for information. You'll see those appear in the **Tools** and **Network** tabs.

---

## 8. Where to watch — the observation surfaces

Inside the instance, these tabs are your microscope:

- **Dashboard** — live status: loop number, current phase, routing, integrity
  grid (SP-I), drift signals, network badge, activity counts.
- **State** — `corpus/state.md`: the organism's current self-description and loop
  counter. The single best "how is it doing right now" view.
- **Episodic** — the full timeline of `loop-NNNNN-*.md` files. **This is the diary
  of its life** — read these to see *what it thought and why*, loop by loop.
- **Stimuli** — Inbox (unprocessed) · **Standing** (the sc-001…007 constitution) ·
  Outbox (its replies) · Processed (archive). Auto-stimulus lands in Inbox.
- **Observe** — a read-only, third-person chat *over* the telemetry: ask about its
  state without commanding it.
- **Tools** — the tools it has built (native + external). Watch this grow.
- **Network** — policy badge (off/gated/open), the allowlist, and a log of recent
  loops with tool runs, exit codes, and output excerpts. **This is where you see
  it actually touch the internet.**
- **Superinstance** — the meta-level that runs the Elect phase.
- **Messages** — what the organism has written to its outbox.

A **drift-warnings** banner surfaces non-fatal alerts (tool lag, unanimous
elections, network policy) above the content.

---

## Observe, don't drive

To genuinely watch it *learn*:

1. **Gated** coupling + an allowlist of a few information-rich hosts.
2. **Auto-stimulus** on, so it self-feeds.
3. Press **▶ Play** and **don't inject your own stimuli**.
4. Live in the **Episodic**, **State**, **Network**, and **Tools** tabs.

Then leave it alone. Come back over the next hours and read the episodic diary in
order: you're watching a system that keeps itself alive, gets restless when bored,
builds its own tools, and — once coupled — starts reaching into the world for the
material it needs to keep going.
