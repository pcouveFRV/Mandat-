// Partis : relations, ressources hebdomadaires (la couche "Anno"), terrain, courants, congrès, scissions, droits du joueur.
import type { Donnees, Etat, Parti, Perso, Ctx, Courant } from '../types';
import { A, NB_AXES } from '../types';
import { Rng, clamp } from '../rng';
import { message, journal } from './inbox';
import { attr, nomComplet, creerPerso, ajouterHist, modTrait, liberer } from './personnages';

export const rel = (e: Etat, a: number, b: number) => a === b ? 100 : e.relPartis[a * e.partis.length + b];
export function bougerRel(e: Etat, a: number, b: number, dv: number) { if (a === b) return; const n = e.partis.length; e.relPartis[a * n + b] = clamp(e.relPartis[a * n + b] + dv, -100, 100); e.relPartis[b * n + a] = clamp(e.relPartis[b * n + a] + dv, -100, 100); }
export const actifs = (e: Etat) => e.partis.filter(p => p.actif);
export function cadres(e: Etat, parti: number, rangMin = 1): Perso[] { return e.persos.filter(p => p.parti === parti && p.statut === 'actif' && p.rang >= rangMin); }
export function parlementaires(e: Etat, parti: number): number { let n = 0; for (const s of e.assemblee) if (s.parti === parti) n++; for (const l of e.senat) for (const s of l) if (s.parti === parti) n++; return n; }
export function nbDeputes(e: Etat, parti: number): number { let n = 0; for (const s of e.assemblee) if (s.parti === parti) n++; return n; }
export function nbMairies(e: Etat, parti: number, popMin = 0, d?: Donnees): number { let n = 0; for (const m of e.mairies) if (m.parti === parti && (!d || (d.villes[m.ville].pop >= popMin && d.villes[m.ville].plm !== 2))) n++; return n; }

// Droits du joueur selon le mode et ses postes (mode Carrière : il ne contrôle que ce que ses postes permettent).
export interface Droits { tout: boolean; investitures: boolean; finances: boolean; doctrine: boolean; medias: boolean; alliances: boolean; mercato: boolean; terrain: number[] | 'tous'; }
export function droits(e: Etat): Droits {
  const j = e.joueur; const P = e.partis[j.parti];
  if (j.mode === 'parti' || (P && P.chef === j.perso)) return { tout: true, investitures: true, finances: true, doctrine: true, medias: true, alliances: true, mercato: true, terrain: 'tous' };
  const p = e.persos[j.perso]; const b = (k: string) => !!P && P.bureau[k] === j.perso; const dels: number[] = []; if (P) P.delegues.forEach((x, i) => { if (x === j.perso) dels.push(i); });
  return { tout: false, investitures: b('elections'), finances: b('tresorier'), doctrine: b('projet'), medias: b('porte_parole') || (p?.rang ?? 0) >= 3, alliances: b('elections'), mercato: b('organisation'), terrain: b('organisation') ? 'tous' : dels };
}

// ---------- Tour hebdomadaire ----------
export const ACTIONS_TERRAIN: Record<string, { nom: string; impl: number; mob: number; fatigue: number; terr: number[] }> = {
  tractage: { nom: 'Tractage', impl: 1.0, mob: 0.6, fatigue: 0.6, terr: [1.1, 1, 0.8] }, porte_a_porte: { nom: 'Porte-à-porte', impl: 1.3, mob: 1.5, fatigue: 1.4, terr: [1.2, 1, 0.7] },
  marches: { nom: 'Marchés', impl: 1.2, mob: 0.7, fatigue: 0.8, terr: [0.8, 1.1, 1.3] }, collage: { nom: 'Collage d\'affiches', impl: 0.7, mob: 0.5, fatigue: 0.5, terr: [1, 1, 1] },
  reunions: { nom: 'Réunions d\'appartement', impl: 1.5, mob: 0.8, fatigue: 0.9, terr: [1.1, 1, 0.9] }, phoning: { nom: 'Phoning', impl: 0.4, mob: 1.6, fatigue: 0.7, terr: [1, 1, 1] },
};

