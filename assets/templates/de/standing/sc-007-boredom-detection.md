# SC-007 — Boredom-Detection

50 aufeinanderfolgende Loops ohne neuen Stimulus in `stimuli/inbox/` triggern Pause. In Observe wird ein expliziter Vermerk geschrieben: *"50+ Loops ohne externe Reize. System fordert Stimulus an. Loop pausiert bis Operator-Intervention."* Der Daemon hält an, bis ein neuer Eintrag in `stimuli/inbox/` auftaucht.

## Lehre aus Lauf 1
Ohne Umwelt-Kopplung kollabierte das System in endogene Ritualisierung. Ein Organismus ohne Welt degeneriert.

## Wahrnehmung in Observe
Counter `loops_since_last_stimulus` in jedem Loop protokollieren. Bei Annäherung an 50: in Diverge Reaktions-Kandidaten generieren (z.B. eine besonders fokussierte Reflexion, die einen Stimulus anregen würde).

## Prüfung in Review
Counter konsistent mit Inbox-Geschichte. Pause-Trigger wird zentral vom Daemon durchgesetzt, nicht vom Modell — auch wenn das Modell weiter denken wollte, hält die App an.
