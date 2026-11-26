// Exercice des mandats : mairie, département, région, Assemblée, présidence simplifiée.
import type { Donnees, Etat, Ctx, Mairie, Conseil, Perso } from '../types';
import { A } from '../types';
import { Rng, clamp } from '../rng';
import { message, journal } from './inbox';
import { attr, aMandat, creerPerso, donnerMandat, nomComplet, ajouterHist } from './personnages';
import { nbDeputes } from './partis';

export const PROJETS_MAIRIE = ['Équipements sportifs', 'Sécurité', 'Propreté', 'Voirie', 'Culture', 'Écoles'];
export const DELEGATIONS = ['Finances', 'Sécurité', 'Urbanisme et voirie', 'Écoles', 'Culture', 'Sport', 'Solidarités', 'Environnement et propreté'];
const DELEG_PROJET = [5, 1, 3, 5, 4, 0, -1, 2]; // délégation -> catégorie de projet aidée
export const PROJETS_CONSEIL: Record<string, string[]> = { dept: ['Collèges', 'Routes', 'Action sociale', 'Économie locale', 'Environnement'], reg: ['Lycées', 'Transports', 'Formation', 'Économie', 'Environnement'] };
export const coutProjet = (pop: number, niveau: number) => Math.round(pop * 28 * (1 + niveau * 0.6));

export function mairieDuJoueur(e: Etat): Mairie | null { const p = e.persos[e.joueur.perso]; const m = p && aMandat(p, 'maire'); return m ? e.mairies[m.lieu] : null; }
export function conseilDuJoueur(e: Etat): { c: Conseil; type: 'dept' | 'reg' } | null { const p = e.persos[e.joueur.perso]; if (!p) return null; const a = aMandat(p, 'president_dept'); if (a) return { c: e.conseilsDept[a.lieu], type: 'dept' }; const b = aMandat(p, 'president_region'); if (b) return { c: e.conseilsReg[b.lieu], type: 'reg' }; return null; }

