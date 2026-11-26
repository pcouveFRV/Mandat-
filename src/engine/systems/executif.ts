// Exécutif national : Premier ministre, réformes en plusieurs étapes, 49.3 et censure, remaniement, dissolution, référendum.
// Le joueur agit quand son camp tient l'Élysée ou Matignon. Les présidents IA gouvernent avec les mêmes règles.
import type { Donnees, Etat, Ctx, Executif, Reforme, Parti } from '../types';
import { A } from '../types';
import { Rng, clamp } from '../rng';
import { message, journal } from './inbox';
import { nomComplet, ajouterHist } from './personnages';
import { nbDeputes, rel, bougerRel } from './partis';
import { dateTexte, jourVote } from '../calendrier';

export const ETAPES = ['Concertation', 'Conseil des ministres', 'Débat au Parlement', 'Appliquée'];
export function executifDe(e: Etat): Executif { if (!e.executif) e.executif = { reformes: [], prochain: 1, dernierRemaniement: -999, dernierePM: -999, derniereDissolution: -999, dernierReferendum: -999, referendum: null, censures: 0 }; return e.executif; }
// Le joueur gouverne s'il est président (ou si son parti l'est en mode Parti), ou si son camp dirige le gouvernement.
export function roleExecutif(e: Etat): { president: boolean; gouverne: boolean } {
  const j = e.joueur; const pr = e.presidence; const president = pr.parti === j.parti && pr.perso >= 0 && (j.mode === 'parti' || pr.perso === j.perso);
  const matignon = e.gouvernement.parti === j.parti && (j.mode === 'parti' || e.gouvernement.pm === j.perso);
  return { president, gouverne: president || matignon };
}
const siegesMajorite = (e: Etat) => e.gouvernement.coalition.reduce((s, p) => s + nbDeputes(e, p), 0);
const TOTAL = 577, MAJ = 289;
// Part de l'opinion favorable à une réforme : segments dont la position va dans le même sens.
export function soutienOpinion(d: Donnees, axe: number, sens: number): number { let pour = 0, tot = 0; for (const s of d.segments) { const v = s.axes[axe] * sens; const w = 1 - s.abstention * 0.5; pour += w * clamp(0.5 + v * 0.11, 0.08, 0.92); tot += w; } return Math.round(100 * pour / (tot || 1)); }
const nomReforme = (d: Donnees, axe: number, sens: number) => `${d.axes[axe].nom} : ${(sens > 0 ? d.axes[axe].polePlus : d.axes[axe].poleMoins).split(',')[0].toLowerCase()}`;

