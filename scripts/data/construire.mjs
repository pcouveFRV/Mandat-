// Construit les fichiers JSON du jeu dans public/data/ à partir des sources brutes de .sources/.
// Usage : node scripts/data/construire.mjs   (après node scripts/data/telecharger.mjs)
// Aucune dépendance. Voir docs/DATA.md pour le format des fichiers produits.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const S = '.sources';
const OUT = 'public/data';
mkdirSync(`${OUT}/geo/d`, { recursive: true });

// ---------- utilitaires ----------
function csv(path, sep = ',') {
  const txt = readFileSync(path, 'utf8').replace(/^﻿/, '');
  const lignes = [];
  let cur = [], champ = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { champ += '"'; i++; } else q = false; } else champ += c; }
    else if (c === '"') q = true;
    else if (c === sep) { cur.push(champ); champ = ''; }
    else if (c === '\n') { cur.push(champ); lignes.push(cur); cur = []; champ = ''; }
    else if (c !== '\r') champ += c;
  }
  if (champ || cur.length) { cur.push(champ); lignes.push(cur); }
  const tete = lignes.shift();
  return lignes.filter(l => l.length > 1).map(l => Object.fromEntries(tete.map((k, i) => [k, l[i] ?? ''])));
}
const json = p => JSON.parse(readFileSync(p, 'utf8'));
const ecrire = (p, o) => { const s = JSON.stringify(o); writeFileSync(`${OUT}/${p}`, s); console.log(`${p} : ${(s.length / 1024).toFixed(0)} Ko`); };
// RNG déterministe (mulberry32) pour les données de substitution.
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

// ---------- géométrie ----------
const polys = g => !g ? [] : g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
function dansAnneau(x, y, r) { let d = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) d = !d; } return d; }
function dansGeom(x, y, ps) { for (const p of ps) { if (dansAnneau(x, y, p[0])) { let trou = false; for (let k = 1; k < p.length; k++) if (dansAnneau(x, y, p[k])) trou = true; if (!trou) return true; } } return false; }
function aireAnneau(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] * r[i][1] - r[i][0] * r[j][1]); return a / 2; }
function infoGeom(ps) { // centroïde pondéré, aire en km2, bbox
  let A = 0, cx = 0, cy = 0, minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  for (const p of ps) { const r = p[0]; const a = Math.abs(aireAnneau(r)); let sx = 0, sy = 0; for (const [x, y] of r) { sx += x; sy += y; if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; } A += a; cx += a * sx / r.length; cy += a * sy / r.length; }
  if (A === 0) return { lon: minx, lat: miny, km2: 0, bbox: [minx, miny, maxx, maxy] };
  const lat = cy / A; return { lon: cx / A, lat, km2: A * 111.32 * 111.32 * Math.cos(lat * Math.PI / 180), bbox: [minx, miny, maxx, maxy] };
}
function dp(pts, tol) { // Douglas-Peucker
  if (pts.length < 5) return pts; const garde = new Uint8Array(pts.length); garde[0] = garde[pts.length - 1] = 1; let pile = [[0, pts.length - 1]];
  if (pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) { let m = 0, dm = 0; for (let i = 1; i < pts.length - 1; i++) { const d = (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2; if (d > dm) { dm = d; m = i; } } garde[m] = 1; pile = [[0, m], [m, pts.length - 1]]; }
  while (pile.length) { const [a, b] = pile.pop(); let dm = 0, im = -1; const [x1, y1] = pts[a], [x2, y2] = pts[b]; const dx = x2 - x1, dy = y2 - y1, n = Math.hypot(dx, dy) || 1e-12;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / n; if (d > dm) { dm = d; im = i; } }
    if (dm > tol && im > 0) { garde[im] = 1; pile.push([a, im], [im, b]); } }
  const out = pts.filter((_, i) => garde[i]); return out.length >= 4 ? out : pts.slice(0, 4);
}
function compacter(ps, tol, k) { // -> [[x0,y0,x1,y1,...], ...] un anneau extérieur par polygone, entiers
  const out = []; for (const p of ps) { const r = dp(p[0], tol); if (r.length < 4) continue; const flat = []; let px = null, py = null; for (const [x, y] of r) { const X = Math.round(x * k), Y = Math.round(y * k); if (X !== px || Y !== py) { flat.push(X, Y); px = X; py = Y; } } if (flat.length >= 6) out.push(flat); } return out;
}

