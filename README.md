# MANDAT - Politique Manager

Jeu de gestion politique au tour par tour, en français, pour navigateur. La France, les partis, les circonscriptions et le calendrier électoral sont réels au départ. Dès le premier tour, l'histoire diverge.

Trois inspirations : Football Manager pour les personnes (fiches à attributs, effectif, mercato, boîte de réception), Anno pour l'économie du parti (militants, argent, notoriété, crédibilité, unité), Civilization pour le territoire et le temps (carte de France, arbre de doctrine, plusieurs victoires, parties jusqu'en 2050).

Usage privé. Les attributs des personnes réelles sont calculés de façon neutre à partir de leurs mandats. Aucune affaire n'est attribuée à une personne réelle.

## Jouer

En ligne : une fois GitHub Pages activé (voir plus bas), le jeu est à l'adresse `https://<votre-compte>.github.io/<nom-du-dépôt>/`.

En local :

```
npm install
npm run dev
```

Puis ouvrir l'adresse indiquée (http://localhost:5173). Le jeu fonctionne hors ligne une fois chargé. Les sauvegardes sont dans le navigateur (IndexedDB), avec export et import de fichiers `.mandat`.

Le guide du joueur est dans [docs/JOUER.md](docs/JOUER.md).

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement Vite |
| `npm run build` | Construction dans `dist/` (application statique) |
| `npm test` | Tests du moteur (Vitest) |
| `npm run calibrer` | Contrôle du calibrage sur les législatives 2024 |
| `npm run equilibrage` | 20 parties complètes jouées par les IA, rapport dans `docs/EQUILIBRAGE.md` (environ 30 minutes) |
| `npm run data:telecharger` | Clone les sources de données dans `.sources/` |
| `npm run data:construire` | Reconstruit zones, circonscriptions, résultats et contours |
| `npm run data:contenu` | Régénère partis, segments, doctrine, traits, médias, noms, événements (écrase les modifications manuelles de ces fichiers) |

## Déploiement sur GitHub Pages

Le workflow `.github/workflows/deploiement.yml` lance les tests, construit le jeu avec Vite et le déploie à chaque push sur `main`.

À faire une fois dans le dépôt : Settings > Pages > Source : « GitHub Actions ». Sur un compte gratuit, GitHub Pages n'est disponible que pour un dépôt public : il faut soit rendre le dépôt public, soit passer à une offre payante. Tant que Pages n'est pas activé, l'étape « deployer » échoue mais l'étape « construire » valide les tests et la construction, et le site construit est téléchargeable dans l'onglet Actions (archive « site »).

Les chemins sont relatifs : le jeu fonctionne quel que soit le nom du dépôt.

## Organisation

```
src/engine/        moteur pur : état, tour, création, actions, vues, victoire
  systems/         electorat, regles, scrutins, partis, personnages, finances, medias, campagnes,
                   doctrine, evenements, mandats, ia, justice, sondages, carriere, inbox,
                   agora (réseau social, événements en trois temps), executif (réformes, 49.3, dissolution, référendum),
                   equipe (militants, quartiers, campagne locale, mini-jeux)
src/worker/        Web Worker qui fait tourner le moteur
src/ui/            interface Preact : cadre, écrans, carte SVG
src/data/          chargement des données hors navigateur (tests, scripts)
public/data/       données du jeu en JSON (modifiables à la main)
scripts/data/      pipeline de données (telecharger-mac.mjs : à lancer sur votre ordinateur)
serveur/           serveur facultatif de l'assistant d'écriture (Ollama derrière Caddy)
scripts/           calibrage et équilibrage
tests/             tests du moteur
docs/              JOUER, MOTEUR, DATA, DESIGN, EQUILIBRAGE, DECISIONS, PROGRESS
public/data/logos/ emplacement pour vos logos de partis (voir LISEZMOI.md)
```

## Modifier les données

Tout est dans `public/data/`. Pour corriger un parti, un élu ou un maire : `partis.json` et `personnalites.json`. Le format est décrit dans [docs/DATA.md](docs/DATA.md). Le fonctionnement du moteur et les formules sont dans [docs/MOTEUR.md](docs/MOTEUR.md).

## Limites connues

Voir [docs/PROGRESS.md](docs/PROGRESS.md).
