# Décisions

Une ligne par décision, avec la raison.

- Dépôt : le dépôt GitHub créé s'appelle `Mandat-` et non `mandat`. Je l'utilise tel quel, car ma session ne peut ni créer ni renommer un dépôt. Le jeu utilise des chemins relatifs, donc un renommage ne casse rien.
- Interface : Preact, comme demandé. Pas de React.
- Graphiques : SVG fait main, sans librairie. Raison : zéro dépendance en plus, rendu cohérent avec la carte.
- Outils de construction : le registre npm n'est pas joignable depuis mon environnement. Le projet est configuré pour Vite, Preact et Vitest (c'est ce que lancent `npm run dev`, `npm run build`, `npm test` et le workflow GitHub). De mon côté je compile avec bun et les sources de Preact clonées depuis GitHub (`scripts/dev/`), et je lance les tests avec `bun test`, qui accepte les imports `vitest`.
- Données : data.gouv.fr et l'INSEE ne sont pas joignables depuis mon environnement, GitHub oui. Les données réelles viennent donc de dépôts GitHub publics qui republient les fichiers officiels (voir `docs/DATA.md`). Ce qui manque est remplacé par des données de substitution, signalées comme telles.
- Pipeline de données en Node sans dépendance (`.mjs`). Raison : lançable partout avec `node`, sans installation.
- Maquette de zones : communes de plus de 10 000 habitants une par une (1 045), autres communes regroupées en bassins par canton (1 699), 34 secteurs pour Paris, Lyon, Marseille, 19 zones pour les collectivités d'outre-mer et les Français de l'étranger. Raison : c'est la granularité demandée, et elle tient les performances.
- Vingt groupes sociaux par zone au lieu du croisement complet âge x catégorie x territoire. Raison : performance et lisibilité. Le type de territoire est porté par la zone.
- Calibrage refait à chaque création de partie (moins d'une seconde) plutôt que stocké dans un fichier. Raison : si vous modifiez un parti ou un segment dans les JSON, le calibrage reste juste sans rien relancer.
- Le parti exact des candidats UG et ENS de 2024 n'est pas dans les données officielles par nuance. Les élus connus sont rattachés par la liste `affiliations`, les autres par défaut au PS (UG) ou à Renaissance (ENS).
- Paris, Lyon, Marseille : j'applique la réforme de 2025 (un vote pour le conseil de la ville avec prime de 25 %, un vote par secteur avec prime de 50 %). Raison : c'est le régime en vigueur depuis les municipales 2026.
- Les secteurs sont dessinés par des cercles sur la carte. Raison : les contours des arrondissements municipaux n'étaient pas dans les sources joignables.
- Un vote a lieu le dimanche et le moteur le traite le lundi suivant. Raison : un tour commence le lundi, la soirée électorale ouvre la semaine.
- Législatives placées en juin après chaque présidentielle (2027, 2032, etc.). Raison : c'est l'usage depuis 2002, et le président élu en 2027 n'aurait pas de majorité avec l'Assemblée de 2024. La dissolution libre est renvoyée à la V4.
- Départementales et régionales en mars 2028 puis tous les six ans. Raison : report légal de 2027 à 2028.
- Postes de direction des partis (trésorier, porte-parole, etc.) et délégués départementaux confiés à des personnages générés. Raison : ne pas attribuer à une personne réelle une fonction qu'elle n'occupe pas.
- Traits des personnes réelles tirés uniquement de leur fonction, jamais au hasard. Raison : un trait comme « Gaffeur » serait un jugement personnel.
- Les personnes réelles ne meurent pas dans le jeu, elles se retirent avec l'âge. Raison : éviter d'annoncer le décès d'une personne réelle.
- Médias : noms fictifs inspirés des vrais. Raison : le cahier des charges demande des médias « inspirés des vrais », et donner une orientation éditoriale à un média réel serait un jugement.
- Usure du pouvoir ajoutée au moteur (le parti du président et ses alliés perdent du terrain, l'opposition se refait). Raison : sans elle, le premier parti des données réelles gagnait toutes les présidentielles dans la simulation automatique.
- Pas plus de deux mandats présidentiels consécutifs. Raison : article 6 de la Constitution.
- Scissions : le courant qui part rejoint le parti existant le plus proche, ou active un des deux partis de réserve s'il pèse plus de 22 %. Raison : garder un nombre de partis fixe en mémoire tout en permettant la création de partis (scission, fondation par le joueur).
- Sénateurs et élus locaux sans rôle de jeu : sièges comptés par parti sans fiche personnage, sauf pour le parti du joueur. Raison : limiter le nombre de personnages (environ 2 700 au départ, 7 000 en 2050).
- En mode Carrière, l'IA dirige le parti du joueur pour tout ce que ses postes ne lui permettent pas de décider. Raison : c'est la règle demandée (un militant ne décide pas des investitures).
- Le score du mode Carrière compte surtout le parcours personnel. Le poids du parti n'est compté en entier que si le joueur le préside.
- Déploiement : le workflow GitHub Actions teste, construit et déploie. L'activation de GitHub Pages se fait dans les réglages du dépôt et je n'y ai pas accès depuis ma session.
- Partie d'essai : jouée à travers la vraie interface par un robot (Playwright) qui prend les décisions comme un joueur, avec relecture des journaux et des captures d'écran. Raison : c'est le seul moyen pour moi de jouer dix ans dans le navigateur.