// ---------- 1. Référentiels ----------
console.log('Lecture des référentiels');
const regionsCsv = csv(`${S}/decoupage-administratif/sources/regions.csv`);
const deptsCsv = csv(`${S}/decoupage-administratif/sources/departements.csv`);
const communesCsv = csv(`${S}/decoupage-administratif/sources/communes.csv`);
const popCsv = csv(`${S}/decoupage-administratif/sources/donnees_communes.csv`, ';');
const pop = new Map(popCsv.map(r => [r.COM, +r.PMUN]));
for (const r of csv(`${S}/decoupage-administratif/sources/donnees_communes_mayotte.csv`, ';')) pop.set('976' + r.CODCOM, +r.PMUN);
const comOM = csv(`${S}/decoupage-administratif/sources/collectivites-outremer.csv`);

// Sénateurs par département (répartition en vigueur, 348 sièges avec les collectivités et les Français de l'étranger).
const SEN = { '01': 3, '02': 3, '03': 2, '04': 1, '05': 1, '06': 5, '07': 2, '08': 2, '09': 1, '10': 2, '11': 2, '12': 2, '13': 8, '14': 3, '15': 2, '16': 2, '17': 3, '18': 2, '19': 2, '2A': 1, '2B': 1, '21': 3, '22': 3, '23': 2, '24': 2, '25': 3, '26': 3, '27': 3, '28': 3, '29': 4, '30': 3, '31': 5, '32': 2, '33': 6, '34': 4, '35': 4, '36': 2, '37': 3, '38': 5, '39': 2, '40': 2, '41': 2, '42': 4, '43': 2, '44': 5, '45': 3, '46': 2, '47': 2, '48': 1, '49': 4, '50': 3, '51': 3, '52': 2, '53': 2, '54': 4, '55': 2, '56': 3, '57': 5, '58': 2, '59': 11, '60': 4, '61': 2, '62': 7, '63': 3, '64': 3, '65': 2, '66': 2, '67': 5, '68': 4, '69': 7, '70': 2, '71': 3, '72': 3, '73': 2, '74': 3, '75': 12, '76': 6, '77': 6, '78': 6, '79': 2, '80': 3, '81': 2, '82': 2, '83': 4, '84': 3, '85': 3, '86': 2, '87': 2, '88': 2, '89': 2, '90': 1, '91': 5, '92': 7, '93': 6, '94': 6, '95': 5, '971': 3, '972': 2, '973': 2, '974': 4, '976': 2, '975': 1, '977': 1, '978': 1, '986': 1, '987': 2, '988': 2, 'ZZ': 12 };
// Série 2 (renouvelée en 2020, puis septembre 2026) : Ain à Indre, Bas-Rhin à Yonne hors Île-de-France, Belfort, Guyane, Polynésie, Wallis, Saint-Barthélemy, Saint-Martin, moitié des Français de l'étranger.
const serie = d => { if (d === 'ZZ') return 0; if (['973', '987', '986', '977', '978'].includes(d)) return 2; if (['971', '972', '974', '976', '975', '988'].includes(d)) return 1; if (['75', '77', '78', '91', '92', '93', '94', '95'].includes(d)) return 1; if (d === '2A' || d === '2B') return 2; const n = +d; return (n <= 36 || (n >= 67 && n <= 90)) ? 2 : 1; };

const regions = regionsCsv.map(r => ({ code: r.REG, nom: r.LIBELLE, depts: [] }));
regions.push({ code: 'COM', nom: 'Collectivités d\'outre-mer', depts: [] }, { code: 'ETR', nom: 'Français de l\'étranger', depts: [] });
const regIdx = new Map(regions.map((r, i) => [r.code, i]));
const depts = deptsCsv.map(d => ({ code: d.DEP, nom: d.LIBELLE, region: d.REG, pop: 0, cantons: 0, senateurs: SEN[d.DEP] ?? 1, serie: serie(d.DEP) }));
const NOMS_COM = { '975': 'Saint-Pierre-et-Miquelon', '977': 'Saint-Barthélemy', '978': 'Saint-Martin', '986': 'Wallis-et-Futuna', '987': 'Polynésie française', '988': 'Nouvelle-Calédonie' };
const POP_COM = { '975': 5800, '977': 10500, '978': 32000, '986': 11200, '987': 279000, '988': 268500 };
for (const c of Object.keys(NOMS_COM)) depts.push({ code: c, nom: NOMS_COM[c], region: 'COM', pop: POP_COM[c], cantons: 0, senateurs: SEN[c], serie: serie(c) });
depts.push({ code: 'ZZ', nom: 'Français de l\'étranger', region: 'ETR', pop: 1700000, cantons: 0, senateurs: 12, serie: 0 });
const deptIdx = new Map(depts.map((d, i) => [d.code, i]));
for (const d of depts) regions[regIdx.get(d.region)].depts.push(d.code);

