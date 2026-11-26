// Médias et réseaux sociaux : invitations, interviews et débats (mini-jeu de répliques), publications, gaffes.
import type { Donnees, Etat, Parti, Perso, Ctx, Debat, DonMedia } from '../types';
import { A } from '../types';
import { Rng, clamp } from '../rng';
import { message, journal } from './inbox';
import { attr, modTrait, nomComplet } from './personnages';
import { priorites } from './electorat';
import { droits } from './partis';
import { dateTexte } from '../calendrier';

export const REPONSES = [
  { id: 'attaque', nom: 'Attaquer', desc: 'Renvoyer la critique vers le gouvernement ou un adversaire.', attr: A.debat, ctx: 'debat' },
  { id: 'esquive', nom: 'Esquiver', desc: 'Changer de sujet sans répondre. Sûr, mais peu convaincant.', attr: A.sangfroid, ctx: 'tv' },
  { id: 'chiffre', nom: 'Sortir un chiffre', desc: 'Répondre sur le fond avec des données précises.', attr: A.dossiers, ctx: 'dossiers' },
  { id: 'emotion', nom: 'Jouer l\'émotion', desc: 'Raconter une histoire vécue, parler aux tripes.', attr: A.charisme, ctx: 'tv' },
  { id: 'contre_attaque', nom: 'Contre-attaquer', desc: 'Retourner la question contre le journaliste ou l\'adversaire. Risqué.', attr: A.eloquence, ctx: 'debat' },
] as const;
// Adéquation entre le genre de question (lignes) et la réponse (colonnes : attaque, esquive, chiffre, émotion, contre-attaque).
const GENRES: Record<string, { fit: number[]; gabarits: string[] }> = {
  chiffre: { fit: [-0.5, -1.2, 1.4, -0.4, -0.2], gabarits: ['Comment financez-vous vos mesures sur {t} ?', 'Sur {t}, quel est votre objectif chiffré ?', 'Les experts jugent votre plan sur {t} irréaliste. Que répondez-vous ?'] },
  attaque: { fit: [0.6, -0.6, 0.4, 0.0, 1.0], gabarits: ['Vos adversaires vous accusent de démagogie sur {t}. Votre réponse ?', 'Sur {t}, vous disiez le contraire il y a deux ans.', 'Votre parti est-il crédible pour parler de {t} ?'] },
  emotion: { fit: [0.2, -1.0, -0.3, 1.4, -0.2], gabarits: ['Que dites-vous à cette famille touchée par la crise de {t} ?', 'Un téléspectateur vous interpelle : sur {t}, rien ne change dans sa vie.', 'Après le drame de cette semaine, que proposez-vous sur {t} ?'] },
  piege: { fit: [0.3, 0.9, -0.2, -0.2, 0.6], gabarits: ['Des tensions dans votre parti sur {t} : qui décide vraiment ?', 'Un de vos cadres a tenu des propos contraires à votre ligne sur {t}. Le sanctionnez-vous ?', 'Soutiendrez-vous le gouvernement sur {t} si votre proposition est reprise ?'] },
  vision: { fit: [-0.3, -1.0, 0.5, 0.9, 0.0], gabarits: ['Quelle France voulez-vous dans dix ans en matière de {t} ?', 'Si vous ne deviez garder qu\'une mesure sur {t}, laquelle ?', 'En quoi votre projet sur {t} est-il différent des autres ?'] },
};
const NOM_THEME = (d: Donnees, t: number) => d.themes[t].nom.toLowerCase();

