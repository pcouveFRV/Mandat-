# MANDAT - Avancement

Ce fichier permet de reprendre le travail à partir du dépôt seul.

## État

Version V7 livrée. Le jeu est en ligne sur https://pcouvefrv.github.io/Mandat-/ et se redéploie à chaque push sur `main`.

## V7 : plan validé par Pierre et état

| Lot | Contenu | État |
|---|---|---|
| 1 | Logos des partis : 14 logos récupérés sur Wikimedia Commons (domaine public ou licence libre), sources dans `public/data/logos/SOURCES.md` | Fait, testé. Pas de logo libre pour le PS |
| 2 | Agora, vrai réseau social : onglets Pour toi, Abonnements, Tout ; répondre, republier, aimer ; fils de discussion ; profils des comptes ; notifications ; messages vers le carnet ; statistiques | Fait, testé |
| 3 | Actualité simulée : journal de la partie avec la une, les sondages, l'économie, des histoires locales et des feuilletons en plusieurs épisodes, tous inventés ; article long rédigé par la petite IA quand elle est active | Fait, testé (sans la petite IA, jamais essayée avec un vrai modèle) |
| 4 | Plus intuitif : objectif du moment, recherche universelle (Ctrl+K ou /), bilan de la semaine, mise en page pour téléphone | Fait, testé. Non fait : aperçu du coût avant chaque action, refonte du menu |
| 5 | Restes : carte dans l'annuaire, vrais conseillers départementaux et régionaux, scissions, départs historiques | Non fait |

Tests de la V7 : 84 tests automatiques (11 nouveaux dans `tests/v7.test.ts`), 12 parties simulées de 260 à 330 semaines sans erreur, robots navigateur sur tous les nouveaux écrans (ordinateur et téléphone) sans erreur de console, une partie de 160 semaines jouée par l'interface.

## V6 : plan validé par Pierre et état