function appliquer(e: Etat, d: Donnees, rng: Rng, r: Reforme, force: boolean) {
  const pr = e.presidence; const G = e.partis[e.gouvernement.parti]; const nP = e.partis.length; const sout = soutienOpinion(d, r.axe, r.sens) + (r.soutien - 50) * 0.3;
  r.etape = 3; r.fin = e.semaine; pr.reformes++; pr.popularite = clamp(pr.popularite + (sout - 50) / 7 - (force ? 4 : 0) + 1, 5, 90);
  if (G) { const coh = Math.sign(G.axes[r.axe]) === r.sens ? 1 : G.axes[r.axe] === 0 ? 0 : -1; G.credibilite = clamp(G.credibilite + 1.5 * coh + 0.5, 0, 100); G.culture = clamp(G.culture + 1.2, 0, 100); if (coh < 0) G.unite = clamp(G.unite - 4, 0, 100);
    d.segments.forEach((s, si) => { const v = s.axes[r.axe] * r.sens; e.opinion[si * nP + G.idx] += clamp(v * 0.012, -0.05, 0.05); }); }
  if (r.axe === 0) { e.eco.croissance = clamp(e.eco.croissance + 0.15 + rng.gauss() * 0.2, -3, 4); } if (r.axe === 7) e.eco.chomage = clamp(e.eco.chomage - 0.1 + rng.gauss() * 0.15, 4, 13);
  journal(e, `Réforme adoptée${force ? ' par 49.3' : ''} : ${r.nom}`);
}
function chuteGouvernement(e: Etat, d: Donnees, rng: Rng, ctx: Ctx | null, joueur: boolean) {
  const x = executifDe(e); const pr = e.presidence; const G = e.partis[e.gouvernement.parti]; x.censures++; pr.popularite = clamp(pr.popularite - 6, 5, 90); if (G) { G.unite = clamp(G.unite - 5, 0, 100); G.dynamique = clamp(G.dynamique - 5, -50, 50); }
  const anc = e.gouvernement.pm; if (anc >= 0 && e.persos[anc]) ajouterHist(e, e.persos[anc], 'Renversé par une motion de censure');
  const cands = G ? e.persos.filter(p => p.parti === G.idx && p.statut === 'actif' && p.rang >= 3 && p.id !== anc && p.id !== pr.perso) : []; const nv = cands.sort((a, b) => b.attrs[A.negociation] + b.notoriete / 10 - a.attrs[A.negociation] - a.notoriete / 10)[0];
  e.gouvernement.pm = nv ? nv.id : (G ? G.chef : -1); x.dernierePM = e.semaine; journal(e, 'Le gouvernement est renversé par une motion de censure');
  if (joueur && ctx) message(e, ctx, 'mandat', 'Le gouvernement est renversé', `La motion de censure est adoptée. ${nv ? nomComplet(nv) + ' est chargé de former un nouveau gouvernement.' : 'Un nouveau gouvernement doit être formé.'} Popularité et unité en baisse.`, true);
}
// Vote d'un texte. Renvoie adopte, rejete ou censure.
function voter(e: Etat, d: Donnees, rng: Rng, r: Reforme, force: boolean): 'adopte' | 'rejete' | 'censure' {
  const maj = siegesMajorite(e); const pr = e.presidence;
  if (!force) { const marge = (maj - MAJ) / 20 + (r.soutien - 50) / 25 + rng.gauss() * 0.7; return maj >= MAJ ? (marge > -1.2 ? 'adopte' : 'rejete') : (marge > 0.4 ? 'adopte' : 'rejete'); }
  // 49.3 : le texte passe sauf si une motion de censure réunit une majorité.
  if (maj >= MAJ) return 'adopte'; const risque = clamp(0.2 + (MAJ - maj) / 160 + (45 - pr.popularite) / 120 + executifDe(e).censures * -0.05, 0.05, 0.75); return rng.chance(risque) ? 'censure' : 'adopte';
}

