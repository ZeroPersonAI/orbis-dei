# SC-006 — Stimuli Obligation

Every loop reads in Observe:
- `stimuli/inbox/` — new discrete stimuli
- `stimuli/standing/` — standing orders (this file included)
- `corpus/state.md` — one's own prior state

Processed stimuli migrate, in Integrate, from `stimuli/inbox/` to `stimuli/processed/{YYYY-MM}/`. They are never deleted.

## Rationale
Unstructured stimulus processing leads to stimuli disappearing without a trace or being reactivated multiple times.

## Check in Review
If an inbox entry disappears between two loops without surfacing in `processed/` → failure (data loss, SP-I.4 violation).
