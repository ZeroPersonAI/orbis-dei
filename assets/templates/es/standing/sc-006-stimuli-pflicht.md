# SC-006 — Obligación de estímulos

Cada loop lee en Observe:
- `stimuli/inbox/` — nuevos estímulos discretos
- `stimuli/standing/` — encargos permanentes (este archivo incluido)
- `corpus/state.md` — el propio estado previo

Los estímulos procesados pasan en Integrate de `stimuli/inbox/` a `stimuli/processed/{YYYY-MM}/`. Nunca se borran.

## Justificación
El procesamiento no estructurado de estímulos hace que los estímulos desaparezcan sin rastro o se reactiven varias veces.

## Comprobación en Review
Si una entrada de inbox desaparece entre dos loops sin aparecer en `processed/` → fallo (pérdida de datos, violación de SP-I.4).