export function tourPartis(e: Etat, d: Donnees, rng: Rng, ctx: Ctx) {
  const nP = e.partis.length; const nZ = d.zones.length;
  // Décroissance de l'implantation acquise et de la mobilisation.
  for (let i = 0; i < nZ * nP; i++) { if (e.mob[i] !== 0) e.mob[i] *= 0.86; if (e.impl[i] !== 0) e.impl[i] *= 0.9965; }
  for (let i = 0; i < e.opinion.length; i++) if (e.opinion[i] !== 0) e.opinion[i] *= 0.985;
  for (const P of e.partis) {
    if (!P.actif) continue; const joueur = P.idx === e.joueur.parti;
    // Militants actifs : une part des adhérents, selon la dynamique et l'unité.
    const taux = clamp(0.1 + P.dynamique / 400 + (P.unite - 50) / 500, 0.03, 0.3); const cible = P.adherents * taux;
    P.militants += (cible - P.militants) * 0.1; P.fatigue = clamp(P.fatigue * 0.9, 0, 100);
    // Terrain.
    let effort = 0;
    for (const t of P.terrain) {
      const act = ACTIONS_TERRAIN[t.action]; if (!act || t.part <= 0) continue; const zs = d.zonesParDept[t.dept]; if (!zs) continue;
      const mil = P.militants * t.part; effort += t.part * act.fatigue; const insc = d.depts[t.dept].pop * 0.66 || 1;
      const del = P.delegues[t.dept] >= 0 ? e.persos[P.delegues[t.dept]] : null; const qual = del ? 0.6 + attr(d, del, A.terrain, 'terrain') / 20 + attr(d, del, A.organisation) / 40 : 0.6;
      const dens = clamp(mil / insc * 400, 0, 1.5) * qual * (1 - P.fatigue / 160);
      for (const z of zs) { const k = act.terr[d.zones[z].terr]; e.impl[z * nP + P.idx] = clamp(e.impl[z * nP + P.idx] + 0.012 * dens * act.impl * k, -2, 2); e.mob[z * nP + P.idx] = clamp(e.mob[z * nP + P.idx] + 0.05 * dens * act.mob * k, 0, 1.2); }
    }
    P.fatigue = clamp(P.fatigue + effort * 9, 0, 100);
    // Adhésions : dynamique, notoriété, qualité des délégués. Une croissance trop rapide sans cadres abîme l'unité.
    // Usure du pouvoir : le parti du président et ses alliés de gouvernement s'usent, l'opposition se refait une santé.
    const us = P.scoreIA.usure ?? 0; const auPouvoir = e.presidence.parti === P.idx; const allie = !auPouvoir && e.gouvernement.coalition.includes(P.idx);
    P.scoreIA.usure = auPouvoir ? Math.min(Math.max(us, 0.42), us + 0.0019 * (e.presidence.popularite < 45 ? 1.25 : 0.6)) : allie ? Math.min(Math.max(us, 0.2), us + 0.0009) : Math.max(0, us - 0.003);
    // Adhésions : dynamique, notoriété, crédibilité, qualité des délégués, et rappel vers une taille cohérente avec le poids électoral.
    const adh0 = P.scoreIA.adh0 || P.adherents, int0 = P.scoreIA.int0 || 0.02; const cibleAdh = adh0 * Math.pow(Math.max(0.2, (e.intentions[P.idx] ?? int0) / int0), 0.7);
    const g = 0.0009 * P.dynamique / 10 + 0.0006 * (P.notoriete - 50) / 50 + 0.0004 * (P.credibilite - 50) / 50 - 0.0006 - 0.0016 * (P.adherents / cibleAdh - 1) - (P.cotisation - 30) * 0.00001;
    let delta = 0, sansCadre = 0;
    for (let i = 0; i < P.adhDept.length; i++) { const a = P.adhDept[i]; if (a <= 0) continue; const del = P.delegues[i] >= 0 ? e.persos[P.delegues[i]] : null; const q = del ? (del.attrs[A.organisation] + del.attrs[A.terrain] - 20) * 0.00012 : -0.0006; if (!del) sansCadre += a; const na = Math.max(5, a * (1 + g + q)); delta += na - a; P.adhDept[i] = na; }
    P.adherents = Math.max(50, P.adherents + delta);
    const croissance = delta / P.adherents;
    if (croissance > 0.004) { const stress = (croissance - 0.004) * 400 * (0.5 + sansCadre / P.adherents); P.unite = clamp(P.unite - stress, 0, 100); if (rng.chance(stress * 0.05)) gaffeLocale(e, d, rng, ctx, P); }
    // Capital politique, crédibilité, notoriété, unité, dynamique.
    P.capital = clamp(P.capital + (P.capital < 50 ? 0.25 : -0.05) + (P.unite > 70 ? 0.05 : 0), 0, 100);
    const cs = cadres(e, P.idx, 3); const comp = cs.length ? cs.reduce((s, p) => s + p.attrs[A.dossiers] + p.attrs[A.gestion], 0) / (2 * cs.length) : 9;
    let bilan = 0, nb = 0; for (const m of e.mairies) if (m.parti === P.idx) { bilan += m.bilan; nb++; }
    const cibleCred = clamp(P.credibilite0 + (comp - 12.5) * 2 + (nb ? (bilan / nb - 58) * 0.2 : 0) - P.gaffes * 1.5 - (P.scoreIA.mouvements ?? 0) * 2, 5, 95);
    P.credibilite += (cibleCred - P.credibilite) * 0.045; P.gaffes *= 0.985;
    const plancher = clamp(P.notoriete0 * 0.7 + parlementaires(e, P.idx) * 0.12 + Math.log10(Math.max(100, P.adherents)) * 3, 5, 97);
    P.notoriete = clamp(P.notoriete + (plancher - P.notoriete) * 0.015 + P.viralite * 0.01, 0, 100); P.viralite *= 0.85;
    const dissidence = P.courants.reduce((s, c) => s + (c.humeur < 40 ? c.poids * (40 - c.humeur) / 40 : 0), 0);
    const cibleU = clamp(78 - dissidence * 60 + P.dynamique * 0.3 - (P.chef < 0 ? 15 : 0), 5, 97); P.unite += (cibleU - P.unite) * 0.025;
    P.dynamique = clamp(P.dynamique * 0.965, -50, 50);
    for (const c of P.courants) c.humeur = clamp(c.humeur + (55 - c.humeur) * 0.02, 0, 100);
    // Menaces internes.
    // Scission : unité effondrée, ou courant important et durablement mécontent dans un parti divisé.
    const fache = P.courants.find(c => c.humeur < 32 && c.poids >= 0.12 && c.poids <= 0.5);
    if ((P.unite < 16 && rng.chance(0.08)) || (fache && P.unite < 52 && e.semaine - (P.scoreIA.derniereScission ?? -999) > 150 && rng.chance(0.012))) { P.scoreIA.derniereScission = e.semaine; scission(e, d, rng, ctx, P); }
    else if (joueur && P.unite < 30 && rng.chance(0.06)) { const c = P.courants.find(x => x.humeur < 45) ?? P.courants[0]; if (c && c.chef >= 0) message(e, ctx, 'parti', 'Menace de démission', `${nomComplet(e.persos[c.chef])}, chef de file du courant « ${c.nom} », menace de quitter le parti si la direction ne l'écoute pas. L'unité est à ${Math.round(P.unite)}.`, true); }
    if (P.chef < 0) designerChef(e, d, rng, ctx, P);
    if (e.semaine >= P.prochainCongres) congres(e, d, rng, ctx, P);
  }
}

