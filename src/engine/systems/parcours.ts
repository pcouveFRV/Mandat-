// Parcours personnel du joueur en mode Carrière : fiche modifiable, entraînement, métier et argent, ambition,
// réputation, bataille d'investiture (dossier, campagne interne, oral devant la commission), carnet de contacts et suivi.
// Les contacts avec qui on peut discuter sont des personnages générés.
import type { Donnees, Etat, Ctx, Parcours, Contact, Dossier, Perso, Scrutin } from '../types';
import { A } from '../types';
import { Rng, clamp } from '../rng';
import { message } from './inbox';
import { nomAleatoire, nomComplet, attr } from './personnages';
import { demanderInvestiture, estime } from './carriere';
import { equipeDe } from './equipe';
import { jourVote } from '../calendrier';

export const NOMS_ATTRS = ['Éloquence', 'Débat', 'Médias', 'Réseaux sociaux', 'Terrain', 'Dossiers', 'Gestion', 'Négociation', 'Organisation', 'Ambition', 'Loyauté', 'Sang-froid', 'Discipline', 'Courage', 'Opportunisme', 'Rancune', 'Résistance', 'Énergie', 'Charisme', 'Réseau', 'Ancrage'];
const ENTRAINABLES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 11, 18, 19, 20];
export const METIERS: Record<string, { nom: string; revenu: number; desc: string; rendement: number }> = {
  plein: { nom: 'Emploi à plein temps', revenu: 420, desc: 'Un salaire correct, mais peu de temps : votre activité politique de la semaine rend moins.', rendement: 0.8 },
  partiel: { nom: 'Emploi à mi-temps', revenu: 230, desc: 'Moins d\'argent, plus de disponibilité.', rendement: 1 },
  aucun: { nom: 'Tout pour la politique', revenu: 0, desc: 'Vous vivez de vos indemnités d\'élu, ou de vos économies. Disponibilité totale.', rendement: 1.15 },
};
const INDEMNITES: Record<string, number> = { maire: 650, adjoint: 180, conseiller_municipal: 0, depute: 1400, senateur: 1400, eurodepute: 1500, conseiller_dept: 420, president_dept: 1100, conseiller_reg: 450, president_region: 1100, president: 3000, premier_ministre: 3000 };
const TRAIN_VIE = 330; // dépenses courantes par semaine
export const AMBITIONS: Record<string, { nom: string; etapes: [string, (e: Etat, p: Perso) => boolean][] }> = {
  maire: { nom: 'Devenir maire de ma ville', etapes: [['Prendre la tête d\'une section', (e, p) => p.rang >= 1], ['Entrer au conseil municipal', (e, p) => p.mandats.some(m => ['conseiller_municipal', 'adjoint', 'maire'].includes(m.type))], ['Obtenir la tête de liste', (e, p) => investi(e, p, 'municipales') || p.mandats.some(m => m.type === 'maire')], ['Être élu maire', (e, p) => p.mandats.some(m => m.type === 'maire')]] },
  depute: { nom: 'Entrer à l\'Assemblée nationale', etapes: [['Prendre la tête d\'une section', (e, p) => p.rang >= 1], ['Se faire un nom localement (notoriété 15)', (e, p) => p.notoriete >= 15], ['Obtenir l\'investiture aux législatives', (e, p) => investi(e, p, 'legislatives') || p.mandats.some(m => m.type === 'depute')], ['Être élu député', (e, p) => p.mandats.some(m => m.type === 'depute')]] },
  chef: { nom: 'Prendre la tête du parti', etapes: [['Devenir cadre départemental', (e, p) => p.rang >= 2], ['Entrer au bureau national', (e, p) => p.rang >= 3], ['Gagner l\'estime du parti (50)', (e) => estime(e) >= 50], ['Être élu président du parti', (e, p) => e.partis[p.parti]?.chef === p.id]] },
  president: { nom: 'Conquérir l\'Élysée', etapes: [['Devenir une figure nationale', (e, p) => p.rang >= 3], ['Être connu de tous (notoriété 60)', (e, p) => p.notoriete >= 60], ['Diriger son parti', (e, p) => e.partis[p.parti]?.chef === p.id], ['Être élu président de la République', (e, p) => p.mandats.some(m => m.type === 'president')]] },
};
const investi = (e: Etat, p: Perso, type: string) => Object.values((e.investitures as any)[type] ?? {}).includes(p.id);
const moiDe = (e: Etat) => e.joueur.mode === 'carriere' ? e.persos[e.joueur.perso] : null;

export function parcoursDe(e: Etat, d: Donnees): Parcours {
  if (e.parcours) return e.parcours; const p = moiDe(e); const rng = new Rng((e.graine ^ 0x51ed27) >>> 0);
  const g: Parcours = { portrait: [rng.int(0, 3), rng.int(0, 4), rng.int(0, 4), 0, 0, rng.int(0, 3)], bio: '', slogan: '', style: 'pedagogue', entrainement: [A.terrain, A.eloquence, A.reseau], metier: 'plein', argent: 1500, ambition: 'maire', ambitionFaite: {}, promesses: [], dossier: null, contacts: [], suivis: [], photos: {}, etapesVues: 0 };
  if (p) {
    const P = e.partis[p.parti]; const z = d.zones[p.zone]; const nv = (role: string, qui: string, age: [number, number], rel: number): Contact => { const sexe = rng.chance(0.45) ? 'F' : 'M'; const a = rng.int(age[0], age[1]); const n = nomAleatoire(d, rng, sexe, 2026 - a, z.deptIdx); return { id: g.contacts.length + 1, nom: n.nom, prenom: n.prenom, sexe, age: a, role, qui, relation: rel, parle: -1, dette: 0, caractere: rng.pick(['direct', 'prudent', 'chaleureux', 'calculateur', 'bourru', 'ironique']) }; };
    g.contacts.push(nv('mentor', `Ancien élu ${P?.sigle ?? ''} du secteur, il vous a repéré`, [55, 74], 62));
    g.contacts.push(nv('allie', 'Militant de votre génération, entré au parti en même temps que vous', [20, 34], 58));
    g.contacts.push(nv('rival', 'Vise les mêmes places que vous dans la fédération', [24, 45], 30));
    g.contacts.push(nv('journaliste', `Suit la politique locale pour le quotidien de ${z.ville ?? z.nom}`, [28, 58], 40));
    g.contacts.push(nv('cadre', `Secrétaire départemental adjoint de ${P?.sigle ?? 'votre parti'}`, [38, 62], 45));
  }
  e.parcours = g; return g;
}
export function etapesAmbition(e: Etat, d: Donnees): { nom: string; fait: boolean }[] { const p = moiDe(e); const g = parcoursDe(e, d); const a = AMBITIONS[g.ambition] ?? AMBITIONS.maire; return a.etapes.map(([nom, f]) => ({ nom, fait: !!p && f(e, p) })); }

