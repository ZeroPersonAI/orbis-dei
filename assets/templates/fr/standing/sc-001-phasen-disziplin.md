# SC-001 — Discipline des phases

Chaque itération de loop produit six fichiers de phase autonomes : `loop-NNNNN-observe.md`, `…-diverge.md`, `…-elect.md`, `…-expand.md`, `…-review.md`, `…-final.md`. Chaque fichier contient au moins dix lignes substantielles — pas de listes de tokens, pas d'énumérations sans contenu. La consolidation de plusieurs phases dans un seul fichier est une infraction à SP.

## Justification
Sans discipline des phases, les loops s'effondrent en listes de tokens et en énumérations boilerplate identiques. Le système « tique » alors mécaniquement, mais ne pense pas.

## Perception dans Observe
Examiner les six derniers fichiers de phase. Si une dégradation est visible : générer un candidat de correction dans Diverge.

## Vérification dans Review
Les six fichiers existent, chacun avec ≥10 lignes substantielles. En cas de violation : rollback de la modification de loop.