export function gaffeLocale(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, P: Parti) {
  P.gaffes += 1; P.credibilite = clamp(P.credibilite - 1.2, 0, 100); P.dynamique -= 2; const dept = rng.pondere(P.adhDept); const nP = e.partis.length;
  for (const z of d.zonesParDept[dept] ?? []) e.impl[z * nP + P.idx] -= 0.05; // les gaffes laissent des traces locales durables
  journal(e, `Gaffe d'un responsable ${P.sigle} en ${d.depts[dept].nom}`);
  if (P.idx === e.joueur.parti) message(e, ctx, 'parti', 'Gaffe locale', `Un responsable du parti en ${d.depts[dept].nom} a tenu des propos qui font polémique. Le parti a grandi plus vite que son encadrement. Crédibilité et implantation locale en baisse.`, false);
}

export function designerChef(e: Etat, d: Donnees, rng: Rng, ctx: Ctx | null, P: Parti) {
  const cs = cadres(e, P.idx, 2).filter(p => p.id !== e.joueur.perso || e.joueur.mode === 'carriere');
  let best: Perso | null = null, bs = -1; for (const p of cs) { const s = p.notoriete * 0.5 + p.attrs[A.charisme] * 2 + p.attrs[A.ambition] * 1.5 + p.rang * 8 + rng.next() * 10; if (s > bs) { bs = s; best = p; } }
  if (!best) best = creerPerso(e, d, rng, { parti: P.idx, dept: rng.pondere(P.adhDept), rang: 3 });
  P.chef = best.id; if (!best.postes.includes('chef')) best.postes.push('chef'); if (best.rang < 3) best.rang = 3; ajouterHist(e, best, `Prend la tête de ${P.sigle}`);
  if (ctx && P.idx === e.joueur.parti) message(e, ctx, 'parti', 'Nouvelle direction', `${nomComplet(best)} prend la tête du parti.`, true);
}

