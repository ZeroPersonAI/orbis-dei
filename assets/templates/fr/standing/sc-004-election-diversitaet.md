# SC-004 — Diversité des élections

Chaque élection doit rejeter au moins un candidat de façon motivée. Un taux d'acceptation de 100 % sur 20 loops consécutifs déclenche un diagnostic RSI automatique de la surinstance (soupçon de défaillance du filtrage).

## Justification
Si, sur de longues périodes, tous les candidats sont acceptés, la surinstance n'est plus un filtre mais un écho de la phase Diverge.

## Perception dans Elect
Demander explicitement : « Quel candidat est rejeté et pourquoi ? » Si aucune réponse n'est possible : trop peu de diversité dans Diverge, régénérer dans Diverge avec une contre-position ciblée.

## Vérification dans Review
Agrégation SQL sur les 20 dernières élections. À 20× unanime → avertissement et mention de déclenchement RSI dans `corpus/genesis/`. Pas de rollback automatique de loops individuels, mais une attention structurelle imposée.