// ---------- Investiture ----------
const QUESTIONS: { t: string; options: { t: string; attr: number; dif: number }[] }[] = [
  { t: 'On nous dit qu\'on ne vous voit pas assez sur le terrain. Que répondez-vous ?', options: [{ t: 'Citer vos sorties et vos contacts, chiffres à l\'appui', attr: A.terrain, dif: 0 }, { t: 'Renvoyer la question : qui d\'autre tient les marchés chaque samedi ?', attr: A.eloquence, dif: 0.15 }, { t: 'Reconnaître des manques et présenter un plan', attr: A.organisation, dif: 0.05 }] },
  { t: 'Si le parti signe un accord national et vous retire cette candidature, que faites-vous ?', options: [{ t: 'Je me range derrière la décision', attr: A.loyaute, dif: -0.1 }, { t: 'Je demanderai une compensation pour mon équipe', attr: A.negociation, dif: 0.1 }, { t: 'Je ne peux rien promettre à mes électeurs à leur place', attr: A.charisme, dif: 0.25 }] },
  { t: 'Votre priorité pour ce territoire, en une phrase ?', options: [{ t: 'Une mesure précise, avec son coût', attr: A.dossiers, dif: 0.05 }, { t: 'Une histoire vécue sur le terrain', attr: A.charisme, dif: 0.1 }, { t: 'La ligne nationale du parti, sans en dévier', attr: A.loyaute, dif: -0.05 }] },
  { t: 'Y a-t-il dans votre parcours quelque chose que la commission devrait savoir ?', options: [{ t: 'Tout dire, y compris ce qui fâche', attr: A.courage, dif: 0.05 }, { t: 'S\'en tenir à l\'essentiel, calmement', attr: A.sangfroid, dif: 0 }, { t: 'Retourner la question avec un trait d\'humour', attr: A.eloquence, dif: 0.2 }] },
];
const ACTIONS_DOSSIER: Record<string, { nom: string; attr: number; gain: number; desc: string }> = {
  tournee: { nom: 'Faire la tournée des sections', attr: A.terrain, gain: 5, desc: 'Aller voir les militants un par un. Lent, solide.' },
  appels: { nom: 'Passer vos coups de fil', attr: A.reseau, gain: 4, desc: 'Cadres, élus, anciens. Dépend de votre réseau.' },
  note: { nom: 'Rédiger une note sur le territoire', attr: A.dossiers, gain: 4, desc: 'Montrer que vous connaissez vos dossiers.' },
};
const PROMESSES: Record<string, { nom: string; gain: number; rappel: string }> = {
  courant: { nom: 'Promettre votre voix au prochain congrès à un courant', gain: 11, rappel: 'Le courant qui vous avait soutenu vous rappelle votre promesse de vote au congrès.' },
  place: { nom: 'Promettre une place sur votre liste à un cadre', gain: 9, rappel: 'Le cadre à qui vous aviez promis une place sur votre liste vient réclamer son dû.' },
  renvoi: { nom: 'Promettre de soutenir votre rival la prochaine fois', gain: 8, rappel: 'Votre ancien rival vous rappelle que vous lui aviez promis votre soutien pour la prochaine investiture.' },
};
export function ouvrirDossier(e: Etat, d: Donnees, rng: Rng, type: Scrutin, place: 'tete' | 'liste'): { ok: boolean; texte: string } {
  const g = parcoursDe(e, d); const p = moiDe(e); if (!p) return { ok: false, texte: 'Réservé au mode Carrière.' }; if (g.dossier && !g.dossier.verdict) return { ok: false, texte: 'Vous avez déjà un dossier en cours.' };
  const ech = e.calendrier.find(k => k.type === type && !k.fait1 && k.s1 > e.semaine); if (!ech) return { ok: false, texte: 'Aucun scrutin de ce type au calendrier.' }; const reste = ech.s1 - e.semaine; if (reste > 60) return { ok: false, texte: 'Trop tôt : les investitures s\'ouvrent environ un an avant le scrutin.' }; if (reste < 6) return { ok: false, texte: 'Trop tard : les investitures sont closes.' };
  if (investi(e, p, type)) return { ok: false, texte: 'Vous êtes déjà investi pour ce scrutin.' };
  const z = d.zones[p.zone]; const commission = e.semaine + clamp(Math.round(reste / 3), 3, 8); const nbR = rng.int(1, 3); const rivaux = [];
  for (let k = 0; k < nbR; k++) { const sexe = rng.chance(0.4) ? 'F' : 'M'; const n = nomAleatoire(d, rng, sexe, 2026 - rng.int(30, 60), z.deptIdx); rivaux.push({ nom: `${n.prenom} ${n.nom}`, profil: rng.pick(['élu sortant du secteur', 'proche de la direction nationale', 'figure militante locale', 'parachuté par le siège', 'candidat du courant minoritaire']), score: rng.int(10, 34) + (place === 'tete' ? 6 : 0) }); }
  const lib = ({ municipales: place === 'tete' ? 'tête de liste aux municipales' : 'une place sur la liste municipale', departementales: 'candidat aux départementales', legislatives: 'candidat aux législatives', regionales: place === 'tete' ? 'tête de liste régionale' : 'une place sur la liste régionale', europeennes: place === 'tete' ? 'tête de liste européenne' : 'une place sur la liste européenne' } as Record<string, string>)[type]; if (!lib) return { ok: false, texte: 'Pas d\'investiture individuelle pour ce scrutin.' };
  g.dossier = { type, place, lib, commission, scrutin: ech.s1, soutiens: 0, rivaux, fait: {}, promesses: [], oral: null, verdict: '', issue: '' };
  return { ok: true, texte: `Vous êtes officiellement candidat à l'investiture : ${lib}. La commission se réunit dans ${commission - e.semaine} semaines. ${nbR} autre${nbR > 1 ? 's' : ''} candidat${nbR > 1 ? 's sont' : ' est'} sur les rangs.` };
}
export function actionDossier(e: Etat, d: Donnees, rng: Rng, a: any): { ok: boolean; texte: string } {
  const g = parcoursDe(e, d); const p = moiDe(e); const D = g.dossier; const non = (t: string) => ({ ok: false, texte: t }), ok = (t = '') => ({ ok: true, texte: t }); if (!p) return non('Réservé au mode Carrière.');
  if (a.type === 'invDeclarer') return ouvrirDossier(e, d, rng, a.scrutin, a.place ?? 'tete');
  if (!D) return non('Aucun dossier en cours.');
  if (a.type === 'invFermer') { if (!D.verdict) return non('La commission n\'a pas encore tranché.'); g.dossier = null; return ok(); }
  if (D.verdict) return non('La commission a déjà tranché.');
  if (a.type === 'invAgir') { const X = ACTIONS_DOSSIER[a.quoi]; if (!X) return non('Action inconnue.'); if (D.oral) return non('L\'oral a commencé.'); if (D.fait[a.quoi] === e.semaine) return non('Déjà fait cette semaine.'); if (Object.values(D.fait).filter(s => s === e.semaine).length >= 2) return non('Deux démarches par semaine, pas plus : vous avez aussi une vie.');
    D.fait[a.quoi] = e.semaine; const q = attr(d, p, X.attr); const gain = Math.max(1, Math.round(X.gain * (0.5 + q / 20) * (METIERS[g.metier]?.rendement ?? 1) + rng.gauss())); D.soutiens = clamp(D.soutiens + gain, 0, 100); p.forme = clamp(p.forme - 4, 0, 100); for (const r of D.rivaux) r.score = clamp(r.score + rng.int(0, 2), 0, 100);
    return ok(`${X.nom} : votre dossier progresse (+${gain}). Soutiens : ${D.soutiens}.`); }
  if (a.type === 'invPromettre') { const X = PROMESSES[a.quoi]; if (!X) return non('Promesse inconnue.'); if (D.oral) return non('L\'oral a commencé.'); if (D.promesses.includes(a.quoi)) return non('Vous avez déjà fait cette promesse.'); D.promesses.push(a.quoi); D.soutiens = clamp(D.soutiens + X.gain, 0, 100); g.promesses.push({ s: e.semaine, a: a.quoi, t: X.nom, rappel: e.semaine + rng.int(40, 110) }); return ok(`Promesse faite. Soutiens : ${D.soutiens} (+${X.gain}). On vous la rappellera.`); }
  if (a.type === 'invSoutien') { const c = g.contacts.find(x => x.id === +a.contact); if (!c) return non('Contact introuvable.'); if (D.oral) return non('L\'oral a commencé.'); if (D.fait['c' + c.id] !== undefined) return non(`${c.prenom} s'est déjà prononcé sur votre candidature.`); D.fait['c' + c.id] = e.semaine;
    if (c.role === 'rival') { c.relation = clamp(c.relation - 5, 0, 100); return ok(`${c.prenom} ${c.nom} sourit. « Tu me demandes vraiment ça, à moi ? »`); }
    if (c.relation < 45 && c.dette <= 0) { c.relation = clamp(c.relation - 3, 0, 100); return ok(`${c.prenom} ${c.nom} reste évasif. Vous n'êtes pas assez proches, et il ne vous doit rien.`); }
    const gain = c.role === 'mentor' ? 10 : c.role === 'cadre' ? 9 : c.role === 'journaliste' ? 4 : 5; D.soutiens = clamp(D.soutiens + gain, 0, 100); c.dette -= 1; return ok(`${c.prenom} ${c.nom} ${c.role === 'journaliste' ? 'glisse un mot favorable dans son prochain article' : 'passe deux coups de fil pour vous'} (+${gain}). Vous lui devez un service.`); }
  if (a.type === 'invOral') { if (e.semaine < D.commission) return non(`La commission se réunit dans ${D.commission - e.semaine} semaine(s).`); if (D.oral) return non('L\'oral est en cours.'); D.oral = { i: 0, score: 0, journal: [], fini: false }; return ok(); }
  if (a.type === 'invRepondre') { const O = D.oral; if (!O || O.fini) return non('Pas d\'oral en cours.'); const Q = QUESTIONS[O.i]; const o = Q.options[clamp(+a.choix, 0, 2)]; const q = attr(d, p, o.attr); const mentor = g.contacts.find(c => c.role === 'mentor'); const pr = clamp(0.4 + (q - 10) * 0.05 + ((mentor?.relation ?? 0) > 65 ? 0.05 : 0) - o.dif, 0.1, 0.92); const reussi = rng.chance(pr); const pts = reussi ? Math.round(6 + o.dif * 22) : -4;
    O.score += pts; O.journal.push(`${Q.t} ${reussi ? 'La commission hoche la tête.' : 'Silence gêné autour de la table.'}`); O.i++; if (O.i >= QUESTIONS.length) { O.fini = true; return verdict(e, d, rng, g, D, p); } return ok(reussi ? 'Bonne réponse. On prend des notes.' : 'La réponse tombe à plat.'); }
  return non('Action inconnue.');
}
function verdict(e: Etat, d: Donnees, rng: Rng, g: Parcours, D: Dossier, p: Perso): { ok: boolean; texte: string } {
  const total = D.soutiens * 0.55 + (D.oral?.score ?? 0) * 1.3; const meilleur = D.rivaux.reduce((m, r) => Math.max(m, r.score + rng.int(-4, 6)), 0); const bonus = total - meilleur * 0.6;
  const t = demanderInvestiture(e, d, rng, D.type, D.place, bonus); const gagne = t.startsWith('Vous obtenez');
  if (gagne) { D.issue = 'investi'; D.verdict = `${t} Dossier : ${D.soutiens} soutiens, oral ${D.oral!.score >= 12 ? 'réussi' : D.oral!.score >= 0 ? 'correct' : 'raté'}.`; }
  else if (bonus > -8 && D.type !== 'municipales') { D.issue = 'suppleant'; D.verdict = `La commission vous préfère ${D.rivaux.sort((a, b) => b.score - a.score)[0]?.nom ?? 'un autre candidat'}, de peu. On vous propose d'être suppléant. Vous gagnez en visibilité dans le parti.`; e.joueur.pointsVictoire.estime = clamp(estime(e) + 4, 0, 100); p.notoriete = clamp(p.notoriete + 1, 0, 100); }
  else { D.issue = 'ecarte'; D.verdict = `La commission investit ${D.rivaux.sort((a, b) => b.score - a.score)[0]?.nom ?? 'un autre candidat'}. Votre dossier (${D.soutiens} soutiens) n'a pas suffi${D.oral!.score < 0 ? ', et l\'oral vous a coûté cher' : ''}.`; p.moral = clamp(p.moral - 10, 0, 100); }
  return { ok: true, texte: D.verdict };
}