export function lancerProjet(e: Etat, d: Donnees, m: Mairie, cat: number): string {
  const v = d.villes[m.ville]; const niv = m.projets[cat]; if (niv >= 5) return 'Ce domaine est déjà au niveau maximum.'; const cout = coutProjet(v.pop, niv); if (m.budget < cout) return `Budget d'investissement insuffisant (${Math.round(cout / 1000)} k€ nécessaires).`;
  m.budget -= cout; m.projets[cat]++; const adj = m.adjoints.find(a => DELEG_PROJET[DELEGATIONS.indexOf(a.delegation)] === cat); const bonus = adj ? (e.persos[adj.perso].attrs[A.gestion] - 10) * 0.25 : -0.5;
  m.bilan = clamp(m.bilan + 3 + bonus, 0, 100); return `${PROJETS_MAIRIE[cat]} : projet lancé pour ${Math.round(cout / 1000)} k€. Bilan en hausse${adj ? ` (suivi par ${nomComplet(e.persos[adj.perso])})` : ''}.`;
}
export function reglerImpots(e: Etat, m: Mairie, niveau: number): string { const avant = m.impots; m.impots = clamp(niveau, 20, 80); const dv = m.impots - avant; m.bilan = clamp(m.bilan - dv * 0.25, 0, 100); return dv > 0 ? 'Hausse des impôts locaux : recettes en hausse, bilan en baisse.' : dv < 0 ? 'Baisse des impôts locaux : bilan en hausse, recettes en baisse.' : ''; }
export function nommerAdjoint(e: Etat, d: Donnees, m: Mairie, perso: number, delegation: string): string {
  const p = e.persos[perso]; if (!p || p.statut !== 'actif') return 'Personnage indisponible.'; m.adjoints = m.adjoints.filter(a => a.perso !== perso && a.delegation !== delegation); m.adjoints.push({ perso, delegation });
  if (!aMandat(p, 'adjoint')) { donnerMandat(e, p, 'adjoint', m.ville, true); ajouterHist(e, p, `Nommé adjoint (${delegation}) à ${d.villes[m.ville].nom}`); } p.moral = clamp(p.moral + 8, 0, 100); return `${nomComplet(p)} devient adjoint : ${delegation}.`;
}
// Vivier d'élus municipaux du joueur (créé quand il devient maire).
export function equipeMunicipale(e: Etat, d: Donnees, rng: Rng, m: Mairie): Perso[] {
  const v = d.villes[m.ville]; let l = e.persos.filter(p => p.statut === 'actif' && p.parti === m.parti && p.id !== m.maire && (p.mandats.some(x => (x.type === 'conseiller_municipal' || x.type === 'adjoint') && x.lieu === m.ville)));
  while (l.length < 8) { const p = creerPerso(e, d, rng, { parti: m.parti, dept: v.deptIdx, zone: v.zones[0], rang: 1 }); donnerMandat(e, p, 'conseiller_municipal', m.ville, true); l.push(p); }
  return l;
}
export function dialoguer(e: Etat, m: Mairie, cible: 'opposition' | 'interco'): string { const p = e.persos[m.maire]; const q = p.attrs[A.negociation]; if (cible === 'opposition') { m.opposition = clamp(m.opposition + 4 + q * 0.4, 0, 100); p.forme = clamp(p.forme - 3, 0, 100); return 'Vous recevez les groupes d\'opposition. Le climat du conseil municipal s\'apaise.'; } m.interco = clamp(m.interco + 3 + q * 0.4, 0, 100); m.budget += d0(m.interco) * 1000; p.forme = clamp(p.forme - 3, 0, 100); return 'Vous négociez avec l\'intercommunalité. Vos dossiers avancent mieux et des cofinancements se débloquent.'; }
const d0 = (x: number) => Math.round(x * 2);
export function projetConseil(e: Etat, d: Donnees, c: Conseil, type: 'dept' | 'reg', cat: number): string {
  const pop = type === 'dept' ? d.depts[c.lieu].pop : d.zones.filter(z => z.regIdx === c.lieu).reduce((s, z) => s + z.pop, 0); const niv = c.projets[cat]; if (niv >= 5) return 'Niveau maximum atteint.'; const cout = Math.round(pop * 14 * (1 + niv * 0.6)); if (c.budget < cout) return `Budget insuffisant (${Math.round(cout / 1e6 * 10) / 10} M€ nécessaires).`;
  c.budget -= cout; c.projets[cat]++; c.bilan = clamp(c.bilan + 3.5, 0, 100); return `${PROJETS_CONSEIL[type][cat]} : programme lancé pour ${Math.round(cout / 1e6 * 10) / 10} M€. Bilan en hausse.`;
}

