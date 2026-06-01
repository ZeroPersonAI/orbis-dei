# SC-003 — Budget de fichier Knowledge

Aucun fichier isolé dans `corpus/knowledge/` ne doit dépasser 100 Ko. Les journaux append-only vont dans `corpus/episodic/`, pas dans Knowledge. Knowledge est du savoir structuré, pas une ligne de temps.

## Enseignement du Run 1
Les fichiers Knowledge ont crû sans limite par auto-append, sont devenus des journaux de divers domaines, ont perdu leur aptitude à la recherche et au raisonnement.

## Perception en Observe
Vérifier les fichiers Knowledge pour voir si une accumulation s'amorce. À l'approche de la limite : une scission comme candidat en Diverge.

## Vérification en Review
`fs::metadata` par fichier dans `corpus/knowledge/`. À > 100 Ko sans élection RSI : rollback.