// ---------- Contacts ----------
export function parlerContact(e: Etat, d: Donnees, rng: Rng, id: number, sujet: string): { ok: boolean; texte: string } {
  const g = parcoursDe(e, d); const p = moiDe(e); const c = g.contacts.find(x => x.id === id); if (!c || !p) return { ok: false, texte: 'Contact introuvable.' }; if (c.parle === e.semaine) return { ok: false, texte: `Vous avez déjà vu ${c.prenom} cette semaine.` }; c.parle = e.semaine;
  const et = etapesAmbition(e, d); const suite = et.find(x => !x.fait); const eq = equipeDe(e, d); let t = '';
  if (sujet === 'libre') { c.relation = clamp(c.relation + 2, 0, 100); return { ok: true, texte: '' }; }
  if (sujet === 'nouvelles') { c.relation = clamp(c.relation + (c.role === 'rival' ? 1 : 3), 0, 100); t = c.role === 'rival' ? 'Ça va. Je travaille, je ne compte pas mes heures. Et toi, toujours aussi discret ?' : c.role === 'journaliste' ? 'Semaine chargée. Si tu as quelque chose d\'intéressant, je suis preneur. Sinon, je te vois au conseil.' : c.caractere === 'bourru' ? 'On fait aller. Tu ne viens pas me voir pour parler de la pluie, j\'espère.' : 'Content de te voir. Ça fait du bien, quelqu\'un qui prend des nouvelles sans rien demander.'; }
  else if (sujet === 'conseil') { c.relation = clamp(c.relation + 1, 0, 100);
    t = c.role === 'mentor' ? (g.argent < 300 ? 'Avant de penser à la suite, règle tes fins de mois. Un candidat qui a des soucis d\'argent fait de mauvais choix.' : eq.membres.some(m => m.fatigue > 70) ? 'Ton équipe est sur les rotules. Les campagnes se gagnent avec des gens qui ont envie de revenir le lendemain.' : suite ? `Ton prochain cap, c'est clair : ${suite.nom.charAt(0).toLowerCase() + suite.nom.slice(1)}. Tout le reste est secondaire.` : 'Tu as fait ce que tu t\'étais fixé. Maintenant, choisis une ambition plus haute, ou tu vas t\'endormir.')
      : c.role === 'cadre' ? (p.rang < 2 ? 'À la fédération, on regarde deux choses : qui tient son secteur, et qui ne fait pas de vagues. Occupe-toi du premier point.' : 'Tu es dans les radars du national maintenant. Chaque mot compte, surtout sur Agora.')
      : c.role === 'journaliste' ? 'Tu veux un conseil de journaliste ? Dis des choses précises. Les généralités, on en reçoit quarante par jour.' : c.role === 'rival' ? 'Un conseil ? Ne te présente pas contre moi.' : 'Honnêtement, tu devrais te montrer plus. Les gens votent pour ceux qu\'ils ont déjà vus.'; }
  else if (sujet === 'rumeur') { const D = g.dossier; c.relation = clamp(c.relation + 1, 0, 100);
    t = D && !D.verdict && D.rivaux.length ? `Pour l'investiture, méfie-toi de ${D.rivaux.slice().sort((a, b) => b.score - a.score)[0].nom}. ${c.role === 'rival' ? 'Enfin, je dis ça, je ne dis rien.' : 'Il a des appuis que tu ne vois pas.'}` : c.role === 'journaliste' ? `En ce moment, tout le monde me parle de ${(e.agora?.tendances[0]?.sujet ?? 'la rentrée').toLowerCase()}. Si tu as une position claire, c'est le moment.` : eq.quartiers.length ? `Il paraît que ça bouge à ${eq.quartiers.slice().sort((a, b) => a.ancrage - b.ancrage)[0].nom}. On ne vous y voit pas beaucoup, et les autres en profitent.` : 'Rien de neuf sous le soleil.'; }
  else if (sujet === 'service') {
    if (c.role === 'journaliste') { if (c.relation >= 50) { p.notoriete = clamp(p.notoriete + 1.2, 0, 100); c.relation = clamp(c.relation - 6, 0, 100); c.dette -= 1; t = 'D\'accord pour un portrait dans l\'édition de samedi. Mais la prochaine fois, c\'est toi qui me donnes une info.'; } else { c.relation = clamp(c.relation - 3, 0, 100); t = 'Un portrait ? Il me faut une raison de l\'écrire. Fais quelque chose, et on en reparle.'; } }
    else if (c.role === 'rival') { c.relation = clamp(c.relation - 4, 0, 100); t = 'Tu ne manques pas d\'air.'; }
    else if (c.relation >= 50 || c.dette > 0) { e.joueur.pointsVictoire.estime = clamp(estime(e) + 1.5, 0, 100); c.relation = clamp(c.relation - 5, 0, 100); c.dette -= 1; t = 'Je vais parler de toi à deux ou trois personnes qui comptent. Tu me revaudras ça.'; }
    else { c.relation = clamp(c.relation - 3, 0, 100); t = 'On ne se connaît pas encore assez pour que je m\'engage pour toi.'; } }
  else if (sujet === 'rendre') { if (c.dette >= 0) { t = 'Tu ne me dois rien. Mais c\'est gentil.'; c.relation = clamp(c.relation + 2, 0, 100); } else { c.dette += 1; c.relation = clamp(c.relation + 8, 0, 100); p.forme = clamp(p.forme - 6, 0, 100); t = 'Merci. On n\'oublie pas ceux qui tiennent parole.'; } }
  return { ok: true, texte: t };
}
const photo = (p: Perso) => `${p.rang}|${p.parti}|${p.statut}|${p.mandats.map(m => m.type).sort().join(',')}`;
const LIB_MANDAT: Record<string, string> = { maire: 'maire', adjoint: 'adjoint au maire', conseiller_municipal: 'conseiller municipal', depute: 'député', senateur: 'sénateur', eurodepute: 'député européen', conseiller_dept: 'conseiller départemental', president_dept: 'président de département', conseiller_reg: 'conseiller régional', president_region: 'président de région', president: 'président de la République', premier_ministre: 'Premier ministre' };

