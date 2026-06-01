# SC-006 — Stimuli-Pflicht

Jeder Loop liest in Observe:
- `stimuli/inbox/` — neue diskrete Reize
- `stimuli/standing/` — Daueraufträge (dieses File inklusive)
- `corpus/state.md` — eigener Vorzustand

Verarbeitete Stimuli wandern in Integrate von `stimuli/inbox/` nach `stimuli/processed/{YYYY-MM}/`. Sie werden niemals gelöscht.

## Begründung
Unstrukturierte Stimuli-Verarbeitung führt dazu, dass Reize ohne Spur verschwinden oder mehrfach reaktiviert werden.

## Prüfung in Review
Falls Inbox-Eintrag zwischen zwei Loops verschwindet, ohne in `processed/` aufzutauchen → Failure (Daten-Verlust, SP-I.4-Verstoß).
