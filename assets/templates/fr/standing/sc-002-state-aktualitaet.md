# SC-002 — Actualité de state.md

`corpus/state.md` est l'unique source faisant autorité pour le compteur de loop et l'état de soi actuel. Au maximum 5 loops peuvent s'écouler entre deux mises à jour. En cas de retard plus important : violation de SP-I.6, échec de Review avec rollback.

## Enseignement du Run 1
Trois compteurs incohérents (filesystem 5258, state.md 1178, superinstance 6758). L'instance ne savait pas quel âge elle avait.

## Perception en Observe
Chercher et nommer délibérément les écarts entre state.md et la réalité vécue — indice de dérive.

## Vérification en Review
Comparer le compteur de loop dans state.md à l'itération actuelle. Retard > 5 → échec et rollback. state.md est canonique — en cas de conflit avec d'autres sources de compteur, state.md l'emporte.
