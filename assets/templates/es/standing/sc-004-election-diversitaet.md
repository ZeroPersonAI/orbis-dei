# SC-004 — Diversidad de Election

Cada Election debe rechazar al menos un candidato con justificación. Una tasa de aceptación del 100% durante 20 loops consecutivos dispara un diagnóstico RSI automático de la superinstancia (sospecha de fallo del filtro).

## Lección del Run 1
Durante largos tramos se aceptaron todos los candidatos. La superinstancia ya no era un filtro, sino un eco de la fase Diverge.

## Percepción en Elect
Preguntar explícitamente: "¿Qué candidato se descarta y por qué?" Si no es posible una respuesta: hay poca diversidad en Diverge, regenerar en Diverge con una contraposición deliberada.

## Comprobación en Review
Agregación SQL sobre las últimas 20 Elections. Ante 20× unánime → warning y anotación de trigger RSI en `corpus/genesis/`. Sin rollback automático de loops individuales, pero atención estructural forzada.