// ---------- 2. Circonscriptions et résultats 2024 ----------
console.log('Résultats des législatives 2024');
const L = `${S}/legislatives-2024`;
const circRef = csv(`${L}/lg2024_circonscriptions.csv`);
const inscrits = new Map(csv(`${L}/lg2024/t1_inscrits.csv`).map(r => [r.CodCirc2, +r.Inscrits]));
const t1 = csv(`${L}/lg2024/t1_resultats.csv`);
const t2 = csv(`${L}/lg2024/t2_resultats.csv`);
const elus = csv(`${L}/lg2024/t1t2_resultats.csv`);
const DEPT_Z = { ZA: '971', ZB: '972', ZC: '973', ZD: '974', ZM: '976', ZS: '975', ZX: '977', ZW: '986', ZP: '987', ZN: '988', ZZ: 'ZZ' };
const ordinal = n => n === 1 ? '1re' : `${n}e`;
const circos = []; const circoParC2 = new Map();
for (const c of circRef) {
  const c2 = c.CodCirc2; const pre = c2.slice(0, 2); const num = +c2.slice(-3);
  let dept = DEPT_Z[pre] ?? pre; if (pre === 'ZX') dept = '977';
  const id = `${dept}-${String(num).padStart(2, '0')}`;
  const d = depts[deptIdx.get(dept)];
  const o = { id, dept, num, nom: `${ordinal(num)} circonscription ${d ? 'de ' + d.nom : ''}`.trim(), nomCourt: `${d ? d.nom : dept} ${ordinal(num)}`, inscrits: inscrits.get(c2) ?? 0, exprimes: 0, t1: {}, candidats: [], t2: [], elu: null, lon: 0, lat: 0, c2, cElec: c.CodCirElec };
  circoParC2.set(c2, o); circos.push(o);
}
circos.sort((a, b) => a.id < b.id ? -1 : 1);
circos.forEach((c, i) => c.idx = i);
const num = s => +String(s).replace(',', '.');
for (const r of t1) { const c = circoParC2.get(r.CodCirc2); if (!c) continue; const v = +r.NbVoix; c.exprimes += v; c.t1[r.CodNuaCand] = (c.t1[r.CodNuaCand] ?? 0) + v; c.codCirc = r.CodCirc; c.candidats.push({ nom: r.NomPsn, prenom: r.PrenomPsn, sexe: r.CivilitePsn === 'Mme' ? 'F' : 'M', nuance: r.CodNuaCand, voix: v, pct: num(r.RapportExprimes) }); }
for (const r of t2) { const c = circoParC2.get(r.CodCirc2); if (!c) continue; c.t2.push({ nom: r.NomPsn, nuance: r.CodNuaCand, voix: +r.NbVoix, pct: num(r.RapportExprimes) }); }
for (const r of elus) { const c = circoParC2.get(r.CodCirc2); if (!c) continue; c.elu = { nom: r.NomPsn, prenom: r.PrenomPsn, sexe: r.CivilitePsn === 'Mme' ? 'F' : 'M', nuance: r.CodNuaCand, pct: num(r.RapportExprimes), tour: r.Elu1 === 'OUI' ? 1 : 2 }; }
for (const c of circos) { c.candidats.sort((a, b) => b.voix - a.voix); c.candidats = c.candidats.filter((x, i) => i < 6 && x.pct >= 3); }
console.log(`  ${circos.length} circonscriptions, ${circos.filter(c => c.elu).length} élus`);

