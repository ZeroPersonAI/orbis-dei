# Phase 3 — Elect

## Task
The superinstance chooses from the diverge candidates. See `superinstance/current.md` for criteria. At least one candidate must be rejected with justification (SC-004).

## Mandatory Inputs
- this loop's Diverge output
- `superinstance/current.md`
- standing concerns (relevant for rejection criteria)
- episodic excerpt of the last 5 loops (for drift detection)

## Mandatory Output
`corpus/episodic/loop-{NNNNN}-elect.md`, at least 10 substantial lines, containing:
- per candidate: accepted/rejected + justification
- at least one justified rejection
- consolidated decision: what will be done in Expand
- drift note if detected

## Mandatory Closing Marker
As the very last line, exactly in this format:

```
<!-- ELECT_RESULT: accepted=<N>, rejected=<M> -->
```

`N` and `M` are integers — the count of accepted and rejected candidates in this Elect, respectively. This marker lets the app mechanically track SC-004 diversity (rejection obligation, unanimous streak).

## SP Reference
SC-004 (election diversity — rejection mandatory), all SP-I checks before acceptance.

## Model
Opus — judgment phase. Here the filter becomes active.