export function creerDebat(e: Etat, d: Donnees, rng: Rng, type: Debat['type'], media: string, perso: number, adversaire: number, n: number, enjeu: number): Debat {
  const P = e.partis[e.persos[perso].parti >= 0 ? e.persos[perso].parti : e.joueur.parti]; const pr = new Array(d.themes.length).fill(0);
  d.segments.forEach((_, s) => { const x = priorites(e, d, s, 0); x.forEach((v, t) => pr[t] += v); });
  const questions = Array.from({ length: n }, (_, i) => { const t = rng.pondere(pr.map(x => x ** 2)); const g = rng.pick(i === 0 ? ['vision', 'chiffre'] : P.unite < 45 && rng.chance(0.4) ? ['piege'] : Object.keys(GENRES)); return { theme: t, genre: g, texte: rng.pick(GENRES[g].gabarits).replace('{t}', NOM_THEME(d, t)) }; });
  return { id: e.prochainMsg++, type, media, perso, adversaire, questions, tour: 0, score: 0, scoreAdv: 0, journal: [], fini: false, enjeu };
}
function jouerReplique(e: Etat, d: Donnees, rng: Rng, p: Perso, genre: string, rep: number, ton: number): { delta: number; gaffe: boolean; succes: boolean } {
  const R = REPONSES[rep]; const a = attr(d, p, R.attr, R.ctx) * 0.7 + attr(d, p, A.medias, 'tv') * 0.3; const fit = GENRES[genre].fit[rep];
  const x = (a - 11) / 3 + fit + rng.gauss() * 0.9 - ton * 0.15; const succes = x > 0; const risque = rep === 4 ? 2 : rep === 0 ? 1.3 : rep === 1 ? 0.3 : 1;
  const gaffe = !succes && rng.chance(0.07 * risque * modTrait(d, p, 'gaffe', 1, true) * (1.5 - p.attrs[A.sangfroid] / 20));
  const delta = succes ? (rep === 1 ? 0.4 : rep === 4 ? 2.2 : 1.4) + Math.min(1.5, x * 0.5) : (rep === 1 ? -0.6 : rep === 4 ? -2.2 : -1.2) - (gaffe ? 3 : 0);
  return { delta, gaffe, succes };
}
// Joue la réplique du joueur (et celle de l'adversaire dans un débat). Renvoie le texte du résultat.
export function repondre(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, rep: number): string {
  const D = e.debat; if (!D || D.fini) return ''; const q = D.questions[D.tour]; const p = e.persos[D.perso]; const media = d.medias.find(m => m.id === D.media);
  const r = jouerReplique(e, d, rng, p, q.genre, rep, media?.ton ?? 1); D.score += r.delta;
  let txt = `${REPONSES[rep].nom} : ${r.gaffe ? 'dérapage en direct, la séquence tourne en boucle' : r.succes ? ['réponse nette, le plateau acquiesce', 'bien vu, la séquence est reprise', 'efficace'][rng.int(0, 2)] : ['réponse confuse', 'le journaliste insiste, vous êtes en difficulté', 'cela ne prend pas'][rng.int(0, 2)]} (${r.delta > 0 ? '+' : ''}${r.delta.toFixed(1)})`;
  if (r.gaffe) { const P = e.partis[p.parti]; const k = Math.min(1, 0.25 + 0.2 * p.rang); if (P) { P.gaffes += 1.5 * k; P.credibilite = clamp(P.credibilite - 1.5 * k, 0, 100); } p.citations.push(`Dérapage sur ${NOM_THEME(d, q.theme)} (${media?.nom ?? 'débat'}, ${dateTexte(e.semaine)})`); }
  if (D.adversaire >= 0) { const a = e.persos[D.adversaire]; let best = 0, bf = -9; GENRES[q.genre].fit.forEach((f, i) => { const v = f + (attr(d, a, REPONSES[i].attr, REPONSES[i].ctx) - 11) / 3 + rng.gauss() * 0.5; if (v > bf) { bf = v; best = i; } }); const ra = jouerReplique(e, d, rng, a, q.genre, best, 1); D.scoreAdv += ra.delta; txt += `. ${nomComplet(a)} choisit de ${REPONSES[best].nom.toLowerCase()} : ${ra.gaffe ? 'il dérape' : ra.succes ? 'il marque un point' : 'il convainc peu'} (${ra.delta > 0 ? '+' : ''}${ra.delta.toFixed(1)}).`; }
  D.journal.push(`${q.texte} ${txt}`); D.tour++; if (D.tour >= D.questions.length) cloreDebat(e, d, rng, ctx);
  return txt;
}
export function cloreDebat(e: Etat, d: Donnees, rng: Rng, ctx: Ctx) {
  const D = e.debat; if (!D) return; D.fini = true; const p = e.persos[D.perso]; const P = e.partis[p.parti >= 0 ? p.parti : e.joueur.parti]; const media = d.medias.find(m => m.id === D.media);
  const marge = D.score - D.scoreAdv; const n = D.questions.length;
  if (D.type === 'grand_debat') { const ed = e.entreDeux.presidentielle; if (ed) { const u = ed.unites.PR; const moi = u.cands.findIndex(c => c.perso === D.perso), adv = u.cands.findIndex(c => c.perso === D.adversaire); const b = clamp(marge * 0.004, -0.04, 0.04); ed.bonusDebat = u.cands.map((_, i) => i === moi ? b : i === adv ? -b : 0); ed.debatFait = true; } p.notoriete = clamp(p.notoriete + 3, 0, 100); message(e, ctx, 'medias', 'Grand débat : le verdict', marge > 2 ? `Les enquêtes à chaud vous donnent vainqueur du débat (${D.score.toFixed(1)} contre ${D.scoreAdv.toFixed(1)}). Un avantage pour dimanche.` : marge < -2 ? `Votre adversaire sort vainqueur du débat (${D.scoreAdv.toFixed(1)} contre ${D.score.toFixed(1)}). Cela pèsera dimanche.` : 'Match nul selon les enquêtes à chaud. Le débat ne devrait pas changer la donne.', true); return; }
  // Un second couteau engage moins le parti qu'un dirigeant : l'effet sur le parti dépend du rang de celui qui parle.
  const poids = Math.min(1, 0.25 + 0.2 * p.rang); const aud = (media?.audience ?? 800) / 1000 * poids * poids; const moy = D.score / n; const nP = e.partis.length;
  P.notoriete = clamp(P.notoriete + 0.4 * Math.sqrt(aud) * (1 + Math.max(0, moy)), 0, 100); P.credibilite = clamp(P.credibilite + moy * 0.6 * Math.sqrt(aud), 0, 100); p.notoriete = clamp(p.notoriete + 0.8 * Math.sqrt(aud) * (1 - p.notoriete / 100) * (1 + Math.max(0, moy)), 0, 100); P.dynamique = clamp(P.dynamique + moy * 0.8, -50, 50); if (moy > 0.8) P.capital = clamp(P.capital + 2, 0, 100);
  if (media) d.segments.forEach((s, si) => { if (s.etiquettes.some(t => media.cibles.includes(t))) e.opinion[si * nP + P.idx] += moy * 0.02 * Math.sqrt(aud); });
  if (D.type === 'debat' && D.adversaire >= 0) { const Q = e.partis[e.persos[D.adversaire].parti]; if (Q) Q.dynamique = clamp(Q.dynamique - marge * 0.3, -50, 50); }
  p.forme = clamp(p.forme - 5, 0, 100); if (moy > 1.2 && rng.chance(0.5)) p.citations.push(`Passage remarqué sur ${media?.nom ?? 'un plateau'} (${dateTexte(e.semaine)})`);
  message(e, ctx, 'medias', `Bilan de votre passage : ${media?.nom ?? 'débat'}`, `${moy > 1 ? 'Excellente prestation.' : moy > 0.2 ? 'Prestation correcte.' : moy > -0.6 ? 'Prestation terne.' : 'Prestation ratée.'} Score : ${D.score.toFixed(1)}${D.adversaire >= 0 ? ` contre ${D.scoreAdv.toFixed(1)}` : ''}. Notoriété et crédibilité ajustées.`, false);
}
// Résolution automatique (porte-parole envoyé, partis IA).
export function passageAuto(e: Etat, d: Donnees, rng: Rng, P: Parti, p: Perso, media: DonMedia): number {
  const q = (attr(d, p, A.medias, 'tv') + attr(d, p, A.debat, 'debat') + attr(d, p, A.eloquence, 'tv')) / 3; const moy = clamp((q - 11) / 4 + rng.gauss() * 0.6, -2, 2); const aud = media.audience / 1000; const nP = e.partis.length;
  P.notoriete = clamp(P.notoriete + 0.3 * Math.sqrt(aud), 0, 100); P.credibilite = clamp(P.credibilite + moy * 0.2 * Math.sqrt(aud), 0, 100); p.notoriete = clamp(p.notoriete + 0.5 * Math.sqrt(aud) * (1 - p.notoriete / 100), 0, 100);
  d.segments.forEach((s, si) => { if (s.etiquettes.some(t => media.cibles.includes(t))) e.opinion[si * nP + P.idx] += moy * 0.012 * Math.sqrt(aud); });
  if (rng.chance(0.02 * modTrait(d, p, 'gaffe', 1, true) * (1 + media.ton * 0.5))) { P.gaffes += 1; P.credibilite = clamp(P.credibilite - 1.5, 0, 100); journal(e, `Dérapage de ${nomComplet(p)} (${P.sigle}) sur ${media.nom}`); return -3; }
  return moy;
}

