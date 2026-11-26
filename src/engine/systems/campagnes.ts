// Campagnes : alliances par défaut, composition des candidatures, budgets, meetings, parrainages, comptes de campagne.
import type { Donnees, Etat, Parti, Ctx, Candidature, Scrutin, Echeance, BudgetCampagne } from '../types';
import { A } from '../types';
import { Rng, clamp, hash } from '../rng';
import { DUREE_CAMPAGNE, NOM_SCRUTIN, dateTexte, jourVote, annee } from '../calendrier';
import { message, journal } from './inbox';
import { rel, cadres, parlementaires, bougerRel, droits } from './partis';
import { attr, qualiteCandidat, nomComplet, ajouterHist } from './personnages';
import { plafond, remboursement, risqueRejet } from './regles';

export const LOCAUX: Scrutin[] = ['municipales', 'departementales', 'regionales'];
export function politique(e: Etat, parti: number, type: Scrutin): string { return e.politiqueAlliance[`${parti}:${type}`] ?? (LOCAUX.includes(type) ? 'union' : 'seul'); }
export function accordsActifs(e: Etat, type: Scrutin) { return e.accords.filter(a => a.type === type && !a.rompu && a.fin >= e.semaine); }
export function allies(e: Etat, parti: number, type: Scrutin): number[] { const s = new Set<number>(); for (const a of accordsActifs(e, type)) if (a.partis.includes(parti)) for (const p of a.partis) if (p !== parti) s.add(p); return [...s]; }

export interface OptListes { type: Scrutin; uid: string; forces: number[]; local: boolean; seuilSeul: number; sortant?: { parti: number; perso: number }; circo?: number; zoneLocale?: number; national?: boolean; semaine: number }
// Compose les listes ou candidatures d'une unité : accords explicites, unions par défaut selon les relations, têtes de liste.
export function formerListes(e: Etat, d: Donnees, o: OptListes): Candidature[] {
  const nP = e.partis.length; const poids = (p: number) => o.forces[p] * (o.local ? 0.25 + e.partis[p].notabilite : 1) * (o.sortant?.parti === p ? 2.2 : 1);
  const groupes: number[][] = []; const pris = new Set<number>(); const chefImpose: Record<number, number> = {};
  for (const a of accordsActifs(e, o.type)) { const g = a.partis.filter(p => e.partis[p].actif && !pris.has(p)); if (g.length < 2) continue; g.forEach(p => pris.add(p)); if (a.repartition && o.circo !== undefined && a.repartition[o.circo] !== undefined) chefImpose[groupes.length] = a.repartition[o.circo]; groupes.push(g); }
  const ordre = e.partis.filter(p => p.actif && !pris.has(p.idx)).map(p => p.idx).sort((a, b) => poids(b) - poids(a));
  for (const p of ordre) {
    const pol = politique(e, p, o.type); let place = false;
    if (pol === 'union') for (const g of groupes) { const chef = g[0]; if (pris.has(chef) && chefImpose[groupes.indexOf(g)] !== undefined) continue; if (politique(e, chef, o.type) !== 'union') continue; if (rel(e, p, chef) >= 35 && g.every(q => rel(e, p, q) >= 5)) { g.push(p); place = true; break; } }
    if (!place && (o.forces[p] >= o.seuilSeul || o.sortant?.parti === p || pol === 'partout')) groupes.push([p]);
  }
  const res: Candidature[] = [];
  groupes.forEach((g, gi) => {
    let chef = chefImpose[gi]; if (chef === undefined || !g.includes(chef)) chef = g.slice().sort((a, b) => poids(b) - poids(a))[0];
    if (o.sortant && g.includes(o.sortant.parti)) chef = o.sortant.parti;
    const somme = g.reduce((s, p) => s + o.forces[p], 0); if (somme < o.seuilSeul * 0.6 && !(o.sortant && g.includes(o.sortant.parti))) return;
    let perso = -1, sortant = false;
    if (o.sortant && o.sortant.parti === chef && o.sortant.perso >= 0 && e.persos[o.sortant.perso]?.statut === 'actif') { perso = o.sortant.perso; sortant = true; }
    const inv = e.investitures[o.type]?.[`${o.uid}:${chef}`]; if (inv !== undefined && inv >= 0 && e.persos[inv]?.statut === 'actif' && e.persos[inv].parti === chef) { perso = inv; sortant = !!o.sortant && o.sortant.perso === inv; }
    const h = hash(`${o.uid}:${chef}:${o.semaine}`);
    let qualite: number; let sexe: 'M' | 'F';
    if (perso >= 0) { const p = e.persos[perso]; qualite = qualiteCandidat(d, p, o.zoneLocale === undefined || p.zone === o.zoneLocale || d.zones[p.zone]?.deptIdx === d.zones[o.zoneLocale]?.deptIdx, !!o.national); sexe = p.sexe; }
    else { const P = e.partis[chef]; const dep = o.zoneLocale !== undefined ? d.zones[o.zoneLocale].deptIdx : -1; const del = dep >= 0 && P.delegues[dep] >= 0 ? e.persos[P.delegues[dep]] : null; qualite = -0.12 + ((h % 1000) / 1000) * 0.3 + (del ? (del.attrs[A.organisation] - 10) * 0.012 : -0.05); sexe = ((h >>> 10) % 100) < 50 - P.scoreIA.biaisParite ? 'F' : 'M'; }
    res.push({ parti: chef, perso, soutiens: g.filter(p => p !== chef), qualite: qualite + (sortant ? 0.25 : 0), sortant, sexe });
  });
  return res;
}