// Travail parlementaire : chaque action a un coût en forme ou en capital, et un effet sur la notoriété et la crédibilité.
export const ACTIONS_PARLEMENT: Record<string, { nom: string; desc: string; forme: number; capital: number }> = {
  qag: { nom: 'Question au gouvernement', desc: 'Deux minutes devant les caméras. Notoriété.', forme: 3, capital: 0 },
  amendement: { nom: 'Déposer des amendements', desc: 'Travail de fond en commission. Crédibilité.', forme: 5, capital: 0 },
  proposition: { nom: 'Proposition de loi', desc: 'Un texte à votre nom. Adoption selon la majorité.', forme: 10, capital: 4 },
  commission: { nom: 'Commission d\'enquête', desc: 'Six mois d\'auditions. Forte visibilité.', forme: 12, capital: 8 },
  niche: { nom: 'Niche parlementaire', desc: 'Journée réservée à votre groupe (15 députés minimum).', forme: 6, capital: 6 },
};
export function actionParlement(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, parti: number, perso: number, type: string): string {
  const T = ACTIONS_PARLEMENT[type]; const P = e.partis[parti]; const p = e.persos[perso]; if (!T || !p) return ''; const dep = nbDeputes(e, parti);
  if (!aMandat(p, 'depute') && !(e.joueur.mode === 'parti' && dep > 0)) return 'Il faut un mandat de député.'; if ((P.scoreIA.dernierParlement ?? -9) >= e.semaine) return 'Une initiative parlementaire par semaine.';
  if (type === 'niche' && dep < 15) return 'Votre groupe n\'a pas les 15 députés nécessaires.'; if (P.capital < T.capital) return 'Capital politique insuffisant.'; if (p.forme < T.forme + 10) return 'Trop fatigué pour cela.';
  P.scoreIA.dernierParlement = e.semaine; P.capital -= T.capital; p.forme = clamp(p.forme - T.forme, 0, 100); const k = e.joueur.mode === 'parti' ? Math.min(2, 0.5 + dep / 60) : 1; const majo = e.gouvernement.coalition.includes(parti);
  e.joueur.pointsVictoire.activite = (e.joueur.pointsVictoire.activite ?? 0) + 1; let txt = '';
  switch (type) {
    case 'qag': { const q = attr(d, p, A.eloquence, 'debat') + rng.gauss() * 3; const ok = q > 11; P.notoriete = clamp(P.notoriete + (ok ? 0.8 : 0.2) * k, 0, 100); p.notoriete = clamp(p.notoriete + (ok ? 1.5 : 0.4), 0, 100); txt = ok ? 'Votre question fait mouche. La séquence est reprise aux journaux du soir.' : 'Question posée dans un hémicycle clairsemé.'; break; }
    case 'amendement': { const q = attr(d, p, A.dossiers, 'dossiers') + rng.gauss() * 3; const ok = q > 11; P.credibilite = clamp(P.credibilite + (ok ? 0.8 : 0.2) * k, 0, 100); txt = ok ? `${rng.int(2, 9)} de vos amendements sont adoptés en commission.` : 'Vos amendements sont rejetés, mais le travail est remarqué.'; break; }
    case 'proposition': { const chance = majo ? 0.55 : 0.12 + dep / 1500; const ok = rng.chance(chance + (attr(d, p, A.negociation) - 10) * 0.02); P.credibilite = clamp(P.credibilite + (ok ? 2.5 : 0.6) * k, 0, 100); P.notoriete = clamp(P.notoriete + (ok ? 1.5 : 0.5) * k, 0, 100); p.notoriete = clamp(p.notoriete + (ok ? 4 : 1), 0, 100); if (ok) { ajouterHist(e, p, 'Fait adopter une proposition de loi'); P.culture += 2; } txt = ok ? 'Votre proposition de loi est adoptée. Une ligne qui restera dans votre bilan.' : 'Le texte est rejeté, mais il a permis d\'ouvrir le débat.'; break; }
    case 'commission': { P.notoriete = clamp(P.notoriete + 2.5 * k, 0, 100); P.credibilite = clamp(P.credibilite + 1.5 * k, 0, 100); p.notoriete = clamp(p.notoriete + 5, 0, 100); const cible = e.gouvernement.parti; if (cible >= 0 && cible !== parti) e.partis[cible].credibilite = clamp(e.partis[cible].credibilite - 1.5, 0, 100); txt = 'La commission d\'enquête est créée. Les auditions sont très suivies.'; break; }
    case 'niche': { const ok = rng.chance(majo ? 0.6 : 0.25); P.notoriete = clamp(P.notoriete + 1.5 * k, 0, 100); P.credibilite = clamp(P.credibilite + (ok ? 2 : 0.5), 0, 100); P.unite = clamp(P.unite + 1, 0, 100); txt = ok ? 'Journée réussie : un de vos textes est adopté.' : 'Journée d\'obstruction : aucun texte n\'aboutit, mais vos thèmes ont occupé l\'actualité.'; break; }
  }
  journal(e, `${nomComplet(p)} (${P.sigle}) : ${T.nom.toLowerCase()}`); return txt;
}

