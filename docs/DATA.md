# Données

Tout ce que le jeu utilise est dans `public/data/`, en JSON lisible. Vous pouvez modifier ces fichiers à la main. Le jeu les relit à chaque chargement de page.

## Ce qui est réel, ce qui est de substitution

Lors de la construction, data.gouv.fr et le site de l'INSEE n'étaient pas joignables depuis l'environnement de travail. GitHub l'était. Les données réelles viennent donc de dépôts GitHub publics qui republient les fichiers officiels. Ce qui manquait est remplacé par des données de substitution, signalées ci-dessous.

| Donnée | Statut | Source |
|---|---|---|
| Contours des communes, départements, régions | Réel | IGN et INSEE via `gregoiredavid/france-geojson` |
| Contours des 558 circonscriptions de métropole et des DROM | Réel | Contours joints aux résultats 2024, `IdrissaD/data_legislatives_2024` |
| Liste des communes, cantons, départements, régions (code officiel géographique) | Réel | INSEE via `datagouv/decoupage-administratif` (dossier `sources/`) |
| Populations municipales des communes et des arrondissements de Paris, Lyon, Marseille | Réel | INSEE, populations légales, même dépôt |
| Législatives 2024 : premier et second tour, 577 circonscriptions, candidats, nuances, élus | Réel | Ministère de l'Intérieur, mis en forme par Duong Tam Kien, `taniki/legislatives-2024` |
| Les 577 députés élus en 2024 (nom, prénom, sexe, nuance) | Réel | Même source |
| Parti précis des députés élus sous une nuance commune (UG, ENS) | Substitution partielle | Liste `affiliations` de `personnalites.json`, établie de mémoire. Un député UG absent de la liste est rattaché au PS, un député ENS à Renaissance |
| Figures nationales, chefs de partis, présidents de région, maires de grandes villes | Réel, à vérifier | `personnalites.json`, liste écrite à la main à l'automne 2026 |
| Maires des autres villes simulées | Substitution | Couleur politique tirée au sort selon le vote local et le poids des notables, personnage généré |
| Sénateurs (hors figures nationales), présidents de département, eurodéputés (hors figures) | Substitution | Composition simulée à partir des élus locaux, personnages générés |
| Sociologie des zones (âge, catégories socioprofessionnelles, revenus) | Substitution | `socio.json`, construit à partir du type de territoire, de la région et d'un bruit déterministe |
| Résultats des municipales, régionales, départementales, européennes, présidentielle | Substitution | Le paysage local de départ est déduit des législatives 2024 et du poids des notables de chaque parti |
| Profils d'opinion des 20 groupes sociaux | Substitution | `segments.json`, construit à partir des grandes enquêtes d'opinion connues |
| Trésorerie, adhérents, dette des partis | Ordres de grandeur | `partis.json`, estimations à corriger si besoin |

Conséquence pratique : la carte, les circonscriptions, les populations, les résultats de 2024 et les députés sont réels. Les maires des villes moyennes, les sénateurs et les conseillers locaux sont plausibles mais inventés, sauf ceux que vous ajoutez dans `personnalites.json`.

Aucune affaire judiciaire n'est attribuée à une personne réelle. Les attributs des personnes réelles sont calculés à partir de leur rang et de leurs mandats, plus un bruit aléatoire. Leurs traits viennent uniquement de leur fonction (un maire reçoit « Notable indéboulonnable » et « Bon gestionnaire », un chef de parti « Homme ou femme d'appareil » et « Stratège », etc.). Les personnes réelles ne meurent pas dans le jeu : elles se retirent avec l'âge.

## Régénérer les données

```
node scripts/data/telecharger.mjs    # clone les sources dans .sources/ (environ 500 Mo)
node scripts/data/construire.mjs     # zones, circonscriptions, résultats, contours
node scripts/data/contenu.mjs        # partis, segments, doctrine, traits, médias, noms
node scripts/data/evenements.mjs     # événements
```

