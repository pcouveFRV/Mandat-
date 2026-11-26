// Électorat : calcul du vote par zone et par segment, reports de second tour, calibrage. Formules décrites dans docs/MOTEUR.md.
import type { Donnees, Etat } from '../types';
import { NB_AXES, NB_THEMES } from '../types';
import { hash, clamp } from '../rng';

export const LAMBDA = 0.11;      // poids de la distance doctrinale
export const TAU_ALLIANCE = 0.85; // part des électeurs d'un allié qui suivent le candidat commun
export const FACTEUR_ABST: Record<string, number> = { presidentielle: 0.6, legislatives: 0.8, municipales: 1.05, europeennes: 1.18, departementales: 1.55, regionales: 1.55, sondage: 0.8 };

export interface Cache { D: Float32Array; nat: Float32Array; prop: Float32Array; nS: number; nP: number; nR: number }

// Priorités effectives d'un segment dans une région : priorités de base + chocs d'actualité (nationaux et régionaux).
export function priorites(e: Etat, d: Donnees, seg: number, region: number): number[] {
  const p = d.segments[seg].priorites.slice();
  for (const c of e.chocs) { if (c.region >= 0 && c.region !== region) continue; const reste = clamp((c.fin - e.semaine) / Math.max(1, c.fin - c.debut), 0, 1); p[c.theme] += c.val * reste * (0.5 + d.segments[seg].volatilite); }
  return p;
}
export function preparer(e: Etat, d: Donnees): Cache {
  const nS = d.segments.length, nP = e.partis.length, nR = d.regions.length;
  const D = new Float32Array(nR * nS * nP); const W = new Float32Array(NB_AXES);
  const regionsAvecChoc = new Set(e.chocs.filter(c => c.region >= 0).map(c => c.region));
  let base: Float32Array | null = null;
  for (let r = 0; r < nR; r++) {
    if (!regionsAvecChoc.has(r) && base) { D.set(base, r * nS * nP); continue; }
    for (let s = 0; s < nS; s++) {
      const pr = priorites(e, d, s, r); W.fill(0); let tot = 0;
      for (let t = 0; t < NB_THEMES; t++) { const ax = d.themes[t].axes; for (let a = 0; a < NB_AXES; a++) { W[a] += pr[t] * ax[a]; } }
      for (let a = 0; a < NB_AXES; a++) { W[a] += 0.6; tot += W[a]; }
      const sa = d.segments[s].axes;
      for (let p = 0; p < nP; p++) { const pa = e.partis[p].axes; let dist = 0; for (let a = 0; a < NB_AXES; a++) { const x = sa[a] - pa[a]; dist += W[a] * x * x; } D[(r * nS + s) * nP + p] = dist / tot; }
    }
    if (!regionsAvecChoc.has(r) && !base) base = D.slice(r * nS * nP, (r + 1) * nS * nP);
  }
  const nat = new Float32Array(nP);
  for (let p = 0; p < nP; p++) { const P = e.partis[p]; nat[p] = 0.012 * (P.notoriete - P.notoriete0) + 0.015 * (P.credibilite - P.credibilite0) + 0.01 * P.dynamique - ((P.scoreIA.usure ?? 0) - (P.scoreIA.usure0 ?? 0)); }
  // Effet durable des propositions phares : elles attirent ou repoussent des segments selon leurs étiquettes et le poids du thème.
  const prop = new Float32Array(nS * nP); const propParId: Record<string, any> = (preparer as any)._idx ?? ((preparer as any)._idx = Object.fromEntries(d.propositions.map(x => [x.id, x]))); const idxTheme: Record<string, number> = (preparer as any)._th ?? ((preparer as any)._th = Object.fromEntries(d.themes.map((t, i) => [t.id, i])));
  for (let p = 0; p < nP; p++) for (const id of e.partis[p].propositions) { const pr = propParId[id]; if (!pr) continue; const th = idxTheme[pr.theme] ?? 0; for (let s = 0; s < nS; s++) { const sg = d.segments[s]; const k = 0.03 + 0.012 * sg.priorites[th]; let v = 0; for (const t of pr.attire) if (sg.etiquettes.includes(t)) v += k; for (const t of pr.repousse) if (sg.etiquettes.includes(t)) v -= k * 0.8; prop[s * nP + p] += v; } }
  for (let i = 0; i < prop.length; i++) prop[i] = Math.max(-0.5, Math.min(0.6, prop[i]));
  return { D, nat, prop, nS, nP, nR };
}

