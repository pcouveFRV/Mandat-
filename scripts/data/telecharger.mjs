// Télécharge les sources brutes dans .sources/ (dépôts GitHub publics qui republient les fichiers officiels).
// Usage : node scripts/data/telecharger.mjs
// Voir docs/DATA.md pour le détail de chaque source (URL, date, licence).
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';

const SOURCES = [
  // Contours communes, cantons, départements, régions (IGN / INSEE via Grégoire David), Licence Ouverte.
  ['france-geojson', 'https://github.com/gregoiredavid/france-geojson.git'],
  // Code officiel géographique et populations légales INSEE (sources du paquet @etalab/decoupage-administratif).
  ['decoupage-administratif', 'https://github.com/datagouv/decoupage-administratif.git'],
  // Résultats des législatives 2024 (ministère de l'Intérieur, mis en forme par Duong Tam Kien) et fond des circonscriptions.
  ['legislatives-2024', 'https://github.com/taniki/legislatives-2024.git'],
  // Contours réels des circonscriptions législatives joints aux résultats 2024 (Idrissa Djepa Creutz).
  ['data_legislatives_2024', 'https://github.com/IdrissaD/data_legislatives_2024.git'],
];

mkdirSync('.sources', { recursive: true });
for (const [nom, url] of SOURCES) {
  const dest = `.sources/${nom}`;
  if (existsSync(dest)) { console.log(`déjà présent : ${dest}`); continue; }
  console.log(`clonage de ${url}`);
  execSync(`git clone --depth 1 ${url} ${dest}`, { stdio: 'inherit' });
}
console.log('Sources prêtes. Lancer ensuite : node scripts/data/construire.mjs');