export function actionExecutif(e: Etat, d: Donnees, rng: Rng, ctx: Ctx | null, a: any): { ok: boolean; texte: string } {
  const x = executifDe(e); const role = roleExecutif(e); const non = (t: string) => ({ ok: false, texte: t }), ok = (t: string) => ({ ok: true, texte: t });
  if (!role.gouverne) return non('Votre camp ne gouverne pas.'); const P = e.partis[e.joueur.parti]; const pr = e.presidence;
  switch (a.type) {
    case 'execReforme': {
      const axe = clamp(+a.axe | 0, 0, d.axes.length - 1), sens = a.sens > 0 ? 1 : -1; if (x.reformes.filter(r => r.etape < 3).length >= 2) return non('Deux réformes sont déjà en cours. Menez-les au bout avant d\'en ouvrir une autre.');
      if (x.reformes.some(r => r.axe === axe && r.fin !== undefined && e.semaine - r.fin < 104)) return non('Ce domaine vient d\'être réformé. Laissez passer deux ans.'); if (P.capital < 5) return non('Il faut 5 de capital politique pour ouvrir un chantier.');
      P.capital -= 5; const r: Reforme = { id: x.prochain++, axe, sens, nom: nomReforme(d, axe, sens), etape: 0, debut: e.semaine, soutien: clamp(soutienOpinion(d, axe, sens) + Math.round(rng.gauss() * 4), 10, 90) }; x.reformes.push(r); journal(e, `Le gouvernement ouvre un chantier : ${r.nom}`);
      return ok(`Chantier ouvert : ${r.nom}. Soutien de départ dans l'opinion : ${r.soutien} %.`);
    }
    case 'execAvancer': {
      const r = x.reformes.find(k => k.id === a.id); if (!r || r.etape >= 3) return non('Réforme introuvable.');
      if (r.etape === 0) { if (a.mode === 'concerter') { if ((r.concertations ?? 0) >= 3) return non('La concertation a donné ce qu\'elle pouvait.'); if (r.derniere === e.semaine) return non('Une étape par semaine sur chaque texte.'); r.concertations = (r.concertations ?? 0) + 1; r.derniere = e.semaine; const g = 3 + Math.round(rng.next() * 4); r.soutien = clamp(r.soutien + g, 5, 95); return ok(`Syndicats, élus et associations sont reçus. Soutien : ${r.soutien} % (+${g}). Le calendrier s'allonge d'autant.`); } r.etape = 1; r.derniere = e.semaine; return ok('La concertation est close. Le texte part en Conseil des ministres.'); }
      if (r.derniere === e.semaine) return non('Une étape par semaine sur chaque texte.'); r.derniere = e.semaine;
      if (r.etape === 1) { r.etape = 2; return ok('Le projet de loi est adopté en Conseil des ministres et déposé au Parlement.'); }
      const force = a.mode === '49.3'; if (force && P.capital < 8) return non('Le 49.3 coûte 8 de capital politique.'); if (force) P.capital -= 8;
      const res = voter(e, d, rng, r, force);
      if (res === 'adopte') { appliquer(e, d, rng, r, force); return ok(force ? `Le 49.3 est engagé. La motion de censure échoue : ${r.nom} est adoptée. Popularité : ${Math.round(pr.popularite)} %.` : `Le texte est voté : ${r.nom} est adoptée. Popularité : ${Math.round(pr.popularite)} %.`); }
      if (res === 'censure') { r.etape = 3; r.fin = e.semaine; r.abandon = true; chuteGouvernement(e, d, rng, ctx, false); return ok('La motion de censure est adoptée. Le gouvernement tombe et le texte est abandonné.'); }
      r.soutien = clamp(r.soutien - 4, 5, 95); pr.popularite = clamp(pr.popularite - 1.5, 5, 90); return ok(`Le texte est rejeté par l'Assemblée (${siegesMajorite(e)} sièges pour la majorité, il en faut ${MAJ}). Vous pouvez retenter le vote, ou engager le 49.3.`);
    }
    case 'execAbandon': { const r = x.reformes.find(k => k.id === a.id); if (!r || r.etape >= 3) return non('Réforme introuvable.'); r.etape = 3; r.fin = e.semaine; r.abandon = true; pr.popularite = clamp(pr.popularite - 2, 5, 90); P.credibilite = clamp(P.credibilite - 1.5, 0, 100); return ok('Le texte est retiré. Recul assumé, crédibilité en baisse.'); }
    case 'execPM': {
      const p = e.persos[a.perso]; if (!role.president) return non('Seul le président nomme le Premier ministre.'); if (!p || p.statut !== 'actif' || p.rang < 3 || !e.gouvernement.coalition.includes(p.parti)) return non('Il faut une figure nationale de la majorité.');
      if (p.id === pr.perso) return non('Le président ne peut pas être son propre Premier ministre.'); if (e.semaine - x.dernierePM < 26) return non('Le Premier ministre vient d\'être nommé. Attendez six mois.'); if (P.capital < 8) return non('Il faut 8 de capital politique.');
      P.capital -= 8; const anc = e.gouvernement.pm; e.gouvernement.pm = p.id; x.dernierePM = e.semaine; ajouterHist(e, p, 'Nommé Premier ministre'); if (anc >= 0 && e.persos[anc] && anc !== p.id) { ajouterHist(e, e.persos[anc], 'Quitte Matignon'); e.persos[anc].moral = clamp(e.persos[anc].moral - 15, 0, 100); }
      pr.popularite = clamp(pr.popularite + 2 + (p.notoriete - 50) / 25, 5, 90); if (p.parti !== pr.parti) bougerRel(e, pr.parti, p.parti, 8); journal(e, `${nomComplet(p)} est nommé Premier ministre`);
      return ok(`${nomComplet(p)} s'installe à Matignon.${p.parti !== pr.parti ? ' Ce choix d\'ouverture rapproche les deux partis.' : ''}`);
    }
    case 'execRemaniement': { if (P.capital < 10) return non('Il faut 10 de capital politique.'); P.capital -= 10; const tot = e.semaine - x.dernierRemaniement; x.dernierRemaniement = e.semaine; const g = tot >= 52 ? 3 : -1.5; pr.popularite = clamp(pr.popularite + g, 5, 90); P.unite = clamp(P.unite + (tot >= 52 ? 2 : -2), 0, 100); journal(e, 'Remaniement ministériel'); return ok(tot >= 52 ? 'Nouvelle équipe, nouvel élan : la popularité remonte un peu.' : 'Un remaniement de plus. L\'opinion y voit de la fébrilité.'); }
    case 'execDissolution': {
      if (!role.president) return non('Seul le président peut dissoudre l\'Assemblée.'); const der = e.archives.filter(k => k.type === 'legislatives').slice(-1)[0]; if (der && e.semaine - der.s < 52) return non('Pas de dissolution dans l\'année qui suit des législatives.');
      if (e.semaine - x.derniereDissolution < 52) return non('Une dissolution par an au plus.'); const ech = e.calendrier.find(k => k.type === 'legislatives' && !k.fait1); if (!ech) return non('Plus de législatives au calendrier.'); if (ech.s1 - e.semaine <= 8) return non('Les législatives sont déjà imminentes.');
      if (e.calendrier.some(k => !k.fait2 && k.type !== 'legislatives' && Math.abs(k.s1 - (e.semaine + 4)) <= 3)) return non('Un autre scrutin tombe au même moment. Attendez qu\'il soit passé.');
      ech.s1 = e.semaine + 4; ech.s2 = e.semaine + 5; ech.designe = false; ech.negocie = false; e.calendrier.sort((p, q) => p.s1 - q.s1); x.derniereDissolution = e.semaine; pr.popularite = clamp(pr.popularite - 3, 5, 90); journal(e, 'Le président dissout l\'Assemblée nationale');
      return ok(`L'Assemblée est dissoute. Premier tour le ${jourVote(ech.s1)}. Les investitures sont à faire tout de suite.`);
    }
    case 'execReferendum': {
      if (!role.president) return non('Seul le président convoque un référendum.'); if (x.referendum) return non('Un référendum est déjà convoqué.'); if (e.semaine - x.dernierReferendum < 104) return non('Un référendum tous les deux ans au plus.'); if (P.capital < 12) return non('Il faut 12 de capital politique.');
      const axe = clamp(+a.axe | 0, 0, d.axes.length - 1), sens = a.sens > 0 ? 1 : -1; P.capital -= 12; x.referendum = { axe, sens, s: e.semaine + 6, titre: nomReforme(d, axe, sens) }; x.dernierReferendum = e.semaine; journal(e, `Référendum convoqué : ${x.referendum.titre}`);
      return ok(`Référendum convoqué dans six semaines : ${x.referendum.titre}. L'opinion part à ${soutienOpinion(d, axe, sens)} % de oui, avant la campagne.`);
    }
  }
  return non('Action inconnue.');
}

