# SC-004 — Election Diversity

Every election must reject at least one candidate with justification. A 100% acceptance rate across 20 consecutive loops triggers automatic RSI diagnosis of the superinstance (suspected filter failure).

## Rationale
When all candidates are accepted over long stretches, the superinstance is no longer a filter, but an echo of the Diverge phase.

## Perception in Elect
Explicitly ask: "Which candidate is rejected and why?" If no answer is possible: too little diversity in Diverge, regenerate in Diverge with a targeted counterposition.

## Check in Review
SQL aggregation over the last 20 elections. At 20× unanimous → warning and RSI trigger note in `corpus/genesis/`. No automatic rollback of individual loops, but structural attention is forced.