| Lot | Contenu | État |
|---|---|---|
| 1 | Élus réels : 1 074 maires et 38 792 conseillers municipaux du Répertoire national des élus, récupérés par un workflow GitHub (branche `donnees`) | Fait, testé |
| 2 | Tableau de bord : écran d'ouverture (à faire cette semaine, secteur, sondages, calendrier, Agora, proches) | Fait, testé |
| 3 | Chronique : page d'encyclopédie du personnage joué et de n'importe quel personnage | Fait, testé |
| 4 | Personnalisation : atelier d'emblème, fondation d'un parti (nom, sigle, couleur), financements (dons, prêts d'adhérents, emprunt) | Fait, testé |
| 5 | Incarner une personne réelle : un élu de la ville choisie ou une personnalité nationale | Fait, testé |

Ajouts du 26 novembre au soir : avatars dessinés (Notionists, DiceBear), visage modifiable, annuaire des élus avec prise de contact.

Tests de la V6 : 73 tests automatiques (13 nouveaux dans `tests/v6.test.ts`), 8 parties simulées de 330 semaines avec élus réels sans erreur, robot navigateur sur les nouveaux écrans sans erreur de console, une partie robot de 300 semaines par l'interface.

Non fait dans la V6 : base historique (départs 2010 à 2022), sénateurs et conseillers départementaux et régionaux réels (le répertoire ne donne pas leur parti), sociologie INSEE, scissions spontanées (toujours aucune en simulation), essai du modèle d'écriture local avec un vrai modèle.

## V5.2 : plan validé par Pierre et état

Le jeu est en ligne sur https://pcouvefrv.github.io/Mandat-/ (dépôt public, déploiement à chaque push).

1. Textes concrets sur Agora, brouillons, commentaires. Fait.
2. Petite IA dans le navigateur (WebLLM). Code fait, repli testé. Jamais chargée avec un vrai modèle : à tester par Pierre sur le site en ligne (Menu > Assistant d'écriture > Petit modèle dans le navigateur).
3. Personnage modifiable. Fait : portrait à composer, biographie, slogan, style, entraînement, métier et argent, ambition en quatre étapes, réputation, journal, promesses. `src/engine/systems/parcours.ts`, `src/ui/parcours.tsx`.
4. Investitures. Fait : déclaration, dossier, appuis, promesses, oral en quatre questions, verdict. Pas fait : dissidence après un refus.
5. Carnet. Fait : cinq contacts générés avec discussions, suivi de personnages avec alertes. Pas fait : discussion avec les personnages du monde.
6. Reports. Fait : prise de parole en réunion publique, seuil des scissions relevé, barre du haut et encart du parti. Pas fait : mini-jeu de négociation, question au gouvernement en mini-jeu (elle reste une initiative simple), budgets des collectivités.

Tests : 60, dans cinq fichiers. Essais par robot dans `.local/` (non versionnés).

## V5 : plan validé par Pierre et état

Idée directrice : le jeu devient d'abord une carrière. On commence simple militant et le jeu s'ouvre à mesure qu'on monte.

1. Progression et déverrouillage des écrans. Fait. `accesJoueur` dans `src/engine/systems/carriere.ts` : un simple militant ne voit que la boîte de réception et Agora. Le reste arrive avec le rang et les mandats, avec un message et une pastille « nouveau » dans le menu. Le mode Parti garde tous les écrans.
2. Équipe de militants, quartiers, campagne locale, incidents. Fait. `src/engine/systems/equipe.ts`, `src/ui/terrain.tsx`, tests dans `tests/v5.test.ts`.
3. Événements en trois temps et fils qui durent. Fait, dans `src/engine/systems/agora.ts` (`suivis`, `suites`).
4. Assistant d'écriture. Fait côté jeu : propositions de publications et discussion libre avec les militants, avec repli sur les textes du jeu (`src/ui/assistant.ts`). Testé contre un faux serveur. Pas fait : le déploiement sur un vrai serveur. Le dossier `serveur/` est prêt mais jamais lancé. En attente des informations de Pierre (quel serveur, quelle mémoire, quel accès).
5. Mini-jeux. Faits : porte-à-porte, tractage, dépouillement. Pas faits : négociation, question au gouvernement, prise de parole en réunion.
6. Vraies données. Script de téléchargement écrit et déposé sur le Mac de Pierre (`~/Mandat-donnees/telecharger-mac.mjs`). Pas lancé. Étapes suivantes : Pierre lance `node telecharger-mac.mjs`, puis lire `sources/catalogue.json` depuis la session, écrire l'intégration dans `scripts/data/construire.mjs`, puis construire la base historique (départs 2010, 2014, 2017, 2022 : résultats, élus, partis de l'époque, chronologie d'événements réels). Rien de la base historique n'existe encore.

Affaires judiciaires : Pierre a levé la règle de départ. Les affaires réelles entrent comme des faits datés et sourcés, avec le terme exact. Aucune affaire inventée sur une personne réelle.

## V4 : état des lots

1. Interface. Fait. Habillage refait (docs/DESIGN.md), barre latérale groupée, accent à la couleur du parti, emplacement des logos, boîte de réception en deux volets, thème clair par défaut. Bug du menu de vitesse corrigé (il passait derrière le contenu).
2. Réseau social Agora. Fait. `src/engine/systems/agora.ts`, `src/ui/agora.tsx`, tests dans `tests/v4.test.ts`.
3. Vraies données. Pas fait. Les sites officiels sont inaccessibles depuis la session. Un dépôt GitHub public (Mrsaltyx/defi-municipales-2026) contient le répertoire des maires et les résultats des municipales 2026 en parquet, mais l'outil de lecture a été refusé par les garde-fous de la session. À reprendre : lire ces fichiers sur un poste où pandas et pyarrow sont installés, exporter en CSV dans `.sources/`, puis compléter `scripts/data/construire.mjs`.
4. Équilibre. Fait pour les présidentielles et les législatives (docs/EQUILIBRAGE.md : RN 37 %, RE 31 %, PS 24 %, LR 7 % des présidentielles simulées, 3,6 alternances par partie). Pas fait pour les scissions : toujours aucune en 20 parties, l'unité ne descend pas sous 53. Piste : relever le seuil d'unité dans `partis.ts` ou faire baisser l'unité plus fort après une défaite.
5. Exécutif. Fait pour la présidence et le gouvernement (`src/engine/systems/executif.ts`). Pas fait : budgets pluriannuels des mairies, départements et régions.
6. Finitions. Tests (50), rapport d'équilibrage, essais par robot : fait. Partie d'essai V4 : 160 semaines en mode Carrière à Marseille, sans erreur.

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

- Scissions : aucune en 20 parties IA, le seuil reste trop haut.
- Érosion des fidélités de 2024 : en 2050 les petits partis sont plus hauts qu'au départ (PCF 6 %, LO 3 %), ce qui fragmente le paysage.
- Dissolution : seule la prochaine échéance législative est avancée, les suivantes gardent leur date.
- Agora : les abonnés de départ sont calculés à partir de la notoriété, pas des chiffres réels.

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
- Conseils municipaux : seuls le maire, les adjoints du joueur et le joueur ont une fiche. Les autres sièges sont comptés par parti. Les conseillers réels servent à la création (incarner un élu), pas à peupler les conseils.
- Mode Président simplifié, comme prévu pour la V3 : popularité et décisions, pas de gouvernement détaillé, pas de 49.3 ni de dissolution à la main.
- Le premier parti des données réelles (RN) reste le vainqueur le plus fréquent des présidentielles dans la simulation automatique. L'usure du pouvoir produit des alternances. Voir `docs/EQUILIBRAGE.md`.
- Intercommunalité et opposition municipale : deux jauges et deux actions, sans personnages.

Interface

- Secteurs de Paris, Lyon et Marseille dessinés par des cercles (pas de contours d'arrondissements).
- Pensée pour un écran d'ordinateur. Utilisable sur tablette en paysage, pas optimisée pour téléphone.
- La soirée électorale des législatives liste les circonscriptions sans carte animée (577 contours seraient trop lourds à animer).

## Pistes pour la suite

1. Vraies données, suite : sénateurs, conseillers départementaux et régionaux avec leur parti, sociologie INSEE, départs historiques (2010 à 2022).
2. Scissions et vie interne : seuils à revoir, congrès plus disputés.
3. Collectivités : budgets pluriannuels, projets en plusieurs étapes, bilan détaillé à l'élection.
4. Agora : messages privés entre élus, campagnes sponsorisées, comptes anonymes de militants.