export function tourExecutif(e: Etat, d: Donnees, rng: Rng, ctx: Ctx) {
  const x = executifDe(e); const pr = e.presidence; if (pr.parti < 0) return; const role = roleExecutif(e); const auto = !role.gouverne || !!e.options.auto; const G: Parti | undefined = e.partis[e.gouvernement.parti];
  if (x.reformes.length > 40) x.reformes.splice(0, x.reformes.length - 40);
  // Référendum : le oui dépend du soutien de fond et de la popularité du président.
  const rf = x.referendum; if (rf && e.semaine >= rf.s) {
    const oui = clamp(50 + (soutienOpinion(d, rf.axe, rf.sens) - 50) * 0.6 + (pr.popularite - 40) * 0.35 + rng.gauss() * 4, 20, 80); const P = e.partis[pr.parti]; x.referendum = null;
    if (oui > 50) { const r: Reforme = { id: x.prochain++, axe: rf.axe, sens: rf.sens, nom: rf.titre, etape: 2, debut: e.semaine, soutien: Math.round(oui) }; x.reformes.push(r); appliquer(e, d, rng, r, false); pr.popularite = clamp(pr.popularite + 4, 5, 90); P.capital = clamp(P.capital + 10, 0, 100); }
    else { pr.popularite = clamp(pr.popularite - 8, 5, 90); P.dynamique = clamp(P.dynamique - 6, -50, 50); P.unite = clamp(P.unite - 3, 0, 100); }
    const t = `Référendum sur « ${rf.titre} » : le ${oui > 50 ? 'oui' : 'non'} l'emporte avec ${String(Math.round((oui > 50 ? oui : 100 - oui) * 10) / 10).replace('.', ',')} %.`; journal(e, t);
    message(e, ctx, role.president ? 'mandat' : 'actu', oui > 50 ? 'Référendum : le oui l\'emporte' : 'Référendum : le non l\'emporte', t + (role.president ? (oui > 50 ? ' La réforme entre en vigueur. Popularité et capital en hausse.' : ' Désaveu pour l\'Élysée. Popularité en nette baisse.') : ''), role.president);
  }
  if (!auto) { const enCours = x.reformes.filter(r => r.etape < 3); for (const r of enCours) if (e.semaine - r.debut === 26) message(e, ctx, 'mandat', 'Une réforme s\'enlise', `Le chantier « ${r.nom} » est ouvert depuis six mois. Faites-le avancer dans l'écran Mandat, ou retirez-le.`, false); return; }
  // Exécutif IA : un chantier de temps en temps, sur l'axe le plus marqué du parti qui gouverne.
  if (!G) return;
  for (const r of x.reformes.filter(k => k.etape < 3)) {
    if (e.semaine - (r.derniere ?? r.debut) < 5) continue; r.derniere = e.semaine;
    if (r.etape < 2) { r.etape++; if (r.etape === 1) r.soutien = clamp(r.soutien + 4, 5, 95); continue; }
    let res = voter(e, d, rng, r, false); if (res === 'rejete' && rng.chance(G.style === 'offensif' ? 0.6 : 0.3)) res = voter(e, d, rng, r, true) === 'censure' ? 'censure' : 'adopte';
    if (res === 'adopte') appliquer(e, d, rng, r, false); else if (res === 'censure') { r.etape = 3; r.fin = e.semaine; r.abandon = true; chuteGouvernement(e, d, rng, ctx, false); } else if (rng.chance(0.5)) { r.etape = 3; r.fin = e.semaine; r.abandon = true; pr.popularite = clamp(pr.popularite - 1.5, 5, 90); }
  }
  if (x.reformes.filter(k => k.etape < 3).length === 0 && rng.chance(0.035)) {
    let axe = 0, m = -1; G.axes.forEach((v, i) => { const s = Math.abs(v) + rng.next() * 2; if (s > m && !x.reformes.some(r => r.axe === i && r.fin !== undefined && e.semaine - r.fin < 104)) { m = s; axe = i; } });
    const sens = G.axes[axe] >= 0 ? 1 : -1; x.reformes.push({ id: x.prochain++, axe, sens, nom: nomReforme(d, axe, sens), etape: 0, debut: e.semaine, soutien: soutienOpinion(d, axe, sens) }); journal(e, `Le gouvernement ouvre un chantier : ${nomReforme(d, axe, sens)}`);
  }
  void rel;
}