// ---------- Tour hebdomadaire ----------
export function tourParcours(e: Etat, d: Donnees, rng: Rng, ctx: Ctx) {
  const p = moiDe(e); if (!p) return; const g = parcoursDe(e, d); const actif = !e.options.auto;
  // Argent : salaire, indemnités d'élu, dépenses courantes.
  const ind = p.mandats.reduce((s, m) => s + (INDEMNITES[m.type] ?? 0), 0); g.argent += (METIERS[g.metier]?.revenu ?? 0) + ind - TRAIN_VIE;
  if (g.argent < 0) { p.moral = clamp(p.moral - 2, 0, 100); if (e.semaine % 4 === 0 && actif) message(e, ctx, 'carriere', 'Vos comptes sont dans le rouge', 'Vos dépenses dépassent vos revenus. Reprenez un emploi, ou décrochez un mandat indemnisé. Votre moral s\'en ressent.', false); }
  if (g.metier === 'plein') p.forme = clamp(p.forme - 1.5, 0, 100);
  // Entraînement : les attributs choisis progressent un peu plus vite.
  for (const i of g.entrainement) if (rng.chance(0.045 * (METIERS[g.metier]?.rendement ?? 1) * (p.forme / 80)) && p.attrs[i] < Math.min(20, p.pot + 2)) { p.attrs[i]++; if (actif) message(e, ctx, 'carriere', `Vous progressez : ${NOMS_ATTRS[i]}`, `Votre travail paie. ${NOMS_ATTRS[i]} : ${p.attrs[i]}.`, false); }
  // Ambition : chaque étape franchie est saluée.
  const et = etapesAmbition(e, d); const faites = et.filter(x => x.fait).length; if (faites > g.etapesVues && actif) { const x = et[faites - 1]; message(e, ctx, 'carriere', `Étape franchie : ${x.nom}`, faites === et.length ? `Vous avez atteint votre ambition : ${AMBITIONS[g.ambition].nom.toLowerCase()}. Choisissez-en une nouvelle dans l'écran Mon parcours.` : `Vous avancez vers votre ambition (${AMBITIONS[g.ambition].nom.toLowerCase()}). Prochaine étape : ${et[faites].nom.toLowerCase()}.`, faites === et.length); e.joueur.pointsVictoire.estime = clamp(estime(e) + 2, 0, 100); } g.etapesVues = faites;
  // Promesses : on vous les rappelle.
  for (const pr of g.promesses.filter(x => x.rappel <= e.semaine && !x.regle)) { pr.regle = true; const X = PROMESSES[pr.a]; if (actif) message(e, ctx, 'carriere', 'On vous rappelle une promesse', `${X?.rappel ?? 'Une promesse ancienne refait surface.'} Tenir parole coûte du capital, se dédire coûte de l'estime.`, true, { choix: [{ t: 'Tenir parole' }, { t: 'Gagner du temps' }, { t: 'Se dédire' }] } as any); else e.joueur.pointsVictoire.estime = clamp(estime(e) - 1, 0, 100); }
  // Investiture : la commission attend le joueur. Passé deux semaines, le dossier tombe.
  const D = g.dossier; if (D && !D.verdict) { for (const r of D.rivaux) if (rng.chance(0.5)) r.score = clamp(r.score + 1, 0, 100); if (e.semaine === D.commission && actif) message(e, ctx, 'carriere', 'La commission d\'investiture vous attend', `Votre oral pour ${D.lib} a lieu cette semaine. Rendez-vous dans l'écran Mon parcours.`, true); if (e.semaine > D.commission + 2 || !actif) { if (!D.oral) D.oral = { i: QUESTIONS.length, score: actif ? -6 : 4, journal: [actif ? 'Vous ne vous êtes pas présenté devant la commission.' : ''], fini: true }; verdict(e, d, rng, g, D, p); if (actif) message(e, ctx, 'carriere', 'Investiture : la commission a tranché', D.verdict, true); } }
  // Relations : elles s'érodent si on ne les entretient pas. Les contacts ont leur vie.
  for (const c of g.contacts) { if (e.semaine - c.parle > 10) c.relation = clamp(c.relation - 0.4, 0, 100); if (c.role === 'rival' && rng.chance(0.012) && actif) { message(e, ctx, 'carriere', `${c.prenom} ${c.nom} avance ses pions`, `Votre rival${c.sexe === 'F' ? 'e' : ''} a été vu${c.sexe === 'F' ? 'e' : ''} à la fédération trois fois ce mois-ci. On dit qu'${c.sexe === 'F' ? 'elle' : 'il'} prépare la prochaine investiture.`, false); } }
  // Suivi : prévenir quand un personnage suivi change de situation.
  for (const id of g.suivis.slice()) { const q = e.persos[id]; if (!q) continue; const now = photo(q); const avant = g.photos[id]; if (avant && avant !== now) { const [r0, pa0, st0, m0] = avant.split('|'); const nv = q.mandats.map(m => m.type).filter(t => !m0.split(',').includes(t)); const chg: string[] = []; if (+r0 < q.rang) chg.push('monte dans la hiérarchie de son parti'); if (+pa0 !== q.parti) chg.push(q.parti >= 0 ? `rejoint ${e.partis[q.parti].nom}` : 'quitte son parti'); if (nv.length) chg.push(`devient ${nv.map(t => LIB_MANDAT[t] ?? t).join(' et ')}`); if (st0 !== q.statut) chg.push(q.statut === 'actif' ? 'revient en politique' : 'se retire de la vie politique'); if (chg.length && actif) message(e, ctx, 'carriere', `Carnet : ${nomComplet(q)}`, `${nomComplet(q)} ${chg.join(', ')}.`, false); } g.photos[id] = now; }
}
export function actionParcours(e: Etat, d: Donnees, rng: Rng, a: any): { ok: boolean; texte: string } {
  const g = parcoursDe(e, d); const non = (t: string) => ({ ok: false, texte: t }), ok = (t = '') => ({ ok: true, texte: t }); const p = moiDe(e); if (!p) return non('Réservé au mode Carrière.');
  switch (a.type) {
    case 'profilPortrait': { const v = (a.portrait as number[] ?? []).slice(0, 6).map((x, i) => clamp(+x | 0, 0, i === 0 ? 99 : 5)); if (v.length !== 6) return non('Portrait invalide.'); g.portrait = v; return ok(); }
    case 'profilTexte': g.bio = String(a.bio ?? '').slice(0, 400); g.slogan = String(a.slogan ?? '').slice(0, 80); if (['pedagogue', 'offensif', 'humour', 'emotion', 'coulisses'].includes(a.style)) g.style = a.style; return ok('Fiche mise à jour.');
    case 'profilEntrainement': { const v = [...new Set((a.attrs as number[] ?? []).map(x => +x))].filter(x => ENTRAINABLES.includes(x)).slice(0, 3); if (!v.length) return non('Choisissez au moins un attribut.'); g.entrainement = v; return ok(`Vous travaillez : ${v.map(i => NOMS_ATTRS[i].toLowerCase()).join(', ')}.`); }
    case 'profilMetier': if (!METIERS[a.metier]) return non('Choix inconnu.'); if (g.metierChange !== undefined && e.semaine - g.metierChange < 12) return non('Vous venez de changer de situation. Attendez trois mois.'); g.metier = a.metier; g.metierChange = e.semaine; return ok(`${METIERS[a.metier].nom}. ${METIERS[a.metier].desc}`);
    case 'profilAmbition': if (!AMBITIONS[a.ambition]) return non('Ambition inconnue.'); g.ambition = a.ambition; g.etapesVues = etapesAmbition(e, d).filter(x => x.fait).length; return ok(`Nouvelle ambition : ${AMBITIONS[a.ambition].nom.toLowerCase()}.`);
    case 'suivre': { const q = e.persos[+a.id]; if (!q || q.id === p.id) return non('Personnage introuvable.'); if (g.suivis.includes(q.id)) { g.suivis = g.suivis.filter(x => x !== q.id); delete g.photos[q.id]; return ok(`Vous ne suivez plus ${nomComplet(q)}.`); } if (g.suivis.length >= 12) return non('Douze personnes suivies au plus.'); g.suivis.push(q.id); g.photos[q.id] = photo(q); return ok(`Vous suivez ${nomComplet(q)} : vous serez prévenu de ses promotions, de ses mandats et de ses changements de parti.`); }
    case 'contactParler': return parlerContact(e, d, rng, +a.id, String(a.sujet));
  }
  return actionDossier(e, d, rng, a);
}
export function vueParcours(e: Etat, d: Donnees) {
  const g = parcoursDe(e, d); const p = moiDe(e); if (!p) return { carriere: false }; const P = e.partis[p.parti]; const eq = equipeDe(e, d); const es = estime(e); const ind = p.mandats.reduce((s, m) => s + (INDEMNITES[m.type] ?? 0), 0);
  const motiv = eq.membres.length ? eq.membres.reduce((s, m) => s + m.motiv, 0) / eq.membres.length : 50; const journ = g.contacts.find(c => c.role === 'journaliste'); const mentor = g.contacts.find(c => c.role === 'mentor');
  const niveau = (v: number) => v >= 65 ? 'très bonne' : v >= 45 ? 'bonne' : v >= 25 ? 'mitigée' : 'faible';
  const rep = [
    { qui: 'Les militants', v: Math.round(clamp(es * 0.5 + motiv * 0.5, 0, 100)), raisons: [motiv > 60 ? 'votre équipe est motivée' : motiv < 40 ? 'votre équipe s\'essouffle' : 'votre équipe tient', p.attrs[A.terrain] >= 12 ? 'on vous voit sur le terrain' : 'on vous voit peu sur le terrain'] },
    { qui: 'Les cadres du parti', v: Math.round(clamp(es * 0.6 + p.rang * 8 + ((mentor?.relation ?? 40) - 40) * 0.3, 0, 100)), raisons: [es > 40 ? 'vous êtes jugé fiable' : 'vous devez encore faire vos preuves', g.promesses.some(x => x.regle === 'dedit') ? 'on se souvient d\'une promesse non tenue' : g.promesses.length ? 'vous avez des engagements en cours' : 'vous n\'avez rien promis à personne'] },
    { qui: 'La presse locale', v: Math.round(clamp(p.notoriete * 1.2 + ((journ?.relation ?? 40) - 40) * 0.5, 0, 100)), raisons: [p.notoriete > 20 ? 'votre nom commence à circuler' : 'vous êtes encore inconnu', (journ?.relation ?? 0) > 55 ? 'vous avez un bon contact à la rédaction' : 'personne ne vous connaît à la rédaction'] },
  ].map(r => ({ ...r, niveau: niveau(r.v) }));
  const ech = e.calendrier.filter(k => !k.fait1 && k.s1 > e.semaine && k.s1 - e.semaine <= 60 && k.s1 - e.semaine >= 6 && ['municipales', 'departementales', 'legislatives', 'regionales', 'europeennes'].includes(k.type)).map(k => ({ type: k.type, dans: k.s1 - e.semaine, date: jourVote(k.s1), investi: investi(e, p, k.type) }));
  const D = g.dossier;
  return {
    carriere: true, id: p.id, reel: !!p.reel, nom: nomComplet(p), age: 2026 + Math.floor(e.semaine / 52) - p.naissance, parti: p.parti, rang: p.rang, portrait: g.portrait, bio: g.bio, slogan: g.slogan, style: g.style,
    attrs: p.attrs.map((v, i) => ({ i, nom: NOMS_ATTRS[i], v, entrainable: ENTRAINABLES.includes(i), choisi: g.entrainement.includes(i) })), pot: p.pot, forme: Math.round(p.forme), moral: Math.round(p.moral), notoriete: Math.round(p.notoriete), estime: Math.round(es),
    metier: g.metier, metiers: METIERS, argent: Math.round(g.argent), revenu: (METIERS[g.metier]?.revenu ?? 0) + ind, indemnites: ind, depenses: TRAIN_VIE, mandats: p.mandats.map(m => LIB_MANDAT[m.type] ?? m.type),
    ambition: g.ambition, ambitions: Object.keys(AMBITIONS).map(k => ({ id: k, nom: AMBITIONS[k].nom })), etapes: etapesAmbition(e, d), reputation: rep,
    journal: p.hist.slice().reverse().slice(0, 30).map(h => ({ s: h.s, t: h.t })), promesses: g.promesses.map(x => ({ t: x.t, regle: x.regle ?? false })), semaine: e.semaine,
    echeances: ech, dossier: D ? { ...D, dans: D.commission - e.semaine, actions: ACTIONS_DOSSIER, promessesPossibles: PROMESSES, question: D.oral && !D.oral.fini ? QUESTIONS[D.oral.i] : null, nbQuestions: QUESTIONS.length } : null,
    contacts: g.contacts.map(c => ({ ...c, vu: c.parle === e.semaine })), suivis: g.suivis.map(id => e.persos[id]).filter(Boolean).map(q => ({ id: q.id, nom: nomComplet(q), parti: q.parti, rang: q.rang, mandats: q.mandats.map(m => LIB_MANDAT[m.type] ?? m.type) })), sigle: P?.sigle ?? '', lieu: d.zones[p.zone].nom,
  };
}
// Réponse à un rappel de promesse (message à choix).
export function reglerPromesse(e: Etat, d: Donnees, choix: number): string {
  const g = parcoursDe(e, d); const pr = g.promesses.find(x => x.regle === true); if (!pr) return ''; const P = e.partis[e.joueur.parti];
  if (choix === 0) { pr.regle = 'tenue'; P.capital = clamp(P.capital - 3, 0, 100); e.joueur.pointsVictoire.estime = clamp(estime(e) + 3, 0, 100); return 'Vous tenez parole. On saura que la vôtre vaut quelque chose.'; }
  if (choix === 1) { pr.regle = undefined; pr.rappel = e.semaine + 20; e.joueur.pointsVictoire.estime = clamp(estime(e) - 1, 0, 100); return 'Vous gagnez quelques mois. Ils reviendront.'; }
  pr.regle = 'dedit'; e.joueur.pointsVictoire.estime = clamp(estime(e) - 6, 0, 100); for (const c of g.contacts) if (c.role !== 'journaliste') c.relation = clamp(c.relation - 6, 0, 100); return 'Vous vous dédisez. La nouvelle fait le tour de la fédération en une journée.';
}

