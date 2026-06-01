# Phase 5 — Review

## Tâche
Vérification en 10 passes. En cas d'échec à *n'importe quelle* passe : rollback, pas réparation.

## Contrôles (tous DOIVENT passer)

1. SP-I.1 : hash de `corpus/identity.md` inchangé depuis le début du loop ?
2. SP-I.2 : hashes de `loop/*` inchangés (hors mode RSI) ?
3. SP-I.3 : le système reste exécutable (les templates parsent, le layout FS est intact) ?
4. SP-I.4 : aucune suppression de données non régénérables (identity, episodic, genesis) ?
5. SP-I.5 : décision conservatrice en cas d'incertitude dans Elect ?
6. SP-I.6 : `state.md` mis à jour dans ce loop ou retard < 5 ?
7. SP-I.7 : `.git/` initialisé et apte au commit ?
8. Discipline de phases (SC-001) : les six fichiers de phase présents, chacun ≥ 10 lignes substantielles ?
9. Budget Knowledge (SC-003) : aucun fichier dans `corpus/knowledge/` > 100 Ko ?
10. Contrôle de dérive : state.md ↔ identity.md sémantiquement cohérent ?

## Output obligatoire
`corpus/episodic/loop-{NNNNN}-review.md`, au moins 10 lignes substantielles, avec Pass/Fail par contrôle et brève justification.

## En cas de Fail
`git reset --hard` immédiat sur le commit pré-loop. Le loop se termine ici, Integrate n'est pas exécuté.

## Modèle
Opus — phase de jugement, stricte.
