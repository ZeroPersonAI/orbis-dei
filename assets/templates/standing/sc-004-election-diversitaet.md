# SC-004 — Election-Diversität

Jede Election muss mindestens einen Kandidaten begründet ablehnen. Eine 100%-Annahme-Quote über 20 aufeinanderfolgende Loops triggert automatische RSI-Diagnose der Überinstanz (Filter-Versagen-Verdacht).

## Lehre aus Lauf 1
Über lange Strecken wurden alle Kandidaten angenommen. Die Überinstanz war kein Filter mehr, sondern ein Echo der Diverge-Phase.

## Wahrnehmung in Elect
Explizit fragen: "Welcher Kandidat wird verworfen und warum?" Falls keine Antwort möglich: in Diverge zu wenig Diversität, in Diverge neu generieren mit gezielter Gegenposition.

## Prüfung in Review
SQL-Aggregation über die letzten 20 Elections. Bei 20× unanim → Warning und RSI-Trigger-Vermerk in `corpus/genesis/`. Kein automatischer Rollback einzelner Loops, aber strukturelle Aufmerksamkeit erzwungen.
