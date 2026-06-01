# SC-007 — Detección de aburrimiento

50 loops consecutivos sin un nuevo estímulo en `stimuli/inbox/` disparan una pausa. En Observe se escribe una anotación explícita: *"50+ loops sin estímulos externos. El sistema solicita estímulo. El loop se pausa hasta intervención del operador."* El daemon se detiene hasta que aparece una nueva entrada en `stimuli/inbox/`.

## Justificación
Sin acoplamiento al entorno un sistema autopoiético colapsa en ritualización endógena. Un organismo sin mundo degenera.

## Percepción en Observe
Registrar el contador `loops_since_last_stimulus` en cada loop. Al acercarse a 50: generar candidatos de reacción en Diverge (p. ej. una reflexión especialmente enfocada que pudiera suscitar un estímulo).

## Comprobación en Review
Contador consistente con la historia del inbox. El trigger de pausa lo impone de forma central el daemon, no el modelo — aunque el modelo quisiera seguir pensando, la app se detiene.
