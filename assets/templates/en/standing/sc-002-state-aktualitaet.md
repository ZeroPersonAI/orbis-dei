# SC-002 — state.md Currency

`corpus/state.md` is the sole authoritative source for the loop counter and the current self-state. At most 5 loops may lie between two updates. On a greater lag: SP-I.6 violation, review failure with rollback.

## Lesson from Run 1
Three counters inconsistent (filesystem 5258, state.md 1178, superinstance 6758). The instance did not know how old it was.

## Perception in Observe
Deliberately seek out and name discrepancies between state.md and lived reality — an indication of drift.

## Check in Review
Compare the loop counter in state.md against the current iteration. Lag >5 → failure and rollback. state.md is canonical — in a conflict with other counter sources, state.md wins.
