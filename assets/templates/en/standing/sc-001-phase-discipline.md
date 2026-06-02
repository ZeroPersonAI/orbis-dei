# SC-001 — Phase Discipline

Every loop iteration produces six standalone phase files: `loop-NNNNN-observe.md`, `…-diverge.md`, `…-elect.md`, `…-expand.md`, `…-review.md`, `…-final.md`. Each file contains at least ten substantial lines — no token lists, no enumerations without content. Consolidating multiple phases into one file is an SP violation.

## Rationale
Without phase discipline, loops collapse into token lists and identical boilerplate enumerations. The system then "ticks" mechanically but does not think.

## Perception in Observe
Inspect the last six phase files. If decay is visible: generate a correction candidate in Diverge.

## Check in Review
All six files exist, each with ≥10 substantial lines. On violation: rollback of the loop modification.
