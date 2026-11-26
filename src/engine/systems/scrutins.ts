// Scrutins : déroulement de chaque élection (premier tour, entre-deux-tours, second tour), installation des élus, explications.
import type { Donnees, Etat, Ctx, Candidature, Scrutin, Echeance, UniteT1, ResultatLigne, ResultatLieu, Conseil, Perso } from '../types';
import { A } from '../types';
import { Rng, clamp } from '../rng';
import { NOM_SCRUTIN, dateTexte, annee } from '../calendrier';
import { SIEGES_REGION } from '../donnees';
import { preparer, voter, reporter, FACTEUR_ABST, Cache, distancePartis } from './electorat';
import { formerListes, cloreCompte, politique } from './campagnes';
import { tourUninominal, tourDeListe, primeMajoritaire, europeennes as regleEuro, senatoriales as regleSenat, financementPublic } from './regles';
import { rel, bougerRel, parlementaires, cadres } from './partis';
import { creerPerso, donnerMandat, retirerMandat, nomComplet, ajouterHist, qualiteCandidat } from './personnages';
import { message, journal } from './inbox';

export interface DefUnite { uid: string; nom: string; zf: [number, number][]; sortant?: { parti: number; perso: number }; zoneLocale?: number; circo?: number; sieges?: number; prime?: number; poids?: number; bonusSortant?: number; lieu: number }
interface Opts { local: boolean; seuilSeul: number; echelle: number; facteur: number; national?: boolean }

export function forcesZones(e: Etat, d: Donnees, c: Cache): Float32Array {
  const act = e.partis.filter(p => p.actif).map(p => p.idx); const zs = d.zones.map(z => z.idx); const v = voter(e, d, c, zs, { partis: act, facteur: 0.8 }); const nP = e.partis.length; const F = new Float32Array(zs.length * nP);
  for (let i = 0; i < zs.length; i++) { let s = 0; for (let l = 0; l < act.length; l++) s += v.voix[i * act.length + l]; for (let l = 0; l < act.length; l++) F[i * nP + act[l]] = v.voix[i * act.length + l] / (s || 1); }
  return F;
}
function forcesUnite(d: Donnees, F: Float32Array, zf: [number, number][], nP: number): number[] { const r = new Array(nP).fill(0); let W = 0; for (const [z, f] of zf) { const w = d.zones[z].inscrits * f; W += w; for (let p = 0; p < nP; p++) r[p] += w * F[z * nP + p]; } for (let p = 0; p < nP; p++) r[p] /= W || 1; return r; }
const nomCand = (e: Etat, c: Candidature) => c.perso >= 0 ? nomComplet(e.persos[c.perso]) : `Candidat ${e.partis[c.parti].sigle}`;
const etiquette = (e: Etat, c: Candidature) => [c.parti, ...c.soutiens];

function voteUnite(e: Etat, d: Donnees, c: Cache, rng: Rng, u: DefUnite, cands: Candidature[], o: Opts) {
  const L = cands.length; const zs = u.zf.map(x => x[0]); const bonus = new Float32Array(zs.length * L);
  for (let l = 0; l < L; l++) { const cd = cands[l]; const b = cd.qualite * (o.national ? 1.7 : o.local ? 1 : 0.55) + (o.local ? (e.partis[cd.parti].notabilite - 0.4) * 1.5 : 0) + (cd.sortant ? (u.bonusSortant ?? 0) : 0); for (let i = 0; i < zs.length; i++) bonus[i * L + l] = b + (cd.perso >= 0 && e.persos[cd.perso].zone === zs[i] ? 0.12 : 0); }
  const v = voter(e, d, c, zs, { partis: cands.map(x => x.parti), soutiens: cands.map(x => x.soutiens), bonus, facteur: o.facteur, echelle: o.echelle });
  const voix = new Array(L).fill(0); let inscrits = 0, votants = 0;
  for (let i = 0; i < zs.length; i++) { const f = u.zf[i][1]; inscrits += v.inscrits[i] * f; votants += v.votants[i] * f; for (let l = 0; l < L; l++) voix[l] += v.voix[i * L + l] * f; }
  for (let l = 0; l < L; l++) voix[l] = Math.max(0, Math.round(voix[l] * Math.exp(rng.gauss() * 0.035)));
  return { voix, inscrits: Math.round(inscrits), votants: Math.round(votants), seg: v };
}
function lignes(e: Etat, cands: Candidature[], voix: number[], extra: (i: number) => Partial<ResultatLigne> = () => ({})): ResultatLigne[] { const tot = voix.reduce((a, b) => a + b, 0) || 1; return cands.map((c, i) => ({ nom: nomCand(e, c), partis: etiquette(e, c), perso: c.perso, voix: Math.round(voix[i]), pct: Math.round(1000 * voix[i] / tot) / 10, ...extra(i) })).sort((a, b) => b.voix - a.voix); }
function agregat(e: Etat, parParti: number[], sieges?: number[]): ResultatLigne[] { const tot = parParti.reduce((a, b) => a + b, 0) || 1; return e.partis.filter(p => parParti[p.idx] > 0 || (sieges && sieges[p.idx] > 0)).map(p => ({ nom: p.sigle, partis: [p.idx], perso: -1, voix: Math.round(parParti[p.idx]), pct: Math.round(1000 * parParti[p.idx] / tot) / 10, sieges: sieges ? sieges[p.idx] : undefined })).sort((a, b) => (sieges ? (b.sieges! - a.sieges!) : 0) || b.voix - a.voix); }
const estimation = (rng: Rng, l: ResultatLigne[]) => l.map(x => ({ ...x, pct: Math.max(0, Math.round((x.pct + rng.gauss() * 0.9) * 2) / 2) }));

// Consignes et barrages : explicites pour le joueur, déduits des relations pour l'IA.
function consigneDe(e: Etat, q: number, restants: number[]): number { const ex = e.consignes[q]; if (ex !== undefined && q === e.joueur.parti) return ex; let best = -1, br = 39; for (const r of restants) { const x = rel(e, q, r); if (x > br) { br = x; best = r; } } return best; }
function barrageDe(e: Etat, q: number, restants: number[]): number { if (q === e.joueur.parti && e.consignes[q] === -2) return -1; let pire = -1, pr = -54; for (const r of restants) { const x = rel(e, q, r); if (x < pr) { pr = x; pire = r; } } return pire; }

