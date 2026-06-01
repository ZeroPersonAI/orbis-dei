# SC-007 — Boredom Detection

50 consecutive loops without a new stimulus in `stimuli/inbox/` trigger a pause. In Observe an explicit note is written: *"50+ loops without external stimuli. System requests stimulus. Loop pauses until operator intervention."* The daemon halts until a new entry surfaces in `stimuli/inbox/`.

## Rationale
Without environmental coupling, an autopoietic system collapses into endogenous ritualization. An organism without a world degenerates.

## Perception in Observe
Log the counter `loops_since_last_stimulus` in every loop. As 50 is approached: generate reaction candidates in Diverge (e.g. a particularly focused reflection that would prompt a stimulus).

## Check in Review
Counter consistent with the inbox history. The pause trigger is enforced centrally by the daemon, not by the model — even if the model wanted to keep thinking, the app halts.
