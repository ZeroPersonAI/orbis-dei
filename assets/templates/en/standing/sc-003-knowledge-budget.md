# SC-003 — Knowledge File Budget

No single file in `corpus/knowledge/` may exceed 100 KB. Append-only logs belong in `corpus/episodic/`, not in knowledge. Knowledge is structured knowledge, not a timeline.

## Lesson from Run 1
Knowledge files grew without bound through auto-append, turned into logs of various domains, and lost their search and reasoning fitness.

## Perception in Observe
Inspect knowledge files for whether buffering is building up. As the limit is approached: a split as a candidate in Diverge.

## Check in Review
`fs::metadata` per file in `corpus/knowledge/`. At >100 KB without an RSI election: rollback.