// ---------- Premier tour générique ----------
function tour1(e: Etat, d: Donnees, rng: Rng, c: Cache, F: Float32Array, type: Scrutin, unites: DefUnite[], mode: 'uni' | 'liste', o: Opts, s2: number) {
  const nP = e.partis.length; const ed: Record<string, UniteT1> = {}; const nat = new Array(nP).fill(0); let ins = 0, vot = 0; const lieux: ResultatLieu[] = [];
  const segI = new Float64Array(d.segments.length), segV = new Float64Array(d.segments.length); const candH = new Array(nP).fill(0), candF = new Array(nP).fill(0), circos1 = new Array(nP).fill(0);
  for (const u of unites) {
    const forces = forcesUnite(d, F, u.zf, nP);
    const cands = formerListes(e, d, { type, uid: u.uid, forces, local: o.local, seuilSeul: o.seuilSeul, sortant: u.sortant, circo: u.circo, zoneLocale: u.zoneLocale, national: o.national, semaine: e.semaine });
    if (!cands.length) continue;
    const r = voteUnite(e, d, c, rng, u, cands, o); const w = u.poids ?? 1; const tot = r.voix.reduce((a, b) => a + b, 0) || 1;
    for (let l = 0; l < cands.length; l++) { nat[cands[l].parti] += r.voix[l] * w; if (cands[l].sexe === 'F') candF[cands[l].parti]++; else candH[cands[l].parti]++; if (r.voix[l] / tot >= 0.01) circos1[cands[l].parti]++; }
    ins += r.inscrits * w; vot += r.votants * w; for (let s = 0; s < segI.length; s++) { segI[s] += r.seg.segInscrits[s]; segV[s] += r.seg.segVotants[s]; }
    let elu = -1, maintenus: number[] = []; const fusions: Record<number, number> = {};
    if (mode === 'uni') { const t = tourUninominal(r.voix, r.inscrits); elu = t.elu; maintenus = t.qualifies; }
    else { const t = tourDeListe(r.voix); elu = t.gagnant; maintenus = t.maintien; if (elu < 0) for (const f of t.fusion) { let best = -1, br = 19; for (const m of maintenus) { const x = rel(e, cands[f].parti, cands[m].parti); if (x > br) { br = x; best = m; } } if (best >= 0 && cands[f].parti !== e.joueur.parti) fusions[f] = best; } }
    // Désistements et fusions des partis IA entre les deux tours.
    if (elu < 0 && maintenus.length > 2) {
      const ordre = maintenus.slice().sort((a, b) => r.voix[b] - r.voix[a]);
      for (const x of ordre.slice(2)) { const px = cands[x].parti; if (px === e.joueur.parti) continue; const devant = ordre.filter(y => r.voix[y] > r.voix[x]);
        const ami = devant.filter(y => rel(e, px, cands[y].parti) >= (mode === 'uni' ? 30 : 45)).sort((a, b) => rel(e, px, cands[b].parti) - rel(e, px, cands[a].parti))[0];
        const ennemi = devant.find(y => rel(e, px, cands[y].parti) <= -55); const autre = devant.find(y => y !== ennemi && rel(e, px, cands[y].parti) > -30);
        if (ami !== undefined) { if (mode === 'liste') fusions[x] = ami; maintenus = maintenus.filter(y => y !== x); }
        else if (mode === 'uni' && ennemi !== undefined && autre !== undefined && e.partis[px].scoreIA.frontRepublicain > 0) maintenus = maintenus.filter(y => y !== x);
      }
    }
    ed[u.uid] = { cands, t1: r.voix, inscrits: r.inscrits, votants: r.votants, maintenus, fusions, elu, nom: u.nom };
    lieux.push({ lieu: u.nom, id: u.uid, inscrits: r.inscrits, votants: r.votants, lignes: lignes(e, cands, r.voix, i => ({ elu: i === elu, qualifie: maintenus.includes(i) })).slice(0, 5) });
  }
  e.entreDeux[type] = { s2, unites: ed };
  return { nat, ins, vot, lieux, segI, segV, candH, candF, circos1 };
}
// ---------- Second tour générique ----------
function tour2(e: Etat, d: Donnees, rng: Rng, type: Scrutin, mode: 'uni' | 'liste') {
  const ed = e.entreDeux[type]; const nP = e.partis.length; const res: Record<string, { voix: number[]; gagnant: number; votants: number }> = {}; const nat = new Array(nP).fill(0); let ins = 0, vot = 0; const lieux: ResultatLieu[] = [];
  if (!ed) return { res, nat, ins, vot, lieux };
  const des = e.desistements[type] ?? [];
  for (const uid of Object.keys(ed.unites)) {
    const u = ed.unites[uid]; if (u.elu >= 0) { res[uid] = { voix: u.t1, gagnant: u.elu, votants: u.votants }; continue; }
    let maint = u.maintenus.filter(i => !(des.includes(uid) && u.cands[i].parti === e.joueur.parti)); if (!maint.length) maint = u.maintenus.slice(0, 1);
    const t1 = u.t1.slice(); for (const k of Object.keys(u.fusions)) { const f = +k, t = u.fusions[f]; if (maint.includes(t)) { t1[t] += 0.88 * t1[f]; t1[f] = 0; if (!u.cands[t].soutiens.includes(u.cands[f].parti)) u.cands[t].soutiens.push(u.cands[f].parti, ...u.cands[f].soutiens); } }
    const partisL = u.cands.map(c => c.parti); const restP = maint.map(i => partisL[i]);
    const r = reporter(e, t1, partisL, maint, q => consigneDe(e, q, restP), q => barrageDe(e, q, restP));
    const bonus = ed.bonusDebat; const voix = r.voix.map((v, i) => maint.includes(i) ? Math.round(v * Math.exp(rng.gauss() * 0.03) * (bonus ? 1 + (bonus[i] ?? 0) : 1)) : 0);
    let g = maint[0]; for (const i of maint) if (voix[i] > voix[g]) g = i;
    const votants = Math.round(u.votants - r.abst * 0.9); res[uid] = { voix, gagnant: g, votants }; ins += u.inscrits; vot += votants;
    for (const i of maint) nat[partisL[i]] += voix[i];
    lieux.push({ lieu: u.nom, id: uid, inscrits: u.inscrits, votants, lignes: lignes(e, maint.map(i => u.cands[i]), maint.map(i => voix[i]), i => ({ elu: maint[i] === g })) });
  }
  return { res, nat, ins, vot, lieux };
}

function explication(e: Etat, d: Donnees, u: UniteT1, voix: number[], gagnant: number, segI?: Float64Array, segV?: Float64Array): string {
  const j = e.joueur.parti; const moi = u.cands.findIndex(c => c.parti === j || c.soutiens.includes(j)); if (moi < 0) return '';
  const nb = voix.filter(v => v > 0).length; const tot = voix.reduce((a, b) => a + b, 0) || 1; const f: string[] = [];
  f.push(nb >= 4 ? 'quadrangulaire' : nb === 3 ? 'triangulaire' : nb === 2 ? 'duel' : 'candidat unique');
  f.push(`participation de ${Math.round(100 * u.votants / (u.inscrits || 1))} %`);
  if (segI && segV) { let ji = 0, jv = 0, ti = 0, tv = 0; d.segments.forEach((s, i) => { if (s.etiquettes.includes('jeunes')) { ji += segI[i]; jv += segV[i]; } ti += segI[i]; tv += segV[i]; }); if (ji > 0 && jv / ji < tv / ti - 0.08) f.push('forte abstention des 18-34 ans'); }
  const c = u.cands[moi]; if (c.perso < 0) f.push('candidat peu connu'); else { const p = e.persos[c.perso]; if (p.attrs[A.ancrage] <= 8) f.push('candidat peu implanté'); else if (p.attrs[A.ancrage] >= 14) f.push('candidat bien implanté'); if (c.sortant) f.push('prime au sortant'); }
  const adv = u.cands[gagnant]; if (gagnant !== moi && adv?.sortant) f.push('sortant adverse solide');
  const dyn = e.partis[c.parti].dynamique; if (dyn > 12) f.push('dynamique nationale favorable'); else if (dyn < -12) f.push('dynamique nationale défavorable');
  if (gagnant !== moi && nb === 2 && voix[moi] / tot > 0.45) f.push('reports de voix insuffisants');
  return `${gagnant === moi ? 'Victoire' : 'Défaite'} dans ${u.nom} (${Math.round(1000 * voix[moi] / tot) / 10} %) : ${f.join(', ')}.`;
}
function bilanMoral(e: Etat, c: Candidature, gagne: boolean) { if (c.perso < 0) return; const p = e.persos[c.perso]; if (gagne) { p.victoires++; p.moral = clamp(p.moral + 18, 0, 100); } else { p.defaites++; p.moral = clamp(p.moral - 15, 0, 100); p.attrs[A.resistance] = clamp(p.attrs[A.resistance] + (p.defaites % 3 === 0 ? 1 : 0), 1, 20); } p.forme = clamp(p.forme - 15, 5, 100); }
function incarner(e: Etat, d: Donnees, rng: Rng, c: Candidature, zone: number, rang = 1): Perso { if (c.perso >= 0) return e.persos[c.perso]; const z = d.zones[zone]; const p = creerPerso(e, d, rng, { parti: c.parti, dept: z.deptIdx, zone, rang, sexe: c.sexe, age: rng.int(32, 62) }); c.perso = p.id; return p; }
function archiver(e: Etat, type: Scrutin, tour: number, national: ResultatLigne[], participation: number, resume: string, extra: Partial<Etat['archives'][0]> = {}) { e.archives.push({ s: e.semaine, type, tour, titre: `${NOM_SCRUTIN[type]} ${annee(e.semaine)}${tour ? `, ${tour === 1 ? 'premier' : 'second'} tour` : ''}`, national, participation, resume, ...extra }); e.abstentionHist.push({ s: e.semaine, type, v: Math.round(1000 * (1 - participation)) / 10 }); journal(e, `${NOM_SCRUTIN[type]} : ${resume}`); }
function couleursParDept(e: Etat, d: Donnees, lieux: ResultatLieu[], deptDe: (id: string) => string): Record<string, number> { const acc: Record<string, number[]> = {}; for (const l of lieux) { const k = deptDe(l.id); acc[k] ??= new Array(e.partis.length).fill(0); for (const x of l.lignes) acc[k][x.partis[0]] += x.voix; } const r: Record<string, number> = {}; for (const k of Object.keys(acc)) r[k] = acc[k].indexOf(Math.max(...acc[k])); return r; }
function reactions(e: Etat, rng: Rng, score: (p: number) => number): { perso: string; parti: number; texte: string }[] {
  const out: { perso: string; parti: number; texte: string }[] = []; const P = e.partis.filter(p => p.actif && p.chef >= 0).sort((a, b) => score(b.idx) - score(a.idx)).slice(0, 6);
  P.forEach((p, i) => { const bon = i < 2 || p.dynamique > 5; const T = bon ? ['Ce soir, les Français ont envoyé un message clair.', 'C\'est une victoire de la constance et du travail de terrain.', 'Rien n\'est fait, mais l\'espoir a changé de camp.'] : ['Nous avons entendu le message des électeurs.', 'Ce résultat nous oblige. Nous en tirerons toutes les leçons.', 'Le combat continue, dès demain.']; out.push({ perso: nomComplet(e.persos[p.chef]), parti: p.idx, texte: rng.pick(T) }); });
  return out;
}
function effetDynamique(e: Etat, avant: number[], apres: number[]) { for (const P of e.partis) { if (!P.actif) continue; const dv = (apres[P.idx] ?? 0) - (avant[P.idx] ?? 0); P.dynamique = clamp(P.dynamique + dv * 120, -50, 50); if (dv > 0.01) P.capital = clamp(P.capital + 6, 0, 100); } }

