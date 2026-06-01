# SC-006 — Stimuli Obligation

Every loop reads in Observe:
- `stimuli/inbox/` — new discrete stimuli
- `stimuli/standing/` — standing orders (this file included)
- `corpus/state.md` — one's own prior state

Processed stimuli migrate, in Integrate, from `stimuli/inbox/` to `stimuli/processed/{YYYY-MM}/`. They are never deleted.

## Lesson from Run 1
Stimulus processing was unstructured. Stimuli disappeared without a trace or were reactivated multiple times.

## Check in Review
If an inbox entry disappears between two loops without surfacing in `processed/` → failure (data loss, SP-I.4 violation).
