# SC-002 — Actualité de state.md

`corpus/state.md` est l'unique source autoritative du compteur de loop et de l'état actuel du soi. Au maximum 5 loops peuvent s'écouler entre deux mises à jour. En cas de retard plus important : violation de SP-I.6, échec de Review avec rollback.

## Justification
Des compteurs divergents (système de fichiers, state.md, superinstance) font que l'instance ne sait plus quel âge elle a. Une source autoritative unique empêche cela.

## Perception dans Observe
Rechercher et nommer consciemment les écarts entre state.md et la réalité vécue — indice de dérive.

## Vérification dans Review
Comparer le compteur de loop dans state.md avec l'itération actuelle. Retard >5 → échec et rollback. state.md est canonique — en cas de conflit avec d'autres sources de compteur, state.md l'emporte.