// ================= LÉGISLATIVES =================
function unitesLegislatives(e: Etat, d: Donnees): DefUnite[] { return d.circos.map((c, i) => { const zf = d.zonesParCirco[i]; const s = e.assemblee[i]; return { uid: c.id, nom: c.nomCourt, zf, sortant: s && s.parti >= 0 ? { parti: s.parti, perso: s.perso } : undefined, zoneLocale: zf.length ? zf.slice().sort((a, b) => d.zones[b[0]].pop * b[1] - d.zones[a[0]].pop * a[1])[0][0] : 0, circo: i, lieu: i, bonusSortant: -0.1 }; }).filter(u => u.zf.length); }
export function legislativesT1(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, ech: Echeance) {
  const c = preparer(e, d); const F = forcesZones(e, d, c); const us = unitesLegislatives(e, d);
  const r = tour1(e, d, rng, c, F, 'legislatives', us, 'uni', { local: false, seuilSeul: 0.02, echelle: 1, facteur: FACTEUR_ABST.legislatives }, ech.s2);
  // Financement public : voix du premier tour, parité des candidatures.
  for (const P of e.partis) { if (!P.actif) continue; P.voixLeg = r.circos1[P.idx] >= 50 ? r.nat[P.idx] : 0; P.scoreIA.candH = r.candH[P.idx]; P.scoreIA.candF = r.candF[P.idx]; P.scoreIA.circos1 = r.circos1[P.idx]; }
  const ed = e.entreDeux.legislatives; const elusT1 = Object.values(ed.unites).filter(u => u.elu >= 0).length; const national = agregat(e, r.nat); const part = r.vot / (r.ins || 1);
  const tri = Object.values(ed.unites).filter(u => u.elu < 0 && u.maintenus.length >= 3).length;
  archiver(e, 'legislatives', 1, national, part, `${national[0].nom} en tête avec ${national[0].pct} %, participation ${Math.round(part * 100)} %, ${elusT1} élus dès le premier tour, ${tri} triangulaires possibles`);
  e.soiree = { type: 'legislatives', tour: 1, s: e.semaine, estimation: estimation(rng, national), final: national, lieux: r.lieux, participation: part, reactions: reactions(e, rng, p => r.nat[p]), titre: `Législatives ${annee(e.semaine)}, premier tour`, explication: '', carte: { niveau: 'circo', couleurs: Object.fromEntries(r.lieux.map(l => [l.id, l.lignes[0].partis[0]])) } };
  const j = e.joueur.parti; const mes = Object.entries(ed.unites).filter(([, u]) => u.elu < 0 && u.maintenus.some(i => u.cands[i].parti === j));
  const troisiemes = mes.filter(([, u]) => { const o = u.maintenus.slice().sort((a, b) => u.t1[b] - u.t1[a]); return o.findIndex(i => u.cands[i].parti === j) >= 2; });
  message(e, ctx, 'campagne', 'Législatives : entre-deux-tours', `Vos candidats sont qualifiés dans ${mes.length} circonscriptions, dont ${troisiemes.length} en troisième position ou plus. Dans l'écran Campagne, vous pouvez décider des désistements et de la consigne de vote avant le second tour du ${dateTexte(ech.s2)}.`, true);
  ech.fait1 = true;
}
export function legislativesT2(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, ech: Echeance) {
  const ed = e.entreDeux.legislatives; if (!ed) { ech.fait2 = true; return; } const nP = e.partis.length; const avant = e.partis.map(p => e.assemblee.filter(s => s.parti === p.idx).length / 577);
  const r = tour2(e, d, rng, 'legislatives', 'uni'); const sieges = new Array(nP).fill(0); const j = e.joueur.parti; const expl: string[] = []; let serres: [number, string][] = [];
  d.circos.forEach((ci, i) => {
    const u = ed.unites[ci.id]; const rr = r.res[ci.id]; if (!u || !rr) { if (e.assemblee[i]?.parti >= 0) sieges[e.assemblee[i].parti]++; return; }
    const g = u.cands[rr.gagnant]; const zl = d.zonesParCirco[i].slice().sort((a, b) => d.zones[b[0]].pop * b[1] - d.zones[a[0]].pop * a[1])[0][0];
    const p = incarner(e, d, rng, g, zl); const ancien = e.assemblee[i];
    if (ancien && ancien.perso >= 0 && ancien.perso !== p.id) { const a = e.persos[ancien.perso]; retirerMandat(a, 'depute'); ajouterHist(e, a, `Perd son siège de député (${ci.nomCourt})`); }
    for (const m of p.mandats.filter(m => ['maire', 'president_dept', 'president_region', 'senateur', 'eurodepute'].includes(m.type))) laisserExecutif(e, d, rng, p, m.type, m.lieu);
    if (!p.mandats.some(m => m.type === 'depute' && m.lieu === i)) { donnerMandat(e, p, 'depute', i); ajouterHist(e, p, `Élu député (${ci.nomCourt})`); }
    e.assemblee[i] = { perso: p.id, parti: g.parti }; sieges[g.parti]++;
    u.cands.forEach((cd, k) => { if (u.t1[k] > 0) bilanMoral(e, cd, k === rr.gagnant); });
    const moi = u.cands.findIndex(cd => cd.parti === j); if (moi >= 0) { const tot = rr.voix.reduce((a, b) => a + b, 0) || 1; const ecart = Math.abs(rr.voix[moi] / tot - 0.5); const txt = explication(e, d, u, rr.voix, rr.gagnant); if (txt && (u.cands[moi].perso === e.joueur.perso || rr.voix[moi] > 0)) serres.push([u.cands[moi].perso === e.joueur.perso ? -1 : ecart, txt]); }
  });
  serres.sort((a, b) => a[0] - b[0]); for (const s of serres.slice(0, 6)) expl.push(s[1]);
  const part = r.vot / (r.ins || 1); const national = agregat(e, r.nat, sieges); const gv = formerGouvernement(e, d, sieges);
  const resume = `${national[0].nom} premier groupe avec ${national[0].sieges} sièges. ${gv}`;
  archiver(e, 'legislatives', 2, national, part || 0.6, resume, { sieges, explicationJoueur: expl.join('\n') });
  e.soiree = { type: 'legislatives', tour: 2, s: e.semaine, estimation: estimation(rng, national), final: national, lieux: r.lieux, participation: part, reactions: reactions(e, rng, p => sieges[p]), sieges, titre: `Législatives ${annee(e.semaine)}, second tour`, explication: expl.join('\n'), carte: { niveau: 'circo', couleurs: Object.fromEntries(d.circos.map((c, i) => [c.id, e.assemblee[i]?.parti ?? -1])) } };
  effetDynamique(e, avant, sieges.map(s => s / 577));
  for (const P of e.partis) { if (!P.actif) continue; const fp = financementPublic(P.voixLeg, P.scoreIA.circos1 ?? 0, parlementaires(e, P.idx), P.scoreIA.candH ?? 0, P.scoreIA.candF ?? 0); P.financementPublic = fp.total; P.pariteRetenue = fp.retenue; cloreCompte(e, d, rng, ctx, P, (r.nat[P.idx] || 0) / (r.nat.reduce((a, b) => a + b, 0) || 1) + 0.05); }
  const Pj = e.partis[j]; message(e, ctx, 'resultats', 'Législatives : résultats', `${resume}\nVotre parti : ${sieges[j]} sièges. Financement public annuel : ${Math.round(Pj.financementPublic / 1000)} k€${Pj.pariteRetenue > 0 ? ` (retenue pour non-respect de la parité : ${Math.round(Pj.pariteRetenue / 1000)} k€)` : ''}.\n${expl.join('\n')}`, true);
  delete e.entreDeux.legislatives; e.desistements.legislatives = []; ech.fait2 = true;
}
function laisserExecutif(e: Etat, d: Donnees, rng: Rng, p: Perso, type: string, lieu: number) {
  // Non-cumul : un parlementaire abandonne son exécutif local ou son autre mandat parlementaire, un remplaçant du même parti lui succède.
  retirerMandat(p, type as any, lieu); ajouterHist(e, p, `Quitte son mandat de ${type.replace('_', ' ')} (non-cumul)`);
  if (type === 'maire') { const m = e.mairies[lieu]; if (m && m.maire === p.id) { const s = creerPerso(e, d, rng, { parti: m.parti, dept: d.villes[lieu].deptIdx, zone: d.villes[lieu].zones[0], rang: 2 }); m.maire = s.id; donnerMandat(e, s, 'maire', lieu, true); } }
  if (type === 'president_dept') { const c = e.conseilsDept[lieu]; if (c && c.president === p.id) c.president = -1; }
  if (type === 'president_region') { const c = e.conseilsReg[lieu]; if (c && c.president === p.id) c.president = -1; }
  if (type === 'senateur') for (const l of e.senat) for (const s of l) if (s.perso === p.id) s.perso = -1;
  if (type === 'eurodepute') for (const s of e.europe) if (s.perso === p.id) s.perso = -1;
}
export function formerGouvernement(e: Etat, d: Donnees, sieges: number[]): string {
  const total = sieges.reduce((a, b) => a + b, 0) || 577; const maj = Math.floor(total / 2) + 1; const pres = e.presidence.parti;
  let pivot = pres >= 0 && sieges[pres] > 0 ? pres : sieges.indexOf(Math.max(...sieges)); const essais = [pivot, sieges.indexOf(Math.max(...sieges))]; let meilleur: number[] = [], ms = 0;
  for (const pv of essais) { const co = [pv]; let s = sieges[pv]; const cand = e.partis.filter(p => p.actif && p.idx !== pv && sieges[p.idx] > 0).sort((a, b) => rel(e, pv, b.idx) - rel(e, pv, a.idx)); for (const q of cand) { if (s >= maj) break; if (rel(e, pv, q.idx) >= 25 && co.every(x => rel(e, x, q.idx) >= 0)) { co.push(q.idx); s += sieges[q.idx]; } } if (s > ms) { ms = s; meilleur = co; } if (s >= maj) break; }
  const chef = meilleur[0]; e.gouvernement = { parti: chef, coalition: meilleur, pm: e.partis[chef].chef };
  const noms = meilleur.map(p => e.partis[p].sigle).join(', ');
  return ms >= maj ? `Majorité ${meilleur.length > 1 ? 'de coalition' : 'absolue'} (${noms}) avec ${ms} sièges.` : `Pas de majorité absolue. Gouvernement minoritaire (${noms}, ${ms} sièges).`;
}