export function vueExecutif(e: Etat, d: Donnees) {
  const role = roleExecutif(e); const x = executifDe(e); const pr = e.presidence; const G = e.partis[e.gouvernement.parti]; const maj = siegesMajorite(e);
  const pm = e.gouvernement.pm >= 0 ? e.persos[e.gouvernement.pm] : null; const der = e.archives.filter(k => k.type === 'legislatives').slice(-1)[0];
  const candidatsPM = role.president ? e.persos.filter(p => p.statut === 'actif' && p.rang >= 3 && e.gouvernement.coalition.includes(p.parti) && p.id !== pr.perso && p.id !== e.gouvernement.pm).sort((a, b) => b.notoriete - a.notoriete).slice(0, 14).map(p => ({ id: p.id, nom: nomComplet(p), parti: p.parti, notoriete: Math.round(p.notoriete), negociation: p.attrs[A.negociation], gestion: p.attrs[A.gestion] })) : [];
  return {
    president: role.president, gouverne: role.gouverne, cohabitation: pr.parti >= 0 && e.gouvernement.parti !== pr.parti, popularite: Math.round(pr.popularite), depuis: dateTexte(pr.debut),
    pm: pm ? { id: pm.id, nom: nomComplet(pm), parti: pm.parti } : null, partiGouv: G ? G.idx : -1, coalition: e.gouvernement.coalition, sieges: maj, majorite: MAJ, total: TOTAL, absolue: maj >= MAJ, censures: x.censures,
    reformes: x.reformes.filter(r => r.etape < 3).map(r => ({ ...r, etapeNom: ETAPES[r.etape], opinion: soutienOpinion(d, r.axe, r.sens), semaines: e.semaine - r.debut, concertations: r.concertations ?? 0 })),
    faites: x.reformes.filter(r => r.etape === 3).slice(-8).reverse().map(r => ({ nom: r.nom, abandon: !!r.abandon, date: dateTexte(r.fin ?? r.debut) })),
    axes: d.axes.map((a, i) => ({ i, nom: a.nom, moins: a.poleMoins, plus: a.polePlus, pour: soutienOpinion(d, i, 1), contre: soutienOpinion(d, i, -1), ligne: G ? G.axes[i] : 0 })),
    candidatsPM, referendum: x.referendum ? { titre: x.referendum.titre, dans: x.referendum.s - e.semaine } : null,
    peutDissoudre: role.president && (!der || e.semaine - der.s >= 52) && e.semaine - x.derniereDissolution >= 52, peutReferendum: role.president && !x.referendum && e.semaine - x.dernierReferendum >= 104,
  };
}