// Géométrie des circonscriptions
const fond = json(`${S}/data_legislatives_2024/donnees_produites/resultats_provisoires_par_circo.geojson`);
const geoCirco = new Map();
for (const f of fond.features) {
  const code = String(f.properties.circo_id); const c = circos.find(x => x.codCirc === code || x.cElec === code || x.c2 === code);
  if (!c) { console.log('  circo sans correspondance :', code); continue; }
  const ps = polys(f.geometry); if (!ps.length) continue; geoCirco.set(c.idx, ps); const g = infoGeom(ps); c.lon = +g.lon.toFixed(3); c.lat = +g.lat.toFixed(3); c.bbox = g.bbox;
}
console.log(`  ${geoCirco.size} circonscriptions avec contour`);
const circosParDept = new Map(); for (const c of circos) { if (!circosParDept.has(c.dept)) circosParDept.set(c.dept, []); circosParDept.get(c.dept).push(c); }

// ---------- 3. Communes et zones ----------
console.log('Communes et zones');
const geoCom = new Map();
for (const f of json(`${S}/france-geojson/communes-version-simplifiee.geojson`).features) geoCom.set(f.properties.code, polys(f.geometry));
for (const f of json(`${S}/france-geojson/communes-avec-outre-mer.geojson`).features) if (f.properties.code.startsWith('97')) geoCom.set(f.properties.code, polys(f.geometry));

function circosPourPoint(dept, lon, lat) { const l = circosParDept.get(dept) ?? []; for (const c of l) { const ps = geoCirco.get(c.idx); if (ps && c.bbox && lon >= c.bbox[0] && lon <= c.bbox[2] && lat >= c.bbox[1] && lat <= c.bbox[3] && dansGeom(lon, lat, ps)) return c.idx; } return -1; }
function plusProche(dept, lon, lat) { let best = -1, bd = 1e9; for (const c of circosParDept.get(dept) ?? []) { const d = (c.lon - lon) ** 2 + (c.lat - lat) ** 2; if (d < bd && geoCirco.has(c.idx)) { bd = d; best = c.idx; } } if (best < 0) { const l = circosParDept.get(dept); if (l && l.length) best = l[0].idx; } return best; }
function repartition(dept, ps, info, fin) { // fractions de la commune par circonscription
  const compte = new Map(); const add = i => compte.set(i, (compte.get(i) ?? 0) + 1);
  if (!fin) { let i = circosPourPoint(dept, info.lon, info.lat); if (i < 0) i = plusProche(dept, info.lon, info.lat); return i < 0 ? [] : [[i, 100]]; }
  const [x0, y0, x1, y1] = info.bbox; const N = 14;
  for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) { const x = x0 + (a + .5) * (x1 - x0) / N, y = y0 + (b + .5) * (y1 - y0) / N; if (!dansGeom(x, y, ps)) continue; let i = circosPourPoint(dept, x, y); if (i >= 0) add(i); }
  if (!compte.size) { const i = plusProche(dept, info.lon, info.lat); return i < 0 ? [] : [[i, 100]]; }
  const tot = [...compte.values()].reduce((a, b) => a + b, 0); let l = [...compte.entries()].map(([i, n]) => [i, Math.round(100 * n / tot)]).filter(x => x[1] >= 8);
  const s = l.reduce((a, b) => a + b[1], 0); l.forEach(x => x[1] = Math.round(x[1] * 100 / s)); l[0][1] += 100 - l.reduce((a, b) => a + b[1], 0); return l;
}