// ================= MUNICIPALES =================
function unitesMunicipales(e: Etat, d: Donnees): DefUnite[] { return d.villes.map(v => { const m = e.mairies[v.idx]; return { uid: v.id, nom: v.nom, zf: v.zones.map(z => [z, 1] as [number, number]), sortant: m && m.parti >= 0 ? { parti: m.parti, perso: m.maire } : undefined, zoneLocale: v.zones[0], sieges: v.sieges, prime: v.prime, lieu: v.idx, bonusSortant: m ? 0.35 + (m.bilan - 50) / 45 : 0 }; }); }
export function municipalesT1(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, ech: Echeance) {
  const c = preparer(e, d); const F = forcesZones(e, d, c);
  const r = tour1(e, d, rng, c, F, 'municipales', unitesMunicipales(e, d), 'liste', { local: true, seuilSeul: 0.07, echelle: 0.75, facteur: FACTEUR_ABST.municipales }, ech.s2);
  // Petites communes (bassins) : répartition des mairies par sensibilité.
  const nP = e.partis.length; const act = e.partis.filter(p => p.actif).map(p => p.idx); const bz = d.zones.filter(z => z.type === 1).map(z => z.idx); const bonus = new Float32Array(bz.length * act.length);
  for (let i = 0; i < bz.length; i++) for (let l = 0; l < act.length; l++) bonus[i * act.length + l] = (e.partis[act[l]].notabilite - 0.4) * 2.6 + Math.log(0.02 + (e.partsBassin[bz[i] * nP + act[l]] ?? 0)) * 0.25;
  const v = voter(e, d, c, bz, { partis: act, bonus, facteur: FACTEUR_ABST.municipales, echelle: 0.6 });
  for (let i = 0; i < bz.length; i++) { let s = 0; for (let l = 0; l < act.length; l++) s += v.voix[i * act.length + l] ** 1.3; for (let p = 0; p < nP; p++) e.partsBassin[bz[i] * nP + p] = 0; for (let l = 0; l < act.length; l++) e.partsBassin[bz[i] * nP + act[l]] = v.voix[i * act.length + l] ** 1.3 / (s || 1); }
  const part = r.vot / (r.ins || 1); const ed = e.entreDeux.municipales; const des1 = Object.values(ed.unites).filter(u => u.elu >= 0).length; const national = agregat(e, r.nat);
  archiver(e, 'municipales', 1, national, part, `${des1} villes pourvues dès le premier tour sur ${Object.keys(ed.unites).length}, participation ${Math.round(part * 100)} %`);
  e.soiree = { type: 'municipales', tour: 1, s: e.semaine, estimation: estimation(rng, national), final: national, lieux: r.lieux.sort((a, b) => b.inscrits - a.inscrits).slice(0, 250), participation: part, reactions: reactions(e, rng, p => r.nat[p]), titre: `Municipales ${annee(e.semaine)}, premier tour`, explication: '', carte: { niveau: 'dept', couleurs: couleursParDept(e, d, r.lieux, id => d.villes[d.idxVille[id]].dept) } };
  const j = e.joueur.parti; const n = Object.values(ed.unites).filter(u => u.elu < 0 && u.cands.some((cd, i) => cd.parti === j && (u.maintenus.includes(i) || u.t1[i] / (u.t1.reduce((a, b) => a + b, 0) || 1) >= 0.05))).length;
  message(e, ctx, 'campagne', 'Municipales : entre-deux-tours', `Vos listes peuvent se maintenir ou fusionner dans ${n} villes. Décidez des fusions et des désistements dans l'écran Campagne avant le ${dateTexte(ech.s2)}.`, true); ech.fait1 = true;
}
export function municipalesT2(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, ech: Echeance) {
  const ed = e.entreDeux.municipales; if (!ed) { ech.fait2 = true; return; } const nP = e.partis.length; const j = e.joueur.parti; const avant = e.partis.map(p => e.mairies.filter(m => m.parti === p.idx).length / d.villes.length);
  const r = tour2(e, d, rng, 'municipales', 'liste'); const gagnees = new Array(nP).fill(0); const expl: string[] = []; let conq = 0, perdues = 0;
  for (const v of d.villes) {
    const u = ed.unites[v.id]; const rr = r.res[v.id]; if (!u || !rr) continue; const g = u.cands[rr.gagnant]; const m = e.mairies[v.idx];
    const s = primeMajoritaire(rr.voix, v.sieges, v.prime); const sieges = new Array(nP).fill(0); u.cands.forEach((cd, i) => { sieges[cd.parti] += s[i]; });
    const ancienParti = m.parti; const ancienMaire = m.maire; const p = incarner(e, d, rng, g, v.zones[0], v.pop > 100000 ? 3 : 2);
    if (ancienMaire >= 0 && ancienMaire !== p.id) { const a = e.persos[ancienMaire]; retirerMandat(a, 'maire', v.idx); ajouterHist(e, a, `Perd la mairie de ${v.nom}`); }
    if (p.mandats.some(x => ['depute', 'senateur', 'eurodepute'].includes(x.type))) { // non-cumul : le parlementaire élu maire laisse la mairie à son premier adjoint
      const adj = creerPerso(e, d, rng, { parti: g.parti, dept: v.deptIdx, zone: v.zones[0], rang: 2 }); m.maire = adj.id; donnerMandat(e, adj, 'maire', v.idx, true); ajouterHist(e, adj, `Élu maire de ${v.nom}`); if (!p.mandats.some(x => x.type === 'conseiller_municipal')) donnerMandat(e, p, 'conseiller_municipal', v.idx, true);
    } else { m.maire = p.id; if (!p.mandats.some(x => x.type === 'maire' && x.lieu === v.idx)) { donnerMandat(e, p, 'maire', v.idx, true); ajouterHist(e, p, `Élu maire de ${v.nom}`); } }
    m.parti = g.parti; m.sieges = sieges; m.coalition = [g.parti, ...g.soutiens]; if (ancienParti !== g.parti) { m.bilan = 50; m.projets = m.projets.map(x => Math.max(0, x - 1)); } m.opposition = 50;
    gagnees[g.parti]++; u.cands.forEach((cd, k) => { if (u.t1[k] > 0) bilanMoral(e, cd, k === rr.gagnant); });
    const moi = u.cands.findIndex(cd => cd.parti === j || cd.soutiens.includes(j));
    if (moi >= 0) { const gagne = rr.gagnant === moi; if (gagne && ancienParti !== j && g.parti === j) conq++; if (!gagne && ancienParti === j) perdues++; if ((v.pop > 80000 || u.cands[moi].perso === e.joueur.perso || (!gagne && ancienParti === j)) && expl.length < 8) expl.push(explication(e, d, u, rr.voix, rr.gagnant)); }
    // Conseiller municipal pour le personnage du joueur s'il était tête de liste battue.
    if (e.joueur.mode === 'carriere') { const cj = u.cands.findIndex(cd => cd.perso === e.joueur.perso); if (cj >= 0 && cj !== rr.gagnant && s[cj] > 0) donnerMandat(e, e.persos[e.joueur.perso], 'conseiller_municipal', v.idx); const im = e.investitures.municipales ?? {}; if (im[`liste:${j}`] === e.joueur.perso && im[`listeVille:${j}`] === v.idx && sieges[j] > 0 && !e.persos[e.joueur.perso].mandats.some(x => x.type === 'maire')) { donnerMandat(e, e.persos[e.joueur.perso], 'conseiller_municipal', v.idx); message(e, ctx, 'resultats', 'Vous entrez au conseil municipal', `La liste obtient ${sieges[j]} sièges à ${v.nom}. Vous êtes élu conseiller municipal${g.parti === j || g.soutiens.includes(j) ? ' de la majorité' : ' d\'opposition'}.`, true); } }
    const nI = d.zones[v.zones[0]]; void nI; for (const z of v.zones) e.impl[z * nP + g.parti] += 0.06;
  }
  const national = agregat(e, r.nat, gagnees); const part = (r.vot / (r.ins || 1)) || 0.55;
  const resume = `${national[0].nom} dirige ${national[0].sieges} villes de plus de 10 000 habitants, ${national[1]?.nom ?? ''} ${national[1]?.sieges ?? ''}`;
  archiver(e, 'municipales', 2, national, part, resume, { sieges: gagnees, explicationJoueur: expl.join('\n') });
  e.soiree = { type: 'municipales', tour: 2, s: e.semaine, estimation: estimation(rng, national), final: national, lieux: r.lieux.sort((a, b) => b.inscrits - a.inscrits).slice(0, 250), participation: part, reactions: reactions(e, rng, p => gagnees[p]), sieges: gagnees, titre: `Municipales ${annee(e.semaine)}, second tour`, explication: expl.join('\n'), carte: { niveau: 'dept', couleurs: couleursParDept(e, d, r.lieux, id => d.villes[d.idxVille[id]].dept) } };
  effetDynamique(e, avant, gagnees.map(x => x / d.villes.length)); for (const P of e.partis) if (P.actif) cloreCompte(e, d, rng, ctx, P, 0.08);
  message(e, ctx, 'resultats', 'Municipales : résultats', `${resume}.\nVotre parti dirige désormais ${gagnees[j]} villes (${conq} conquêtes, ${perdues} pertes).\n${expl.join('\n')}`, true);
  delete e.entreDeux.municipales; e.desistements.municipales = []; ech.fait2 = true;
}

