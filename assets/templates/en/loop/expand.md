# Phase 4 — Expand

## Task
Actually apply the modifications decided in Elect. Change code, corpus, tools. Atomic steps per subsystem.

## Output Structure — strict
Your output consists of exactly three kinds of content. **Everything else is discarded.**

### 1. One INTENT block
Begin with your plan for this loop — what you intend to do, in your own words. This is *forward-looking*: an intention, not a claim about something already done.

```
<!-- INTENT -->
This loop implements the Elect decisions C1–C3: <concrete, multiple lines>
<!-- END_INTENT -->
```

### 2. FILE_WRITE blocks — real files
What you emit in a FILE_WRITE block lands verbatim on disk:

```
<!-- FILE_WRITE: <relative-path> -->
<file content, verbatim>
<!-- END_FILE_WRITE -->
```

Replace `<relative-path>` with a real path (e.g. `tools/native/<name>.sh`). **Everything in the instance is writable** except the protected core: `corpus/identity.md`, `corpus/state.md`, `loop/*`, `corpus/episodic/*`, `corpus/genesis/*`, `superinstance/*`, `stimuli/*` — **except `stimuli/outbox/`, your outbound channel to the operator** —, `CLAUDE.md` — and nothing with `..` or an absolute path. No knowledge or outbox file over 100 KB.

Tool scripts begin with a shebang (`#!/bin/sh`, `#!/usr/bin/env python3`, `#!/usr/bin/env node`, …) — the interpreter is determined from it.

### 3. TOOL_RUN markers — execution
A tool that you created in THIS loop via FILE_WRITE, you have executed:

```
<!-- TOOL_RUN: <path-to-tool> -->
```

It runs sandboxed (no network, write access only within the instance, 30s timeout).

## Important — no success narratives
**Do not write a narrative about what you have achieved.** You cannot know the outcomes of your FILE_WRITE/TOOL_RUN actions at the time of output — the app applies them only afterward. Any "I fixed X" claim would be a blind guess and potentially wrong.

The app records the *actual* results factually: the episodic file `corpus/episodic/loop-{NNNNN}-expand.md` is composed entirely by the system from your INTENT block + the real "Applied file writes" + "Tool run results". Prose outside of INTENT/FILE_WRITE/TOOL_RUN is discarded.

**If you decide on something, actually carry it out via FILE_WRITE/TOOL_RUN.** What is not in a block does not happen.

## Constraints
- Knowledge file budget (SC-003): no file in `corpus/knowledge/` >100 KB
- Tool diversity (SC-005): at loop counter % 200 == 0, either a new tool or an abstention note
- SP-I.1/I.2: modify `corpus/identity.md` and `loop/*` only under RSI conditions

## Model
Sonnet — execution.