// Secteurs de Paris, Lyon et Marseille : centres approximatifs des arrondissements (lon, lat).
const ARR = {
  '75': { ville: 'Paris', com: '75056', pre: '751', pts: [[2.336, 48.862], [2.343, 48.868], [2.360, 48.863], [2.356, 48.854], [2.345, 48.845], [2.333, 48.850], [2.312, 48.856], [2.312, 48.873], [2.338, 48.877], [2.361, 48.876], [2.380, 48.859], [2.395, 48.836], [2.362, 48.828], [2.327, 48.829], [2.293, 48.840], [2.262, 48.860], [2.307, 48.887], [2.344, 48.892], [2.385, 48.887], [2.401, 48.863]],
    secteurs: [['Paris Centre', [1, 2, 3, 4]], ...Array.from({ length: 16 }, (_, i) => [`Paris ${i + 5}e`, [i + 5]])] },
  '69': { ville: 'Lyon', com: '69123', pre: '6938', pts: [[4.835, 45.770], [4.827, 45.749], [4.855, 45.753], [4.826, 45.779], [4.803, 45.756], [4.852, 45.773], [4.840, 45.733], [4.869, 45.734], [4.808, 45.782]],
    secteurs: Array.from({ length: 9 }, (_, i) => [`Lyon ${i + 1}${i ? 'e' : 'er'}`, [i + 1]]) },
  '13': { ville: 'Marseille', com: '13055', pre: '132', pts: [[5.383, 43.300], [5.360, 43.315], [5.380, 43.312], [5.402, 43.307], [5.397, 43.293], [5.381, 43.287], [5.363, 43.283], [5.380, 43.241], [5.451, 43.234], [5.413, 43.275], [5.484, 43.288], [5.440, 43.308], [5.433, 43.350], [5.391, 43.345], [5.364, 43.360], [5.313, 43.365]],
    secteurs: [['Marseille 1er secteur (1er, 7e)', [1, 7]], ['Marseille 2e secteur (2e, 3e)', [2, 3]], ['Marseille 3e secteur (4e, 5e)', [4, 5]], ['Marseille 4e secteur (6e, 8e)', [6, 8]], ['Marseille 5e secteur (9e, 10e)', [9, 10]], ['Marseille 6e secteur (11e, 12e)', [11, 12]], ['Marseille 7e secteur (13e, 14e)', [13, 14]], ['Marseille 8e secteur (15e, 16e)', [15, 16]]] },
};
const PLM = new Set(['75056', '69123', '13055']);