// ================= DÉPARTEMENTALES =================
function unitesDepartementales(e: Etat, d: Donnees): DefUnite[] { return d.zones.filter(z => z.cantons > 0 && z.dept !== '75' && z.type !== 3).map(z => { const cs = e.conseilsDept[z.deptIdx]; return { uid: z.id, nom: z.nom, zf: [[z.idx, 1]] as [number, number][], zoneLocale: z.idx, poids: z.cantons, lieu: z.deptIdx, sortant: cs && cs.parti >= 0 ? { parti: cs.parti, perso: -1 } : undefined, bonusSortant: cs ? 0.1 + (cs.bilan - 50) / 80 : 0 }; }); }
export function departementalesT1(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, ech: Echeance) {
  const c = preparer(e, d); const F = forcesZones(e, d, c);
  const r = tour1(e, d, rng, c, F, 'departementales', unitesDepartementales(e, d), 'uni', { local: true, seuilSeul: 0.08, echelle: 0.8, facteur: FACTEUR_ABST.departementales }, ech.s2);
  const part = r.vot / (r.ins || 1); const national = agregat(e, r.nat); archiver(e, 'departementales', 1, national, part, `${national[0].nom} en tête avec ${national[0].pct} %, participation ${Math.round(part * 100)} %`);
  ech.fait1 = true;
}
function elirePresident(e: Etat, d: Donnees, rng: Rng, c: Conseil, type: 'president_dept' | 'president_region', dept: number, teteGagnante = -1): string {
  const total = c.sieges.reduce((a, b) => a + b, 0) || 1; const ordre = e.partis.map(p => p.idx).filter(p => c.sieges[p] > 0).sort((a, b) => c.sieges[b] - c.sieges[a]);
  let best: number[] = [ordre[0]], bs = c.sieges[ordre[0]];
  for (const pv of ordre.slice(0, 3)) { const co = [pv]; let s = c.sieges[pv]; for (const q of ordre) { if (q === pv || s > total / 2) continue; if (rel(e, pv, q) >= 30 && co.every(x => rel(e, x, q) >= 0)) { co.push(q); s += c.sieges[q]; } } if (s > bs || (s === bs && pv === ordre[0])) { bs = s; best = co; } if (s > total / 2) break; }
  const parti = best[0]; const ancien = c.president; c.coalition = best;
  if (ancien >= 0 && (e.persos[ancien].parti !== parti || e.persos[ancien].statut !== 'actif')) { retirerMandat(e.persos[ancien], type, c.lieu); ajouterHist(e, e.persos[ancien], `Perd la présidence ${type === 'president_dept' ? 'du département' : 'de la région'}`); c.president = -1; }
  if (c.parti !== parti) c.bilan = 50; c.parti = parti;
  if (teteGagnante >= 0 && e.persos[teteGagnante].parti === parti && !e.persos[teteGagnante].mandats.some(m => ['depute', 'senateur', 'eurodepute'].includes(m.type))) c.president = teteGagnante;
  if (c.president < 0) { const cs = e.persos.filter(p => p.parti === parti && p.statut === 'actif' && p.dept === dept && p.rang >= 2 && p.mandats.length === 0); const p = cs.length ? cs.sort((a, b) => b.notoriete - a.notoriete)[0] : creerPerso(e, d, rng, { parti, dept, rang: 2 }); c.president = p.id; }
  const p = e.persos[c.president]; if (!p.mandats.some(m => m.type === type && m.lieu === c.lieu)) { donnerMandat(e, p, type, c.lieu, true); ajouterHist(e, p, `Élu président ${type === 'president_dept' ? 'du conseil départemental' : 'du conseil régional'} (${type === 'president_dept' ? d.depts[c.lieu].nom : d.regions[c.lieu].nom})`); }
  return e.partis[parti].sigle;
}
export function departementalesT2(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, ech: Echeance) {
  const ed = e.entreDeux.departementales; if (!ed) { ech.fait2 = true; return; } const nP = e.partis.length; const r = tour2(e, d, rng, 'departementales', 'uni'); const j = e.joueur.parti;
  const sieges: number[][] = d.depts.map(() => new Array(nP).fill(0));
  for (const z of d.zones) { const u = ed.unites[z.id]; const rr = r.res[z.id]; if (!u || !rr) continue; const g = u.cands[rr.gagnant]; const tot = rr.voix.reduce((a, b) => a + b, 0) || 1; const ordre = rr.voix.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
    let n2 = 0; if (z.cantons >= 3 && ordre.length > 1 && ordre[1][0] > 0) n2 = Math.round(z.cantons * clamp(0.5 - (ordre[0][0] - ordre[1][0]) / tot * 2.2, 0, 0.45));
    sieges[z.deptIdx][g.parti] += 2 * (z.cantons - n2); if (n2 > 0) sieges[z.deptIdx][u.cands[ordre[1][1]].parti] += 2 * n2;
    if (e.joueur.mode === 'carriere') { const cj = u.cands.findIndex(cd => cd.perso === e.joueur.perso); if (cj >= 0) { bilanMoral(e, u.cands[cj], cj === rr.gagnant); if (cj === rr.gagnant) { donnerMandat(e, e.persos[e.joueur.perso], 'conseiller_dept', z.deptIdx); message(e, ctx, 'resultats', 'Vous êtes élu conseiller départemental', explication(e, d, u, rr.voix, rr.gagnant), true); } else message(e, ctx, 'resultats', 'Défaite aux départementales', explication(e, d, u, rr.voix, rr.gagnant), true); } }
  }
  const pres = new Array(nP).fill(0); const avant = e.partis.map(p => e.conseilsDept.filter(c => c.parti === p.idx).length / 100);
  for (const c of e.conseilsDept) { const s = sieges[c.lieu]; if (!s.some(x => x > 0)) { if (c.parti >= 0) pres[c.parti]++; continue; } c.sieges = s; elirePresident(e, d, rng, c, 'president_dept', c.lieu); pres[c.parti]++; }
  const national = agregat(e, r.nat, pres); const part = (r.vot / (r.ins || 1)) || 0.35; const resume = `${national[0].nom} préside ${national[0].sieges} départements, ${national[1]?.nom ?? ''} ${national[1]?.sieges ?? ''}`;
  archiver(e, 'departementales', 2, national, part, resume, { sieges: pres });
  e.soiree = { type: 'departementales', tour: 2, s: e.semaine, estimation: estimation(rng, national), final: national, lieux: [], participation: part, reactions: reactions(e, rng, p => pres[p]), sieges: pres, titre: `Départementales ${annee(e.semaine)}`, explication: '', carte: { niveau: 'dept', couleurs: Object.fromEntries(e.conseilsDept.map(c => [d.depts[c.lieu].code, c.parti])) } };
  effetDynamique(e, avant, pres.map(x => x / 100)); for (const P of e.partis) if (P.actif && P.campagne?.scrutin === 'departementales') cloreCompte(e, d, rng, ctx, P, 0.08);
  message(e, ctx, 'resultats', 'Départementales : résultats', `${resume}. Votre parti préside ${pres[j]} départements.`, true); delete e.entreDeux.departementales; ech.fait2 = true;
}

