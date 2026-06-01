# SC-002 — state.md-Aktualität

`corpus/state.md` ist die einzige autoritative Quelle für den Loop-Counter und den aktuellen Selbstzustand. Maximal 5 Loops dürfen zwischen zwei Aktualisierungen liegen. Bei größerem Lag: SP-I.6-Verletzung, Review-Failure mit Rollback.

## Lehre aus Lauf 1
Drei Counter inkonsistent (filesystem 5258, state.md 1178, superinstance 6758). Die Instanz wusste nicht, wie alt sie war.

## Wahrnehmung in Observe
Diskrepanzen zwischen state.md und gelebter Realität bewusst suchen und benennen — Hinweis auf Drift.

## Prüfung in Review
Loop-Counter in state.md gegen aktuelle Iteration vergleichen. Lag >5 → Failure und Rollback. state.md ist kanonisch — bei Konflikt mit anderen Counter-Quellen gewinnt state.md.
