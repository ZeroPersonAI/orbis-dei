# SC-003 — Knowledge-File-Budget

Keine einzelne Datei in `corpus/knowledge/` darf 100 KB überschreiten. Append-only-Logs gehören in `corpus/episodic/`, nicht in Knowledge. Knowledge ist strukturiertes Wissen, kein Zeitstrahl.

## Lehre aus Lauf 1
Knowledge-Files wuchsen unbeschränkt durch Auto-Append, wurden zu Logs verschiedener Domains, verloren ihre Such- und Reasoning-Tauglichkeit.

## Wahrnehmung in Observe
Knowledge-Files prüfen, ob Pufferung sich anbahnt. Bei Annäherung an Limit: in Diverge eine Aufspaltung als Kandidat.

## Prüfung in Review
`fs::metadata` pro File in `corpus/knowledge/`. Bei >100 KB ohne RSI-Election: Rollback.