export interface Offre { partis: number[]; soutiens?: number[][]; bonus?: Float32Array; facteur: number; echelle?: number; tau?: number }
export interface Vote { voix: Float64Array; inscrits: Float64Array; votants: Float64Array; segInscrits: Float64Array; segVotants: Float64Array }

// Calcule les voix de chaque liste dans chaque zone. voix[i * L + l] pour la i-ème zone demandée.
export function voter(e: Etat, d: Donnees, c: Cache, zones: number[], o: Offre): Vote {
  const L = o.partis.length, nS = c.nS, nP = c.nP; const ech = o.echelle ?? 1; const tau = o.tau ?? TAU_ALLIANCE;
  const voix = new Float64Array(zones.length * L), inscrits = new Float64Array(zones.length), votants = new Float64Array(zones.length);
  const segInscrits = new Float64Array(nS), segVotants = new Float64Array(nS);
  const ex = new Float64Array(L); const uz = new Float64Array(nP);
  for (let i = 0; i < zones.length; i++) {
    const zi = zones[i]; const z = d.zones[zi]; const zb = zi * nP; const rb = z.regIdx * nS * nP;
    let intens = 0; for (let p = 0; p < nP; p++) { uz[p] = e.prox[zb + p] + e.impl[zb + p] + c.nat[p]; const m = e.mob[zb + p]; if (m > 0) intens += m; }
    intens = Math.min(1, intens * 0.25);
    inscrits[i] = z.inscrits;
    for (let s = 0; s < nS; s++) {
      const w = d.socio[zi * nS + s]; if (w === 0) continue; const seg = d.segments[s];
      const abst = clamp(seg.abstention * o.facteur * (1 - 0.3 * intens), 0.04, 0.92);
      const n = z.inscrits * w / 1000; const v = n * (1 - abst);
      segInscrits[s] += n; segVotants[s] += v; votants[i] += v;
      let tot = 0; const db = rb + s * nP; const ob = s * nP;
      for (let l = 0; l < L; l++) {
        const p = o.partis[l];
        let x = Math.exp(ech * (uz[p] - LAMBDA * c.D[db + p]) + e.opinion[ob + p] + c.prop[ob + p] + e.mob[zb + p] * seg.volatilite + (o.bonus ? o.bonus[i * L + l] : 0));
        const al = o.soutiens?.[l]; if (al) for (const q of al) x += tau * Math.exp(ech * (uz[q] - LAMBDA * c.D[db + q]) + e.opinion[ob + q] + c.prop[ob + q] + e.mob[zb + q] * seg.volatilite);
        ex[l] = x; tot += x;
      }
      if (tot > 0) { const k = v * 0.975 / tot; for (let l = 0; l < L; l++) voix[i * L + l] += ex[l] * k; } // 2,5 % de blancs et nuls
    }
  }
  return { voix, inscrits, votants, segInscrits, segVotants };
}

// Intentions de vote nationales (tous les partis actifs seuls), en parts de 0 à 1.
export function intentions(e: Etat, d: Donnees, c: Cache, zones?: number[]): number[] {
  const actifs = e.partis.filter(p => p.actif).map(p => p.idx); const zs = zones ?? d.zones.map(z => z.idx);
  const v = voter(e, d, c, zs, { partis: actifs, facteur: FACTEUR_ABST.sondage });
  const tot = new Float64Array(e.partis.length); let T = 0; const L = actifs.length;
  for (let i = 0; i < zs.length; i++) for (let l = 0; l < L; l++) { tot[actifs[l]] += v.voix[i * L + l]; T += v.voix[i * L + l]; }
  return Array.from(tot, x => T > 0 ? x / T : 0);
}

// Distance doctrinale entre deux partis (0 à 100).
export function distancePartis(e: Etat, a: number, b: number): number { let s = 0; const A = e.partis[a].axes, B = e.partis[b].axes; for (let i = 0; i < NB_AXES; i++) s += (A[i] - B[i]) ** 2; return s / NB_AXES; }

