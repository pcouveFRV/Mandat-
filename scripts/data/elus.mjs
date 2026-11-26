// Intègre les élus réels (Répertoire national des élus) et l'étiquette de leur liste aux municipales 2026.
// Entrée : le dossier de la branche « donnees » (voir .github/workflows/donnees.yml), passé en argument.
// Sorties : public/data/elus.json (maires des villes simulées) et public/data/elus/XX.json (conseillers par département).
// Usage : node scripts/data/elus.mjs /chemin/vers/branche-donnees
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const SRC = process.argv[2]; if (!SRC || !fs.existsSync(SRC)) { console.error('Indiquez le dossier des données téléchargées.'); process.exit(1); }
const lire = (f) => { const p = path.join(SRC, f); const brut = fs.readFileSync(p); return (p.endsWith('.gz') ? zlib.gunzipSync(brut) : brut).toString('utf8'); };
const trouver = (dossier, motif) => { const f = fs.readdirSync(path.join(SRC, dossier)).find(x => motif.test(x)); if (!f) throw new Error(`Fichier introuvable : ${dossier} ${motif}`); return path.join(dossier, f); };
function csv(texte) { const lignes = texte.split(/\r?\n/).filter(Boolean); const dec = (l) => l.split(';').map(x => x.replace(/^"|"$/g, '')); const tete = dec(lignes[0].replace(/^﻿/, '')); return { tete, lignes: lignes.slice(1).map(dec), col: (n) => tete.indexOf(n) }; }
// Nuance de liste du ministère de l'Intérieur vers parti du jeu. Les nuances ambiguës (divers, union d'extrême droite, extrême droite) ne sont pas attribuées.
const NUANCES = { LEXG: 'LO', LFI: 'LFI', LCOM: 'PCF', LSOC: 'PS', LUG: 'DVG', LDVG: 'DVG', LECO: 'ECO', LVEC: 'ECO', LREG: 'REG', LREN: 'RE', LMDM: 'MDM', LHOR: 'HOR', LUC: 'DVC', LDVC: 'DVC', LUDI: 'UDI', LLR: 'LR', LUD: 'DVD', LDVD: 'DVD', LUDR: 'UDR', LRN: 'RN', LREC: 'REC', LDSV: 'DLF' };
const propre = (s) => s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()).replace(/\b(De|Du|Des|Le|La|D')\b(?=\s|')/g, (m) => m).trim();
const cle = (nom, prenom, naissance) => `${nom.toUpperCase().trim()}|${prenom.toUpperCase().trim()}|${naissance}`;

const zones = JSON.parse(fs.readFileSync('public/data/zones.json', 'utf8')); const parId = new Map(zones.zones.map(z => [z[0], z]));
// Secteurs de Paris, Lyon, Marseille : rangés par numéro dans le jeu.
const secteurs = { 75056: zones.zones.filter(z => z[2] === 2 && z[10] === 'Paris').map(z => z[0]).sort(), 69123: zones.zones.filter(z => z[2] === 2 && z[10] === 'Lyon').map(z => z[0]).sort(), 13055: zones.zones.filter(z => z[2] === 2 && z[10] === 'Marseille').map(z => z[0]).sort() };
const zoneSecteur = (codeCommune, libelle) => { const l = secteurs[+codeCommune]; if (!l) return null; const n = +(/(\d+)/.exec(libelle)?.[1] ?? 0); if (!n) return null; const i = +codeCommune === 75056 ? (n === 1 ? 0 : n - 4) : n - 1; return l[i] ?? null; };

// 1. Nuances des listes sur lesquelles chaque élu a été élu.
const nuance = new Map();
for (const f of [trouver('municipales-2026-t1', /^Municipales-2026---Candidats-Elus/), trouver('municipales-2026-t2', /^Municipales-2026---Candidats-Elus/), trouver('municipales-2026-t1', /^Conseils-d-arrondissement.*Candidats-Elus/), trouver('municipales-2026-t2', /^Conseils-d-arrondissement.*Candidats-Elus/)]) {
  const c = csv(lire(f)); const iN = c.col('NOMPSN'), iP = c.col('PREPSN'), iD = c.col('DATNAIPSN'), iNu = c.col('CODE_NUANCE_DE_LISTE'); for (const l of c.lignes) if (l[iNu]) nuance.set(cle(l[iN], l[iP], l[iD]), l[iNu]);
}
console.log(`Nuances de liste connues : ${nuance.size} élus`);
const fiche = (nom, prenom, sexe, naissance, fonction = '') => { const nu = nuance.get(cle(nom, prenom, naissance)) ?? ''; return { n: propre(nom), p: propre(prenom), s: sexe === 'F' ? 'F' : 'M', a: +String(naissance).slice(0, 4) || 1970, nuance: nu, parti: NUANCES[nu] ?? '', f: fonction }; };

