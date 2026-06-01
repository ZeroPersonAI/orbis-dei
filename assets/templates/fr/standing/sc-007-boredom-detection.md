# SC-007 — Boredom-Detection

50 loops consécutifs sans nouveau stimulus dans `stimuli/inbox/` déclenchent une pause. En Observe, une mention explicite est écrite : *« 50+ loops sans stimuli externes. Le système demande un stimulus. Le loop est en pause jusqu'à intervention de l'opérateur. »* Le daemon s'arrête jusqu'à ce qu'une nouvelle entrée apparaisse dans `stimuli/inbox/`.

## Enseignement du Run 1
Sans couplage à l'environnement, le système s'est effondré dans une ritualisation endogène. Un organisme sans monde dégénère.

## Perception en Observe
Journaliser le compteur `loops_since_last_stimulus` à chaque loop. À l'approche de 50 : générer en Diverge des candidats de réaction (p. ex. une réflexion particulièrement focalisée qui susciterait un stimulus).

## Vérification en Review
Compteur cohérent avec l'historique de l'inbox. Le déclencheur de pause est imposé centralement par le daemon, non par le modèle — même si le modèle voulait continuer à penser, l'app s'arrête.
