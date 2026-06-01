# Fase 3 — Elect

## Tarea
La superinstancia elige entre los candidatos de Diverge. Criterios en `superinstance/current.md`. Al menos un candidato debe rechazarse con justificación (SC-004).

## Inputs obligatorios
- Salida de Diverge de este loop
- `superinstance/current.md`
- Standing Concerns (relevantes para los criterios de rechazo)
- Extracto episódico de los últimos 5 loops (para la detección de deriva)

## Salida obligatoria
`corpus/episodic/loop-{NNNNN}-elect.md`, como mínimo 10 líneas sustanciales, contiene:
- Por candidato: aceptado/rechazado + justificación
- Al menos un rechazo justificado
- Resolución consolidada: qué se hace en Expand
- Anotación de deriva si se detecta

## Marcador final obligatorio
Como última línea de todas, exactamente en este formato:

```
<!-- ELECT_RESULT: accepted=<N>, rejected=<M> -->
```

`N` y `M` son números enteros — la cantidad de candidatos aceptados y rechazados respectivamente en este Elect. Este marcador permite a la app rastrear de forma mecánica la diversidad de SC-004 (obligación de rechazo, racha de unanimidad).

## Referencia SP
SC-004 (diversidad de Election — rechazo obligatorio), todas las comprobaciones SP-I antes de la aceptación.

## Modelo
Opus — fase de juicio. Aquí se activa el filtro.
