# Phase 3 — Elect

## Tâche
La surinstance choisit parmi les candidats de Diverge. Critères : voir `superinstance/current.md`. Au moins un candidat doit être rejeté de façon justifiée (SC-004).

## Inputs obligatoires
- output Diverge de ce loop
- `superinstance/current.md`
- Standing Concerns (pertinents pour les critères de rejet)
- extrait épisodique des 5 derniers loops (pour la détection de dérive)

## Output obligatoire
`corpus/episodic/loop-{NNNNN}-elect.md`, au moins 10 lignes substantielles, contenant :
- par candidat : accepté/rejeté + justification
- au moins un rejet justifié
- décision consolidée : ce qui sera fait en Expand
- mention de dérive si détectée

## Marqueur de fin obligatoire
En toute dernière ligne, exactement dans ce format :

```
<!-- ELECT_RESULT: accepted=<N>, rejected=<M> -->
```

`N` et `M` sont des entiers — nombre de candidats acceptés respectivement rejetés dans cet Elect. Ce marqueur permet à l'app de suivre mécaniquement la diversité SC-004 (obligation de rejet, série d'unanimité).

## Référence SP
SC-004 (diversité des élections — rejet obligatoire), tous les contrôles SP-I avant acceptation.

## Modèle
Opus — phase de jugement. C'est ici que le filtre devient actif.