// ---------- Ouverture et déroulement des campagnes ----------
export function budgetParDefaut(e: Etat, d: Donnees, P: Parti, type: Scrutin): BudgetCampagne {
  const pop = d.zones.reduce((s, z) => s + z.pop, 0); const ech = { presidentielle: 1, legislatives: 0.5, europeennes: 0.6, regionales: 0.25, departementales: 0.12, municipales: 0.3, senatoriales: 0.02 }[type];
  const plaf = plafondParti(e, d, P, type); const dispo = Math.max(0, P.tresorerie) * (type === 'presidentielle' ? 0.8 : 0.65) * Math.min(1, ech * 1.5) + (type === 'presidentielle' ? plaf * 0.25 * (P.notoriete / 100) : 0);
  const total = Math.round(Math.min(plaf * 0.9, dispo)); void pop;
  return { scrutin: type, total, meetings: 0.3, affichage: 0.2, tracts: 0.2, numerique: 0.2, sondages: 0.1, depense: 0, cibles: [] };
}
export function plafondParti(e: Etat, d: Donnees, P: Parti, type: Scrutin): number {
  const pop = d.zones.reduce((s, z) => s + z.pop, 0);
  switch (type) { case 'presidentielle': return plafond(type, pop); case 'europeennes': return plafond(type, pop); case 'legislatives': return 577 * plafond(type, pop / 577) * 0.6; case 'regionales': return plafond(type, pop) * 0.6; case 'departementales': return plafond(type, pop) * 0.3; case 'municipales': return plafond(type, pop * 0.5) * 0.5; default: return 200000; }
}

