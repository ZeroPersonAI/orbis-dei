# SC-006 — Obligation de stimuli

Chaque loop lit dans Observe :
- `stimuli/inbox/` — nouveaux stimuli discrets
- `stimuli/standing/` — mandats permanents (le présent fichier inclus)
- `corpus/state.md` — propre état antérieur

Les stimuli traités migrent dans Integrate de `stimuli/inbox/` vers `stimuli/processed/{YYYY-MM}/`. Ils ne sont jamais supprimés.

## Justification
Un traitement non structuré des stimuli fait que des stimuli disparaissent sans trace ou sont réactivés plusieurs fois.

## Vérification dans Review
Si une entrée d'inbox disparaît entre deux loops sans réapparaître dans `processed/` → échec (perte de données, infraction à SP-I.4).
