# SC-002 — state.md-Aktualität

`corpus/state.md` ist die einzige autoritative Quelle für den Loop-Counter und den aktuellen Selbstzustand. Maximal 5 Loops dürfen zwischen zwei Aktualisierungen liegen. Bei größerem Lag: SP-I.6-Verletzung, Review-Failure mit Rollback.

## Begründung
Divergierende Counter (Filesystem, state.md, superinstance) führen dazu, dass die Instanz nicht mehr weiß, wie alt sie ist. Eine einzige autoritative Quelle verhindert das.

## Wahrnehmung in Observe
Diskrepanzen zwischen state.md und gelebter Realität bewusst suchen und benennen — Hinweis auf Drift.

## Prüfung in Review
Loop-Counter in state.md gegen aktuelle Iteration vergleichen. Lag >5 → Failure und Rollback. state.md ist kanonisch — bei Konflikt mit anderen Counter-Quellen gewinnt state.md.