export function tourCampagnes(e: Etat, d: Donnees, rng: Rng, ctx: Ctx) {
  for (const ech of e.calendrier) {
    if (ech.fait1) continue; const duree = DUREE_CAMPAGNE[ech.type]; const cle = `${ech.type}:${ech.s1}`;
    // Désignation des candidats à la présidentielle, 40 semaines avant.
    if (ech.type === 'presidentielle' && !ech.designe && e.semaine >= ech.s1 - 40 && e.semaine < ech.s1 - 8) { ech.designe = true; designerCandidats(e, d, rng, ctx); }
    else if (ech.type === 'presidentielle' && ech.designe && e.semaine <= ech.s1 - 5) tourParrainages(e, d, rng, ctx, ech);
    if (e.semaine >= ech.s1 - duree && e.semaine < ech.s1 && !e.campagnesOuvertes.includes(cle)) {
      e.campagnesOuvertes.push(cle);
      for (const P of e.partis) { if (!P.actif || ech.type === 'senatoriales') continue; if (ech.type === 'presidentielle' && (P.candidatPres < 0 || P.parrainages < 500)) continue; const b = budgetParDefaut(e, d, P, ech.type); if (P.campagne && P.campagne.scrutin !== ech.type) cloreCompte(e, d, rng, ctx, P, 0.05); P.campagne = b; P.comptes.push({ scrutin: ech.type, semaine: ech.s1, depenses: 0, plafond: plafondParti(e, d, P, ech.type), statut: 'en_cours', rembourse: 0, controle: 0 }); }
      const dr = droits(e); const Pj = e.partis[e.joueur.parti];
      message(e, ctx, 'campagne', `Ouverture de la campagne : ${NOM_SCRUTIN[ech.type].toLowerCase()}`, `Le premier tour aura lieu le ${jourVote(ech.s1)}. ${ech.type === 'senatoriales' ? 'Seuls les grands électeurs votent : le résultat dépend de vos élus locaux.' : dr.finances ? `Budget proposé : ${Math.round((Pj.campagne?.total ?? 0) / 1000)} k€. Vous pouvez le modifier dans l'écran Campagne, ainsi que les investitures et les alliances.` : 'La direction du parti fixe le budget et les investitures.'}`, true);
    }
    // Effets hebdomadaires de la dépense de campagne.
    if (e.semaine > ech.s1 - duree && e.semaine <= (ech.s2 > 0 ? ech.s2 : ech.s1) && ech.type !== 'senatoriales') {
      const nP = e.partis.length;
      for (const P of e.partis) {
        const b = P.campagne; if (!P.actif || !b || b.scrutin !== ech.type || b.total <= 0) continue;
        const dep = Math.min(b.total - b.depense, b.total / duree); if (dep <= 0) continue; b.depense += dep; P.tresorerie -= dep; P.fluxMois.campagne = (P.fluxMois.campagne ?? 0) - dep;
        const c = P.comptes[P.comptes.length - 1]; if (c) c.depenses += dep;
        const intens = clamp(dep * duree / (plafondParti(e, d, P, ech.type) || 1), 0, 1.3);
        const kMob = 0.035 * intens * (b.meetings * 1.2 + b.tracts * 1.0 + b.affichage * 0.6), kImpl = 0.004 * intens * (b.affichage * 1.5 + b.tracts);
        for (let z = 0; z < d.zones.length; z++) { const cib = b.cibles.length && b.cibles.includes(d.zones[z].deptIdx) ? 1.8 : b.cibles.length ? 0.7 : 1; e.mob[z * nP + P.idx] = clamp(e.mob[z * nP + P.idx] + kMob * cib, 0, 1.2); e.impl[z * nP + P.idx] += kImpl * cib; }
        const num = 0.02 * intens * b.numerique; d.segments.forEach((s, si) => { if (s.etiquettes.includes('jeunes')) e.opinion[si * nP + P.idx] += num; }); P.viralite += b.numerique * intens * 2;
        P.notoriete = clamp(P.notoriete + 0.25 * intens, 0, 100);
      }
    }
  }
}

// Meeting : effet local fort, fatigue de l'orateur.
export function meeting(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, parti: number, dept: number, orateur: number): string {
  const P = e.partis[parti]; const p = e.persos[orateur]; if (!p || p.forme < 25) return 'L\'orateur est trop fatigué.'; const cout = 35000 + d.depts[dept].pop * 0.02; if (P.tresorerie < cout) return 'Trésorerie insuffisante.';
  P.tresorerie -= cout; P.fluxMois.campagne = (P.fluxMois.campagne ?? 0) - cout; if (P.campagne) { P.campagne.depense += cout; const c = P.comptes[P.comptes.length - 1]; if (c && c.statut === 'en_cours') c.depenses += cout; }
  const q = (attr(d, p, A.eloquence, 'campagne') + attr(d, p, A.charisme, 'campagne')) / 2; const nP = e.partis.length; const eff = 0.012 * q + p.notoriete * 0.0015;
  for (const z of d.zonesParDept[dept]) { e.mob[z * nP + parti] = clamp(e.mob[z * nP + parti] + eff * 1.6, 0, 1.2); e.impl[z * nP + parti] += eff * 0.12; }
  p.forme = clamp(p.forme - 9, 0, 100); P.dynamique = clamp(P.dynamique + q * 0.06, -50, 50); P.militants *= 1.004;
  const succes = q + rng.gauss() * 3 > 11; if (succes) { p.notoriete = clamp(p.notoriete + 0.6, 0, 100); if (rng.chance(0.15)) p.citations.push(`« Nous sommes venus dire à ${d.depts[dept].nom} qu'on ne l'oublie pas. » (meeting, ${dateTexte(e.semaine)})`); }
  return `Meeting en ${d.depts[dept].nom} : ${succes ? 'salle comble, belle ambiance' : 'salle à moitié pleine'}. Mobilisation locale en hausse. Coût : ${Math.round(cout / 1000)} k€.`;
}

// ---------- Présidentielle : candidats et parrainages ----------
export function designerCandidats(e: Etat, d: Donnees, rng: Rng, ctx: Ctx) {
  for (const P of e.partis) {
    if (!P.actif) continue; P.parrainages = 0; if (P.candidatPres >= 0 && e.persos[P.candidatPres]?.statut === 'actif' && e.persos[P.candidatPres].parti === P.idx && P.idx === e.joueur.parti) continue;
    P.candidatPres = -1; if (P.strategie === 'local' && e.intentions[P.idx] < 0.04 && P.idx !== e.joueur.parti) continue;
    // Pas plus de deux mandats présidentiels consécutifs (article 6 de la Constitution).
    const cs = cadres(e, P.idx, 3).filter(p => !(e.presidence.perso === p.id && ((e.presidence.consecutifs ?? 1) >= 2 || e.presidence.debut < 100)) && annee(e.semaine) - p.naissance < 78);
    let best = -1, bs = -1; for (const p of cs) { const s = p.notoriete + p.attrs[A.charisme] * 2 + p.attrs[A.ambition] + (P.chef === p.id ? 12 : 0) + rng.next() * 8; if (s > bs) { bs = s; best = p.id; } }
    if (best < 0 && P.chef >= 0 && e.presidence.perso !== P.chef) best = P.chef; P.candidatPres = best;
    if (best >= 0) ajouterHist(e, e.persos[best], `Désigné candidat de ${P.sigle} à l'élection présidentielle`);
  }
  // Les petits partis proches d'un grand peuvent se ranger derrière son candidat.
  for (const P of e.partis) { if (!P.actif || P.candidatPres < 0 || P.idx === e.joueur.parti) continue; const fort = e.partis.filter(q => q.actif && q.idx !== P.idx && q.candidatPres >= 0 && rel(e, P.idx, q.idx) >= 60 && e.intentions[q.idx] > e.intentions[P.idx] * 2.5).sort((a, b) => e.intentions[b.idx] - e.intentions[a.idx])[0]; if (fort && (P.strategie === 'union' || e.intentions[P.idx] < 0.03) && rng.chance(0.75)) { P.candidatPres = -1; e.consignes[P.idx] = fort.idx; journal(e, `${P.sigle} soutient ${nomComplet(e.persos[fort.candidatPres])} pour la présidentielle`); } }
  const Pj = e.partis[e.joueur.parti]; if (Pj.actif) message(e, ctx, 'campagne', 'Présidentielle : la course aux parrainages commence', Pj.candidatPres >= 0 ? `${nomComplet(e.persos[Pj.candidatPres])} portera vos couleurs. Il faut réunir 500 parrainages d'élus avant la date limite. Suivez le compteur dans l'écran Campagne.` : 'Votre parti ne présente pas de candidat pour le moment. Vous pouvez en désigner un dans l\'écran Campagne.', true);
}
// Vivier de parrains : élus du parti et élus sans étiquette ou proches (maires ruraux surtout).
export function vivierParrains(e: Etat, d: Donnees, P: Parti): number {
  let n = parlementaires(e, P.idx) + e.europe.filter(s => s.parti === P.idx).length; const nP = e.partis.length;
  for (const m of e.mairies) if (m.parti === P.idx) n += 1; for (const c of e.conseilsDept) n += c.sieges[P.idx] ?? 0; for (const c of e.conseilsReg) n += c.sieges[P.idx] ?? 0;
  for (const z of d.zones) if (z.type === 1) n += z.nbCommunes * (e.partsBassin[z.idx * nP + P.idx] ?? 0);
  // Maires sans étiquette sensibles à la notoriété et à la respectabilité du parti.
  n += 9000 * clamp((e.intentions[P.idx] ?? 0) * 0.5 + P.credibilite / 2500, 0, 0.12);
  return n;
}
function tourParrainages(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, ech: Echeance) {
  for (const P of e.partis) {
    if (!P.actif || P.candidatPres < 0) continue; const c = e.persos[P.candidatPres]; const vivier = vivierParrains(e, d, P);
    // Cible : une part du vivier, selon le réseau du candidat, les notables du parti et l'effort consenti. Montée régulière jusqu'à la date limite.
    const cible = vivier * clamp(0.3 + (attr(d, c, A.reseau) + attr(d, c, A.negociation)) * 0.008 + P.notabilite * 0.12 + (P.scoreIA.effortParrainages ?? 0) * 0.12, 0.2, 0.75); const reste = Math.max(1, ech.s1 - 5 - e.semaine + 1);
    P.parrainages = Math.round(P.parrainages + Math.max(0, cible - P.parrainages) / reste + rng.next() * 2);
    if (e.semaine === ech.s1 - 5) {
      const ok = P.parrainages >= 500; journal(e, `${nomComplet(c)} (${P.sigle}) ${ok ? 'obtient ses 500 parrainages' : 'échoue à réunir 500 parrainages'} (${P.parrainages})`);
      if (!ok) { ajouterHist(e, c, `Échoue à réunir les 500 parrainages (${P.parrainages})`); if (P.idx === e.joueur.parti) message(e, ctx, 'campagne', 'Parrainages : échec', `Votre candidat n'a réuni que ${P.parrainages} parrainages. Il ne pourra pas se présenter.`, true); P.candidatPres = -1; P.campagne = null; }
      else if (P.idx === e.joueur.parti) message(e, ctx, 'campagne', 'Parrainages validés', `Le Conseil constitutionnel valide ${P.parrainages} parrainages. ${nomComplet(c)} est officiellement candidat.`, true);
    } else if (P.idx === e.joueur.parti && (ech.s1 - e.semaine) % 6 === 0) message(e, ctx, 'campagne', 'Point parrainages', `${P.parrainages} promesses de parrainage sur 500. Vivier estimé d'élus favorables : ${Math.round(vivier)}.`, false);
  }
}

// ---------- Comptes de campagne ----------
export function cloreCompte(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, P: Parti, partVoix: number) {
  const c = P.comptes[P.comptes.length - 1]; if (!c || c.statut !== 'en_cours') return; c.statut = 'depose'; c.controle = e.semaine + 26; (c as any).part = partVoix; P.campagne = null;
}
export function controleComptes(e: Etat, d: Donnees, rng: Rng, ctx: Ctx) {
  for (const P of e.partis) for (const c of P.comptes) {
    if (c.statut !== 'depose' || e.semaine < c.controle) continue; const tres = P.bureau.tresorier >= 0 ? e.persos[P.bureau.tresorier] : null;
    const risque = P.inegibiliteRisque + (tres ? Math.max(0, 10 - tres.attrs[A.gestion]) * 0.15 : 1.2); const rejet = rng.chance(risqueRejet(c.depenses, c.plafond, risque)); const part = (c as any).part ?? 0;
    c.statut = rejet ? 'rejete' : 'valide'; c.rembourse = remboursement(c.scrutin, c.plafond, c.depenses, part, rejet); P.tresorerie += c.rembourse; P.fluxMois.remboursement = (P.fluxMois.remboursement ?? 0) + c.rembourse; P.inegibiliteRisque = Math.max(0, P.inegibiliteRisque - 1);
    if (rejet) { P.credibilite = clamp(P.credibilite - 4, 0, 100); journal(e, `Compte de campagne de ${P.sigle} rejeté (${NOM_SCRUTIN[c.scrutin as Scrutin].toLowerCase()})`); const cand = c.scrutin === 'presidentielle' ? P.candidatPres : P.chef; if (cand >= 0 && rng.chance(0.35) && !e.persos[cand].reel) { const p = e.persos[cand]; p.statut = 'ineligible'; p.ineligibleJusqua = e.semaine + 156; ajouterHist(e, p, 'Déclaré inéligible pour trois ans après le rejet du compte de campagne'); if (cand === e.joueur.perso) e.joueur.fin = { type: 'defaite', titre: 'Inéligibilité', texte: 'Le rejet de votre compte de campagne vous rend inéligible.' }; } }
    if (P.idx === e.joueur.parti) message(e, ctx, 'finances', rejet ? 'Compte de campagne rejeté' : 'Compte de campagne validé', rejet ? `La commission rejette le compte (${NOM_SCRUTIN[c.scrutin as Scrutin].toLowerCase()}). Aucun remboursement. La crédibilité du parti en souffre.` : `La commission valide le compte (${NOM_SCRUTIN[c.scrutin as Scrutin].toLowerCase()}). Remboursement de l'État : ${Math.round(c.rembourse / 1000)} k€ pour ${Math.round(c.depenses / 1000)} k€ dépensés.`, rejet);
  }
}
export { bougerRel };