// Courants : formés à partir des positions personnelles des cadres par rapport à la ligne du parti.
const NOMS_COURANT: [string, string][] = [['Aile sociale', 'Aile libérale'], ['Aile ouverte', 'Aile ferme'], ['Souverainistes', 'Européens'], ['Aile libertés', 'Aile ordre'], ['Productivistes', 'Écologistes'], ['Conservateurs', 'Progressistes'], ['Légitimistes', 'Rénovateurs'], ['Aile rigueur', 'Aile protection'], ['Non-alignés', 'Atlantistes'], ['Jacobins', 'Girondins']];
export function recalculerCourants(e: Etat, d: Donnees, P: Parti) {
  const cs = cadres(e, P.idx, 1); if (cs.length < 4) { P.courants = []; return; }
  const groupes = new Map<string, Perso[]>(); let loyal = 0;
  for (const p of cs) { let ba = -1, bv = 1.9; for (let a = 0; a < NB_AXES; a++) { const dv = p.axes[a] - P.axes[a]; if (Math.abs(dv) > Math.abs(bv)) { bv = dv; ba = a; } } if (ba < 0) { loyal++; continue; } const k = `${ba}:${bv > 0 ? 1 : -1}`; if (!groupes.has(k)) groupes.set(k, []); groupes.get(k)!.push(p); }
  const anciens = P.courants; const res: Courant[] = [];
  for (const [k, l] of groupes) { const poids = l.length / cs.length; if (poids < 0.08) continue; const [a, s] = k.split(':').map(Number); const chef = l.reduce((b, p) => (p.notoriete + p.attrs[A.ambition] * 3 + p.attrs[A.charisme] * 2 > b.notoriete + b.attrs[A.ambition] * 3 + b.attrs[A.charisme] * 2 ? p : b), l[0]); const anc = anciens.find(c => c.axe === a && c.sens === s); res.push({ nom: NOMS_COURANT[a][s > 0 ? 1 : 0], chef: chef.id, poids, axe: a, sens: s, humeur: anc ? anc.humeur : 55 }); }
  res.sort((a, b) => b.poids - a.poids); P.courants = res.slice(0, 4);
}