// 2. Maires.
const maires = {}; let nbM = 0, nbMP = 0;
{ const c = csv(lire('elus/elus-maires-mai.csv.gz')); const iC = c.col('Code de la commune'), iN = c.col("Nom de l'élu"), iP = c.col("Prénom de l'élu"), iS = c.col('Code sexe'), iD = c.col('Date de naissance');
  for (const l of c.lignes) { const id = 'C' + l[iC]; if (!parId.has(id) && !secteurs[+l[iC]]) continue; const x = fiche(l[iN], l[iP], l[iS], l[iD], 'Maire'); maires[id] = { n: x.n, p: x.p, s: x.s, a: x.a, nuance: x.nuance, parti: x.parti }; nbM++; if (x.parti) nbMP++; } }
// Maires de secteur (Paris, Lyon, Marseille).
const parDept = {};
const ajouter = (zone, x) => { const dept = parId.get(zone)?.[3]; if (!dept) return; ((parDept[dept] ??= {})[zone] ??= []).push([x.n, x.p, x.s, x.a, x.parti, x.f]); };
{ const c = csv(lire('elus/elus-conseillers-darrondissements-ca.csv')); const iC = c.col('Code de la commune'), iL = c.col('Libellé du secteur'), iN = c.col("Nom de l'élu"), iP = c.col("Prénom de l'élu"), iS = c.col('Code sexe'), iD = c.col('Date de naissance'), iF = c.col('Libellé de la fonction');
  for (const l of c.lignes) { const z = zoneSecteur(l[iC], l[iL]); if (!z) continue; const x = fiche(l[iN], l[iP], l[iS], l[iD], l[iF] || 'Conseiller d\'arrondissement'); ajouter(z, x); if (/^maire/i.test(l[iF] || '')) { maires[z] = { n: x.n, p: x.p, s: x.s, a: x.a, nuance: x.nuance, parti: x.parti }; nbM++; if (x.parti) nbMP++; } } }
// 3. Conseillers municipaux des communes simulées une par une.
let nbC = 0, nbCP = 0;
{ const c = csv(lire('elus/elus-conseillers-municipaux-cm.csv.gz')); const iC = c.col('Code de la commune'), iN = c.col("Nom de l'élu"), iP = c.col("Prénom de l'élu"), iS = c.col('Code sexe'), iD = c.col('Date de naissance'), iF = c.col('Libellé de la fonction');
  for (const l of c.lignes) { const id = 'C' + l[iC]; if (!parId.has(id)) continue; const x = fiche(l[iN], l[iP], l[iS], l[iD], l[iF] || 'Conseiller municipal'); ajouter(id, x); nbC++; if (x.parti) nbCP++; } }

fs.writeFileSync('public/data/elus.json', JSON.stringify({ _doc: 'Maires réels des villes simulées, d\'après le Répertoire national des élus (data.gouv.fr). Le parti est déduit de la nuance officielle de la liste aux municipales 2026 ; il est vide quand la nuance est ambiguë.', source: 'Répertoire national des élus et résultats des municipales 2026, ministère de l\'Intérieur, licence ouverte', maires }));
fs.rmSync('public/data/elus', { recursive: true, force: true }); fs.mkdirSync('public/data/elus', { recursive: true });
for (const dept of Object.keys(parDept)) fs.writeFileSync(`public/data/elus/${dept}.json`, JSON.stringify(parDept[dept]));
fs.writeFileSync('public/data/elus/index.json', JSON.stringify({ depts: Object.keys(parDept).sort(), champs: ['nom', 'prenom', 'sexe', 'naissance', 'parti', 'fonction'] }));
console.log(`Maires retenus : ${nbM} (dont ${nbMP} avec un parti attribué). Conseillers : ${nbC} (dont ${nbCP} avec un parti). Départements : ${Object.keys(parDept).length}.`);
console.log(`Marseille : ${JSON.stringify(maires.C13055)} ; 5e secteur : ${JSON.stringify(maires.S1309)}`);
