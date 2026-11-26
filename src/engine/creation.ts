// Création d'une partie : état initial à partir des données réelles, calibrage, personnages, collectivités.
import type { Donnees, Etat, Parti, Perso, Mairie, Conseil, Mode } from './types';
import { A, NB_ATTRS, NB_AXES } from './types';
import { Rng, clamp, hash } from './rng';
import { semaineDe, calendrierInitial, annee } from './calendrier';
import { cibles, calibrer, partiDeNuance, preparer, intentions } from './systems/electorat';
import { creerPerso, donnerMandat, tisserRelations, ajouterHist } from './systems/personnages';
import { recalculerCourants, designerChef } from './systems/partis';
import { primeMajoritaire, plusForteMoyenne, financementPublic } from './systems/regles';
import { senatorialesTour } from './systems/scrutins';
import { message } from './systems/inbox';
import { SIEGES_REGION } from './donnees';

export interface OptPartie { scenario: 'municipales2026' | 'route2027' | 'monde_apres'; mode: Mode; parti: string; graine: number; tutoriel?: boolean; perso?: { nom: string; prenom: string; sexe: 'M' | 'F'; age: number; zone: string; origine: string; etudes: string; traits: string[]; attrs: number[]; depart: 'militant' | 'conseiller' } }
export const SCENARIOS = [
  { id: 'municipales2026', nom: 'Après les municipales 2026', date: 'Avril 2026', texte: 'Les municipales viennent de redessiner la carte. Un an pour préparer la présidentielle.' },
  { id: 'route2027', nom: 'La route de 2027', date: 'Septembre 2026', texte: 'Rentrée politique. Sénatoriales dans trois semaines, présidentielle dans sept mois.' },
  { id: 'monde_apres', nom: 'Le monde d\'après', date: 'Juillet 2027', texte: 'La présidentielle et les législatives de 2027 sont simulées au chargement. Vous héritez d\'un paysage inédit.' },
] as const;
export const POINTS_CREATION = 40;

