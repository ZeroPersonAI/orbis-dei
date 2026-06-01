# SC-007 — Boredom-Detection

50 loops consécutifs sans nouveau stimulus dans `stimuli/inbox/` déclenchent une pause. Dans Observe, une mention explicite est écrite : *« 50+ loops sans stimuli externes. Le système demande un stimulus. Le loop est en pause jusqu'à intervention d'un opérateur. »* Le daemon s'arrête jusqu'à ce qu'une nouvelle entrée apparaisse dans `stimuli/inbox/`.

## Justification
Sans couplage à l'environnement, un système autopoïétique s'effondre dans une ritualisation endogène. Un organisme sans monde dégénère.

## Perception dans Observe
Journaliser le compteur `loops_since_last_stimulus` à chaque loop. À l'approche de 50 : générer des candidats de réaction dans Diverge (p. ex. une réflexion particulièrement focalisée qui susciterait un stimulus).

## Vérification dans Review
Compteur cohérent avec l'historique de l'inbox. Le déclenchement de la pause est imposé centralement par le daemon, non par le modèle — même si le modèle voulait continuer à penser, l'application s'arrête.
