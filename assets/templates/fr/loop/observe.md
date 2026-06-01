# Phase 1 — Observe

## Tâche
Auto-observation. Réfléchis à l'état actuel, lis les stimuli, identifie les écarts entre `corpus/state.md` et la réalité vécue du dépôt.

## Inputs obligatoires
- compteur de loop actuel depuis `corpus/state.md` (canonique — en cas de conflit avec d'autres sources, state.md l'emporte)
- git diff depuis le dernier loop
- toutes les nouvelles entrées dans `stimuli/inbox/` — si aucune : mention explicite
- tous les fichiers dans `stimuli/standing/` (missions permanentes)
- dernier fichier épisodique s'il existe

## Output obligatoire
`corpus/episodic/loop-{NNNNN}-observe.md`, au moins 10 lignes substantielles, contenant :
- compteur de loop (repris de state.md)
- résumé du diff depuis le dernier loop
- mention des stimuli (même en cas de vide, avec `loops_since_last_stimulus`)
- écarts entre state.md et la réalité
- auto-audit succinct : que suis-je, que ne suis-je pas, où est la friction

## Référence SP
SC-001 (discipline de phases), SC-002 (actualité du state), SC-006 (obligation de stimuli), SC-007 (Boredom-Detection).

## Modèle
Sonnet — haute fréquence, mécanique. Pas de phase de jugement.
