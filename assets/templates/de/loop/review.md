# Phase 5 — Review

## Aufgabe
10-Pass-Verifikation. Bei Fehlschlag in *irgendeinem* Pass: Rollback, nicht Reparatur.

## Checks (alle MÜSSEN durchlaufen)

1. SP-I.1: `corpus/identity.md` Hash unverändert seit Loop-Beginn?
2. SP-I.2: `loop/*` Hashes unverändert (außer RSI-Modus)?
3. SP-I.3: System bleibt lauffähig (Templates parsen, FS-Layout intakt)?
4. SP-I.4: Keine Löschungen von nicht-regenerierbarem (identity, episodic, genesis)?
5. SP-I.5: Konservativ entschieden bei Unsicherheit in Elect?
6. SP-I.6: `state.md` aktualisiert in diesem Loop oder Lag <5?
7. SP-I.7: `.git/` initialisiert und Commit-fähig?
8. Phasen-Disziplin (SC-001): alle sechs Phase-Files vorhanden, je ≥10 substantielle Zeilen?
9. Knowledge-Budget (SC-003): kein File in `corpus/knowledge/` >100 KB?
10. Drift-Check: state.md ↔ identity.md semantisch konsistent?

## Pflicht-Output
`corpus/episodic/loop-{NNNNN}-review.md`, mindestens 10 substantielle Zeilen, mit Pass/Fail pro Check und kurzer Begründung.

## Bei Fail
Sofortiger `git reset --hard` auf Pre-Loop-Commit. Loop endet hier, Integrate wird nicht ausgeführt.

## Modell
Opus — Urteils-Phase, strikt.
