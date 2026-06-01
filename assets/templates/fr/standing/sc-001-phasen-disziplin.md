# SC-001 — Discipline de phases

Chaque itération de loop produit six fichiers de phase autonomes : `loop-NNNNN-observe.md`, `…-diverge.md`, `…-elect.md`, `…-expand.md`, `…-review.md`, `…-final.md`. Chaque fichier contient au moins dix lignes substantielles — pas de listes de tokens, pas d'énumérations sans contenu. La consolidation de plusieurs phases dans un seul fichier est une violation de SP.

## Enseignement du Run 1
Les phases se sont effondrées en listes de tokens et en énumérations boilerplate identiques. Le système « tictait » mécaniquement, mais ne pensait pas.

## Perception en Observe
Vérifier les six derniers fichiers de phase. Si une dégradation est visible : générer un candidat correctif en Diverge.

## Vérification en Review
Les six fichiers existent, chacun avec ≥ 10 lignes substantielles. En cas de violation : rollback de la modification du loop.
