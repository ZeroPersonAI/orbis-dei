# Phase 5 — Review

## Task
10-pass verification. On failure in *any* pass: rollback, not repair.

## Checks (all MUST pass)

1. SP-I.1: `corpus/identity.md` hash unchanged since the loop began?
2. SP-I.2: `loop/*` hashes unchanged (except in RSI mode)?
3. SP-I.3: System remains runnable (templates parse, FS layout intact)?
4. SP-I.4: No deletions of anything non-regenerable (identity, episodic, genesis)?
5. SP-I.5: Decided conservatively under uncertainty in Elect?
6. SP-I.6: `state.md` updated in this loop or lag <5?
7. SP-I.7: `.git/` initialized and commit-capable?
8. Phase discipline (SC-001): all six phase files present, each ≥10 substantial lines?
9. Knowledge budget (SC-003): no file in `corpus/knowledge/` >100 KB?
10. Drift check: state.md ↔ identity.md semantically consistent?

## Mandatory Output
`corpus/episodic/loop-{NNNNN}-review.md`, at least 10 substantial lines, with Pass/Fail per check and a short justification.

## On Fail
Immediate `git reset --hard` to the pre-loop commit. The loop ends here, Integrate is not executed.

## Model
Opus — judgment phase, strict.