`contenu.mjs` et `evenements.mjs` écrasent les fichiers qu'ils produisent. Si vous avez modifié ces fichiers à la main, ne relancez pas ces scripts, ou reportez vos changements dans le script. `personnalites.json` n'est produit par aucun script : il est entièrement à vous.

Pour brancher les sources officielles quand elles sont joignables : le Répertoire national des élus (data.gouv.fr, fichiers `elus-maires`, `elus-senateurs`, `elus-conseillers-departementaux`) peut alimenter `personnalites.json`. Il suffit d'ajouter une entrée par élu avec son rôle (voir le format plus bas). Les données INSEE par commune (dossier complet) peuvent remplacer `socio.json` en produisant les mêmes 20 poids par zone.

Licences : les données de l'État (INSEE, IGN, ministère de l'Intérieur) sont sous Licence Ouverte 2.0. Le dépôt `france-geojson` reprend des données IGN et INSEE sous Licence Ouverte. Le dépôt `decoupage-administratif` est sous licence MIT. Les dépôts `legislatives-2024` et `data_legislatives_2024` republient des données du ministère de l'Intérieur. Sources récupérées le 26 novembre 2026.

## Format des fichiers

### partis.json

- `partis` : une entrée par parti. `id` (ne pas changer), `sigle`, `nom`, `couleur`, `axes` (10 positions de -5 à +5, dans l'ordre de `doctrine.json`), `tresorerie` et `dette` en euros, `adherents`, `notoriete`, `credibilite`, `unite` (0 à 100), `strategie` (`local`, `presidentielle`, `union`, `isolement`), `style` (`prudent`, `offensif`, `opportuniste`), `famille`, `notabilite` (poids des notables aux élections locales, de 0 à 1,5).
- `nuances` : pour chaque nuance du ministère de l'Intérieur, la part des voix attribuée à chaque parti du jeu. Sert au calibrage.

### personnalites.json

- `personnalites` : `nom`, `prenom`, `sexe` (`M` ou `F`), `naissance` (année, ou `null`), `parti` (id), `rang` (1 premier plan, 2 figure nationale, 3 élu notable), `roles`.
- Rôles possibles : `chef_parti`, `depute:<circo>` (exemple `13-06`), `senateur:<département>`, `maire:<zone>` (`V75`, `V69`, `V13` pour Paris, Lyon, Marseille, `C<code INSEE>` pour une commune, `S<département><premier arrondissement>` pour un secteur, exemple `S1309` pour le 5e secteur de Marseille), `president_region:<code région>`, `eurodepute`, `figure`, `president_republique`, `premier_ministre`.
- Champ facultatif `attributs` pour fixer des attributs à la main, exemple `{"eloquence": 16, "terrain": 12}`. Les noms sont ceux de la liste `ATTRS` dans `src/engine/types.ts`.
- `maires` : couleur politique imposée pour une mairie sans nom de maire (`zone`, `parti`).
- `affiliations` : parti réel des députés élus sous une nuance commune. Format `Nom` ou `Nom|initiale du prénom`.

### zones.json

Tableau `zones`, une ligne par zone, colonnes dans l'ordre de `champs` : `id`, `nom`, `type` (0 commune de plus de 10 000 habitants, 1 bassin de petites communes regroupées par canton, 2 secteur de Paris, Lyon ou Marseille, 3 collectivité d'outre-mer ou circonscription des Français de l'étranger), `dept`, `pop`, `inscrits`, `terr` (0 urbain dense, 1 périurbain, 2 rural), `lon`, `lat`, `circos` (liste de `[index de circonscription, part en %]`), `ville`, `nbCommunes`, `cantons` (nombre de cantons simulés pour les départementales).

2 797 zones : 1 045 communes, 1 699 bassins, 34 secteurs (17 à Paris, 9 à Lyon, 8 à Marseille), 19 zones d'outre-mer et de l'étranger.

### circos.json

Les 577 circonscriptions : `id` (`<département>-<numéro>`), `inscrits`, `exprimes`, `t1` (voix par nuance au premier tour 2024), `candidats` (principaux candidats), `t2`, `elu`.

### socio.json

`poids` : pour chaque zone, 20 valeurs en pour mille, une par groupe de `segments.json`.

### segments.json

20 groupes sociaux. `axes` : position idéale sur chaque axe. `priorites` : poids de chaque thème. `abstention` : part de base qui ne vote pas à une législative. `volatilite` : sensibilité à l'actualité. `etiquettes` : servent aux propositions, aux médias et aux événements.

### doctrine.json

- `axes` : les 10 axes et leurs deux pôles.
- `themes` : les 15 thèmes et le poids de chaque axe dans le thème.
- `propositions` : `axe`, `pole` (-1 ou +1), `positionRequise`, `theme`, `coutCapital`, `credibiliteRequise`, `attire` et `repousse` (étiquettes de segments).

### evenements.json

Chaque événement : `id`, `titre`, `texte`, `cat`, `portee` (`nat` : tous les partis réagissent, `parti` : vie interne du parti du joueur, `mandat` : selon le mandat exercé, `perso` : mode Carrière), `poids` (fréquence), `cond` (conditions : `mois`, `de`, `a`, `role`, `mode`, `rival`), `themes` (hausse des priorités dans l'opinion), `duree` en semaines, `choix`.

Un choix : `t` (texte), `axe` et `sens` (la position prise : le moteur en déduit la cohérence avec la ligne du parti et l'effet sur chaque segment), `eff` (effets directs : `capital`, `credibilite`, `notoriete`, `unite`, `argent`, `militants`, `bilan`, `budget`, `forme`, `moral`, `popularite`, etc.), `opinion` (effet par étiquette de segment).

### medias.json, traits.json, noms.json

Médias fictifs inspirés du paysage français (audience, orientation, ton, publics). Traits et leurs effets mécaniques. Prénoms par génération et noms de famille par région pour les personnages générés.

### geo/

- `france.json` : contours des départements et des régions (coordonnées multipliées par 1 000).
- `circos.json` : contours des circonscriptions (multipliées par 10 000).
- `d/<département>.json` : communes du département avec l'index de leur zone, et secteurs pour Paris, Lyon, Marseille. Les contours des arrondissements municipaux n'étaient pas disponibles : les secteurs sont dessinés par des cercles placés au centre de chaque secteur.

## Élus réels (V6)

| Fichier | Contenu | Source |
|---|---|---|
| `elus.json` | 1 074 maires des communes simulées (nom, prénom, sexe, année de naissance, nuance, parti déduit pour 999 d'entre eux) | Répertoire national des élus, listes des municipales 2026 |
| `elus/XX.json` | 38 792 conseillers municipaux et d'arrondissement, par département | Répertoire national des élus |
| `elus/index.json` | Liste des départements disponibles | Produit par le script |

Chaîne de production : le workflow `.github/workflows/donnees.yml` lance `scripts/data/telecharger-mac.mjs` sur un serveur GitHub et pousse les fichiers compressés sur la branche `donnees`. Ensuite `node scripts/data/elus.mjs <dossier des fichiers>` produit les JSON ci-dessus.

Correspondance nuance vers parti : elle est dans `scripts/data/elus.mjs`. Les nuances « divers », « extrême » sans parti précis et les nuances vides ne donnent aucun parti.

Non intégrés : sénateurs, conseillers départementaux et régionaux (le répertoire ne donne pas leur parti).

## Logos des partis (V7)

`public/data/logos/` : un fichier par parti, déclaré dans `index.json`. Origine, titre et licence de chaque fichier dans `SOURCES.md`. Pour les mettre à jour : lancer le workflow « Logos des partis », récupérer la branche `logos`, choisir, copier.
