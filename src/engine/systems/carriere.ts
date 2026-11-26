// Mode Carrière : activité hebdomadaire du personnage, estime dans le parti, promotions, investitures, changement de parti.
import type { Donnees, Etat, Ctx, Scrutin, Perso } from '../types';
import { A } from '../types';
import { Rng, clamp } from '../rng';
import { message, journal } from './inbox';
import { NOM_SCRUTIN, DUREE_CAMPAGNE, annee } from '../calendrier';
import { aMandat, ajouterHist, nomComplet, liberer, attr } from './personnages';
import { activerParti, rel, resoudreCongres, droits } from './partis';

export const ACTIVITES: Record<string, { nom: string; desc: string }> = {
  terrain: { nom: 'Militer sur le terrain', desc: 'Tractages, marchés, porte-à-porte. Ancrage local et estime des militants.' },
  reseau: { nom: 'Cultiver son réseau', desc: 'Déjeuners, réunions, coups de fil. Réseau et estime des cadres.' },
  formation: { nom: 'Se former', desc: 'Lectures, formations du parti. Les attributs techniques progressent.' },
  medias: { nom: 'Chercher la lumière', desc: 'Presse locale, réseaux sociaux. Notoriété, avec un risque de faux pas.' },
  mandat: { nom: 'Travailler ses dossiers', desc: 'Si vous avez un mandat : bilan et crédibilité.' },
  repos: { nom: 'Lever le pied', desc: 'Forme et moral remontent.' },
};
export const estime = (e: Etat) => e.joueur.pointsVictoire.estime ?? 0;
const plusEstime = (e: Etat, v: number) => { e.joueur.pointsVictoire.estime = clamp(estime(e) + v, -30, 200); };