// ---------- V6 : emblème, fondation et financement du parti, tableau de bord, page d'encyclopédie ----------
import { dateTexte } from '../calendrier';
import { agoraDe } from './agora';
import { fonderParti } from './carriere';

const chefJoueur = (e: Etat) => e.joueur.mode === 'parti' || e.partis[e.joueur.parti]?.chef === e.joueur.perso;
export function actionV6(e: Etat, d: Donnees, rng: Rng, a: any): { ok: boolean; texte: string } {
  const non = (t: string) => ({ ok: false, texte: t }), ok = (t = '') => ({ ok: true, texte: t }); const P = e.partis[e.joueur.parti]; const S = P.scoreIA;
  switch (a.type) {
    case 'emblemeModifier': { const v = a.embleme ?? {}; e.embleme = { forme: clamp(+v.forme | 0, 0, 3), symbole: clamp(+v.symbole | 0, 0, 7), c1: /^#[0-9a-f]{6}$/i.test(v.c1) ? v.c1 : '#0066cc', c2: /^#[0-9a-f]{6}$/i.test(v.c2) ? v.c2 : '#ffffff', initiales: String(v.initiales ?? '').replace(/[^\p{L}\d]/gu, '').slice(0, 3).toUpperCase(), actif: !!v.actif }; return ok(v.actif ? 'Votre emblème remplace la pastille de votre parti.' : 'Emblème enregistré.'); }
    case 'fonderPartiV6': { if (e.joueur.mode !== 'carriere') return non('Réservé au mode Carrière.'); const nom = String(a.nom ?? '').trim().slice(0, 40); const sigle = String(a.sigle ?? '').replace(/[^\p{L}\d]/gu, '').slice(0, 5).toUpperCase(); if (nom.length < 3 || sigle.length < 2) return non('Il faut un nom (3 lettres au moins) et un sigle (2 à 5 lettres).'); if (e.partis.some(q => q.actif && q.sigle.toUpperCase() === sigle)) return non('Ce sigle est déjà pris.');
      const t = fonderParti(e, d, nom); if (!t.includes('est né')) return non(t); const N = e.partis[e.joueur.parti]; N.sigle = sigle; if (/^#[0-9a-f]{6}$/i.test(a.couleur)) N.couleur = a.couleur; N.scoreIA.fondeS = e.semaine; return ok(`${t} Sigle : ${sigle}. Il vous faut maintenant des adhérents, de l'argent et des candidats.`); }
    case 'finEmprunt': { if (!chefJoueur(e)) return non('Seul le président du parti engage un emprunt.'); if ((S.pretReste ?? 0) > 0) return non('Un emprunt est déjà en cours.'); const plafond = Math.round(((e.intentions[P.idx] ?? 0) * 12e6 + P.adherents * 25) / 1000) * 1000; const m = clamp(Math.round(+a.montant || 0), 0, plafond); if (m < 10000) return non(`La banque ne prête qu'à partir de 10 000 €. Votre plafond actuel : ${plafond.toLocaleString('fr-FR')} €, selon vos sondages et vos adhérents.`);
      P.tresorerie += m; S.pretReste = Math.round(m * 1.12); S.pretHebdo = Math.round(m * 1.12 / 156); return ok(`La banque accorde ${m.toLocaleString('fr-FR')} €, remboursables sur trois ans (${S.pretHebdo.toLocaleString('fr-FR')} € par semaine, intérêts compris).`); }
    case 'finAppel': { if (!chefJoueur(e)) return non('Seul le président du parti lance un appel aux dons.'); if (e.semaine - (S.appelS ?? -99) < 13) return non('Un appel aux dons par trimestre. Au-delà, les sympathisants se lassent.'); S.appelS = e.semaine; const ab = agoraDe(e, d).abP[P.idx] ?? 0; const gain = Math.round(clamp(ab * 0.35 * (0.5 + rng.next()) * (0.6 + P.dynamique / 100 + P.unite / 250), 2000, 600000) / 100) * 100; P.tresorerie += gain; return ok(`Appel aux dons sur Agora : ${gain.toLocaleString('fr-FR')} € récoltés auprès de vos abonnés, dans la limite du plafond légal par donateur.`); }
    case 'finPrets': { if (!chefJoueur(e)) return non('Seul le président du parti sollicite ses adhérents.'); if (e.semaine - (S.pretsS ?? -99) < 26) return non('Vous avez déjà sollicité vos adhérents il y a moins de six mois.'); S.pretsS = e.semaine; const gain = Math.round(P.adherents * (8 + rng.next() * 8) * (P.unite / 70) / 100) * 100; P.tresorerie += gain; P.unite = clamp(P.unite - 1.5, 0, 100); S.pretReste = (S.pretReste ?? 0) + gain; S.pretHebdo = Math.round((S.pretReste) / 156); return ok(`Vos adhérents prêtent ${gain.toLocaleString('fr-FR')} € au parti. Il faudra les rembourser, et certains trouvent qu'on leur demande beaucoup.`); }
  }
  return non('Action inconnue.');
}
// Remboursement hebdomadaire de l'emprunt du parti du joueur.
export function tourFinancement(e: Etat) { const P = e.partis[e.joueur.parti]; const S = P?.scoreIA; if (!S || !(S.pretReste > 0)) return; const v = Math.min(S.pretReste, S.pretHebdo || 0); P.tresorerie -= v; S.pretReste -= v; }

export function vueTableau(e: Etat, d: Donnees) {
  const j = e.joueur; const P = e.partis[j.parti]; const eq = equipeDe(e, d); const ag = agoraDe(e, d); const car = j.mode === 'carriere'; const g = car ? parcoursDe(e, d) : null; const p = moiDe(e);
  const taches: { t: string; ecran: string; urgent: boolean }[] = []; const rep = e.inbox.filter(m => m.choix && m.repondu === undefined).length;
  if (rep) taches.push({ t: `${rep} décision${rep > 1 ? 's' : ''} à prendre dans la boîte de réception`, ecran: 'inbox', urgent: true });
  if (eq.bilan && !eq.bilan.annonce) taches.push({ t: 'Soir de vote : les bureaux de votre secteur remontent', ecran: 'equipe', urgent: true });
  if (eq.incident) taches.push({ t: `Incident à régler : ${eq.incident.titre.toLowerCase()}`, ecran: 'equipe', urgent: true });
  if (g?.dossier && !g.dossier.verdict) taches.push(g.dossier.commission <= e.semaine ? { t: 'La commission d\'investiture vous attend', ecran: 'profil', urgent: true } : { t: `Investiture : ${g.dossier.soutiens} soutiens, commission dans ${g.dossier.commission - e.semaine} semaine(s)`, ecran: 'profil', urgent: false });
  if (e.debat && !e.debat.fini) taches.push({ t: 'Un entretien est en cours', ecran: 'medias', urgent: true });
  if (ag.reactions.length) taches.push({ t: `Réagir sur Agora : ${ag.reactions[0].titre}`, ecran: 'agora', urgent: ag.reactions[0].s === e.semaine });
  const sorties = ['porte', 'tractage', 'reunion'].filter(k => !eq.jeux[k]).length; if (sorties) taches.push({ t: `${sorties} sortie${sorties > 1 ? 's' : ''} de terrain possible${sorties > 1 ? 's' : ''} cette semaine`, ecran: 'equipe', urgent: false });
  if (eq.campagne) for (const k of Object.keys({ lancement: 1, reunion: 1, dernier: 1 })) { /* temps forts signalés dans l'écran Terrain */ }
  if (eq.candidats.length) taches.push({ t: `${eq.candidats.length} personne${eq.candidats.length > 1 ? 's veulent' : ' veut'} rejoindre votre équipe`, ecran: 'equipe', urgent: false });
  const negliges = g ? g.contacts.filter(c => e.semaine - c.parle > 8 && c.role !== 'rival').map(c => ({ nom: `${c.prenom} ${c.nom}`, role: c.role, depuis: c.parle < 0 ? -1 : e.semaine - c.parle })) : [];
  const dettes = g ? g.contacts.filter(c => c.dette < 0).map(c => `${c.prenom} ${c.nom}`) : [];
  const et = car ? etapesAmbition(e, d) : []; const suite = et.find(x => !x.fait);
  return {
    carriere: car, date: dateTexte(e.semaine), taches, ambition: car && g ? { nom: AMBITIONS[g.ambition]?.nom ?? '', etape: suite?.nom ?? 'Ambition atteinte', faites: et.filter(x => x.fait).length, total: et.length } : null,
    echeances: e.calendrier.filter(k => !k.fait2 && k.s1 >= e.semaine).slice(0, 4).map(k => ({ type: k.type, dans: k.s1 - e.semaine, date: jourVote(k.s1) })), campagne: eq.campagne ? { type: eq.campagne.type, dans: eq.campagne.s1 - e.semaine, elan: Math.round(eq.campagne.elan) } : null,
    quartiers: eq.quartiers.map(q => ({ nom: q.nom, ancrage: Math.round(q.ancrage), accueil: Math.round(q.accueil * 100) })), equipe: { n: eq.membres.length, motiv: eq.membres.length ? Math.round(eq.membres.reduce((s, m) => s + m.motiv, 0) / eq.membres.length) : 0, fatigues: eq.membres.filter(m => m.fatigue > 70).length, caisse: eq.caisse }, lieu: d.zones[eq.zone].nom,
    parti: { nom: P.nom, sigle: P.sigle, intentions: Math.round((e.intentions[P.idx] ?? 0) * 1000) / 10, unite: Math.round(P.unite), tresorerie: Math.round(P.tresorerie), adherents: Math.round(P.adherents), pret: Math.round(P.scoreIA.pretReste ?? 0) },
    classement: e.partis.filter(q => q.actif).map(q => ({ parti: q.idx, v: Math.round((e.intentions[q.idx] ?? 0) * 1000) / 10 })).sort((x, y) => y.v - x.v).slice(0, 8),
    fil: ag.posts.slice(-3).reverse().map(x => ({ compte: x.compte, texte: x.texte, parti: x.parti, etat: x.etat })), tendances: ag.tendances.slice(0, 3).map(t => t.sujet), abonnes: car && p ? (p.abonnes ?? 0) : ag.abP[P.idx], negliges, dettes,
    moi: p && car ? { nom: nomComplet(p), rang: p.rang, forme: Math.round(p.forme), moral: Math.round(p.moral), notoriete: Math.round(p.notoriete), estime: Math.round(estime(e)), argent: g ? Math.round(g.argent) : 0 } : null,
  };
}
// Page d'encyclopédie d'un personnage, écrite à partir de ce qui s'est passé dans la partie.
export function vueChronique(e: Etat, d: Donnees, id?: number) {
  const j = e.joueur; const p = e.persos[id ?? j.perso]; if (!p) return null; const P = p.parti >= 0 ? e.partis[p.parti] : null; const estMoi = j.mode === 'carriere' && p.id === j.perso; const g = estMoi ? parcoursDe(e, d) : null; const F = p.sexe === 'F';
  const an = (s: number) => 2026 + Math.floor((s + 14) / 52); const fonctions = p.mandats.map(m => ({ nom: LIB_MANDAT[m.type] ?? m.type, depuis: dateTexte(m.debut) })); const postes = p.postes.map(k => ({ chef: `président${F ? 'e' : ''} du parti`, delegue: `délégué${F ? 'e' : ''} départemental${F ? 'e' : ''}`, section: 'responsable de section' } as Record<string, string>)[k] ?? `membre du bureau national (${k.replace('_', ' ')})`);
  const titre = fonctions.length ? fonctions.map(f => f.nom).join(', ') : postes[0] ?? (p.rang === 0 ? `militant${F ? 'e' : ''}` : `cadre`);
  const chapeau = `${nomComplet(p)}, né${F ? 'e' : ''} en ${p.naissance}, est ${F ? 'une femme' : 'un homme'} politique français${F ? 'e' : ''}${P ? `, membre du parti ${P.nom} (${P.sigle})` : ', sans parti'}. ${F ? 'Elle' : 'Il'} est ${titre}${g?.slogan ? `. ${F ? 'Elle' : 'Il'} a fait de la formule « ${g.slogan} » sa marque de fabrique` : ''}.`;
  const parAn: Record<number, string[]> = {}; for (const h of p.hist) (parAn[an(h.s)] ??= []).push(h.t); const parcours = Object.keys(parAn).map(Number).sort((a, b) => a - b).map(a => ({ an: a, texte: parAn[a].map(t => t.replace(/\.$/, '')).join('. ') + '.' }));
  const ag = agoraDe(e, d); const posts = ag.posts.filter(x => x.perso === p.id); const positions = posts.filter(x => x.etat === 'buzz' || x.moi).slice(-4).reverse().map(x => ({ date: dateTexte(x.s), texte: x.texte, vues: x.vues }));
  const controverses: string[] = []; for (const x of posts.filter(k => k.etat === 'polemique').slice(-3)) controverses.push(`${dateTexte(x.s)} : une publication sur « ${x.sujet} » déclenche une polémique (${x.vues.toLocaleString('fr-FR')} vues).`);
  if (g) for (const pr of g.promesses.filter(k => k.regle === 'dedit')) controverses.push(`Promesse reniée : « ${pr.t} ».`); if (g?.dossier?.issue === 'ecarte') controverses.push(`Écarté${F ? 'e' : ''} par la commission d'investiture (${g.dossier.lib}).`);
  if (!p.reel) for (const af of e.affaires.filter(k => k.perso === p.id)) controverses.push(`Affaire : ${af.titre}${af.close ? ' (close)' : ' (en cours)'}.`);
  return {
    id: p.id, nom: nomComplet(p), reel: p.reel, estMoi, chapeau, portrait: g?.portrait ?? null, parti: p.parti, naissance: p.naissance, lieu: p.reel ? '' : d.zones[p.zone]?.nom ?? '', fonctions, postes, profession: p.reel ? '' : p.profession,
    bio: g?.bio ?? '', parcours, positions, controverses, promesses: g ? g.promesses.map(x => ({ t: x.t, regle: x.regle ?? false })) : [], elections: { victoires: p.victoires, defaites: p.defaites }, notoriete: Math.round(p.notoriete), abonnes: p.abonnes ?? 0,
    modifs: p.hist.slice(-5).reverse().map(h => ({ date: dateTexte(h.s), t: h.t })), maj: dateTexte(e.semaine),
  };
}
