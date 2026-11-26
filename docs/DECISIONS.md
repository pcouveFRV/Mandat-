# Décisions

Une ligne par décision, avec la raison.

- Dépôt : le dépôt GitHub créé s'appelle `Mandat-` et non `mandat`. Je l'utilise tel quel, car ma session ne peut ni créer ni renommer un dépôt. Le jeu utilise des chemins relatifs, donc un renommage ne casse rien.
- Interface : Preact, comme demandé. Pas de React.
- Graphiques : SVG fait main, sans librairie. Raison : zéro dépendance en plus, rendu cohérent avec la carte.
- Outils de construction : le registre npm n'est pas joignable depuis mon environnement. Le projet est configuré pour Vite, Preact et Vitest (c'est ce que lancent `npm run dev`, `npm run build`, `npm test` et le workflow GitHub). De mon côté je compile avec bun et les sources de Preact clonées depuis GitHub (`scripts/dev/`), et je lance les tests avec `bun test`, qui accepte les imports `vitest`.
- Données : data.gouv.fr et l'INSEE ne sont pas joignables depuis mon environnement, GitHub oui. Les données réelles viennent donc de dépôts GitHub publics qui republient les fichiers officiels (voir `docs/DATA.md`). Ce qui manque est remplacé par des données de substitution, signalées comme telles.
- Pipeline de données en Node sans dépendance (`.mjs`). Raison : lançable partout avec `node`, sans installation.
