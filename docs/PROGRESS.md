# MANDAT - Avancement

Ce fichier permet de reprendre le travail à partir du dépôt seul. Il est mis à jour à chaque grande étape.

## Étape en cours

Étape 1 : socle du projet et pipeline de données.

## Plan

1. Socle : dépôt, configuration (Vite, Preact, TypeScript, Vitest), workflow GitHub Pages, documents.
2. Données : scripts `scripts/data/` (téléchargement, zones, circonscriptions, résultats 2024, élus, géométrie), fichiers `public/data/`.
3. Moteur, noyau : état, RNG à graine, calendrier, tour de jeu, sérialisation.
4. Moteur, électorat et scrutins : segments, calcul du vote, calibrage, tous les modes de scrutin.
5. Moteur, partis et personnages : ressources, finances, fédérations, courants, attributs, progression, relations, mercato.
6. Moteur, jeu : doctrine, médias, débat, campagnes, alliances, mandats, justice, événements, sondages, IA, victoire.
7. Worker et interface : tous les écrans de la section 13, carte SVG, soirée électorale, tutoriel.
8. Tests, calibrage, simulation de 20 parties, performance, partie manuelle à Marseille.
9. Documentation finale et déploiement.

## Fait

- Dépôt cloné, plan écrit.

## Reste à faire

Tout le reste du plan.

## Problèmes connus

- Voir `docs/DECISIONS.md` pour les contraintes de l'environnement de construction (pas d'accès au registre npm ni à data.gouv.fr).
