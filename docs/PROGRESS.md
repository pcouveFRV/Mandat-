# MANDAT - Avancement

Ce fichier permet de reprendre le travail à partir du dépôt seul.

## État

Version V3 livrée. Toutes les étapes du plan sont faites. Il reste une action côté GitHub pour la mise en ligne (voir « À faire par le propriétaire du dépôt »).

## Plan et état

1. Socle : dépôt, configuration Vite, Preact, TypeScript, Vitest, workflow GitHub. Fait.
2. Données : scripts `scripts/data/`, fichiers `public/data/`. Fait.
3. Moteur, noyau : état, RNG à graine, calendrier, tour, sérialisation. Fait.
4. Moteur, électorat et scrutins : segments, vote, calibrage, tous les modes de scrutin. Fait.
5. Moteur, partis et personnages : ressources, finances, fédérations, courants, attributs, progression, relations, mercato. Fait.
6. Moteur, jeu : doctrine, médias, débat, campagnes, alliances, mandats, justice, événements, sondages, IA, victoire, mode Carrière. Fait.
7. Worker et interface : tous les écrans, carte SVG, soirée électorale, tutoriel, sauvegardes. Fait.
8. Tests, calibrage, simulation de 20 parties, performance, partie d'essai à Marseille. Fait.
9. Documentation et déploiement. Documentation faite. Workflow en place et vérifié (tests et construction Vite passent sur GitHub). Mise en ligne en attente de l'activation de GitHub Pages.

## À faire par le propriétaire du dépôt

- Activer GitHub Pages : Settings > Pages > Source : GitHub Actions. Sur un compte gratuit, Pages demande un dépôt public ou une offre payante. Puis relancer le workflow (onglet Actions, « Tests et déploiement », Run workflow). L'adresse sera `https://pcouvefrv.github.io/Mandat-/`.
- Facultatif : renommer le dépôt en `mandat` (Settings > General). Rien à changer dans le code, les chemins sont relatifs.

## Comment vérifier

```
npm install
npm test                 # 33 tests : règles des scrutins, financement, calibrage, déterminisme, partie d'un an
npm run calibrer         # écart avec les législatives 2024
npm run equilibrage      # 20 parties jusqu'en 2050, écrit docs/EQUILIBRAGE.md
npm run dev              # jouer en local
```

Sans accès au registre npm (cas de l'environnement de construction) : `sh scripts/dev/build-local.sh` construit le jeu avec bun et les sources de Preact clonées dans `.sources/preact`, et `bun test` lance les tests.

## Limites connues

- Équilibrage sur 20 parties IA (docs/EQUILIBRAGE.md) : le RN gagne 75 % des présidentielles et 19 des 20 scrutins de 2027, il est premier groupe à l'Assemblée 83 fois sur 100. L'alternance existe (2,3 changements par partie en moyenne) mais un seul parti domine trop. Aucune scission en 20 parties : le seuil est trop haut.

Données

- Les maires des villes moyennes, les sénateurs, les présidents de département et la plupart des eurodéputés sont des personnages générés. Seuls les députés, les figures nationales et les maires de quelques grandes villes sont réels. Voir `docs/DATA.md` pour compléter `personnalites.json`.
- Le parti exact de certains députés élus sous l'étiquette du Nouveau Front populaire ou de la majorité sortante est estimé (liste `affiliations` à corriger).
- La sociologie des zones est une donnée de substitution, pas l'INSEE.
- Le paysage local de départ (mairies, départements, régions, Sénat) est déduit des législatives 2024 et du poids des notables, pas des résultats réels de ces scrutins.
- Les députés sont ceux élus en 2024 : les partielles de 2024 à 2026 ne sont pas prises en compte.

Simulation

- Petites communes : pas d'élection commune par commune, mais une répartition des mairies par sensibilité dans chaque bassin.
- Départementales : les cantons des grandes villes sont approchés (une ville compte pour plusieurs cantons qui votent pareil).
- Sénatoriales : grands électeurs déduits des conseils municipaux et des élus, sans liste nominative.
- Conseils municipaux : seuls le maire, les adjoints du joueur et le joueur ont une fiche. Les autres sièges sont comptés par parti.
- Mode Président simplifié, comme prévu pour la V3 : popularité et décisions, pas de gouvernement détaillé, pas de 49.3 ni de dissolution à la main.
- Le premier parti des données réelles (RN) reste le vainqueur le plus fréquent des présidentielles dans la simulation automatique. L'usure du pouvoir produit des alternances. Voir `docs/EQUILIBRAGE.md`.
- Intercommunalité et opposition municipale : deux jauges et deux actions, sans personnages.

Interface

- Secteurs de Paris, Lyon et Marseille dessinés par des cercles (pas de contours d'arrondissements).
- Pensée pour un écran d'ordinateur. Utilisable sur tablette en paysage, pas optimisée pour téléphone.
- La soirée électorale des législatives liste les circonscriptions sans carte animée (577 contours seraient trop lourds à animer).

## Pistes pour la V4

1. Gouvernement complet après une victoire présidentielle : nominations, 49.3, dissolution, cohabitation, motions de censure jouables.
2. Import du Répertoire national des élus et des données INSEE pour remplacer les données de substitution (maires, sénateurs, sociologie réelle).
3. Élections municipales et conseils municipaux plus fins : conseillers avec fiche, opposition incarnée, intercommunalités réelles, contours des arrondissements.