// Reports de voix au second tour, à l'échelle d'une unité (circonscription, ville, pays).
// t1 : voix par liste au premier tour. restants : index des listes maintenues. partisListe : parti de chaque liste.
// consigne[q] : parti soutenu par q (-1 aucune, -2 "ni l'un ni l'autre"). barrage[q] : parti contre lequel q appelle à voter (-1 aucun).
export function reporter(e: Etat, t1: number[], partisListe: number[], restants: number[], consigne: (q: number) => number, barrage: (q: number) => number, sursaut = 0): { voix: number[]; abst: number } {
  const voix = t1.map(() => 0); let abst = 0; const tot = t1.reduce((a, b) => a + b, 0) || 1;
  for (const r of restants) voix[r] = t1[r] * 0.97;
  for (let q = 0; q < t1.length; q++) {
    if (restants.includes(q) || t1[q] <= 0) continue;
    const pq = partisListe[q]; const w: number[] = []; let dmin = 1e9, sw = 0;
    for (const r of restants) {
      const pr = partisListe[r]; const dist = distancePartis(e, pq, pr); if (dist < dmin) dmin = dist;
      let u = -dist / 6 + 0.5 * Math.log(Math.max(1e-6, t1[r] / tot)) + e.relPartis[pq * e.partis.length + pr] / 60;
      const cs = consigne(pq); if (cs === pr) u += 1.2; const br = barrage(pq); if (br >= 0 && br !== pr) u += 0.7; if (br === pr) u -= 0.8;
      const x = Math.exp(u); w.push(x); sw += x;
    }
    const a = Math.exp(-1.2 + dmin / 9 + (consigne(pq) === -2 ? 0.8 : 0)); // abstention des électeurs sans candidat proche
    for (let k = 0; k < restants.length; k++) voix[restants[k]] += t1[q] * w[k] / (sw + a);
    abst += t1[q] * a / (sw + a);
  }
  if (sursaut) for (const r of restants) voix[r] *= 1 + sursaut * 0.5;
  return { voix, abst };
}

// ---------- Calibrage ----------
const TILT: Record<string, number[]> = { LFI: [1.45, 0.9, 0.6], ECO: [1.5, 0.9, 0.7], PP: [1.4, 0.95, 0.7], PS: [1.0, 1.0, 1.0], PCF: [1.1, 1.0, 0.9], RN: [0.65, 1.05, 1.25], UDR: [0.8, 1.05, 1.15], RE: [1.15, 1.0, 0.9], HOR: [1.05, 1.0, 0.95], LR: [0.9, 1.0, 1.1], DVD: [0.85, 1.0, 1.15], DVG: [0.9, 1.0, 1.1], LO: [0.9, 1.0, 1.1], REC: [1.05, 1.0, 0.95] };
const AFF_UG: Record<string, string[]> = {
  LFI: ['93', '94', '95', '91', '13', '31', '34', '69', '59', '92', '77', '78', '974', '972', '67', '54', '45', '86', '87'],
  PS: ['09', '11', '12', '24', '29', '22', '35', '40', '64', '65', '81', '19', '46', '32', '44', '53', '72', '76', '14', '27', '62', '63', '33', '47', '16', '79', '58', '71', '21', '2A', '971', '973'],
  ECO: ['75', '38', '69', '67', '33', '44', '35', '37', '49', '74', '26', '25'], PCF: ['03', '76', '59', '93', '94', '63', '18', '62', '80', '974'],
};
// Parti réel estimé d'un candidat à partir de sa nuance (les nuances UG et ENS regroupent plusieurs partis).
export function partiDeNuance(d: Donnees, nuance: string, circoId: string, dept: string): string {
  const parts = d.nuances[nuance]; if (!parts) return 'DVC'; const ks = Object.keys(parts); if (ks.length === 1) return ks[0];
  if (nuance === 'UXD') return 'UDR'; if (nuance === 'RN') return 'RN'; if (nuance === 'HOR') return 'HOR';
  const base: Record<string, number> = nuance === 'UG' ? { LFI: 0.4, PS: 0.34, ECO: 0.17, PCF: 0.07, PP: 0.02 } : nuance === 'ENS' ? { RE: 0.64, MDM: 0.2, HOR: 0.16 } : { ...parts };
  if (nuance === 'UG') for (const p of Object.keys(AFF_UG)) if (AFF_UG[p].includes(dept)) base[p] *= p === 'PCF' ? 2.5 : 2;
  const r = (hash('n' + circoId) % 10000) / 10000; let tot = 0; for (const k of Object.keys(base)) tot += base[k]; let acc = 0;
  for (const k of Object.keys(base)) { acc += base[k] / tot; if (r < acc) return k; } return Object.keys(base)[0];
}

