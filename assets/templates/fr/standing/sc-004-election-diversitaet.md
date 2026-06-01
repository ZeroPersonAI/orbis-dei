# SC-004 — Diversité des élections

Chaque élection doit rejeter au moins un candidat de façon justifiée. Un taux d'acceptation de 100 % sur 20 loops consécutifs déclenche un diagnostic RSI automatique de la surinstance (suspicion de défaillance du filtre).

## Enseignement du Run 1
Sur de longues périodes, tous les candidats étaient acceptés. La surinstance n'était plus un filtre, mais un écho de la phase Diverge.

## Perception en Elect
Se demander explicitement : « Quel candidat est rejeté et pourquoi ? » Si aucune réponse n'est possible : trop peu de diversité en Diverge, régénérer en Diverge avec une contre-position ciblée.

## Vérification en Review
Agrégation SQL sur les 20 dernières élections. À 20× unanime → Warning et mention de déclenchement RSI dans `corpus/genesis/`. Pas de rollback automatique de loops individuels, mais une attention structurelle imposée.