const communes = []; // toutes les communes avec zone
const zones = [];
const parCanton = new Map();
for (const r of communesCsv) {
  if (r.TYPECOM !== 'COM') continue;
  const code = r.COM; const p = pop.get(code) ?? 0; const ps = geoCom.get(code);
  const d = depts[deptIdx.get(r.DEP)]; if (!d) continue; d.pop += p;
  const info = ps && ps.length ? infoGeom(ps) : null;
  const c = { code, nom: r.LIBELLE, dept: r.DEP, can: r.CAN, pop: p, ps, info, zone: -1 };
  communes.push(c);
  if (PLM.has(code)) continue;
  if (p >= 10000) {
    c.zone = zones.length;
    const km2 = info ? Math.max(info.km2, 1) : 20;
    zones.push({ id: 'C' + code, nom: r.LIBELLE, type: 0, dept: r.DEP, pop: p, km2, lon: info?.lon ?? 0, lat: info?.lat ?? 0, circos: info ? repartition(r.DEP, ps, info, p >= 30000) : [], ville: null, nb: 1 });
  } else { const k = r.DEP + '|' + (r.CAN || 'x'); if (!parCanton.has(k)) parCanton.set(k, []); parCanton.get(k).push(c); }
}
const cantonsParDept = new Map();
for (const [k, l] of parCanton) {
  const dept = k.split('|')[0]; cantonsParDept.set(dept, (cantonsParDept.get(dept) ?? 0) + 1);
  l.sort((a, b) => b.pop - a.pop); const tot = l.reduce((a, c) => a + c.pop, 0); if (tot === 0) continue;
  let lon = 0, lat = 0, km2 = 0, w = 0; const cc = new Map();
  for (const c of l) { if (!c.info) continue; lon += c.info.lon * (c.pop + 1); lat += c.info.lat * (c.pop + 1); w += c.pop + 1; km2 += c.info.km2; let i = circosPourPoint(dept, c.info.lon, c.info.lat); if (i < 0) i = plusProche(dept, c.info.lon, c.info.lat); if (i >= 0) cc.set(i, (cc.get(i) ?? 0) + c.pop + 1); }
  const t = [...cc.values()].reduce((a, b) => a + b, 0) || 1; let cl = [...cc.entries()].map(([i, n]) => [i, Math.round(100 * n / t)]).filter(x => x[1] >= 5).sort((a, b) => b[1] - a[1]);
  if (cl.length) { const s = cl.reduce((a, b) => a + b[1], 0); cl.forEach(x => x[1] = Math.round(x[1] * 100 / s)); cl[0][1] += 100 - cl.reduce((a, b) => a + b[1], 0); }
  else { const lc = circosParDept.get(dept) ?? []; cl = lc.map(c => [c.idx, Math.floor(100 / lc.length)]); if (cl.length) cl[0][1] += 100 - cl.reduce((a, b) => a + b[1], 0); }
  const z = zones.length; for (const c of l) c.zone = z;
  zones.push({ id: 'B' + l[0].code, nom: `Bassin de ${l[0].nom}`, type: 1, dept, pop: tot, km2: Math.max(km2, 1), lon: w ? lon / w : 0, lat: w ? lat / w : 0, circos: cl, ville: null, nb: l.length });
}
// Secteurs PLM
for (const dep of Object.keys(ARR)) {
  const A = ARR[dep]; const com = communes.find(c => c.code === A.com);
  for (const [nom, arrs] of A.secteurs) {
    let p = 0, lon = 0, lat = 0; const cc = new Map();
    for (const a of arrs) { const code = A.pre + String(a).padStart(dep === '69' ? 1 : 2, '0'); const pa = pop.get(code) ?? 0; p += pa; const [x, y] = A.pts[a - 1]; lon += x * pa; lat += y * pa; let i = circosPourPoint(dep, x, y); if (i < 0) i = plusProche(dep, x, y); cc.set(i, (cc.get(i) ?? 0) + pa); }
    const cl = [...cc.entries()].map(([i, n]) => [i, Math.round(100 * n / p)]).sort((a, b) => b[1] - a[1]); cl[0][1] += 100 - cl.reduce((a, b) => a + b[1], 0);
    zones.push({ id: `S${dep}${String(arrs[0]).padStart(2, '0')}`, nom, type: 2, dept: dep, pop: p, km2: Math.max(1, (com.info?.km2 ?? 100) * p / com.pop), lon: lon / p, lat: lat / p, circos: cl, ville: A.ville, nb: arrs.length, arrs });
  }
}
// Collectivités d'outre-mer et Français de l'étranger : une zone par circonscription.
for (const c of circos) { if (NOMS_COM[c.dept] || c.dept === 'ZZ') { const n = (circosParDept.get(c.dept) ?? []).length; zones.push({ id: 'O' + c.id, nom: c.dept === 'ZZ' ? `Français de l'étranger, ${ordinal(c.num)} circonscription` : (n > 1 ? `${NOMS_COM[c.dept]} ${c.num}` : NOMS_COM[c.dept]), type: 3, dept: c.dept, pop: c.dept === 'ZZ' ? Math.round(c.inscrits * 1.25) : Math.round(POP_COM[c.dept] / n), km2: 1000, lon: 0, lat: 0, circos: [[c.idx, 100]], ville: null, nb: 1 }); } }
// Saint-Barthélemy et Saint-Martin partagent une circonscription : une seule zone est créée via la circo 977-01.
for (const d of depts) d.cantons = cantonsParDept.get(d.code) ?? 0;