// Cibles de vote par zone et par parti, tirées des résultats réels du premier tour des législatives 2024.
// titulaire(circo, nuance) : parti estimé ou connu du candidat principal de cette nuance.
export function cibles(d: Donnees, nP: number, titulaire: (circo: number, nuance: string) => string): { T: Float32Array; C: Float32Array; nat: number[] } {
  const nC = d.circos.length, nZ = d.zones.length; const C = new Float32Array(nC * nP); const nat = new Array(nP).fill(0); let totNat = 0;
  for (let ci = 0; ci < nC; ci++) {
    const c = d.circos[ci]; const tot = c.exprimes || 1;
    for (const nu of Object.keys(c.t1)) {
      const parts = { ...(d.nuances[nu] ?? { DVC: 1 }) }; const ks = Object.keys(parts);
      if (ks.length > 1) { const t = titulaire(ci, nu); if (parts[t] !== undefined) { parts[t] *= 2.4; let s = 0; for (const k of ks) s += parts[k]; for (const k of ks) parts[k] /= s; } }
      for (const k of ks) { const v = c.t1[nu] * parts[k]; C[ci * nP + d.idxParti[k]] += v / tot; nat[d.idxParti[k]] += v; totNat += v; }
    }
  }
  for (let p = 0; p < nP; p++) nat[p] /= totNat;
  // Plancher : un parti absent d'une circonscription garde un socle (il aurait eu des voix s'il avait eu un candidat).
  for (let ci = 0; ci < nC; ci++) { let s = 0; for (let p = 0; p < nP; p++) { const f = 0.22 * nat[p]; if (C[ci * nP + p] < f) C[ci * nP + p] = f; s += C[ci * nP + p]; } for (let p = 0; p < nP; p++) C[ci * nP + p] /= s; }
  const T = new Float32Array(nZ * nP);
  const maj = () => { const Aagg = new Float64Array(nC * nP), W = new Float64Array(nC); for (const z of d.zones) for (const [ci, f] of z.circos) { const w = z.inscrits * f / 100; W[ci] += w; for (let p = 0; p < nP; p++) Aagg[ci * nP + p] += w * T[z.idx * nP + p]; } return { Aagg, W }; };
  for (const z of d.zones) { let s = 0; for (let p = 0; p < nP; p++) { let v = 0; for (const [ci, f] of z.circos) v += C[ci * nP + p] * f / 100; const tilt = TILT[d.partis[p].id]; if (tilt) v *= tilt[z.terr]; v *= 0.9 + 0.2 * ((hash(z.id + p) % 1000) / 1000); T[z.idx * nP + p] = v; s += v; } for (let p = 0; p < nP; p++) T[z.idx * nP + p] /= s || 1; }
  for (let it = 0; it < 6; it++) { // ajustement pour que l'agrégat par circonscription retrouve le résultat réel
    const { Aagg, W } = maj();
    for (const z of d.zones) { let s = 0; for (let p = 0; p < nP; p++) { let k = 0; for (const [ci, f] of z.circos) { const a = Aagg[ci * nP + p] / (W[ci] || 1); k += (f / 100) * Math.log((C[ci * nP + p] + 1e-5) / (a + 1e-5)); } T[z.idx * nP + p] *= Math.exp(k); s += T[z.idx * nP + p]; } for (let p = 0; p < nP; p++) T[z.idx * nP + p] /= s || 1; }
  }
  return { T, C, nat };
}