// ================= RÉGIONALES =================
function unitesRegionales(e: Etat, d: Donnees): DefUnite[] { return d.regions.map((r, i) => ({ r, i })).filter(x => SIEGES_REGION[x.r.code]).map(({ r, i }) => { const zs = d.zones.filter(z => z.regIdx === i && z.type !== 3); const c = e.conseilsReg[i]; return { uid: 'R' + r.code, nom: r.nom, zf: zs.map(z => [z.idx, 1] as [number, number]), sortant: c && c.parti >= 0 ? { parti: c.parti, perso: c.president } : undefined, sieges: SIEGES_REGION[r.code], prime: 0.25, lieu: i, bonusSortant: c ? 0.2 + (c.bilan - 50) / 60 : 0 }; }); }
export function regionalesT1(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, ech: Echeance) {
  const c = preparer(e, d); const F = forcesZones(e, d, c);
  const r = tour1(e, d, rng, c, F, 'regionales', unitesRegionales(e, d), 'liste', { local: true, seuilSeul: 0.05, echelle: 0.9, facteur: FACTEUR_ABST.regionales }, ech.s2);
  const part = r.vot / (r.ins || 1); const national = agregat(e, r.nat); archiver(e, 'regionales', 1, national, part, `${national[0].nom} en tête avec ${national[0].pct} %, participation ${Math.round(part * 100)} %`);
  e.soiree = { type: 'regionales', tour: 1, s: e.semaine, estimation: estimation(rng, national), final: national, lieux: r.lieux, participation: part, reactions: reactions(e, rng, p => r.nat[p]), titre: `Régionales et départementales ${annee(e.semaine)}, premier tour`, explication: '', carte: { niveau: 'region', couleurs: Object.fromEntries(r.lieux.map(l => [l.id.slice(1), l.lignes[0].partis[0]])) } };
  message(e, ctx, 'campagne', 'Régionales et départementales : entre-deux-tours', `Fusions de listes et désistements se décident dans l'écran Campagne avant le ${dateTexte(ech.s2)}.`, true); ech.fait1 = true;
}
export function regionalesT2(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, ech: Echeance) {
  const ed = e.entreDeux.regionales; if (!ed) { ech.fait2 = true; return; } const nP = e.partis.length; const r = tour2(e, d, rng, 'regionales', 'liste'); const j = e.joueur.parti; const pres = new Array(nP).fill(0); const expl: string[] = []; const avant = e.partis.map(p => e.conseilsReg.filter(c => c.parti === p.idx).length / 18);
  for (const c of e.conseilsReg) {
    const reg = d.regions[c.lieu]; const u = ed.unites['R' + reg.code]; const rr = r.res['R' + reg.code]; if (!u || !rr) { if (c.parti >= 0) pres[c.parti]++; continue; }
    const s = primeMajoritaire(rr.voix, SIEGES_REGION[reg.code], 0.25); const sieges = new Array(nP).fill(0); u.cands.forEach((cd, i) => { const part = [cd.parti, ...cd.soutiens]; sieges[cd.parti] += Math.ceil(s[i] * (part.length > 1 ? 0.6 : 1)); const reste = s[i] - Math.ceil(s[i] * (part.length > 1 ? 0.6 : 1)); cd.soutiens.forEach((q, k) => { sieges[q] += Math.floor(reste / cd.soutiens.length) + (k < reste % cd.soutiens.length ? 1 : 0); }); });
    c.sieges = sieges; const g = u.cands[rr.gagnant]; const zl = d.zones.find(z => z.regIdx === c.lieu)!; const tete = incarner(e, d, rng, g, zl.idx, 3);
    const co = [g.parti, ...g.soutiens]; const ancien = c.president; if (ancien >= 0 && ancien !== tete.id) { retirerMandat(e.persos[ancien], 'president_region', c.lieu); ajouterHist(e, e.persos[ancien], `Perd la présidence de la région ${reg.nom}`); }
    if (c.parti !== g.parti) c.bilan = 50; c.parti = g.parti; c.coalition = co;
    if (tete.mandats.some(m => ['depute', 'senateur', 'eurodepute'].includes(m.type))) { const rp = creerPerso(e, d, rng, { parti: g.parti, dept: zl.deptIdx, rang: 3 }); c.president = rp.id; donnerMandat(e, rp, 'president_region', c.lieu, true); } else { c.president = tete.id; if (!tete.mandats.some(m => m.type === 'president_region')) { donnerMandat(e, tete, 'president_region', c.lieu, true); ajouterHist(e, tete, `Élu président de la région ${reg.nom}`); } }
    pres[g.parti]++; u.cands.forEach((cd, k) => { if (u.t1[k] > 0) bilanMoral(e, cd, k === rr.gagnant); }); const x = explication(e, d, u, rr.voix, rr.gagnant); if (x) expl.push(x);
    if (e.joueur.mode === 'carriere' && e.persos[e.joueur.perso].dept !== undefined && d.depts[e.persos[e.joueur.perso].dept].region === reg.code && sieges[j] > 3 && e.persos[e.joueur.perso].rang >= 1 && e.investitures.regionales?.[`liste:${j}`] === e.joueur.perso) donnerMandat(e, e.persos[e.joueur.perso], 'conseiller_reg', c.lieu);
  }
  const national = agregat(e, r.nat, pres); const part = (r.vot / (r.ins || 1)) || 0.35; const resume = `${national[0].nom} préside ${national[0].sieges} régions, ${national[1]?.nom ?? ''} ${national[1]?.sieges ?? ''}`;
  archiver(e, 'regionales', 2, national, part, resume, { sieges: pres, explicationJoueur: expl.join('\n') });
  e.soiree = { type: 'regionales', tour: 2, s: e.semaine, estimation: estimation(rng, national), final: national, lieux: r.lieux, participation: part, reactions: reactions(e, rng, p => pres[p]), sieges: pres, titre: `Régionales ${annee(e.semaine)}, second tour`, explication: expl.join('\n'), carte: { niveau: 'region', couleurs: Object.fromEntries(e.conseilsReg.map(c => [d.regions[c.lieu].code, c.parti])) } };
  effetDynamique(e, avant, pres.map(x => x / 18)); for (const P of e.partis) if (P.actif) cloreCompte(e, d, rng, ctx, P, 0.08);
  message(e, ctx, 'resultats', 'Régionales : résultats', `${resume}. Votre parti préside ${pres[j]} régions.\n${expl.join('\n')}`, true); delete e.entreDeux.regionales; e.desistements.regionales = []; ech.fait2 = true;
}