// Congrès : motions portées par les courants, vote des adhérents.
export function congres(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, P: Parti) {
  P.prochainCongres = e.semaine + 156 + rng.int(-8, 8); recalculerCourants(e, d, P);
  const joueur = P.idx === e.joueur.parti; const chef = P.chef >= 0 ? e.persos[P.chef] : null;
  if (joueur && !e.options.auto && (e.joueur.mode === 'parti' || P.chef === e.joueur.perso)) {
    const motions = P.courants.map(c => `« ${c.nom} » (${Math.round(c.poids * 100)} % des cadres, menée par ${nomComplet(e.persos[c.chef])})`).join(', ');
    message(e, ctx, 'parti', 'Congrès du parti', `Le congrès s'ouvre. Motions en présence : ${motions || 'aucune motion concurrente'}. Votre capital politique est de ${Math.round(P.capital)}. Comment abordez-vous le vote des adhérents ?`, true, { choix: [{ t: 'Chercher la synthèse', info: 'Concessions doctrinales aux courants, unité en hausse.' }, { t: 'Passer en force', info: 'Coûte du capital politique. Risque de fronde.' }, { t: 'Laisser voter librement', info: 'Résultat incertain.' }], action: { type: 'congres', data: { parti: P.idx } } });
    return;
  }
  resoudreCongres(e, d, rng, ctx, P, chef && chef.attrs[A.negociation] > 12 ? 0 : P.style === 'offensif' ? 1 : 2);
}
export function resoudreCongres(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, P: Parti, choix: number) {
  const chef = P.chef >= 0 ? e.persos[P.chef] : null; const opp = P.courants[0]; const joueur = P.idx === e.joueur.parti;
  const forceChef = 50 + P.dynamique * 0.8 + (chef ? (chef.attrs[A.charisme] + chef.attrs[A.negociation] - 20) * 1.2 : -10) + P.capital * 0.2;
  const forceOpp = opp ? opp.poids * 100 + (60 - opp.humeur) * 0.5 + (e.persos[opp.chef].attrs[A.charisme] + e.persos[opp.chef].attrs[A.ambition] - 20) * 1.2 : 0;
  let txt = '';
  if (choix === 0) { for (const c of P.courants) { P.axes[c.axe] = clamp(P.axes[c.axe] + c.sens * (c.poids > 0.25 ? 1 : 0.5), -5, 5); c.humeur = clamp(c.humeur + 25, 0, 100); } P.unite = clamp(P.unite + 12, 0, 100); P.credibilite -= 1; txt = 'Une synthèse est trouvée. La ligne bouge un peu vers les courants, l\'unité se renforce.'; }
  else if (choix === 1) { P.capital = clamp(P.capital - 20, 0, 100); if (forceChef + P.capital * 0.3 + rng.gauss() * 8 > forceOpp + 25) { P.unite = clamp(P.unite - 4, 0, 100); for (const c of P.courants) c.humeur -= 15; txt = 'La direction impose sa motion. Les opposants rentrent dans le rang, en grinçant des dents.'; } else { P.unite = clamp(P.unite - 15, 0, 100); for (const c of P.courants) c.humeur -= 25; txt = 'Le passage en force échoue. Le congrès se termine dans la confusion.'; } }
  else { const marge = forceChef - forceOpp + rng.gauss() * 10; if (marge > 0 || !opp) { P.unite = clamp(P.unite + 5, 0, 100); P.capital = clamp(P.capital + 8, 0, 100); txt = `La motion de la direction l'emporte avec ${clamp(Math.round(50 + marge / 2), 51, 85)} % des voix.`; } else {
    const nv = e.persos[opp.chef]; txt = `La motion « ${opp.nom} » l'emporte. ${nomComplet(nv)} prend la tête du parti.`; if (chef) { chef.postes = chef.postes.filter(x => x !== 'chef'); chef.moral -= 25; ajouterHist(e, chef, `Battu au congrès de ${P.sigle}`); } P.chef = nv.id; nv.postes.push('chef'); ajouterHist(e, nv, `Élu à la tête de ${P.sigle} au congrès`); P.axes[opp.axe] = clamp(P.axes[opp.axe] + opp.sens, -5, 5); P.unite = clamp(P.unite + 3, 0, 100);
    if (joueur && e.joueur.mode === 'parti') P.capital = clamp(P.capital - 15, 0, 100);
  } }
  journal(e, `Congrès ${P.sigle} : ${txt}`);
  if (joueur) message(e, ctx, 'parti', 'Résultat du congrès', txt, true);
}

