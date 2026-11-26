// Téléchargement des données officielles, à lancer sur votre ordinateur (pas depuis la session Claude, dont le réseau est bridé).
// Usage :  node telecharger-mac.mjs            (jeux essentiels, quelques centaines de Mo)
//          node telecharger-mac.mjs --tout     (ajoute l'historique complet par bureau de vote, plusieurs Go)
// Les fichiers arrivent dans le dossier « sources » à côté de ce script, avec un fichier catalogue.json qui les décrit.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const ICI = path.dirname(fileURLToPath(import.meta.url)); const SORTIE = path.join(ICI, 'sources'); const TOUT = process.argv.includes('--tout');
const API = 'https://www.data.gouv.fr/api/1/datasets/';
// Identifiants vérifiés sur data.gouv.fr en novembre 2026.
const JEUX = [
  { id: 'repertoire-national-des-elus-1', nom: 'elus', pourquoi: 'Maires, députés, sénateurs, conseillers : les élus réels.', max: 400 },
  { id: 'elections-municipales-2026-resultats-du-premier-tour', nom: 'municipales-2026-t1', pourquoi: 'Municipales 2026, premier tour.', max: 200 },
  { id: 'elections-municipales-2026-resultats-du-second-tour', nom: 'municipales-2026-t2', pourquoi: 'Municipales 2026, second tour.', max: 200 },
  { id: 'donnees-des-elections-agregees', nom: 'elections-agregees', pourquoi: 'Toutes les élections depuis 1999 par bureau de vote. Base des départs en 2010, 2014, 2017 et 2022.', max: 20000, lourd: true },
];
// Recherches dont je garde seulement la liste des résultats, pour choisir ensuite les bons fichiers INSEE.
const RECHERCHES = ['insee dossier complet communes', 'insee revenus localisés filosofi communes', 'insee recensement population catégories socioprofessionnelles communes', 'élections départementales 2021 résultats', 'élections régionales 2021 résultats', 'élections sénatoriales résultats'];

const mo = (o) => o ? `${(o / 1e6).toFixed(1)} Mo` : 'taille inconnue';
async function json(url) { const r = await fetch(url, { headers: { 'User-Agent': 'mandat-jeu/5 (usage privé)' } }); if (!r.ok) throw new Error(`${r.status} sur ${url}`); return r.json(); }
async function telecharger(url, fichier) {
  if (fs.existsSync(fichier) && fs.statSync(fichier).size > 0) return 'déjà là';
  const r = await fetch(url, { redirect: 'follow' }); if (!r.ok || !r.body) throw new Error(`${r.status}`);
  await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(fichier + '.partiel')); fs.renameSync(fichier + '.partiel', fichier); return mo(fs.statSync(fichier).size);
}
const propre = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90);

fs.mkdirSync(SORTIE, { recursive: true }); const catalogue = { date: new Date().toISOString(), jeux: [], recherches: [], erreurs: [] };
for (const jeu of JEUX) {
  if (jeu.lourd && !TOUT) { console.log(`\n${jeu.nom} : ignoré (lourd). Relancez avec --tout pour l'obtenir.`); catalogue.jeux.push({ ...jeu, ignore: true }); continue; }
  console.log(`\n${jeu.nom} : ${jeu.pourquoi}`);
  try {
    const d = await json(API + jeu.id + '/'); const dossier = path.join(SORTIE, jeu.nom); fs.mkdirSync(dossier, { recursive: true }); const fiches = [];
    for (const res of d.resources ?? []) {
      const format = (res.format || '').toLowerCase(); if (!['csv', 'txt', 'json', 'parquet', 'zip', 'xlsx', 'gz'].includes(format)) continue;
      const taille = res.filesize || res.extras?.['analysis:content-length'] || 0; const nom = propre(res.title || res.id) + (path.extname(propre(res.title || '')) ? '' : '.' + format);
      // À format égal, on préfère le CSV au parquet : il se lit sans outil particulier.
      if (format === 'parquet' && (d.resources ?? []).some(x => (x.format || '').toLowerCase() === 'csv' && (x.title || '').replace(/\.\w+$/, '') === (res.title || '').replace(/\.\w+$/, ''))) continue;
      if (taille > jeu.max * 1e6) { console.log(`  ${nom} : ignoré (${mo(taille)}, au-dessus de ${jeu.max} Mo)`); fiches.push({ titre: res.title, url: res.url, taille, ignore: true }); continue; }
      try { const r = await telecharger(res.url, path.join(dossier, nom)); console.log(`  ${nom} : ${r}`); fiches.push({ titre: res.title, fichier: path.join(jeu.nom, nom), url: res.url, taille, maj: res.last_modified }); }
      catch (err) { console.log(`  ${nom} : échec (${err.message})`); catalogue.erreurs.push({ jeu: jeu.id, fichier: nom, erreur: String(err.message) }); }
    }
    catalogue.jeux.push({ id: jeu.id, nom: jeu.nom, titre: d.title, maj: d.last_modified, licence: d.license, fichiers: fiches });
  } catch (err) { console.log(`  échec : ${err.message}`); catalogue.erreurs.push({ jeu: jeu.id, erreur: String(err.message) }); }
}
for (const q of RECHERCHES) {
  try { const d = await json(`${API}?q=${encodeURIComponent(q)}&page_size=8`); catalogue.recherches.push({ q, resultats: (d.data ?? []).map(x => ({ id: x.slug, titre: x.title, organisation: x.organization?.name, maj: x.last_modified, fichiers: (x.resources ?? []).slice(0, 12).map(r => ({ titre: r.title, format: r.format, taille: r.filesize, url: r.url })) })) }); console.log(`\nRecherche « ${q} » : ${(d.data ?? []).length} résultats notés.`); }
  catch (err) { catalogue.erreurs.push({ recherche: q, erreur: String(err.message) }); }
}
fs.writeFileSync(path.join(SORTIE, 'catalogue.json'), JSON.stringify(catalogue, null, 1));
console.log(`\nTerminé. ${catalogue.erreurs.length} erreur(s). Dossier : ${SORTIE}\nDites à Claude que c'est fait : il lira catalogue.json et les fichiers depuis ce dossier.`);