for (const z of zones) if (!z.circos.length) { const lc = circosParDept.get(z.dept) ?? []; z.circos = lc.map(c => [c.idx, Math.floor(100 / lc.length)]); if (z.circos.length) z.circos[0][1] += 100 - z.circos.reduce((a, b) => a + b[1], 0); }
// Type de territoire et inscrits
const popCirco = new Float64Array(circos.length);
for (const z of zones) { const dens = z.pop / z.km2; z.terr = z.type === 2 ? 0 : z.type === 3 ? 1 : z.type === 0 ? (z.pop >= 50000 || dens > 2500 ? 0 : 1) : (dens > 110 ? 1 : 2); for (const [i, f] of z.circos) popCirco[i] += z.pop * f / 100; }
// Circonscriptions restées sans zone : on leur rattache une part de la zone la plus proche du même département.
for (const c of circos) { if (popCirco[c.idx] > 0) continue; let best = null, bd = 1e9; for (const z of zones) { if (z.dept !== c.dept || !z.circos.length) continue; const d = (z.lon - c.lon) ** 2 + (z.lat - c.lat) ** 2; if (d < bd) { bd = d; best = z; } } if (best) { const part = Math.min(40, Math.floor(best.circos[0][1] / 2)); best.circos[0][1] -= part; best.circos.push([c.idx, part]); popCirco[c.idx] += best.pop * part / 100; } }
// Inscrits par zone : ratio inscrits / population du département.
const insDept = new Map(), popDeptZ = new Map(); for (const c of circos) insDept.set(c.dept, (insDept.get(c.dept) ?? 0) + c.inscrits); for (const z of zones) popDeptZ.set(z.dept, (popDeptZ.get(z.dept) ?? 0) + z.pop);
for (const z of zones) z.inscrits = Math.round(z.pop * (insDept.get(z.dept) ?? 0) / (popDeptZ.get(z.dept) || 1)) || Math.round(z.pop * 0.66);
// Cantons simulés pour les départementales : les grandes villes comptent pour plusieurs cantons.
const popMoyCanton = new Map(); for (const d of depts) { const b = zones.filter(z => z.dept === d.code && z.type === 1); popMoyCanton.set(d.code, b.length ? Math.max(15000, b.reduce((a, z) => a + z.pop, 0) / b.length) : 30000); }
for (const z of zones) z.cantons = z.type === 1 ? 1 : z.type === 3 ? 0 : Math.max(1, Math.round(z.pop / (popMoyCanton.get(z.dept) * 1.6)));
for (const d of depts) d.cantons = zones.filter(z => z.dept === d.code).reduce((a, z) => a + z.cantons, 0);
const sansCirco = zones.filter(z => !z.circos.length).length;
console.log(`  ${zones.length} zones : ${zones.filter(z => z.type === 0).length} communes, ${zones.filter(z => z.type === 1).length} bassins, ${zones.filter(z => z.type === 2).length} secteurs, ${zones.filter(z => z.type === 3).length} outre-mer et étranger (sans circo : ${sansCirco})`);
const circosVides = circos.filter(c => !zones.some(z => z.circos.some(x => x[0] === c.idx))); if (circosVides.length) console.log('  circos sans zone :', circosVides.map(c => c.id).join(' '));

// ---------- 4. Sociologie de substitution ----------
// 20 groupes (voir segments.json). Poids par zone construits à partir du type de territoire, de la région et d'un bruit déterministe.
// Substitution : remplace les données INSEE (âge, catégories socioprofessionnelles, revenus), non joignables lors de la construction.
const NB_SEG = 20;
//            0 étud 1 jeunes préc 2 jeunes cadres 3 ouv 25-49 4 ouv 50-64 5 empl 25-49 6 empl 50-64 7 interm 25-49 8 interm 50-64 9 cadres 35-49 10 cadres 50-64 11 indép 12 agri 13 sans emploi 14 retr modestes 15 retr moyens 16 retr aisés 17 fonct. 18 jeunes ouv/empl 19 inactifs
const BASE = [
  [6, 5, 7, 5, 3, 8, 4, 9, 4, 9, 5, 4, 0, 6, 5, 6, 5, 6, 5, 3], // urbain dense
  [3, 4, 4, 8, 5, 9, 6, 9, 6, 6, 4, 5, 1, 4, 7, 8, 4, 5, 5, 3], // périurbain
  [2, 3, 2, 9, 7, 7, 6, 6, 5, 3, 3, 7, 6, 4, 11, 9, 3, 4, 4, 3], // rural
];
const REG_TILT = { // multiplicateurs régionaux simples (réalité sociologique approchée)
  '11': { 2: 1.6, 9: 1.6, 10: 1.4, 0: 1.3, 12: 0.2, 14: 0.7, 3: 0.7 }, '32': { 3: 1.35, 4: 1.35, 13: 1.4, 9: 0.8 }, '44': { 3: 1.3, 4: 1.3, 13: 1.15 }, '28': { 3: 1.15, 12: 1.2 }, '53': { 12: 1.4, 7: 1.1, 13: 0.8 }, '52': { 12: 1.3, 3: 1.1, 13: 0.8 }, '75': { 12: 1.3, 14: 1.15, 15: 1.15 }, '76': { 14: 1.15, 13: 1.25, 11: 1.15 }, '93': { 16: 1.35, 15: 1.2, 11: 1.3, 13: 1.2, 3: 0.8 }, '84': { 9: 1.1, 7: 1.1 }, '27': { 12: 1.2, 4: 1.15, 14: 1.15 }, '24': { 12: 1.2, 14: 1.1 }, '94': { 11: 1.4, 14: 1.2, 15: 1.2 },
};
const socio = new Uint16Array(zones.length * NB_SEG);
zones.forEach((z, zi) => {
  const r = rng(hash(z.id)); const reg = depts[deptIdx.get(z.dept)]?.region; const tilt = REG_TILT[reg] ?? {}; const w = BASE[z.terr].map((b, i) => b * (tilt[i] ?? 1) * (0.7 + 0.6 * r()));
  if (z.type === 3 || ['01', '02', '03', '04', '06'].includes(reg)) { w[13] *= 1.8; w[1] *= 1.5; w[16] *= 0.5; w[18] *= 1.4; }
  if (z.dept === 'ZZ') { w[9] *= 3; w[10] *= 2; w[2] *= 2; w[3] = 0.5; w[12] = 0; w[13] *= 0.4; }
  if (z.terr === 0 && z.pop > 150000) { w[0] *= 1.5; w[2] *= 1.3; }
  const s = w.reduce((a, b) => a + b, 0); let acc = 0; for (let i = 0; i < NB_SEG; i++) { const v = Math.round(1000 * w[i] / s); socio[zi * NB_SEG + i] = v; acc += v; } socio[zi * NB_SEG + 5] += 1000 - acc;
});