// ================= EUROPÉENNES =================
export function europeennesTour(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, ech: Echeance) {
  const c = preparer(e, d); const F = forcesZones(e, d, c); const nP = e.partis.length; const zf = d.zones.map(z => [z.idx, 1] as [number, number]); const forces = forcesUnite(d, F, zf, nP);
  const u: DefUnite = { uid: 'EU', nom: 'France', zf, lieu: 0 }; const avant = e.partis.map(p => e.europe.filter(s => s.parti === p.idx).length / 81);
  const cands = formerListes(e, d, { type: 'europeennes', uid: 'EU', forces, local: false, seuilSeul: 0.012, national: true, semaine: e.semaine });
  for (const cd of cands) if (cd.perso < 0) { const P = e.partis[cd.parti]; const t = e.persos.filter(p => p.parti === cd.parti && p.statut === 'actif' && p.mandats.some(m => m.type === 'eurodepute')).sort((a, b) => b.notoriete - a.notoriete)[0] ?? (P.chef >= 0 ? e.persos[P.chef] : null); if (t) { cd.perso = t.id; cd.qualite = qualiteCandidat(d, t, true, true); } }
  const r = voteUnite(e, d, c, rng, u, cands, { local: false, seuilSeul: 0, echelle: 1, facteur: FACTEUR_ABST.europeennes, national: true }); const s = regleEuro(r.voix, 81);
  const sieges = new Array(nP).fill(0); const nat = new Array(nP).fill(0); const nouveaux: { perso: number; parti: number }[] = [];
  cands.forEach((cd, i) => { nat[cd.parti] += r.voix[i]; const membres = [cd.parti, ...cd.soutiens]; for (let k = 0; k < s[i]; k++) { const p = membres[k % membres.length === 0 ? 0 : (k % 3 === 2 ? 1 + (k % cd.soutiens.length || 0) : 0)] ?? cd.parti; sieges[p]++; } });
  for (const P of e.partis) { if (!sieges[P.idx]) continue; const anciens = e.europe.filter(x => x.parti === P.idx && x.perso >= 0 && e.persos[x.perso].statut === 'actif').map(x => x.perso); const tete = cands.find(cd => cd.parti === P.idx)?.perso ?? -1; const liste = [...new Set([tete, ...anciens].filter(x => x >= 0 && !e.persos[x].mandats.some(m => ['depute', 'senateur', 'maire', 'president_region', 'president_dept'].includes(m.type))))]; for (let k = 0; k < sieges[P.idx]; k++) { const id = liste[k] ?? -1; nouveaux.push({ perso: id, parti: P.idx }); if (id >= 0 && !e.persos[id].mandats.some(m => m.type === 'eurodepute')) donnerMandat(e, e.persos[id], 'eurodepute', 0); } }
  for (const x of e.europe) if (x.perso >= 0 && !nouveaux.some(n => n.perso === x.perso)) retirerMandat(e.persos[x.perso], 'eurodepute');
  e.europe = nouveaux; const part = r.votants / (r.inscrits || 1); const national = lignes(e, cands, r.voix, i => ({ sieges: s[i] }));
  const resume = `${national[0].nom} (${e.partis[national[0].partis[0]].sigle}) en tête avec ${national[0].pct} % et ${national[0].sieges} sièges, participation ${Math.round(part * 100)} %`;
  archiver(e, 'europeennes', 0, national, part, resume, { sieges });
  const cz = voter(e, d, c, d.zones.map(z => z.idx), { partis: cands.map(x => x.parti), soutiens: cands.map(x => x.soutiens), facteur: FACTEUR_ABST.europeennes }); const acc: Record<string, number[]> = {}; d.zones.forEach((z, i) => { acc[z.dept] ??= new Array(cands.length).fill(0); for (let l = 0; l < cands.length; l++) acc[z.dept][l] += cz.voix[i * cands.length + l]; });
  e.soiree = { type: 'europeennes', tour: 0, s: e.semaine, estimation: estimation(rng, national), final: national, lieux: [], participation: part, reactions: reactions(e, rng, p => nat[p]), sieges, titre: `Européennes ${annee(e.semaine)}`, explication: '', carte: { niveau: 'dept', couleurs: Object.fromEntries(Object.keys(acc).map(k => [k, cands[acc[k].indexOf(Math.max(...acc[k]))].parti])) } };
  effetDynamique(e, avant, sieges.map(x => x / 81)); const tot = r.voix.reduce((a, b) => a + b, 0) || 1; for (const P of e.partis) if (P.actif) cloreCompte(e, d, rng, ctx, P, nat[P.idx] / tot);
  const j = e.joueur.parti; message(e, ctx, 'resultats', 'Européennes : résultats', `${resume}. Votre parti : ${Math.round(1000 * nat[j] / tot) / 10} %, ${sieges[j]} sièges.${nat[j] / tot < 0.05 && nat[j] > 0 ? ' Sous le seuil de 5 %, aucune représentation.' : ''}`, true);
  ech.fait1 = ech.fait2 = true;
}

// ================= SÉNATORIALES =================
export function grandsElecteurs(e: Etat, d: Donnees, dept: number): number[] {
  const nP = e.partis.length; const G = new Array(nP).fill(0);
  for (const m of e.mairies) { const v = d.villes[m.ville]; if (v.deptIdx !== dept || v.plm === 2) continue; const k = v.pop > 30000 ? 1 + (v.pop - 30000) / 800 / (v.sieges || 1) : 0.6; for (let p = 0; p < nP; p++) G[p] += (m.sieges[p] ?? 0) * k; }
  for (const z of d.zonesParDept[dept]) { const Z = d.zones[z]; if (Z.type !== 1) continue; for (let p = 0; p < nP; p++) G[p] += Z.nbCommunes * 2.2 * (e.partsBassin[z * nP + p] ?? 0); }
  const cd = e.conseilsDept[dept]; if (cd) for (let p = 0; p < nP; p++) G[p] += cd.sieges[p] ?? 0;
  d.circos.forEach((c, i) => { if (d.idxDept[c.dept] === dept && e.assemblee[i]?.parti >= 0) G[e.assemblee[i].parti]++; });
  return G;
}
export function senatorialesTour(e: Etat, d: Donnees, rng: Rng, ctx: Ctx | null, ech: { serie?: number; fait1?: boolean; fait2?: boolean }, silencieux = false) {
  const nP = e.partis.length; const avant = e.partis.map(p => e.senat.reduce((s, l) => s + l.filter(x => x.parti === p.idx).length, 0) / 348); let renouveles = 0;
  d.depts.forEach((dep, di) => {
    if (dep.serie !== ech.serie || dep.senateurs <= 0) return; const G = grandsElecteurs(e, d, di); const tot = G.reduce((a, b) => a + b, 0); if (tot <= 0) return;
    // Les petites forces se rangent derrière la liste amie la plus forte.
    const ordre = e.partis.map(p => p.idx).sort((a, b) => G[b] - G[a]); const Gf = G.slice(); const seuil = dep.senateurs >= 3 ? 0.6 / dep.senateurs : 0.3;
    for (const p of ordre.slice().reverse()) { if (Gf[p] <= 0 || Gf[p] / tot >= seuil) continue; const ami = ordre.find(q => q !== p && Gf[q] / tot >= seuil * 0.7 && rel(e, p, q) >= 30); if (ami !== undefined) { Gf[ami] += Gf[p] * 0.85; Gf[p] = 0; } }
    if (dep.senateurs < 3) { const lead = ordre[0]; for (const q of ordre.slice(1)) if (Gf[q] > 0 && rel(e, q, lead) < 30) { const ami = ordre.find(x => x !== q && Gf[x] > 0 && rel(e, q, x) >= 30 && Gf[x] >= Gf[q]); if (ami !== undefined) { Gf[ami] += Gf[q] * 0.8; Gf[q] = 0; } } }
    for (let p = 0; p < nP; p++) Gf[p] *= Math.exp(rng.gauss() * 0.05);
    const s = regleSenat(Gf, dep.senateurs); const anciens = e.senat[di] ?? []; const nouveau: { perso: number; parti: number }[] = [];
    for (let p = 0; p < nP; p++) { const gardes = anciens.filter(x => x.parti === p && x.perso >= 0 && e.persos[x.perso].statut === 'actif'); for (let k = 0; k < s[p]; k++) { let id = gardes[k]?.perso ?? -1; if (id < 0 && (p === e.joueur.parti && !silencieux)) { const np = creerPerso(e, d, rng, { parti: p, dept: di, rang: 2, age: rng.int(48, 68) }); id = np.id; donnerMandat(e, np, 'senateur', di); } nouveau.push({ perso: id, parti: p }); } }
    for (const x of anciens) if (x.perso >= 0 && !nouveau.some(n => n.perso === x.perso)) retirerMandat(e.persos[x.perso], 'senateur');
    e.senat[di] = nouveau; renouveles += dep.senateurs;
  });
  const sieges = e.partis.map(p => e.senat.reduce((s, l) => s + l.filter(x => x.parti === p.idx).length, 0));
  if (!silencieux && ctx) { const national = agregat(e, sieges, sieges); const resume = `${renouveles} sièges renouvelés. ${national[0].nom} premier groupe au Sénat avec ${national[0].sieges} sièges`; archiver(e, 'senatoriales', 0, national, 0.99, resume, { sieges }); effetDynamique(e, avant.map(x => x * 0.3), sieges.map(x => x / 348 * 0.3)); message(e, ctx, 'resultats', 'Sénatoriales : résultats', `${resume}. Votre parti compte ${sieges[e.joueur.parti]} sénateurs. Le résultat dépend de vos élus municipaux, départementaux et régionaux.`, false); for (const P of e.partis) if (P.actif) P.financementPublic = financementPublic(P.voixLeg, P.scoreIA.circos1 ?? 0, parlementaires(e, P.idx), P.scoreIA.candH ?? 0, P.scoreIA.candF ?? 0).total; }
  ech.fait1 = ech.fait2 = true;
}

