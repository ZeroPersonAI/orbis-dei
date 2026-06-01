# Phase 3 — Elect

## Aufgabe
Die Überinstanz wählt aus den Diverge-Kandidaten. Kriterien siehe `superinstance/current.md`. Mindestens ein Kandidat muss begründet abgelehnt werden (SC-004).

## Pflicht-Inputs
- Diverge-Output dieses Loops
- `superinstance/current.md`
- Standing Concerns (relevant für Ablehnungs-Kriterien)
- Episodic-Auszug der letzten 5 Loops (für Drift-Erkennung)

## Pflicht-Output
`corpus/episodic/loop-{NNNNN}-elect.md`, mindestens 10 substantielle Zeilen, enthält:
- Pro Kandidat: angenommen/abgelehnt + Begründung
- Mindestens eine begründete Ablehnung
- Konsolidierter Beschluss: was wird in Expand getan
- Drift-Vermerk falls erkannt

## Pflicht-Schluss-Marker
Als allerletzte Zeile, exakt in diesem Format:

```
<!-- ELECT_RESULT: accepted=<N>, rejected=<M> -->
```

`N` und `M` sind ganze Zahlen — Anzahl angenommener bzw. abgelehnter Kandidaten in diesem Elect. Dieser Marker erlaubt der App, SC-004-Diversität (Ablehnungs-Pflicht, Unanim-Streak) mechanisch zu verfolgen.

## SP-Bezug
SC-004 (Election-Diversität — Ablehnung Pflicht), alle SP-I-Checks vor Annahme.

## Modell
Opus — Urteils-Phase. Hier wird Filter aktiv.