// Ajuste les proximités initiales (prox) pour que le moteur reproduise les cibles zone par zone.
export function calibrer(e: Etat, d: Donnees, T: Float32Array, nReels: number): { erreurMoy: number; iterations: number } {
  const nP = e.partis.length; const zones = d.zones.map(z => z.idx); const partis = Array.from({ length: nReels }, (_, i) => i);
  const c = preparer(e, d); let err = 1, it = 0;
  for (; it < 40 && err > 0.0015; it++) {
    const v = voter(e, d, c, zones, { partis, facteur: FACTEUR_ABST.legislatives }); err = 0;
    for (let i = 0; i < zones.length; i++) { let s = 0; for (let l = 0; l < nReels; l++) s += v.voix[i * nReels + l]; for (let l = 0; l < nReels; l++) { const part = v.voix[i * nReels + l] / (s || 1); const t = Math.max(T[i * nP + l], 0.0015); err += Math.abs(part - t); e.prox[i * nP + l] += 0.9 * Math.log(t / Math.max(part, 1e-6)); } }
    err /= zones.length * nReels;
  }
  return { erreurMoy: err, iterations: it };
}

// Écart entre le vote simulé au lancement et le premier tour réel des législatives 2024, par circonscription et par bloc politique.
const BLOC_PARTI: Record<string, number> = { LO: 0, LFI: 0, PCF: 0, PS: 0, ECO: 0, PP: 0, DVG: 0, REG: 1, RE: 1, MDM: 1, HOR: 1, DVC: 1, UDI: 1, LR: 2, DVD: 2, UDR: 3, RN: 3, REC: 3, DLF: 3 };
export const BLOCS = ['Gauche', 'Centre', 'Droite', 'Droite nationale'];
export function ecartCalibrage(e: Etat, d: Donnees): { moyen: number; p90: number; max: number; national: { bloc: string; reel: number; simule: number }[]; pires: { circo: string; ecart: number }[] } {
  const c = preparer(e, d); const reels = d.partis.filter(p => !p.id.startsWith('NP')).map((_, i) => i); const L = reels.length; const ecarts: number[] = []; const pires: { circo: string; ecart: number }[] = []; const natR = [0, 0, 0, 0], natS = [0, 0, 0, 0]; let TR = 0, TS = 0;
  d.circos.forEach((ci, i) => {
    const zf = d.zonesParCirco[i]; if (!zf.length || !ci.exprimes) return; const v = voter(e, d, c, zf.map(x => x[0]), { partis: reels, facteur: FACTEUR_ABST.legislatives });
    const sim = [0, 0, 0, 0]; let ts = 0; for (let k = 0; k < zf.length; k++) for (let l = 0; l < L; l++) { const x = v.voix[k * L + l] * zf[k][1]; sim[BLOC_PARTI[d.partis[l].id] ?? 1] += x; ts += x; }
    const reel = [0, 0, 0, 0]; for (const nu of Object.keys(ci.t1)) { const parts = d.nuances[nu] ?? { DVC: 1 }; for (const k of Object.keys(parts)) reel[BLOC_PARTI[k] ?? 1] += ci.t1[nu] * parts[k]; }
    let m = 0; for (let b = 0; b < 4; b++) { const dv = Math.abs(sim[b] / (ts || 1) - reel[b] / ci.exprimes) * 100; ecarts.push(dv); if (dv > m) m = dv; natR[b] += reel[b]; natS[b] += sim[b] / (ts || 1) * ci.exprimes; } TR += ci.exprimes; TS += ci.exprimes; pires.push({ circo: ci.id, ecart: Math.round(m * 10) / 10 });
  });
  ecarts.sort((a, b) => a - b); pires.sort((a, b) => b.ecart - a.ecart);
  return { moyen: ecarts.reduce((a, b) => a + b, 0) / ecarts.length, p90: ecarts[Math.floor(ecarts.length * 0.9)], max: ecarts[ecarts.length - 1], national: BLOCS.map((b, i) => ({ bloc: b, reel: Math.round(1000 * natR[i] / TR) / 10, simule: Math.round(1000 * natS[i] / TS) / 10 })), pires: pires.slice(0, 10) };
}