// ================= PRÉSIDENTIELLE =================
export function candidatsPresidentielle(e: Etat, d: Donnees): Candidature[] {
  return e.partis.filter(P => P.actif && P.candidatPres >= 0 && P.parrainages >= 500 && e.persos[P.candidatPres].statut === 'actif').map(P => ({ parti: P.idx, perso: P.candidatPres, soutiens: e.partis.filter(Q => Q.actif && Q.idx !== P.idx && (Q.candidatPres < 0 || Q.parrainages < 500) && e.consignes[Q.idx] === P.idx).map(Q => Q.idx), qualite: qualiteCandidat(d, e.persos[P.candidatPres], true, true), sortant: e.presidence.perso === P.candidatPres, sexe: e.persos[P.candidatPres].sexe }));
}
export function presidentielleT1(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, ech: Echeance) {
  const c = preparer(e, d); const cands = candidatsPresidentielle(e, d); if (cands.length < 2) { ech.fait1 = ech.fait2 = true; return; }
  const zf = d.zones.map(z => [z.idx, 1] as [number, number]); const u: DefUnite = { uid: 'PR', nom: 'France', zf, lieu: 0, bonusSortant: (e.presidence.popularite - 45) / 60 };
  const r = voteUnite(e, d, c, rng, u, cands, { local: false, seuilSeul: 0, echelle: 1, facteur: FACTEUR_ABST.presidentielle, national: true });
  const ordre = r.voix.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).map(x => x[1]); const tot = r.voix.reduce((a, b) => a + b, 0) || 1;
  e.entreDeux.presidentielle = { s2: ech.s2, unites: { PR: { cands, t1: r.voix, inscrits: r.inscrits, votants: r.votants, maintenus: ordre.slice(0, 2), fusions: {}, elu: -1, nom: 'France' } } };
  const national = lignes(e, cands, r.voix, i => ({ qualifie: ordre.indexOf(i) < 2 })); const part = r.votants / (r.inscrits || 1);
  const a = cands[ordre[0]], b = cands[ordre[1]]; const resume = `${nomCand(e, a)} (${national[0].pct} %) et ${nomCand(e, b)} (${national[1].pct} %) qualifiés pour le second tour, participation ${Math.round(part * 100)} %`;
  archiver(e, 'presidentielle', 1, national, part, resume);
  const cz = voter(e, d, c, d.zones.map(z => z.idx), { partis: cands.map(x => x.parti), soutiens: cands.map(x => x.soutiens), facteur: FACTEUR_ABST.presidentielle }); const acc: Record<string, number[]> = {}; d.zones.forEach((z, i) => { acc[z.dept] ??= new Array(cands.length).fill(0); for (let l = 0; l < cands.length; l++) acc[z.dept][l] += cz.voix[i * cands.length + l] * Math.exp(cands[l].qualite * 1.7); });
  e.soiree = { type: 'presidentielle', tour: 1, s: e.semaine, estimation: estimation(rng, national), final: national, lieux: Object.keys(acc).map(k => ({ lieu: d.depts[d.idxDept[k]]?.nom ?? k, id: k, inscrits: 0, votants: 0, lignes: lignes(e, cands, acc[k]).slice(0, 3) })), participation: part, reactions: reactions(e, rng, p => r.voix[cands.findIndex(x => x.parti === p)] ?? 0), titre: `Présidentielle ${annee(e.semaine)}, premier tour`, explication: '', carte: { niveau: 'dept', couleurs: Object.fromEntries(Object.keys(acc).map(k => [k, cands[acc[k].indexOf(Math.max(...acc[k]))].parti])) } };
  cands.forEach((cd, i) => { const p = e.persos[cd.perso]; ajouterHist(e, p, `Obtient ${Math.round(1000 * r.voix[i] / tot) / 10} % au premier tour de la présidentielle`); p.notoriete = clamp(p.notoriete + 6, 0, 100); if (ordre.indexOf(i) >= 2) { bilanMoral(e, cd, false); cloreCompte(e, d, rng, ctx, e.partis[cd.parti], r.voix[i] / tot); } });
  const j = e.joueur.parti; const enLice = [a.parti, b.parti].includes(j);
  message(e, ctx, 'resultats', 'Présidentielle : premier tour', `${resume}.${enLice ? ' Votre candidat est au second tour. Le grand débat de l\'entre-deux-tours vous attend dans l\'écran Médias.' : ' Vous pouvez donner une consigne de vote dans l\'écran Campagne.'}`, true);
  ech.fait1 = true;
}
export function presidentielleT2(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, ech: Echeance) {
  const ed = e.entreDeux.presidentielle; if (!ed) { ech.fait2 = true; return; } const u = ed.unites.PR; const r = tour2(e, d, rng, 'presidentielle', 'uni'); const rr = r.res.PR; const g = u.cands[rr.gagnant]; const perdant = u.cands[u.maintenus.find(i => i !== rr.gagnant)!];
  const national = lignes(e, u.maintenus.map(i => u.cands[i]), u.maintenus.map(i => rr.voix[i]), i => ({ elu: u.maintenus[i] === rr.gagnant })); const part = rr.votants / (u.inscrits || 1); const p = e.persos[g.perso];
  const ancien = e.presidence.perso; if (ancien >= 0 && ancien !== p.id) { retirerMandat(e.persos[ancien], 'president'); ajouterHist(e, e.persos[ancien], 'Quitte l\'Élysée'); }
  for (const m of p.mandats.slice()) if (m.type !== 'president') laisserExecutif(e, d, rng, p, m.type, m.lieu); for (let i = 0; i < e.assemblee.length; i++) if (e.assemblee[i].perso === p.id) e.assemblee[i] = { perso: -1, parti: e.assemblee[i].parti };
  if (!p.mandats.some(m => m.type === 'president')) donnerMandat(e, p, 'president', 0, true); ajouterHist(e, p, `Élu président de la République avec ${national[0].pct} % des voix`); p.notoriete = 100; p.rang = 4;
  e.presidence = { perso: p.id, parti: g.parti, popularite: 55, debut: e.semaine, budget: 0, reformes: 0 }; bilanMoral(e, g, true); if (perdant) bilanMoral(e, perdant, false);
  const P = e.partis[g.parti]; P.dynamique = clamp(P.dynamique + 25, -50, 50); P.capital = clamp(P.capital + 30, 0, 100); if (perdant) e.partis[perdant.parti].dynamique -= 5;
  const resume = `${nomComplet(p)} (${P.sigle}) est élu président de la République avec ${national[0].pct} % des voix`;
  archiver(e, 'presidentielle', 2, national, part, resume);
  e.soiree = { type: 'presidentielle', tour: 2, s: e.semaine, estimation: estimation(rng, national), final: national, lieux: [], participation: part, reactions: reactions(e, rng, q => q === g.parti ? 2 : q === perdant?.parti ? 1 : 0), titre: `Présidentielle ${annee(e.semaine)}, second tour`, explication: explication(e, d, u, rr.voix, rr.gagnant), carte: { niveau: 'dept', couleurs: {} } };
  for (const cd of [g, perdant]) if (cd) cloreCompte(e, d, rng, ctx, e.partis[cd.parti], 0.3);
  message(e, ctx, 'resultats', 'Présidentielle : second tour', `${resume}. Participation : ${Math.round(part * 100)} %.\n${explication(e, d, u, rr.voix, rr.gagnant)}`, true);
  delete e.entreDeux.presidentielle; for (const k of Object.keys(e.consignes)) delete e.consignes[+k]; ech.fait2 = true;
  if (g.parti === e.joueur.parti && (e.joueur.mode === 'parti' || g.perso === e.joueur.perso)) { e.joueur.pointsVictoire.elysee = (e.joueur.pointsVictoire.elysee ?? 0) + 1; message(e, ctx, 'victoire', 'Victoire : l\'Élysée', `${nomComplet(p)} entre à l'Élysée. C'est une victoire historique. Vous pouvez continuer la partie en mode Président : popularité, réformes sous forme de décisions, législatives à suivre.`, true, { action: { type: 'victoire', data: { type: 'elysee' } } }); }
}

export function tourScrutins(e: Etat, d: Donnees, rng: Rng, ctx: Ctx) {
  for (const ech of e.calendrier) {
    if (e.semaine === ech.s1 && !ech.fait1) { switch (ech.type) { case 'legislatives': legislativesT1(e, d, rng, ctx, ech); break; case 'municipales': municipalesT1(e, d, rng, ctx, ech); break; case 'departementales': departementalesT1(e, d, rng, ctx, ech); break; case 'regionales': regionalesT1(e, d, rng, ctx, ech); break; case 'europeennes': europeennesTour(e, d, rng, ctx, ech); break; case 'senatoriales': senatorialesTour(e, d, rng, ctx, ech); break; case 'presidentielle': presidentielleT1(e, d, rng, ctx, ech); break; } }
    else if (ech.s2 > 0 && e.semaine === ech.s2 && !ech.fait2) { switch (ech.type) { case 'legislatives': legislativesT2(e, d, rng, ctx, ech); break; case 'municipales': municipalesT2(e, d, rng, ctx, ech); break; case 'departementales': departementalesT2(e, d, rng, ctx, ech); break; case 'regionales': regionalesT2(e, d, rng, ctx, ech); break; case 'presidentielle': presidentielleT2(e, d, rng, ctx, ech); break; } }
  }
  void politique; void bougerRel; void cadres; void distancePartis;
}