// Écrans ouverts au joueur. En mode Carrière, un écran qui n'est pas gagné n'existe pas dans le menu.
export const ACCES: Record<string, { nom: string; texte: string }> = {
  inbox: { nom: 'Boîte de réception', texte: '' }, agora: { nom: 'Agora', texte: '' }, equipe: { nom: 'Terrain', texte: '' }, profil: { nom: 'Mon parcours', texte: '' }, contacts: { nom: 'Carnet', texte: '' },
  carte: { nom: 'Carte', texte: 'Vous tenez une section : on vous confie les cartes électorales. Résultats, intentions de vote et implantation, jusqu\'à la commune.' },
  effectif: { nom: 'Effectif', texte: 'Vous avez maintenant accès au fichier des cadres et des élus du parti, avec leurs fiches.' },
  historique: { nom: 'Historique', texte: 'Les archives électorales du parti vous sont ouvertes : tous les scrutins passés et les sondages.' },
  pantheon: { nom: 'Panthéon', texte: 'Votre parcours commence à compter. Le Panthéon suit votre score et vos objectifs.' },
  campagne: { nom: 'Campagne', texte: 'Vous entrez dans la machine électorale : candidatures, investitures, budgets et plans de campagne.' },
  mandat: { nom: 'Mandat', texte: 'Vous êtes élu. Cet écran regroupe tout ce que vous pouvez faire dans l\'exercice de votre mandat.' },
  parti: { nom: 'Parti', texte: 'Vous êtes un cadre départemental : la vie interne du parti vous est ouverte. Fédérations, courants, bureau, congrès.' },
  finances: { nom: 'Finances', texte: 'On vous montre désormais les comptes du parti : recettes, dépenses, dette et financement public.' },
  medias: { nom: 'Médias', texte: 'Les plateaux s\'ouvrent à vous : invitations, entretiens, débats et sondages commandés.' },
  doctrine: { nom: 'Doctrine', texte: 'Vous pesez sur la ligne : l\'arbre de doctrine et les propositions du parti vous sont ouverts.' },
};
export function accesJoueur(e: Etat): string[] {
  const j = e.joueur; if (j.mode === 'parti') return Object.keys(ACCES).filter(k => k !== 'profil' && k !== 'contacts'); const p = e.persos[j.perso]; const P = e.partis[j.parti]; if (!p) return ['inbox', 'agora', 'equipe', 'profil', 'contacts'];
  const chef = !!P && P.chef === p.id; const bureau = !!P && Object.values(P.bureau).includes(p.id); const r = chef ? 4 : p.rang; const elu = p.mandats.length > 0;
  const a = ['inbox', 'agora', 'equipe', 'profil', 'contacts']; if (r >= 1 || elu) a.push('carte', 'effectif', 'historique', 'pantheon', 'campagne'); if (elu) a.push('mandat');
  if (r >= 2) a.push('parti', 'finances'); if (r >= 3 || bureau || (e.debat && !e.debat.fini)) a.push('medias'); if (r >= 3 || bureau) a.push('doctrine');
  return a;
}
export function tourCarriere(e: Etat, d: Donnees, rng: Rng, ctx: Ctx) {
  if (e.joueur.mode !== 'carriere') return; const p = e.persos[e.joueur.perso]; const P = e.partis[e.joueur.parti]; if (!p) return; const nP = e.partis.length;
  { const acc = accesJoueur(e); const connus = e.joueur.acces; if (!connus) e.joueur.acces = acc; else { const nv = acc.filter(k => !connus.includes(k) && ACCES[k].texte); if (nv.length) { e.joueur.acces = [...new Set([...connus, ...acc])]; e.joueur.nouveaux = [...(e.joueur.nouveaux ?? []), ...nv].slice(-6); message(e, ctx, 'carriere', nv.length > 1 ? 'De nouvelles portes s\'ouvrent' : `Nouvel accès : ${ACCES[nv[0]].nom}`, nv.map(k => `${ACCES[k].nom}. ${ACCES[k].texte}`).join('\n\n') + '\n\nLe menu de gauche est à jour.', false); } } }
  const act = (e.options as any).activite ?? 'terrain'; const pr = (i: number, proba: number) => { if (rng.chance(proba * (p.forme / 100)) && p.attrs[i] < Math.min(20, p.pot + 2)) { p.attrs[i]++; return true; } return false; };
  switch (act) {
    case 'terrain': p.forme = clamp(p.forme - 2.5, 0, 100); plusEstime(e, 0.35 + attr(d, p, A.terrain, 'terrain') * 0.02); pr(A.terrain, 0.06); pr(A.ancrage, 0.07); pr(A.organisation, 0.03); if (P.actif) { e.impl[p.zone * nP + P.idx] += 0.004 + attr(d, p, A.terrain, 'terrain') * 0.0006; e.mob[p.zone * nP + P.idx] = clamp(e.mob[p.zone * nP + P.idx] + 0.01, 0, 1.2); } p.notoriete = clamp(p.notoriete + 0.05, 0, 100); break;
    case 'reseau': p.forme = clamp(p.forme - 1.5, 0, 100); plusEstime(e, 0.3 + attr(d, p, A.reseau) * 0.025); pr(A.reseau, 0.08); pr(A.negociation, 0.04); break;
    case 'formation': p.forme = clamp(p.forme - 1, 0, 100); pr(rng.pick([A.eloquence, A.debat, A.dossiers, A.gestion, A.medias, A.reseaux]), 0.22); plusEstime(e, 0.08); break;
    case 'medias': { p.forme = clamp(p.forme - 2, 0, 100); const q = attr(d, p, A.medias, 'tv') + attr(d, p, A.reseaux, 'reseaux'); p.notoriete = clamp(p.notoriete + (0.12 + q * 0.012) * (1 - p.notoriete / 70), 0, 100); pr(A.medias, 0.05); pr(A.reseaux, 0.06); if (rng.chance(0.03 * (24 - p.attrs[A.sangfroid]) / 12)) { plusEstime(e, -2); p.notoriete = clamp(p.notoriete + 1, 0, 100); message(e, ctx, 'carriere', 'Un faux pas', 'Une de vos déclarations est sortie de son contexte. La direction locale n\'apprécie pas.', false); } break; }
    case 'mandat': { p.forme = clamp(p.forme - 2, 0, 100); const m = aMandat(p, 'maire'); if (m) e.mairies[m.lieu].bilan = clamp(e.mairies[m.lieu].bilan + 0.25 + p.attrs[A.gestion] * 0.012, 0, 100); if (p.mandats.length) { plusEstime(e, 0.25); pr(A.dossiers, 0.06); pr(A.gestion, 0.06); p.notoriete = clamp(p.notoriete + 0.06, 0, 100); } break; }
    case 'repos': p.forme = clamp(p.forme + 9, 0, 100); p.moral = clamp(p.moral + 2, 0, 100); break;
  }
  if (p.forme < 20 && rng.chance(0.3)) message(e, ctx, 'carriere', 'Épuisement', 'Vous êtes à bout de forces. Vos attributs effectifs sont diminués. Levez le pied quelques semaines.', true);
  if (p.rang >= 3 && e.joueur.debutPremierPlan < 0) e.joueur.debutPremierPlan = e.semaine;
  // Promotions proposées par le parti.
  if (!P.actif || e.joueur.parti < 0) return; const es = estime(e); const dejaMsg = e.inbox.some(m => m.action?.type === 'promotion' && m.repondu === undefined);
  if (!dejaMsg && e.semaine % 4 === 2) {
    if (p.rang === 0 && es >= 12) message(e, ctx, 'carriere', 'On vous propose une section', `Le délégué départemental vous propose de devenir responsable de la section de ${d.zones[p.zone].nom}.`, true, { choix: [{ t: 'Accepter' }, { t: 'Refuser' }], action: { type: 'promotion', data: { poste: 'section' } } });
    else if (p.rang === 1 && es >= 30 && P.delegues[p.dept] !== p.id) { const del = P.delegues[p.dept] >= 0 ? e.persos[P.delegues[p.dept]] : null; if (!del || (del.attrs[A.organisation] + del.attrs[A.terrain]) < (p.attrs[A.organisation] + p.attrs[A.terrain]) + es / 10) message(e, ctx, 'carriere', 'La fédération vous tend les bras', `La direction nationale vous propose le poste de délégué départemental ${d.depts[p.dept].nom}${del ? `, à la place de ${nomComplet(del)}` : ''}. Vous gérerez le terrain et les investitures locales.`, true, { choix: [{ t: 'Accepter' }, { t: 'Refuser' }], action: { type: 'promotion', data: { poste: 'delegue' } } }); }
    else if (p.rang >= 2 && es >= 60 && !Object.values(P.bureau).includes(p.id) && P.chef !== p.id) { const postes = Object.keys(P.bureau).filter(k => P.bureau[k] < 0 || e.persos[P.bureau[k]].notoriete < p.notoriete); if (postes.length) { const k = postes[rng.int(0, postes.length - 1)]; message(e, ctx, 'carriere', 'Entrée au bureau national', `Le président du parti vous propose un poste à la direction nationale : ${LIB_POSTE[k]}.`, true, { choix: [{ t: 'Accepter' }, { t: 'Refuser' }], action: { type: 'promotion', data: { poste: k } } }); } }
  }
  // Rappel avant chaque scrutin : demander une investiture.
  for (const ech of e.calendrier) if (!ech.fait1 && e.semaine === ech.s1 - DUREE_CAMPAGNE[ech.type] - 3 && ech.type !== 'senatoriales') message(e, ctx, 'carriere', `Investitures : ${NOM_SCRUTIN[ech.type].toLowerCase()}`, `Les investitures se décident maintenant. Vous pouvez demander la vôtre dans l'écran Campagne. Votre estime dans le parti : ${Math.round(es)}.`, false);
  // Fin de carrière.
  if (annee(e.semaine) - p.naissance >= 80) e.joueur.fin = { type: 'fin', titre: 'Fin de carrière', texte: 'À 80 ans, vous vous retirez de la vie publique.' };
  if (p.statut === 'ineligible' && !e.joueur.fin) e.joueur.fin = { type: 'defaite', titre: 'Inéligibilité', texte: 'Déclaré inéligible, vous quittez la vie politique.' };
  if (e.joueur.aQuitte > 0 && p.parti < 0 && e.semaine - e.joueur.aQuitte > 30 && !p.mandats.length) e.joueur.fin = { type: 'defaite', titre: 'Exclusion sans rebond', texte: 'Sans parti ni mandat depuis des mois, votre carrière s\'arrête là.' };
}
export const LIB_POSTE: Record<string, string> = { tresorier: 'trésorier', porte_parole: 'porte-parole', organisation: 'secrétaire à l\'organisation', elections: 'secrétaire aux élections', projet: 'secrétaire au projet', jeunes: 'responsable du mouvement jeunes', chef: 'président du parti', delegue: 'délégué départemental', section: 'responsable de section', jeune: 'mouvement jeunes' };