// Tour mensuel : bilans des exécutifs locaux, budgets, présidence.
export function tourMandats(e: Etat, d: Donnees, rng: Rng, ctx: Ctx) {
  const mj = mairieDuJoueur(e); const cj = conseilDuJoueur(e);
  for (const m of e.mairies) {
    const v = d.villes[m.ville]; const maire = m.maire >= 0 ? e.persos[m.maire] : null; const recettes = v.pop * (9 + m.impots * 0.12) * (1 + m.interco / 500); m.budget = Math.min(m.budget + recettes, v.pop * 900);
    if (m === mj) { const adj = m.adjoints.reduce((s, a) => s + (e.persos[a.perso].attrs[A.gestion] - 10) * 0.04, 0); m.bilan = clamp(m.bilan + (48 - m.bilan) * 0.02 + adj + (m.opposition - 50) * 0.004, 0, 100); m.opposition = clamp(m.opposition - 0.8, 0, 100); m.interco = clamp(m.interco - 0.5, 0, 100); continue; }
    const g = maire ? maire.attrs[A.gestion] + maire.attrs[A.ancrage] * 0.4 : 9; m.bilan = clamp(m.bilan + (42 + g * 1.1 - m.bilan) * 0.03 + rng.gauss() * 0.8, 5, 95);
    if (rng.chance(0.03) && m.budget > coutProjet(v.pop, 2)) { const cat = rng.int(0, 5); if (m.projets[cat] < 5) { m.projets[cat]++; m.budget -= coutProjet(v.pop, m.projets[cat] - 1); } }
  }
  for (const [l, k] of [[e.conseilsDept, 9], [e.conseilsReg, 4.5]] as [Conseil[], number][]) for (const c of l) {
    if (c.parti < 0) continue; const pr = c.president >= 0 ? e.persos[c.president] : null; const pop = l === e.conseilsDept ? d.depts[c.lieu].pop : 0; c.budget = Math.min(c.budget + (pop || c.budget * 0.004 / k * 100) * (pop ? k : 0.01), (pop || 5e6) * 120);
    if (cj && cj.c === c) { c.bilan = clamp(c.bilan + (47 - c.bilan) * 0.02, 0, 100); continue; }
    const g = pr ? pr.attrs[A.gestion] : 9; c.bilan = clamp(c.bilan + (40 + g * 1.2 - c.bilan) * 0.03 + rng.gauss() * 0.7, 5, 95);
  }
  // Présidence : la popularité s'érode, elle pèse sur la dynamique du parti présidentiel.
  const pr = e.presidence; if (pr.parti >= 0) { const joueurPres = pr.parti === e.joueur.parti && (e.joueur.mode === 'parti' || pr.perso === e.joueur.perso); pr.popularite = clamp(pr.popularite + (34 - pr.popularite) * 0.03 + (joueurPres ? 0 : rng.gauss() * 1.2) - (e.eco.chomage - 7.5) * 0.15 + e.eco.croissance * 0.1, 8, 85); const P = e.partis[pr.parti]; P.dynamique = clamp(P.dynamique + (pr.popularite - 40) * 0.04, -50, 50); if (joueurPres && pr.popularite < 18 && rng.chance(0.3)) message(e, ctx, 'mandat', 'Impopularité record', `Votre popularité tombe à ${Math.round(pr.popularite)} %. La majorité s'inquiète pour les prochaines élections.`, true); }
  e.eco.chomage = clamp(e.eco.chomage + (7.5 - e.eco.chomage) * 0.02 + rng.gauss() * 0.06, 4, 13); e.eco.croissance = clamp(e.eco.croissance + (1.1 - e.eco.croissance) * 0.05 + rng.gauss() * 0.12, -3, 4); e.eco.inflation = clamp(e.eco.inflation + (1.9 - e.eco.inflation) * 0.05 + rng.gauss() * 0.1, -0.5, 8);
}
