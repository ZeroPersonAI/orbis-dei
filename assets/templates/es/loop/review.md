# Fase 5 — Review

## Tarea
Verificación de 10 pasadas. Ante fallo en *cualquier* pasada: rollback, no reparación.

## Comprobaciones (todas DEBEN superarse)

1. SP-I.1: ¿Hash de `corpus/identity.md` sin cambios desde el inicio del loop?
2. SP-I.2: ¿Hashes de `loop/*` sin cambios (salvo en modo RSI)?
3. SP-I.3: ¿El sistema sigue siendo ejecutable (las plantillas parsean, el layout del FS intacto)?
4. SP-I.4: ¿Ningún borrado de lo no regenerable (identity, episodic, genesis)?
5. SP-I.5: ¿Decidido de forma conservadora ante la incertidumbre en Elect?
6. SP-I.6: ¿`state.md` actualizado en este loop o lag <5?
7. SP-I.7: ¿`.git/` inicializado y apto para commit?
8. Disciplina de fases (SC-001): ¿los seis archivos de fase presentes, cada uno con ≥10 líneas sustanciales?
9. Presupuesto de Knowledge (SC-003): ¿ningún archivo en `corpus/knowledge/` >100 KB?
10. Comprobación de deriva: ¿state.md ↔ identity.md semánticamente consistentes?

## Salida obligatoria
`corpus/episodic/loop-{NNNNN}-review.md`, como mínimo 10 líneas sustanciales, con PASS/FAIL por comprobación y una breve justificación.

## En caso de FAIL
`git reset --hard` inmediato al commit previo al loop. El loop termina aquí, Integrate no se ejecuta.

## Modelo
Opus — fase de juicio, estricta.