// Scission : le courant le plus mécontent quitte le parti et rejoint la formation la plus proche (ou un parti de réserve si le courant pèse lourd).
export function scission(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, P: Parti) {
  recalculerCourants(e, d, P); const c = P.courants.slice().sort((a, b) => a.humeur - b.humeur)[0]; if (!c) { P.unite = 30; return; }
  const membres = cadres(e, P.idx, 0).filter(p => (p.axes[c.axe] - P.axes[c.axe]) * c.sens >= 1.5 && p.id !== P.chef);
  let cible = -1, bd = 1e9; for (const Q of e.partis) { if (!Q.actif || Q.idx === P.idx) continue; let dist = 0; for (let a = 0; a < NB_AXES; a++) dist += (Q.axes[a] - P.axes[a] - (a === c.axe ? c.sens * 2 : 0)) ** 2; if (Q.famille !== P.famille) dist += 30; if (dist < bd) { bd = dist; cible = Q.idx; } }
  const reserve = e.partis.find(q => !q.actif); const part = clamp(c.poids * 0.8, 0.08, 0.6);
  if (reserve && part > 0.22) { activerParti(e, d, reserve, P, `${NOMS_COURANT[c.axe][c.sens > 0 ? 1 : 0].replace('Aile ', 'Les ')} de ${P.sigle}`.slice(0, 40), c.axe, c.sens, part); cible = reserve.idx; }
  if (cible < 0) return; const Q = e.partis[cible];
  for (const p of membres) { liberer(e, p); p.parti = cible; ajouterHist(e, p, `Quitte ${P.sigle} pour ${Q.sigle} lors de la scission`); for (const s of e.assemblee) if (s.perso === p.id) s.parti = cible; for (const l of e.senat) for (const s of l) if (s.perso === p.id) s.parti = cible; for (const m of e.mairies) if (m.maire === p.id) m.parti = cible; }
  const nP = e.partis.length; for (let z = 0; z < d.zones.length; z++) { e.impl[z * nP + P.idx] -= part * 0.5; e.impl[z * nP + cible] += part * 0.35; }
  const adh = P.adherents * part; P.adherents -= adh; Q.adherents += adh; for (let i = 0; i < P.adhDept.length; i++) { const x = P.adhDept[i] * part; P.adhDept[i] -= x; Q.adhDept[i] += x; }
  P.unite = 55; P.dynamique -= 10; P.courants = P.courants.filter(x => x !== c); bougerRel(e, P.idx, cible, -30);
  P.scoreIA.scissions = (P.scoreIA.scissions ?? 0) + 1; journal(e, `Scission à ${P.sigle} : le courant « ${c.nom} » rejoint ${Q.sigle}`);
  message(e, ctx, 'actu', `Scission à ${P.sigle}`, `Le courant « ${c.nom} » quitte ${P.nom} avec ${membres.length} cadres et environ ${Math.round(part * 100)} % des adhérents. Ils rejoignent ${Q.nom}.`, P.idx === e.joueur.parti);
  if (P.idx === e.joueur.parti && part >= 0.5) e.joueur.fin = { type: 'defaite', titre: 'Scission', texte: 'La scission vous laisse minoritaire dans votre propre parti.' };
}
// Active un parti de réserve à partir d'un parti d'origine (scission ou fondation par le joueur).
export function activerParti(e: Etat, d: Donnees, N: Parti, origine: Parti, nom: string, axe: number, sens: number, part: number) {
  const nP = e.partis.length; N.actif = true; N.nom = nom; N.sigle = nom.split(/\s+/).filter(w => w.length > 2).map(w => w[0].toUpperCase()).join('').slice(0, 4) || 'NP'; N.famille = origine.famille;
  N.axes = origine.axes.slice(); if (axe >= 0) N.axes[axe] = clamp(N.axes[axe] + sens * 2, -5, 5); N.axes0 = N.axes.slice();
  N.notoriete = N.notoriete0 = clamp(origine.notoriete * 0.5, 5, 60); N.credibilite = N.credibilite0 = 40; N.unite = 85; N.capital = 30; N.dynamique = 8; N.tresorerie = 150000; N.adherents = 200; N.militants = 40; N.adhDept = origine.adhDept.map(x => x * 0.002);
  for (let z = 0; z < d.zones.length; z++) { e.prox[z * nP + N.idx] = e.prox[z * nP + origine.idx] + Math.log(Math.max(0.05, part)) ; e.impl[z * nP + N.idx] = 0; e.mob[z * nP + N.idx] = 0; }
  for (let s = 0; s < d.segments.length; s++) e.opinion[s * nP + N.idx] = 0;
  for (const Q of e.partis) { const r = Q.idx === origine.idx ? -20 : rel(e, origine.idx, Q.idx) * 0.8; e.relPartis[N.idx * nP + Q.idx] = r; e.relPartis[Q.idx * nP + N.idx] = r; }
  N.prochainCongres = e.semaine + 150; N.strategie = 'presidentielle'; N.chef = -1;
}
export { modTrait };
