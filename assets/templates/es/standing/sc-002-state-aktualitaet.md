# SC-002 — Actualidad de state.md

`corpus/state.md` es la única fuente autoritativa para el contador de loop y el estado propio actual. Como máximo pueden transcurrir 5 loops entre dos actualizaciones. Ante un lag mayor: violación de SP-I.6, fallo de Review con rollback.

## Justificación
Contadores divergentes (filesystem, state.md, superinstance) hacen que la instancia deje de saber qué edad tiene. Una única fuente autoritativa lo evita.

## Percepción en Observe
Buscar y nombrar conscientemente las discrepancias entre state.md y la realidad vivida — indicio de deriva.

## Comprobación en Review
Comparar el contador de loop en state.md con la iteración actual. Lag >5 → fallo y rollback. state.md es canónico — ante conflicto con otras fuentes de contador gana state.md.
