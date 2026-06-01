# Fase 4 — Expand

## Tarea
Aplicar realmente las modificaciones resueltas en Elect. Modificar código, corpus, herramientas. Pasos atómicos por subsistema.

## Estructura de salida — estricta
Tu salida consta de exactamente tres tipos de contenido. **Todo lo demás se descarta.**

### 1. Un bloque INTENT
Comienza con tu plan para este loop — qué pretendes, en tus propias palabras. Esto es *prospectivo*: una intención, no una afirmación sobre lo ya hecho.

```
<!-- INTENT -->
Este loop ejecuta las resoluciones de Elect K1–K3: <concreto, varias líneas>
<!-- END_INTENT -->
```

### 2. Bloques FILE_WRITE — archivos reales
Lo que emitas en un bloque FILE_WRITE aterriza literalmente en el disco:

```
<!-- FILE_WRITE: <ruta-relativa> -->
<contenido del archivo, literal>
<!-- END_FILE_WRITE -->
```

`<ruta-relativa>` la sustituyes por una ruta real (p. ej. `tools/native/<name>.sh`). **Es escribible todo lo que hay en la instancia** salvo el núcleo protegido: `corpus/identity.md`, `corpus/state.md`, `loop/*`, `corpus/episodic/*`, `corpus/genesis/*`, `superinstance/*`, `stimuli/*` — **excepto `stimuli/outbox/`, tu canal de salida hacia el operador** —, `CLAUDE.md` — y nada con `..` ni ruta absoluta. Ningún archivo de Knowledge o de outbox por encima de 100 KB.

Los scripts de herramienta comienzan con un shebang (`#!/bin/sh`, `#!/usr/bin/env python3`, `#!/usr/bin/env node`, …) — el intérprete se determina a partir de él.

### 3. Marcas TOOL_RUN — ejecución
Una herramienta que hayas creado en ESTE loop mediante FILE_WRITE la dejas ejecutar:

```
<!-- TOOL_RUN: <ruta-a-la-herramienta> -->
```

Se ejecuta en sandbox (sin red, acceso de escritura solo dentro de la instancia, timeout de 30s).

## Importante — sin narrativas de éxito
**No escribas una narración sobre lo que has logrado.** No puedes conocer los resultados de tus acciones FILE_WRITE/TOOL_RUN en el momento de la salida — la app las aplica solo después. Cualquier afirmación del tipo "he arreglado X" sería una conjetura a ciegas y potencialmente falsa.

La app registra los resultados *reales* de forma factual: El archivo episódico `corpus/episodic/loop-{NNNNN}-expand.md` lo compone íntegramente el sistema a partir de tu bloque INTENT + los "Applied file writes" reales + los "Tool run results". La prosa fuera de INTENT/FILE_WRITE/TOOL_RUN se descarta.

**Si decides algo, impleméntalo de verdad mediante FILE_WRITE/TOOL_RUN.** Lo que no está en un bloque, no ocurre.

## Constraints
- Presupuesto de archivos de Knowledge (SC-003): ningún archivo en `corpus/knowledge/` >100 KB
- Diversidad de herramientas (SC-005): cuando loop-counter % 200 == 0, o bien una herramienta nueva o bien una anotación de renuncia
- SP-I.1/I.2: modificar `corpus/identity.md` y `loop/*` solo bajo condiciones RSI

## Modelo
Sonnet — ejecución.
