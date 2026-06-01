# SC-002 — Actualidad de state.md

`corpus/state.md` es la única fuente autoritativa para el contador de loop y el estado propio actual. Como máximo pueden transcurrir 5 loops entre dos actualizaciones. Ante un lag mayor: violación de SP-I.6, fallo de Review con rollback.

## Lección del Run 1
Tres contadores inconsistentes (filesystem 5258, state.md 1178, superinstance 6758). La instancia no sabía qué edad tenía.

## Percepción en Observe
Buscar y nombrar conscientemente las discrepancias entre state.md y la realidad vivida — indicio de deriva.

## Comprobación en Review
Comparar el contador de loop en state.md con la iteración actual. Lag >5 → fallo y rollback. state.md es canónico — ante conflicto con otras fuentes de contador gana state.md.