function partiInitial(d: Donnees, i: number): Parti {
  const p = d.partis[i]; const reserve = p.id.startsWith('NP'); const nD = d.depts.length;
  return { idx: i, id: p.id, actif: !reserve, nom: p.nom, sigle: p.sigle, couleur: p.couleur, famille: p.famille, tresorerie: p.tresorerie, adherents: p.adherents, militants: p.adherents * 0.1, capital: 40, credibilite: p.credibilite, notoriete: p.notoriete, unite: p.unite, credibilite0: p.credibilite, notoriete0: p.notoriete, fatigue: 0, viralite: 0, dynamique: 0,
    axes: p.axes.slice(), axes0: p.axes.slice(), propositions: [], culture: 0, chef: -1, bureau: { tresorier: -1, porte_parole: -1, organisation: -1, elections: -1, projet: -1, jeunes: -1 }, adhDept: new Array(nD).fill(0), delegues: new Array(nD).fill(-1), courants: [], strategie: p.strategie, style: p.style, notabilite: p.notabilite,
    prets: p.dette > 0 ? [{ montant: p.dette, restant: p.dette, mensualite: Math.round(p.dette / 96), fin: 96 * 4.35 }] : [], financementPublic: 0, voixLeg: 0, pariteRetenue: 0, comptes: [], fluxMois: {}, histTreso: [], cotisation: 30, permanents: Math.max(1, Math.round(p.adherents / 2500 + p.tresorerie / 900000)), budgetCom: Math.round(p.tresorerie * 0.004), budgetFormation: 0, terrain: [], prochainCongres: 0, gaffes: 0, inegibiliteRisque: 0, candidatPres: -1, parrainages: 0, campagne: null, scoreIA: { biaisParite: 0, frontRepublicain: 1, effortParrainages: 0 } };
}
function relationsInitiales(d: Donnees, e: Etat) {
  const n = e.partis.length; e.relPartis = new Array(n * n).fill(0);
  const X: Record<string, number> = { 'LFI:PS': 5, 'PS:PP': 65, 'RN:UDR': 85, 'RN:REC': -5, 'LR:RN': -30, 'LR:UDR': -35, 'RE:MDM': 72, 'RE:HOR': 55, 'MDM:HOR': 50, 'LR:RE': 12, 'LR:HOR': 30, 'LR:UDI': 62, 'LR:DVD': 65, 'UDI:DVD': 55, 'UDI:RE': 45, 'UDI:HOR': 50, 'UDI:MDM': 55, 'PS:DVG': 65, 'PS:ECO': 42, 'PS:PCF': 48, 'LFI:PCF': 28, 'LFI:ECO': 32, 'ECO:PP': 45, 'ECO:PCF': 35, 'PP:DVG': 55, 'LFI:PP': -25, 'RE:DVC': 60, 'MDM:DVC': 60, 'HOR:DVC': 55, 'HOR:DVD': 45, 'RE:PS': -5, 'RE:PP': 8, 'REC:UDR': 25, 'DLF:RN': 20, 'DLF:REC': 20, 'DLF:UDR': 25, 'REG:DVG': 35, 'REG:DVC': 35, 'REG:ECO': 35, 'REG:PS': 30, 'LFI:DVG': 20, 'PCF:DVG': 45, 'ECO:DVG': 40, 'DVD:DVC': 50, 'RE:DVD': 25, 'MDM:PS': 5, 'LR:DVC': 40, 'LR:MDM': 20, 'RN:DVD': -15, 'UDR:DVD': 5, 'LO:LFI': -5, 'LO:PCF': 0 };
  const fam = (f: string) => ({ extreme_gauche: 0, gauche: 1, centre: 2, droite: 3, droite_nationale: 4 }[f] ?? 2);
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) { if (a === b) { e.relPartis[a * n + b] = 100; continue; } const A_ = e.partis[a], B = e.partis[b]; const k = X[`${A_.id}:${B.id}`] ?? X[`${B.id}:${A_.id}`]; if (k !== undefined) { e.relPartis[a * n + b] = k; continue; } let dist = 0; for (let i = 0; i < NB_AXES; i++) dist += (A_.axes[i] - B.axes[i]) ** 2; const df = Math.abs(fam(A_.famille) - fam(B.famille)); e.relPartis[a * n + b] = clamp(Math.round(30 - dist / 4 - df * 22 + (df === 0 ? 20 : 0)), -90, 60); }
  for (const P of e.partis) if (P.id === 'LO') for (const Q of e.partis) if (Q.idx !== P.idx) { e.relPartis[P.idx * n + Q.idx] = Math.min(e.relPartis[P.idx * n + Q.idx], -10); e.relPartis[Q.idx * n + P.idx] = Math.min(e.relPartis[Q.idx * n + P.idx], -10); }
}