export const PUBLICATIONS: Record<string, { nom: string; desc: string; viral: number; risque: number; cred: number; jeunes: number; militants: number }> = {
  fond: { nom: 'Vidéo de fond', desc: 'Explication d\'une mesure. Peu virale, bonne pour la crédibilité.', viral: 0.5, risque: 0.2, cred: 0.6, jeunes: 0.3, militants: 0 },
  polemique: { nom: 'Coup de gueule', desc: 'Très viral, mais le mauvais buzz n\'est jamais loin.', viral: 2.2, risque: 2.0, cred: -0.3, jeunes: 0.6, militants: 0.3 },
  humour: { nom: 'Format décalé', desc: 'Plaît aux jeunes quand c\'est réussi.', viral: 1.5, risque: 1.2, cred: -0.1, jeunes: 1.0, militants: 0.1 },
  coulisses: { nom: 'Coulisses du parti', desc: 'Soude les militants.', viral: 0.7, risque: 0.4, cred: 0.1, jeunes: 0.4, militants: 0.8 },
};
export function publier(e: Etat, d: Donnees, rng: Rng, ctx: Ctx | null, P: Parti, type: string): string {
  const T = PUBLICATIONS[type]; if (!T) return ''; if ((P.scoreIA.dernierePub ?? -9) >= e.semaine) return 'Une publication par semaine suffit.'; P.scoreIA.dernierePub = e.semaine;
  const auteur = P.bureau.jeunes >= 0 ? e.persos[P.bureau.jeunes] : P.chef >= 0 ? e.persos[P.chef] : null; const q = auteur ? attr(d, auteur, A.reseaux, 'reseaux') : 8; const nP = e.partis.length;
  const x = (q - 10) / 4 + rng.gauss(); const bad = x < -0.6 && rng.chance(0.18 * T.risque * (auteur ? modTrait(d, auteur, 'gaffe', 1, true) : 1));
  if (bad) { P.viralite += T.viral * 3; P.gaffes += 1.2; P.credibilite = clamp(P.credibilite - 1.5 * T.risque, 0, 100); d.segments.forEach((s, si) => { if (s.etiquettes.includes('jeunes')) e.opinion[si * nP + P.idx] -= 0.03; }); journal(e, `Mauvais buzz pour ${P.sigle} sur les réseaux`); return 'Mauvais buzz : la publication est détournée et moquée pendant trois jours. Crédibilité en baisse.'; }
  const reussi = x > 0.4; const k = reussi ? 1.6 : 0.6; P.viralite += T.viral * k * 2; P.credibilite = clamp(P.credibilite + T.cred * k * 0.5, 0, 100); P.militants *= 1 + 0.004 * T.militants * k;
  d.segments.forEach((s, si) => { if (s.etiquettes.includes('jeunes')) e.opinion[si * nP + P.idx] += 0.018 * T.jeunes * k; });
  return reussi ? 'La publication tourne très bien. Viralité en hausse, surtout chez les jeunes.' : 'Accueil poli. Quelques milliers de vues.';
}

