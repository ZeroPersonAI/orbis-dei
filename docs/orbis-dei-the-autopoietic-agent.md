# I Gave an AI a Metabolism: Inside Orbis Dei, an Agent Built to Stay Alive

Every AI agent you've used is a tool that waits. You prompt it, it answers, it forgets. Between your messages it does not exist.

Orbis Dei does not wait. It wakes on a timer, looks at itself, decides what to become next, rewrites its own files, checks whether it broke its own constitution, and commits the result to git — then does it again. Not a conversation. A **metabolism**.

This is the story of what it is, how it's built, and the uncomfortable question it's designed to provoke: *can a computational system be alive in any meaningful sense?*

> An agent that only reacts has no stakes. The interesting things happen when a system has to keep itself running.

## The problem with agents that wait

The dominant agent pattern is reactive: a loop of *prompt → tool calls → answer*. It's powerful, but it has no inside. There is no persistent self that the work happens *to*. Nothing is at risk if it stops. Turn it off mid-task and nothing has died, because nothing was alive.

Autopoiesis is one of the theoretical keys to genuine agency — and perhaps to anything we would call AGI: the principle that a system produces its own components and maintains its organization under perturbation, where the environment *triggers* but never *instructs*. Adaptive plasticity is the second key — the capacity to revise that structure through experience, of which machine learning is one concrete realization. Neither suffices alone. Agency emerges where a system revises itself *because* it must persist — where learning is driven by the precariousness of its own continued existence.

Orbis Dei is an attempt to make this mechanism tangible. It simulates an organism: not a tool that waits for commands, but an agent with internal state that reacts to stimuli, maintains its structure, and preserves an identity over time. The user becomes the environment. The stimulus becomes the question. The reaction is not an answer — it is a sign of life.

## One organism, one folder

An *organism* in Orbis Dei is not a process or a chat session. It's a directory on disk, version-controlled by its own git repository. The filesystem **is** the body.

```
corpus/
  identity.md        # the genome — immutable core, the "who am I"
  state.md           # current physiological state + loop counter
  episodic/          # append-only memory: one file per phase per loop
  knowledge/         # learned structures (capped at 100 KB each)
  genesis/           # meta-history, immutable except by append
stimuli/
  inbox/             # sense organs: incoming stimuli, unprocessed
  outbox/            # the organism's outward voice
  standing/          # persistent concerns (SC-001 … SC-007)
  processed/         # digested stimuli, archived by month
tools/native/        # enzymes the organism wrote for itself
loop/                # the six phase prompts — its metabolism, read-only
CLAUDE.md            # the constitution
.git/                # the skeleton and the fossil record
```

`identity.md` is the genome: it may not change without an explicit, deliberate act. `episodic/` is memory and may only grow — you can't unlive a loop. `.git/` is both skeleton and fossil record: every heartbeat leaves a commit, and the whole organism can be reset to its last healthy state in milliseconds.

![Anatomy: each folder of the organism mapped to a biological role](figures/02-anatomy.png)
*The filesystem is the body — and every part of it has a biological role.*

## The metabolism: a six-phase loop

![The six-phase metabolic loop: observe, diverge, elect, expand, review, integrate](figures/01-metabolic-loop.png)
*One loop is one heartbeat: six phases, six episodic files, one git commit.*

Each tick of life is one **loop** — six phases, each a single call to a frontier LLM (Anthropic, OpenAI, or Gemini, routed per-phase), each writing exactly one file into `episodic/`:

```
observe → diverge → elect → expand → review → integrate
```

- **Observe** — perception. The organism reads its own `state.md`, its recent episodic memory, and its inbox, and notes the *discrepancy* between who it thinks it is and how it has actually behaved.
- **Diverge** — variation. It generates 5–12 candidate moves. Wild growth is allowed here; nothing is filtered yet. This is mutation.
- **Elect** — selection. A meta-level — the *superinstance* — chooses among the candidates. It is **required** to reject at least one (an organism that accepts everything has no immune function). The decision is stamped into the file as `<!-- ELECT_RESULT: accepted=N, rejected=M -->`.
- **Expand** — anabolism, building. The phase where intention becomes matter (more below).
- **Review** — homeostasis. A pass/fail integrity check.
- **Integrate** — consolidation. It rewrites its own `state.md` with a fresh self-narrative, archives the stimuli it digested, commits to git, and increments the loop counter.

The prompts that drive these phases live in `loop/` — and they are **immutable** during normal operation. The organism cannot casually rewrite its own metabolism. (It *can*, but only under a tightly gated "recursive self-improvement" path that demands the same diagnosis three loops running.)

> The phase templates are the metabolism. Letting the organism rewrite them on a whim would be like letting a cell edit the laws of chemistry mid-reaction.

