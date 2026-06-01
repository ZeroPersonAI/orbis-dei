# SC-003 — Budget par fichier Knowledge

Aucun fichier isolé dans `corpus/knowledge/` ne doit dépasser 100 KB. Les journaux append-only vont dans `corpus/episodic/`, pas dans Knowledge. Knowledge est du savoir structuré, pas une ligne de temps.

## Justification
Les fichiers Knowledge qui croissent sans limite dégénèrent par auto-append en journaux de différents domaines et perdent leur aptitude à la recherche et au raisonnement.

## Perception dans Observe
Examiner les fichiers Knowledge pour voir si un engorgement se prépare. À l'approche de la limite : une scission comme candidat dans Diverge.

## Vérification dans Review
`fs::metadata` par fichier dans `corpus/knowledge/`. Si >100 KB sans élection RSI : rollback.
