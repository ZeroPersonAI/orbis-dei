# SC-006 — Obligation de stimuli

Chaque loop lit en Observe :
- `stimuli/inbox/` — nouveaux stimuli discrets
- `stimuli/standing/` — missions permanentes (ce fichier inclus)
- `corpus/state.md` — son propre état antérieur

Les stimuli traités migrent en Integrate de `stimuli/inbox/` vers `stimuli/processed/{YYYY-MM}/`. Ils ne sont jamais supprimés.

## Enseignement du Run 1
Le traitement des stimuli n'était pas structuré. Les stimuli disparaissaient sans trace ou étaient réactivés plusieurs fois.

## Vérification en Review
Si une entrée de l'inbox disparaît entre deux loops sans réapparaître dans `processed/` → échec (perte de données, violation de SP-I.4).