export function creerPartie(d: Donnees, o: OptPartie): Etat {
  const rng = new Rng(o.graine || 1); const nP = d.partis.length, nZ = d.zones.length, nS = d.segments.length; const nReels = d.partis.filter(p => !p.id.startsWith('NP')).length;
  const debut = o.scenario === 'municipales2026' ? semaineDe(2026, 4, 6) : semaineDe(2026, 9, 7);
  const e: Etat = {
    version: 3, graine: o.graine, rng: 0, scenario: o.scenario, semaine: debut, debut,
    joueur: { mode: o.mode, parti: d.idxParti[o.parti] ?? 0, perso: -1, tutoriel: o.tutoriel ? 0 : -1, debutPremierPlan: -1, trahisons: 0, pointsVictoire: {}, aQuitte: 0 },
    partis: d.partis.map((_, i) => partiInitial(d, i)), persos: [], prox: new Array(nZ * nP).fill(0), impl: new Array(nZ * nP).fill(0), mob: new Array(nZ * nP).fill(0), opinion: new Array(nS * nP).fill(0),
    chocs: [], eco: { croissance: 1.0, chomage: 7.6, inflation: 1.8 }, mairies: [], partsBassin: new Array(nZ * nP).fill(0), conseilsDept: [], conseilsReg: [], assemblee: [], senat: d.depts.map(() => []), europe: [],
    presidence: { perso: -1, parti: -1, popularite: 27, debut: semaineDe(2022, 5, 14), budget: 0, reformes: 0 }, gouvernement: { parti: -1, coalition: [], pm: -1 },
    calendrier: calendrierInitial(debut), candidatures: {}, investitures: {}, campagnesOuvertes: [], relPartis: [], accords: [], affaires: [], inbox: [], prochainMsg: 1, archives: [], sondages: [], soiree: null, debat: null,
    evActifs: [], evVus: {}, histIntentions: [], intentions: [], abstentionHist: [], journal: [], consignes: {}, desistements: {}, entreDeux: {}, politiqueAlliance: {}, options: { vitesse: 1 },
  };
  for (let z = 0; z < nZ; z++) for (let p = nReels; p < nP; p++) e.prox[z * nP + p] = -9;
  relationsInitiales(d, e);

  // --- Personnalités réelles ---
  const parRole: Record<string, Perso> = {};
  for (const x of d.personnalites) {
    const pi = d.idxParti[x.parti]; if (pi === undefined) continue; let dept = 0, zone: number | undefined;
    for (const r of x.roles) { const [k, v] = r.split(':'); if (k === 'depute' && d.idxCirco[v] !== undefined) dept = d.idxDept[d.circos[d.idxCirco[v]].dept]; if (k === 'senateur') dept = d.idxDept[v] ?? 0; if (k === 'maire') { const vi = d.idxVille[v]; if (vi !== undefined) { dept = d.villes[vi].deptIdx; zone = d.villes[vi].zones[0]; } } if (k === 'president_region' && d.idxRegion[v] !== undefined) dept = d.idxDept[d.regions[d.idxRegion[v]].depts[0]] ?? 0; }
    const p = creerPerso(e, d, rng, { parti: pi, dept, zone, rang: x.rang === 1 ? 4 : 3, sexe: x.sexe as 'M' | 'F', nom: x.nom, prenom: x.prenom, reel: true, naissance: x.naissance, roles: x.roles });
    if (x.attributs) for (const k of Object.keys(x.attributs)) { const i = (A as any)[k]; if (i !== undefined) p.attrs[i] = clamp(x.attributs[k], 1, 20); }
    for (const r of x.roles) parRole[r] = p;
    if (x.roles.includes('chef_parti')) { e.partis[pi].chef = p.id; p.postes.push('chef'); }
  }

  // --- Députés (résultats réels de 2024) ---
  const titulaires: Record<string, string> = {}; const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '');
  const affil: Record<string, string> = {}; for (const pid of Object.keys(d.affiliations)) for (const x of d.affiliations[pid]) { const [n, i] = x.split('|'); affil[norm(n) + (i ? '|' + i : '')] = pid; }
  const nomPropre = (s: string) => s.toLowerCase().replace(/(^|[\s'-])(\p{L})/gu, (_m, a, b) => a + b.toUpperCase()).replace(/\b(De|Du|Des|D|La|Le)\b(?=\s|')/g, x => x === 'Le' || x === 'La' ? x : x.toLowerCase());
  d.circos.forEach((c, ci) => {
    const perso = parRole[`depute:${c.id}`]; const el = c.elu; let parti = el ? partiDeNuance(d, el.nuance, c.id, c.dept) : 'DVC';
    if (el && ['UG', 'ENS', 'FI', 'SOC', 'ECO', 'COM', 'DVG', 'HOR', 'REG', 'DVC'].includes(el.nuance)) { const a = affil[norm(el.nom) + '|' + norm(el.prenom).charAt(0)] ?? affil[norm(el.nom)]; parti = a ?? (el.nuance === 'UG' ? 'PS' : el.nuance === 'ENS' ? 'RE' : parti); titulaires[`${ci}:${el.nuance}`] = parti; }
    if (perso) { parti = e.partis[perso.parti].id; if (el) titulaires[`${ci}:${el.nuance}`] = parti; donnerMandat(e, perso, 'depute', ci, true); e.assemblee.push({ perso: perso.id, parti: perso.parti }); return; }
    if (!el) { e.assemblee.push({ perso: -1, parti: d.idxParti[parti] }); return; }
    const zf = d.zonesParCirco[ci]; const zone = zf.length ? zf.slice().sort((a, b) => d.zones[b[0]].pop * b[1] - d.zones[a[0]].pop * a[1])[0][0] : 0;
    const p = creerPerso(e, d, rng, { parti: d.idxParti[parti], dept: d.idxDept[c.dept] ?? 0, zone, rang: 3, sexe: el.sexe as 'M' | 'F', nom: nomPropre(el.nom), prenom: el.prenom, reel: true, age: 38 + (hash(el.nom + el.prenom) % 28), roles: ['depute'] });
    p.notoriete = clamp(18 + Math.round(el.pct / 6) + rng.int(0, 8), 5, 60); donnerMandat(e, p, 'depute', ci, true); e.assemblee.push({ perso: p.id, parti: p.parti });
  });

  // --- Calibrage sur le premier tour des législatives 2024 ---
  const { T } = cibles(d, nP, (ci, nu) => titulaires[`${ci}:${nu}`] ?? partiDeNuance(d, nu, d.circos[ci].id, d.circos[ci].dept));
  calibrer(e, d, T, nReels);
  // Adhérents par département.
  for (const P of e.partis) { if (!P.actif) continue; const w = d.depts.map(() => 0); for (const z of d.zones) w[z.deptIdx] += z.inscrits * T[z.idx * nP + P.idx]; const s = w.reduce((a, b) => a + b, 0) || 1; P.adhDept = w.map(x => P.adherents * x / s); }

  // --- Mairies ---
  const poidsLocal = (zs: number[], p: number) => { let t = 0, w = 0; for (const z of zs) { t += d.zones[z].inscrits * T[z * nP + p]; w += d.zones[z].inscrits; } return (t / (w || 1)) ** 0.7 * (0.15 + e.partis[p].notabilite) ** 2; };
  const imposes: Record<string, number> = {}; for (const m of d.mairesImposes) if (d.idxParti[m.parti] !== undefined) imposes[m.zone] = d.idxParti[m.parti];
  for (const v of d.villes) {
    const reel = parRole[`maire:${v.id}`]; const w = e.partis.map(P => P.actif ? poidsLocal(v.zones, P.idx) : 0);
    let parti = reel ? reel.parti : imposes[v.id] ?? (v.plm === 2 && e.mairies[v.mere] && rng.chance(0.35) ? e.mairies[v.mere].parti : rng.pondere(w.map(x => x ** 1.6)));
    const voix = w.map((x, i) => i === parti ? Math.max(...w) * 1.6 : x); const s = primeMajoritaire(voix, v.sieges, v.prime);
    const maire = reel ?? creerPerso(e, d, rng, { parti, dept: v.deptIdx, zone: v.zones[0], rang: v.pop > 100000 ? 3 : 2, age: rng.int(40, 70) });
    donnerMandat(e, maire, 'maire', v.idx, true); if (!reel) maire.notoriete = clamp(Math.round(8 + Math.log10(v.pop) * 6 - 20 + rng.int(0, 6)), 3, 45);
    const m: Mairie = { ville: v.idx, maire: maire.id, parti, sieges: s, coalition: [parti], bilan: 50 + rng.int(-10, 12), budget: v.pop * 1350, dette: v.pop * 900, projets: [1, 1, 1, 1, 1, 1].map(x => x + rng.int(0, 1)), adjoints: [], opposition: 50, interco: 50, impots: 50 };
    e.mairies.push(m);
  }
  for (const z of d.zones) { if (z.type !== 1) continue; let s = 0; const w = e.partis.map(P => { const x = P.actif ? (T[z.idx * nP + P.idx] ** 0.8) * (0.12 + P.notabilite) ** 2.2 : 0; s += x; return x; }); for (let p = 0; p < nP; p++) e.partsBassin[z.idx * nP + p] = w[p] / (s || 1); }

  // --- Départements et régions ---
  d.depts.forEach((dep, di) => {
    const zs = d.zonesParDept[di]; const w = e.partis.map(P => P.actif && zs.length ? poidsLocal(zs, P.idx) ** 1.5 : 0); const parti = zs.length ? rng.pondere(w.map(x => x ** 1.5)) : 0; const n = Math.max(2, dep.cantons * 2);
    const sieges = primeMajoritaire(w.map((x, i) => i === parti ? Math.max(...w) * 1.2 : x), n, 0.3, 0.04); const c: Conseil = { lieu: di, president: -1, parti, sieges, coalition: [parti], bilan: 50 + rng.int(-8, 8), budget: dep.pop * 1100, projets: [1, 1, 1, 1, 1] };
    if (dep.cantons > 0 && dep.code !== '75') { const p = creerPerso(e, d, rng, { parti, dept: di, rang: 3, age: rng.int(45, 70) }); p.rang = 2; p.notoriete = clamp(p.notoriete - 25, 5, 40); c.president = p.id; donnerMandat(e, p, 'president_dept', di, true); } else c.parti = -1;
    e.conseilsDept.push(c);
  });
  d.regions.forEach((reg, ri) => {
    const zs = d.zones.filter(z => z.regIdx === ri).map(z => z.idx); const reel = parRole[`president_region:${reg.code}`]; const n = SIEGES_REGION[reg.code] ?? 0;
    const w = e.partis.map(P => P.actif && zs.length ? poidsLocal(zs, P.idx) : 0); const parti = reel ? reel.parti : n ? rng.pondere(w.map(x => x ** 2)) : -1;
    const c: Conseil = { lieu: ri, president: -1, parti, sieges: n ? primeMajoritaire(w.map((x, i) => i === parti ? Math.max(...w) * 1.3 : x), n, 0.25) : new Array(nP).fill(0), coalition: parti >= 0 ? [parti] : [], bilan: 50 + rng.int(-8, 8), budget: zs.reduce((s, z) => s + d.zones[z].pop, 0) * 520, projets: [1, 1, 1, 1, 1] };
    if (n) { const p = reel ?? creerPerso(e, d, rng, { parti, dept: d.idxDept[reg.depts[0]] ?? 0, rang: 3, age: rng.int(48, 68) }); c.president = p.id; donnerMandat(e, p, 'president_region', ri, true); }
    e.conseilsReg.push(c);
  });

  // --- Sénat (simulé à partir des élus locaux, puis personnalités réelles) et Parlement européen ---
  senatorialesTour(e, d, rng, null, { serie: 1 }, true); senatorialesTour(e, d, rng, null, { serie: 2 }, true);
  const zz = d.idxDept.ZZ; if (zz !== undefined) e.senat[zz] = [['LR', 4], ['PS', 3], ['RE', 2], ['ECO', 1], ['UDI', 1], ['DVC', 1]].flatMap(([p, n]) => Array.from({ length: n as number }, () => ({ perso: -1, parti: d.idxParti[p as string] })));
  for (const k of Object.keys(parRole)) { if (!k.startsWith('senateur:')) continue; const di = d.idxDept[k.split(':')[1]]; const p = parRole[k]; const l = e.senat[di]; if (!l || !l.length) continue; let i = l.findIndex(s => s.parti === p.parti && s.perso < 0); if (i < 0) i = l.length - 1; l[i] = { perso: p.id, parti: p.parti }; donnerMandat(e, p, 'senateur', di, true); }
  const EU: [string, number][] = [['RN', 30], ['RE', 8], ['MDM', 3], ['HOR', 2], ['PS', 10], ['PP', 3], ['LFI', 9], ['LR', 6], ['ECO', 5], ['DVD', 4], ['REC', 1]];
  const euReels = d.personnalites.filter(x => x.roles.includes('eurodepute'));
  for (const [id, n] of EU) { const pi = d.idxParti[id]; const reels = e.persos.filter(p => p.reel && p.parti === pi && euReels.some(x => x.nom === p.nom && x.prenom === p.prenom)); for (let k = 0; k < n; k++) { const p = reels[k]; if (p) donnerMandat(e, p, 'eurodepute', 0, true); e.europe.push({ perso: p ? p.id : -1, parti: pi }); } }

  // --- Exécutif national ---
  const pr = parRole.president_republique, pm = parRole.premier_ministre;
  if (pr) { donnerMandat(e, pr, 'president', 0, true); e.presidence.perso = pr.id; e.presidence.parti = pr.parti; pr.notoriete = 100; }
  const co = ['RE', 'MDM', 'HOR', 'LR', 'UDI'].map(x => d.idxParti[x]); e.gouvernement = { parti: d.idxParti.RE, coalition: co, pm: pm ? pm.id : -1 }; if (pm) donnerMandat(e, pm, 'premier_ministre', 0, true);

  // --- Cadres des partis : direction, délégués départementaux ---
  for (const P of e.partis) {
    if (!P.actif) continue; if (P.chef < 0) designerChef(e, d, rng, null, P);
    const dispo = e.persos.filter(p => p.parti === P.idx && p.rang >= 3 && p.id !== P.chef && !p.mandats.some(m => m.type === 'president' || m.type === 'premier_ministre'));
    const choisir = (attrs: number[]) => { let best: Perso | null = null, bs = -1; for (const p of dispo) { if (p.postes.length || p.reel) continue; const s = attrs.reduce((a, i) => a + p.attrs[i], 0) + p.notoriete * 0.05; if (s > bs) { bs = s; best = p; } } if (!best) best = creerPerso(e, d, rng, { parti: P.idx, dept: rng.pondere(P.adhDept), rang: 3 }); return best; };
    const R: [string, number[]][] = [['tresorier', [A.gestion, A.discipline]], ['porte_parole', [A.medias, A.eloquence, A.debat]], ['organisation', [A.organisation, A.terrain]], ['elections', [A.negociation, A.organisation]], ['projet', [A.dossiers, A.eloquence]], ['jeunes', [A.reseaux, A.energie]]];
    for (const [k, at] of R) { const p = choisir(at); P.bureau[k] = p.id; p.postes.push(k); }
    const ordre = P.adhDept.map((a, i) => [a, i]).sort((a, b) => b[0] - a[0]); const max = P.adherents >= 30000 ? 101 : P.adherents >= 10000 ? 60 : 25;
    for (const [a, di] of ordre.slice(0, max)) { if (a < 15) break; const loc = e.persos.find(p => p.parti === P.idx && p.dept === di && !p.reel && p.rang >= 2 && p.rang < 4 && !p.postes.length && !p.mandats.some(m => m.type === 'depute' || m.type === 'senateur')) ?? creerPerso(e, d, rng, { parti: P.idx, dept: di, rang: P.adherents >= 20000 ? 2 : 1 }); P.delegues[di] = loc.id; loc.postes.push('delegue'); }
    tisserRelations(e, rng, e.persos.filter(p => p.parti === P.idx && p.rang >= 2)); recalculerCourants(e, d, P);
    P.prochainCongres = debut + 30 + rng.int(0, 150);
    // Financement public issu des législatives 2024.
    let voix = 0; d.circos.forEach((c, ci) => { for (const z of d.zonesParCirco[ci]) voix += 0; void c; }); for (const z of d.zones) voix += z.inscrits * 0.65 * T[z.idx * nP + P.idx];
    P.voixLeg = voix; P.scoreIA.circos1 = voix > 250000 ? 400 : 20; P.scoreIA.candH = 50; P.scoreIA.candF = 48;
    let parl = 0; for (const s of e.assemblee) if (s.parti === P.idx) parl++; for (const l of e.senat) for (const s of l) if (s.parti === P.idx) parl++;
    P.financementPublic = financementPublic(P.voixLeg, P.scoreIA.circos1, parl, 50, 48).total;
  }

  // --- Joueur ---
  const Pj = e.partis[e.joueur.parti];
  if (o.mode === 'carriere' && o.perso) {
    const zi = d.idxZone[o.perso.zone] ?? 0; const z = d.zones[zi]; const p = creerPerso(e, d, rng, { parti: Pj.idx, dept: z.deptIdx, zone: zi, rang: 0, sexe: o.perso.sexe, nom: o.perso.nom, prenom: o.perso.prenom, age: clamp(o.perso.age, 18, 70) });
    let reste = POINTS_CREATION; for (let i = 0; i < NB_ATTRS; i++) { const plus = clamp(Math.round(o.perso.attrs[i] ?? 0), 0, Math.min(8, reste)); p.attrs[i] = 7 + plus; reste -= plus; }
    p.traits = o.perso.traits.filter(t => d.traitsParId[t]).slice(0, 2); p.formation = o.perso.etudes; p.profession = o.perso.origine; p.pot = 17; p.casserole = 0; p.fidelite = 12; p.notoriete = 2; p.axes = Pj.axes.slice(); p.moral = 70; p.forme = 95; p.rel = {};
    ajouterHist(e, p, `Adhère à ${Pj.sigle} à ${z.nom}`); e.joueur.perso = p.id;
    if (o.perso.depart === 'conseiller') { const v = d.villes.find(x => x.zones.includes(zi) && x.plm !== 1); if (v) { donnerMandat(e, p, 'conseiller_municipal', v.idx, true); p.rang = 1; ajouterHist(e, p, `Conseiller municipal d'opposition à ${v.nom}`); p.notoriete = 5; } }
  } else { e.joueur.perso = Pj.chef; e.joueur.debutPremierPlan = debut; }

  const c = preparer(e, d); e.intentions = intentions(e, d, c); for (const P of e.partis) { P.scoreIA.adh0 = P.adherents; P.scoreIA.int0 = Math.max(0.004, e.intentions[P.idx] ?? 0.01); }
  // L'usure du pouvoir déjà subie par la majorité sortante est contenue dans les résultats réels : elle sert de point de départ.
  { const pp = e.partis[e.presidence.parti]; if (pp) pp.scoreIA.usure = pp.scoreIA.usure0 = 0.35; for (const q of e.gouvernement.coalition) if (q !== e.presidence.parti) e.partis[q].scoreIA.usure = e.partis[q].scoreIA.usure0 = 0.1; } e.histIntentions.push({ s: e.semaine, v: e.intentions.map(x => Math.round(x * 1000) / 10) });
  e.rng = rng.s;
  message(e, null, 'actu', o.mode === 'parti' ? `Bienvenue : ${Pj.nom}` : 'Bienvenue : votre carrière commence', o.mode === 'parti' ? `Nous sommes le ${o.scenario === 'municipales2026' ? '6 avril 2026' : '7 septembre 2026'}. Votre parti : ${Pj.nom}. ${Math.round(Pj.adherents)} adhérents, ${Math.round(Pj.tresorerie / 1000)} k€ en caisse, ${e.assemblee.filter(s => s.parti === Pj.idx).length} députés, ${e.mairies.filter(m => m.parti === Pj.idx).length} mairies. Le bouton Continuer fait avancer le temps d'une semaine.` : `Vous êtes militant ${Pj.sigle}. Faites vos preuves sur le terrain, obtenez des responsabilités, puis une investiture. Le bouton Continuer fait avancer le temps d'une semaine.`, true);
  return e;
}