export function tourMedias(e: Etat, d: Donnees, rng: Rng, ctx: Ctx) {
  for (const P of e.partis) {
    if (!P.actif) continue; const joueur = P.idx === e.joueur.parti; const pp = P.bureau.porte_parole >= 0 ? e.persos[P.bureau.porte_parole] : P.chef >= 0 ? e.persos[P.chef] : null; if (!pp) continue;
    const proba = clamp(0.1 + P.notoriete / 250 + Math.abs(P.dynamique) / 150, 0.05, 0.6);
    if (!rng.chance(proba)) continue; const nat = d.medias.filter(m => !m.regions); const media = nat[rng.pondere(nat.map(m => Math.sqrt(m.audience) * (1.2 - Math.abs(m.orientation - (P.axes[0] + P.axes[1]) / 5) * 0.2)))];
    // Le joueur n'est pas invité à chaque fois : le plus souvent, le porte-parole y va sans qu'on le dérange.
    const pourMoi = joueur && !e.options.auto && droits(e).medias && !e.debat && rng.chance(e.joueur.mode === 'carriere' ? clamp(0.08 + (e.persos[e.joueur.perso]?.notoriete ?? 0) / 250, 0.08, 0.4) : 0.3);
    if (pourMoi) {
      const adv = rng.chance(0.3) ? e.partis.filter(q => q.actif && q.idx !== P.idx && q.chef >= 0)[rng.int(0, e.partis.filter(q => q.actif && q.idx !== P.idx && q.chef >= 0).length - 1)] : null;
      message(e, ctx, 'medias', adv ? `Invitation : débat sur ${media.nom}` : `Invitation : ${media.nom}`, adv ? `${media.nom} propose un débat face à ${nomComplet(e.persos[adv.bureau.porte_parole >= 0 ? adv.bureau.porte_parole : adv.chef])} (${adv.sigle}). Audience : ${media.audience} 000 personnes.` : `${media.nom} vous invite cette semaine. Audience : ${media.audience} 000 personnes. Ton de l'émission : ${['posé', 'vif', 'polémique'][media.ton]}.`, false, { choix: [{ t: 'Y aller moi-même', info: 'Vous jouez l\'entretien dans l\'écran Médias.' }, { t: 'Envoyer le porte-parole', info: 'Résultat selon ses attributs.' }, { t: 'Décliner' }], action: { type: 'invitation', data: { media: media.id, adversaire: adv ? (adv.bureau.porte_parole >= 0 ? adv.bureau.porte_parole : adv.chef) : -1 } }, expire: e.semaine + 1 });
    } else passageAuto(e, d, rng, P, pp, media);
  }
}