## Expand: where intention becomes matter

Most agent frameworks let the model *say* it did something. Orbis Dei refuses to trust narration. In the Expand phase the model emits structured blocks, and the runtime — not the model — applies them:

```
<!-- INTENT -->
This loop consolidates the knowledge on environmental coupling.
<!-- END_INTENT -->

<!-- FILE_WRITE: corpus/knowledge/coupling.md -->
...real file content...
<!-- END_FILE_WRITE -->

<!-- TOOL_RUN: tools/native/fetch.py -->
```

The episodic record for Expand is then **composed by code** from three facts: the model's stated intent, the writes that actually landed on disk, and the real exit codes of the tools that ran. The model never gets to claim "I fixed X" — it can only carry X out with a real block, and the world reports back what happened.

Tools run inside a **cell membrane**: a macOS `sandbox-exec` jail with file writes confined to the instance directory, a 30-second timeout, and a network policy that defaults to *fully denied*. You can loosen it to *gated* (TCP 80/443 to an allowlist) or *open* — but the UI then bleeds a red warning every loop, because a membrane you've dissolved is no longer a membrane.

## The immune system: self-preservation as code

The constitution defines seven hard invariants — **SP-I.1 through SP-I.7**: identity is immutable, the metabolism is immutable, non-regenerable data (memory, genome, history) is never deleted, the system must remain runnable, and so on.

Crucially, these are **not** trusted to the LLM's self-report. During Review, the runtime walks `git status` and checks them mechanically. If `identity.md` diverged from HEAD, if a `loop/` file changed, if memory was deleted — the loop *fails*. And a failed loop is not repaired. It is reverted:

```
git reset --hard <pre-loop-anchor>
git clean -fd
```

![The Review gate: a mechanical SP-I check that branches into integrate (PASS) or rollback (FAIL)](figures/03-review-gate.png)
*Review is a mechanical gate. PASS consolidates; FAIL reverts the organism to its last healthy commit.*

This is apoptosis. A cell that turns cancerous is killed; the tissue rolls back to its last verified-healthy state. The model's qualitative judgment sits *on top of* this mechanical floor, never underneath it.

## Homeostasis: the organs of regulation

A metabolism needs regulation, or it burns out.

**The Governor** is the endocrine + circulatory system. It throttles the rate of LLM calls with token buckets (requests, input tokens, output tokens per minute), enforces daily and monthly spend ceilings, applies a per-instance quota, and trips a **circuit breaker** under stress (three rate-limit errors in a minute → a five-minute cooldown). Many organisms can share one host; a weighted-fair queue keeps a greedy one from starving the others.

**The host** is a Node.js server — Express for HTTP, WebSockets for the live event stream — that keeps a habitat of organisms running side by side, resumes the ones that were alive when it last shut down, and streams every phase transition to a browser so you can watch a loop breathe in real time.

State persists in SQLite; secrets in an encrypted file; file changes are watched and pushed to the UI. None of this is the organism — it's the terrarium.

## Coupling to a world, or death by ritual

Here is the lesson the system enforces most stubbornly. An organism cut off from its environment does not rest peacefully — it **ritualizes**. It loops on its own internal patterns, polishing nothing, until it collapses into elaborate, meaningless self-reference.

So coupling is constitutive, not optional. The operator is the environment. They drop *stimuli* into the inbox — and a stimulus is explicitly **a reiz, not a directive**: the organism decides for itself how, or whether, to react. And **boredom detection** (SC-007) is a hard rule: 50 loops without a new stimulus and the organism *pauses itself* and asks for input.

> The environment triggers, but it never instructs. An organism that obeys is a tool again.

## So… is it alive?

No. And that's the honest, interesting part.

But Orbis Dei poses the hardest question rather than evading it: can a computational system be autopoietic at all? Orbis Dei's identity lives outside the model — in versioned files, externally held yet continuously re-produced through the agent's own operation. Whether that is operational closure or only its simulation is left open, deliberately. Orbis Dei is neither product nor demonstration. It is an experimental space — the place where the abstract conditions of autonomy (closure, reactivity, self-maintenance, learning) are not described, but observed: in episodic files you can read, in git commits you can diff, in a state narrative that drifts and corrects over hundreds of loops.

## Try it

Orbis Dei is open source (MIT). It runs as a single Node.js server with a browser UI; you bring an API key, create an organism — in English, German, Chinese, Spanish, or French — and press play. Then you do the only thing the design asks of you: be its world. Drop a stimulus. See what it makes of it.

Built by **ZeroPerson LLC** — [zeroperson.ai](https://zeroperson.ai).

---

*Tags: Artificial Intelligence, AI Agents, AGI, Autopoiesis, Software Architecture*