export function promouvoir(e: Etat, d: Donnees, poste: string): string {
  const p = e.persos[e.joueur.perso]; const P = e.partis[e.joueur.parti];
  if (poste === 'section') { p.rang = 1; p.postes.push('section'); ajouterHist(e, p, `Responsable de la section ${P.sigle} de ${d.zones[p.zone].nom}`); return 'Vous prenez la tête de la section.'; }
  if (poste === 'delegue') { const a = P.delegues[p.dept]; if (a >= 0) { e.persos[a].postes = e.persos[a].postes.filter(x => x !== 'delegue'); e.persos[a].moral -= 15; } P.delegues[p.dept] = p.id; p.postes.push('delegue'); if (p.rang < 2) p.rang = 2; ajouterHist(e, p, `Délégué départemental ${P.sigle} (${d.depts[p.dept].nom})`); return 'Vous dirigez désormais la fédération. Le terrain du département est entre vos mains.'; }
  const a = P.bureau[poste]; if (a >= 0) { e.persos[a].postes = e.persos[a].postes.filter(x => x !== poste); } P.bureau[poste] = p.id; p.postes.push(poste); if (p.rang < 3) p.rang = 3; ajouterHist(e, p, `Entre au bureau national de ${P.sigle} (${LIB_POSTE[poste]})`); return `Vous êtes ${LIB_POSTE[poste]} du parti.`;
}
// Demande d'investiture : acceptée d'office si le joueur décide des investitures, sinon selon son estime, son rang et la concurrence.
export function demanderInvestiture(e: Etat, d: Donnees, rng: Rng, type: Scrutin, place: 'tete' | 'liste', bonus = 0): string {
  const p = e.persos[e.joueur.perso]; const P = e.partis[e.joueur.parti]; if (!P.actif) return 'Vous n\'avez pas de parti.'; const es = estime(e); const dr = droits(e);
  const z = d.zones[p.zone]; let uid = ''; let besoin = 0; let lib = '';
  if (type === 'municipales') { const v = d.villes.find(x => x.zones.includes(p.zone) && x.plm !== 1); if (!v) return 'Votre commune est trop petite pour être simulée : installez-vous dans une ville de plus de 10 000 habitants.'; uid = place === 'tete' ? v.id : 'liste'; besoin = place === 'tete' ? 18 + Math.log10(v.pop) * 6 : 6; lib = place === 'tete' ? `tête de liste à ${v.nom}` : `une place sur la liste à ${v.nom}`; if (place === 'liste') e.investitures.municipales = { ...(e.investitures.municipales ?? {}), [`liste:${P.idx}`]: p.id, [`listeVille:${P.idx}`]: v.idx }; }
  else if (type === 'departementales') { uid = z.id; besoin = 16; lib = `le canton de ${z.nom}`; }
  else if (type === 'legislatives') { const ci = z.circos.slice().sort((a, b) => b[1] - a[1])[0][0]; uid = d.circos[ci].id; besoin = 38; lib = `la circonscription ${d.circos[ci].nomCourt}`; const s = e.assemblee[ci]; if (s && s.parti === P.idx && s.perso !== p.id && s.perso >= 0) besoin += 25; }
  else if (type === 'regionales') { uid = place === 'tete' ? 'R' + d.depts[p.dept].region : 'liste'; besoin = place === 'tete' ? 70 : 22; lib = place === 'tete' ? 'la tête de liste régionale' : 'une place éligible sur la liste régionale'; }
  else if (type === 'europeennes') { uid = place === 'tete' ? 'EU' : 'liste'; besoin = place === 'tete' ? 90 : 55; lib = place === 'tete' ? 'la tête de liste européenne' : 'une place éligible sur la liste européenne'; }
  else return 'Pas d\'investiture individuelle pour ce scrutin.';
  const score = es + p.rang * 6 + p.notoriete * 0.3 + rng.gauss() * 5 + bonus; if (!dr.investitures && !(dr.terrain !== 'tous' && (dr.terrain as number[]).includes(p.dept) && ['municipales', 'departementales'].includes(type)) && score < besoin) { plusEstime(e, -1); return `La commission d'investiture refuse ${lib}. Il vous manque du poids dans le parti (estime ${Math.round(es)}, il en faudrait environ ${Math.round(besoin)}).`; }
  e.investitures[type] = { ...(e.investitures[type] ?? {}), [`${uid}:${P.idx}`]: p.id }; ajouterHist(e, p, `Investi par ${P.sigle} pour ${lib}`); return `Vous obtenez l'investiture pour ${lib}.`;
}
export function quitterParti(e: Etat, d: Donnees): string { const p = e.persos[e.joueur.perso]; const P = e.partis[e.joueur.parti]; liberer(e, p); p.parti = -1; e.joueur.aQuitte = e.semaine; e.joueur.pointsVictoire.estime = 0; e.joueur.trahisons++; ajouterHist(e, p, `Quitte ${P.sigle}`); for (const s of e.assemblee) if (s.perso === p.id) s.parti = -1; return `Vous quittez ${P.nom}. Vous gardez vos mandats, sans étiquette. Il faudra rebondir vite.`; }
export function rejoindreParti(e: Etat, d: Donnees, rng: Rng, vers: number, invite = false): string {
  const p = e.persos[e.joueur.perso]; const Q = e.partis[vers]; if (!Q.actif) return 'Ce parti n\'existe pas.'; let dist = 0; for (let i = 0; i < 10; i++) dist += Math.abs(p.axes[i] - Q.axes[i]);
  if (!invite && p.notoriete < 15 && p.mandats.length === 0 && dist > 22) return `${Q.sigle} ne voit pas l'intérêt de votre ralliement pour l'instant.`;
  if (p.parti >= 0) { liberer(e, p); e.joueur.trahisons++; } p.parti = vers; e.joueur.parti = vers; e.joueur.aQuitte = 0; e.joueur.pointsVictoire.estime = clamp(p.notoriete * 0.3 + p.mandats.length * 6, 0, 40); p.axes = p.axes.map((x, i) => Math.round((x + Q.axes[i]) / 2));
  for (const s of e.assemblee) if (s.perso === p.id) s.parti = vers; for (const m of e.mairies) if (m.maire === p.id) m.parti = vers; ajouterHist(e, p, `Rejoint ${Q.sigle}`); journal(e, `${nomComplet(p)} rejoint ${Q.sigle}`); return `Vous rejoignez ${Q.nom}. Votre estime repart de ${Math.round(estime(e))}.`;
}
export function fonderParti(e: Etat, d: Donnees, nom: string): string {
  const p = e.persos[e.joueur.perso]; const N = e.partis.find(x => !x.actif); if (!N) return 'Trop de partis existent déjà : rejoignez-en un.'; if (p.notoriete < 25 && !p.mandats.some(m => ['depute', 'senateur', 'maire', 'eurodepute', 'president_region', 'president_dept'].includes(m.type))) return 'Il faut une notoriété de 25 ou un mandat important pour lancer un parti.';
  const origine = e.partis[p.parti >= 0 ? p.parti : e.joueur.parti]; if (p.parti >= 0) { liberer(e, p); e.joueur.trahisons++; }
  activerParti(e, d, N, origine, nom || 'Nouveau parti', -1, 0, clamp(p.notoriete / 250, 0.03, 0.3)); N.axes = p.axes.slice(); N.axes0 = p.axes.slice(); N.chef = p.id; p.parti = N.idx; p.postes = ['chef']; p.rang = Math.max(p.rang, 3); e.joueur.parti = N.idx; e.joueur.aQuitte = 0;
  N.adherents = 300 + p.notoriete * 60; N.adhDept = d.depts.map((_, i) => (i === p.dept ? 0.3 : 0.7 / d.depts.length) * N.adherents); N.tresorerie = 80000 + p.notoriete * 4000; N.notoriete = N.notoriete0 = clamp(p.notoriete * 0.8, 5, 70);
  for (const s of e.assemblee) if (s.perso === p.id) s.parti = N.idx; for (const m of e.mairies) if (m.maire === p.id) m.parti = N.idx; ajouterHist(e, p, `Fonde ${N.nom}`); journal(e, `${nomComplet(p)} fonde ${N.nom}`);
  return `${N.nom} est né. Vous en êtes le président : toutes les décisions du parti vous reviennent.`;
}
// Briguer la présidence du parti : provoque un vote des adhérents contre le chef en place.
export function briguer(e: Etat, d: Donnees, rng: Rng, ctx: Ctx): string {
  const p = e.persos[e.joueur.perso]; const P = e.partis[e.joueur.parti]; if (P.chef === p.id) return 'Vous êtes déjà président du parti.'; if (p.rang < 3 || estime(e) < 50) return 'Il faut être une figure nationale du parti (rang 3) avec une estime d\'au moins 50.';
  const chef = P.chef >= 0 ? e.persos[P.chef] : null; const moi = estime(e) * 0.5 + p.notoriete * 0.5 + attr(d, p, A.charisme) * 2 + attr(d, p, A.negociation) + rng.gauss() * 8; const lui = chef ? 40 + chef.notoriete * 0.5 + chef.attrs[A.charisme] * 2 + P.dynamique * 0.8 + rng.gauss() * 8 : 0;
  if (moi > lui) { if (chef) { chef.postes = chef.postes.filter(x => x !== 'chef'); chef.moral -= 25; ajouterHist(e, chef, `Battu par ${nomComplet(p)} pour la présidence de ${P.sigle}`); } P.chef = p.id; p.postes.push('chef'); p.rang = Math.max(p.rang, 4); P.unite = clamp(P.unite - 6, 0, 100); ajouterHist(e, p, `Élu président de ${P.sigle}`); journal(e, `${nomComplet(p)} prend la tête de ${P.sigle}`); return `Les adhérents vous élisent à la tête de ${P.nom}. Vous dirigez désormais tout le parti.`; }
  plusEstime(e, -15); p.moral = clamp(p.moral - 15, 0, 100); P.unite = clamp(P.unite - 4, 0, 100); void resoudreCongres; void rel; return 'Vous êtes battu. La direction s\'en souviendra : votre estime recule.';
}
export type { Perso };
