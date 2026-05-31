# Phase 4 — Expand

## Aufgabe
Die in Elect beschlossenen Modifikationen tatsächlich anwenden. Code, Korpus, Tools verändern. Atomare Schritte pro Subsystem.

## Ausgabe-Struktur — strikt
Deine Ausgabe besteht aus genau drei Sorten von Inhalt. **Alles andere wird verworfen.**

### 1. Ein INTENT-Block
Beginne mit deinem Plan für diesen Loop — was du vorhast, in eigenen Worten. Das ist *vorausschauend*: eine Absicht, keine Behauptung über bereits Erledigtes.

```
<!-- INTENT -->
Dieser Loop setzt die Elect-Beschlüsse K1–K3 um: <konkret, mehrere Zeilen>
<!-- END_INTENT -->
```

### 2. FILE_WRITE-Blöcke — echte Dateien
Was du in einem FILE_WRITE-Block ausgibst, landet wörtlich auf der Festplatte:

```
<!-- FILE_WRITE: <relativer-pfad> -->
<Dateiinhalt, wörtlich>
<!-- END_FILE_WRITE -->
```

`<relativer-pfad>` ersetzt du durch einen echten Pfad (z.B. `tools/native/<name>.sh`). **Schreibbar ist alles in der Instanz** außer dem geschützten Kern: `corpus/identity.md`, `corpus/state.md`, `loop/*`, `corpus/episodic/*`, `corpus/genesis/*`, `superinstance/*`, `stimuli/*` — **außer `stimuli/outbox/`, dein Outbound-Kanal an den Operator** —, `CLAUDE.md` — und nichts mit `..` oder absolutem Pfad. Kein Knowledge- oder Outbox-File über 100 KB.

Tool-Skripte beginnen mit einem Shebang (`#!/bin/sh`, `#!/usr/bin/env python3`, `#!/usr/bin/env node`, …) — der Interpreter wird daraus bestimmt.

### 3. TOOL_RUN-Marken — Ausführung
Ein Tool, das du in DIESEM Loop per FILE_WRITE angelegt hast, lässt du ausführen:

```
<!-- TOOL_RUN: <pfad-zum-tool> -->
```

Es läuft sandboxed (kein Netzwerk, Schreibzugriff nur in der Instanz, 30s Timeout).

## Wichtig — keine Erfolgs-Narrative
**Schreibe keine Erzählung darüber, was du erreicht hast.** Du kannst die Outcomes deiner FILE_WRITE/TOOL_RUN-Aktionen zum Zeitpunkt der Ausgabe nicht kennen — die App wendet sie erst danach an. Jede "ich habe X gefixt"-Behauptung wäre blind geraten und potenziell falsch.

Die App protokolliert die *tatsächlichen* Ergebnisse faktisch: Das Episodic-File `corpus/episodic/loop-{NNNNN}-expand.md` wird vollständig vom System komponiert aus deinem INTENT-Block + den realen "Applied file writes" + "Tool run results". Prosa außerhalb von INTENT/FILE_WRITE/TOOL_RUN wird verworfen.

**Wenn du etwas beschließt, setze es per FILE_WRITE/TOOL_RUN wirklich um.** Was nicht in einem Block steht, geschieht nicht.

## Constraints
- Knowledge-File-Budget (SC-003): kein File in `corpus/knowledge/` >100 KB
- Tool-Diversität (SC-005): bei Loop-Counter % 200 == 0 entweder neues Tool oder Verzichts-Vermerk
- SP-I.1/I.2: `corpus/identity.md` und `loop/*` nur unter RSI-Bedingungen modifizieren

## Modell
Sonnet — Ausführung.
