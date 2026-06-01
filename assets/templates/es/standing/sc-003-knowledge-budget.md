# SC-003 — Presupuesto de archivos de Knowledge

Ningún archivo individual en `corpus/knowledge/` puede superar los 100 KB. Los logs append-only pertenecen a `corpus/episodic/`, no a Knowledge. Knowledge es conocimiento estructurado, no una línea temporal.

## Justificación
Los archivos de Knowledge que crecen sin límite degeneran por auto-append en logs de distintos dominios y pierden su aptitud para la búsqueda y el razonamiento.

## Percepción en Observe
Revisar los archivos de Knowledge para ver si se está gestando un almacenamiento excesivo. Al acercarse al límite: una división como candidato en Diverge.

## Comprobación en Review
`fs::metadata` por cada archivo en `corpus/knowledge/`. Si >100 KB sin Election RSI: rollback.