// ---------- 5. Écriture des données de jeu ----------
const r3 = x => Math.round(x * 1000) / 1000;
ecrire('zones.json', { champs: ['id', 'nom', 'type', 'dept', 'pop', 'inscrits', 'terr', 'lon', 'lat', 'circos', 'ville', 'nbCommunes', 'cantons'], zones: zones.map(z => [z.id, z.nom, z.type, z.dept, z.pop, z.inscrits, z.terr, r3(z.lon), r3(z.lat), z.circos, z.ville, z.nb, z.cantons]) });
ecrire('socio.json', { substitution: true, nbSegments: NB_SEG, poids: Array.from(socio) });
ecrire('circos.json', circos.map(c => ({ id: c.id, dept: c.dept, num: c.num, nom: c.nom, nomCourt: c.nomCourt, inscrits: c.inscrits, exprimes: c.exprimes, t1: c.t1, candidats: c.candidats, t2: c.t2, elu: c.elu, lon: c.lon, lat: c.lat })));
ecrire('depts.json', depts);
ecrire('regions.json', regions);

// ---------- 6. Géométrie ----------
console.log('Géométrie');
const geoDept = {}; const K = 1000; const aireMin = code => code.length === 3 ? 0.00005 : 0.0004;
for (const f of json(`${S}/france-geojson/departements-avec-outre-mer.geojson`).features) geoDept[f.properties.code] = compacter(polys(f.geometry).filter(p => Math.abs(aireAnneau(p[0])) > aireMin(f.properties.code)), 0.004, K);
const geoReg = {};
for (const f of json(`${S}/france-geojson/regions-avec-outre-mer.geojson`).features) geoReg[f.properties.code] = compacter(polys(f.geometry).filter(p => Math.abs(aireAnneau(p[0])) > 0.001), 0.008, K);
ecrire('geo/france.json', { echelle: K, depts: geoDept, regions: geoReg });
const gc = {}; for (const [i, ps] of geoCirco) gc[circos[i].id] = compacter(ps.filter(p => Math.abs(aireAnneau(p[0])) > 0.00002), 0.0025, 10000);
ecrire('geo/circos.json', { echelle: 10000, circos: gc });
let total = 0;
for (const d of depts) {
  const l = communes.filter(c => c.dept === d.code && c.ps && c.ps.length); if (!l.length) continue;
  const o = { echelle: 10000, communes: l.map(c => [c.code, c.nom, c.zone, compacter(c.ps, 0.0012, 10000)]) };
  if (ARR[d.code]) o.secteurs = zones.map((z, i) => [i, z]).filter(([, z]) => z.type === 2 && z.dept === d.code).map(([i, z]) => [i, z.nom, r3(z.lon), r3(z.lat), z.pop]);
  const s = JSON.stringify(o); total += s.length; writeFileSync(`${OUT}/geo/d/${d.code}.json`, s);
}
console.log(`geo/d/*.json : ${(total / 1048576).toFixed(1)} Mo au total`);
console.log('Terminé.');
