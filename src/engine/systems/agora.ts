// Agora : le réseau social unique du jeu (fil court, image, vidéo, direct).
// Comptes des partis et des personnages, abonnés, tendances, publications, réactions à l'actualité.
// Les partis IA utilisent les mêmes règles que le joueur.
// Personnes réelles : leurs publications sont décrites de façon neutre, aucun propos ne leur est attribué.
import type { Donnees, Etat, Parti, Perso, Ctx, Agora, Post } from '../types';
import { A } from '../types';
import { Rng, clamp } from '../rng';
import { message, journal } from './inbox';
import { attr, modTrait, nomComplet } from './personnages';

export const FORMATS: Record<string, { nom: string; desc: string; portee: number; viral: number; risque: number; jeunes: number; militants: number; cred: number }> = {
  texte: { nom: 'Message court', desc: 'Rapide, peu risqué. Idéal pour réagir dans l\'heure.', portee: 0.9, viral: 0.8, risque: 0.7, jeunes: 0.4, militants: 0.2, cred: 0.1 },
  image: { nom: 'Visuel', desc: 'Une image et un slogan. Se partage bien chez les militants.', portee: 1.0, viral: 1.0, risque: 0.6, jeunes: 0.6, militants: 0.6, cred: 0 },
  video: { nom: 'Vidéo courte', desc: 'Le format qui touche les jeunes. Fort potentiel, risque de détournement.', portee: 1.3, viral: 1.7, risque: 1.2, jeunes: 1.2, militants: 0.3, cred: 0 },
  direct: { nom: 'Direct', desc: 'Questions en direct. Soude la base, mais chaque mot compte.', portee: 0.7, viral: 1.1, risque: 1.6, jeunes: 0.7, militants: 1.0, cred: 0.3 },
};
export const TONS: Record<string, { nom: string; desc: string; viral: number; risque: number; cred: number }> = {
  pedagogue: { nom: 'Pédagogue', desc: 'Expliquer une mesure. Peu viral, bon pour la crédibilité.', viral: 0.6, risque: 0.3, cred: 0.6 },
  offensif: { nom: 'Offensif', desc: 'Attaquer une politique. Très viral, risque de polémique.', viral: 1.6, risque: 1.8, cred: -0.2 },
  humour: { nom: 'Décalé', desc: 'Plaît quand c\'est réussi, gêne quand c\'est raté.', viral: 1.3, risque: 1.2, cred: -0.1 },
  emotion: { nom: 'Témoignage', desc: 'Une rencontre de terrain. Touche au-delà de la base.', viral: 1.0, risque: 0.6, cred: 0.2 },
  coulisses: { nom: 'Coulisses', desc: 'La vie du parti de l\'intérieur. Fidélise les abonnés.', viral: 0.7, risque: 0.4, cred: 0.1 },
};
// Le sujet est toujours posé comme une étiquette en tête ou en fin de phrase : il peut être un domaine ou un titre d'actualité.
const GABARITS: Record<string, string[]> = {
  pedagogue: ['{sujet} : notre proposition, expliquée simplement.', '{sujet} : ce que nous ferions, mesure par mesure.', '{sujet} : trois chiffres pour comprendre le débat.'],
  offensif: ['{sujet} : le gouvernement fait fausse route, nous le disons depuis des mois.', '{sujet} : assez de promesses, il faut des actes.', '{sujet} : qui assume le bilan ? Personne. Nous, nous proposons.'],
  humour: ['{sujet} : on a refait le calcul, et ce n\'est pas brillant.', '{sujet} : le point en trente secondes, sans langue de bois.', '{sujet} : quand on vous dit que tout va bien.'],
  emotion: ['Rencontre ce matin à {ville}. Sujet du jour : {sujet}. Les habitants attendent des réponses.', '{sujet} : ce que j\'ai entendu à {ville} devrait tous nous faire réfléchir.', 'À {ville}, des témoignages que je n\'oublierai pas. Sujet : {sujet}.'],
  coulisses: ['Dans les coulisses de la réunion de bureau. À l\'ordre du jour : {sujet}.', 'Soirée de travail avec les militants de {ville}. Thème : {sujet}.', 'Préparation du prochain déplacement à {ville}. Thème : {sujet}.'],
};
const CITOYENS = ['{sujet} : on attend surtout des actes.', '{sujet} : tout le monde a un avis, personne n\'a de solution.', '{sujet} : chez nous à {ville}, on le vit tous les jours.', '{sujet} : ça pourrait me faire retourner voter.', '{sujet} : on en parle depuis une semaine, et demain on parlera d\'autre chose.', '{sujet} : qui a vraiment lu les programmes ?'];
const NOMS_FORMAT: Record<string, string> = { texte: 'un message', image: 'un visuel', video: 'une vidéo', direct: 'un direct' };
const MAX_POSTS = 3; // publications utiles par semaine pour le joueur

export function agoraDe(e: Etat, d: Donnees): Agora {
  if (!e.agora) e.agora = { posts: [], prochain: 1, tendances: [], abP: e.partis.map(P => P.actif ? Math.round(P.adherents * 4 + P.notoriete * P.notoriete * 55) : 0), reactions: [], delegue: false, semaineJoueur: -1, nbJoueur: 0, hist: [] };
  const g = e.agora; while (g.abP.length < e.partis.length) g.abP.push(0);
  return g;
}
export function abonnesDe(d: Donnees, p: Perso): number {
  if (p.abonnes === undefined) { const age = 2026 - p.naissance; p.abonnes = Math.round(p.notoriete * p.notoriete * 90 * (0.5 + attr(d, p, A.reseaux, 'reseaux') / 12) * (age < 35 ? 1.5 : age > 62 ? 0.6 : 1) + p.rang * 300 + 120); }
  return p.abonnes;
}
const villeDe = (d: Donnees, rng: Rng, p: Perso | null) => { const z = p ? d.zones[p.zone] : null; if (z && (z.type === 0 || z.type === 2)) return z.ville ?? z.nom; const v = d.zones.filter(x => x.type === 0); return v[rng.int(0, v.length - 1)]?.nom ?? 'Paris'; };
const remplir = (t: string, sujet: string, ville: string) => { const s = t.replace(/\{sujet\}/g, sujet).replace(/\{ville\}/g, ville); return s.charAt(0).toUpperCase() + s.slice(1); };
const minuscule = (s: string) => s;

// ---------- Rédaction ----------
// Une publication dit quelque chose de précis : le fait (l'événement et sa description, ou un chiffre du moment),
// la position du parti (tirée des choix de l'événement ou de sa ligne sur le thème) et, si elle existe, une mesure de son programme.
const bas = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
// Ce que veut faire un parti sur chaque axe, selon son pôle (moins, plus). Formules à l'infinitif.
const CAPS: Record<string, [string, string]> = {
  economie: ['bloquer les prix des produits de base et mieux partager les richesses', 'baisser les impôts et libérer ceux qui travaillent'],
  immigration: ['ouvrir des voies légales et régulariser ceux qui travaillent', 'réduire les flux et faire appliquer les expulsions'],
  europe: ['reprendre la main sur nos lois et nos frontières', 'avancer vers une Europe plus intégrée'],
  securite: ['miser sur la prévention et protéger les libertés', 'rétablir l\'ordre et la fermeté des peines'],
  ecologie: ['produire d\'abord, sans normes qui étouffent', 'accélérer la transition écologique'],
  societe: ['défendre nos repères et nos traditions', 'ouvrir de nouveaux droits'],
  institutions: ['garder un exécutif fort et stable', 'passer à une nouvelle République, avec plus de démocratie directe'],
  social: ['réduire la dépense et responsabiliser chacun', 'étendre la protection sociale'],
  etranger: ['garder une voix indépendante, sans alignement', 'tenir nos alliances et soutenir l\'Ukraine'],
  decentralisation: ['garder un État fort qui décide', 'donner le pouvoir aux territoires'],
};
const sansPoint = (s: string) => s.replace(/[.\s]+$/, '');
function matiere(e: Etat, d: Donnees, rng: Rng, P: Parti, sujet: string, axe: number): { titre: string; fait: string; position: string; mesure: string; chiffre: string; evenement: boolean } {
  const g = agoraDe(e, d); const ev = d.evenements.find(x => x.id === g.sources?.[sujet]); let position = '', ax = axe;
  if (ev) { let m = -99; for (const c of ev.choix) { const i = c.axe ? d.axes.findIndex(x => x.id === c.axe) : -1; const s = i >= 0 ? (c.sens ?? 0) * P.axes[i] : 0.5; if (s > m) { m = s; position = bas(sansPoint(c.t)); if (i >= 0) ax = i; } } }
  const A0 = ax >= 0 ? d.axes[ax] : null; const cap = A0 && CAPS[A0.id] ? CAPS[A0.id][P.axes[ax] >= 0 ? 1 : 0] : '';
  const props = A0 ? d.propositions.filter(p => P.propositions.includes(p.id) && p.axe === A0.id) : []; const mesure = props.length ? bas(props[rng.int(0, props.length - 1)].nom) : '';
  const pct = (x: number) => String(Math.round(x * 10) / 10).replace('.', ','); const eco = A0 && (A0.id === 'economie' || A0.id === 'social');
  const chiffres = eco ? [`Chômage à ${pct(e.eco.chomage)} %.`, `Croissance à ${pct(e.eco.croissance)} %.`, `Inflation à ${pct(e.eco.inflation)} %.`] : e.presidence.perso >= 0 ? [`${Math.round(e.presidence.popularite)} % de Français seulement font confiance à l'exécutif.`] : ['Les Français attendent des réponses.'];
  return { titre: sansPoint(sujet), fait: ev ? ev.texte : '', position: position || cap || 'proposer autre chose', mesure, chiffre: rng.pick(chiffres), evenement: !!ev };
}
export function rediger(e: Etat, d: Donnees, rng: Rng, P: Parti, ville: string, ton: string, sujet: string, axe: number): string {
  const m = matiere(e, d, rng, P, sujet, axe); const mes = m.mesure ? ` Notre mesure : ${m.mesure}.` : ''; const pos = m.position; let v: string[];
  if (m.evenement) v = ({
    pedagogue: [`${m.titre}. ${m.fait} Notre position est simple : ${pos}.${mes}`, `${m.fait} Sur ce dossier, ${P.sigle} propose de ${pos.startsWith('a') || pos.startsWith('é') ? 'prendre ses responsabilités : ' : ''}${pos}.${mes}`, `${m.titre} : au-delà de l'émotion, que faire ? ${pos.charAt(0).toUpperCase() + pos.slice(1)}. C'est ce que nous défendons.`],
    offensif: [`${m.titre}. ${m.fait} Le gouvernement savait et n'a rien fait. Il faut ${pos}, maintenant.`, `${m.fait} Combien d'alertes faudra-t-il encore ? Notre réponse : ${pos}.`, `${m.titre} : la facture de leurs renoncements. Nous, nous disons : ${pos}.${mes}`],
    humour: [`${m.titre}. Le gouvernement découvre le sujet, comme chaque année à la même date. Notre réponse tient en une ligne : ${pos}.`, `${m.fait} Promis, cette fois ils vont créer une commission. Nous, on propose plutôt : ${pos}.`],
    emotion: [`${m.fait} À ${ville}, on m'en a parlé ce matin, avec de la colère et de la fatigue. Notre choix : ${pos}.`, `${m.titre}. Derrière ce titre il y a des familles, à ${ville} comme ailleurs. Nous leur devons une réponse : ${pos}.`],
    coulisses: [`Réunion de bureau ce soir, un seul point à l'ordre du jour : ${bas(m.titre)}. La ligne est arrêtée : ${pos}.`, `Dans les coulisses : deux heures de débat sur un sujet, ${bas(m.titre)}. On en sort avec une position : ${pos}.`],
  } as Record<string, string[]>)[ton] ?? [];
  else v = ({
    pedagogue: [`${m.titre} : ${m.chiffre} Ce que nous proposons : ${pos}.${mes}`, `On nous demande notre ligne sur ce thème, ${bas(m.titre)}. La voici : ${pos}.${mes}`, `${m.chiffre} Derrière ce chiffre, un choix politique. Le nôtre : ${pos}.${mes}`],
    offensif: [`${m.chiffre} Et le gouvernement regarde ailleurs. ${m.titre} : il est temps de ${pos}.`, `${m.titre}. Des années de discours, aucun résultat. ${m.chiffre} Nous voulons ${pos}.${mes}`, `${m.chiffre} Voilà leur bilan. Voilà pourquoi il faut ${pos}.`],
    humour: [`${m.chiffre} Mais rassurez-vous, tout est sous contrôle. ${m.titre} : notre idée un peu folle, ${pos}.`, `${m.titre}. Le plan du gouvernement tient sur un ticket de caisse. Le nôtre : ${pos}.${mes}`],
    emotion: [`À ${ville} ce matin, on m'a parlé de ce sujet : ${bas(m.titre)}. Pas de chiffres, des vies. C'est pour eux qu'il faut ${pos}.`, `${m.titre}. Une retraitée de ${ville} m'a dit : « on ne demande pas la lune ». Elle a raison. Il faut ${pos}.${mes}`],
    coulisses: [`Soirée de travail avec les militants de ${ville}. Thème : ${bas(m.titre)}. On repart avec une feuille de route : ${pos}.`, `Dans les coulisses du bureau national. Au programme : ${bas(m.titre)}.${mes || ` Notre cap : ${pos}.`}`],
  } as Record<string, string[]>)[ton] ?? [];
  const t = v.length ? v[rng.int(0, v.length - 1)] : `${m.titre}. ${pos.charAt(0).toUpperCase() + pos.slice(1)}.`;
  return t.replace(/\s+/g, ' ').trim().slice(0, 280);
}
// Trois brouillons pour le joueur, un par ton. Tirage propre : demander des brouillons ne change pas la partie.
export function brouillons(e: Etat, d: Donnees, cible: string, n: number): { ton: string; texte: string }[] {
  const g = agoraDe(e, d); const P = e.partis[e.joueur.parti]; const [type, val] = String(cible).split(':'); let sujet = '', axe = -1;
  if (type === 'reaction') { const r = g.reactions.find(x => x.id === +val); if (r) { sujet = r.titre; axe = r.axe; } } else if (type === 'tendance') { const t = g.tendances[+val]; if (t) { sujet = t.sujet; axe = t.axe; } }
  if (!sujet) { axe = clamp(+val || 0, 0, d.axes.length - 1); sujet = d.axes[axe].nom; }
  const rng = new Rng((e.graine ^ Math.imul(e.semaine + 1, 2654435761) ^ Math.imul(n + 1, 40503)) >>> 0); const moi = e.joueur.mode === 'carriere' ? e.persos[e.joueur.perso] : null;
  return ['pedagogue', 'offensif', 'emotion'].map(ton => ({ ton, texte: rediger(e, d, rng, P, villeDe(d, rng, moi), ton, sujet, axe) }));
}
const COMMENTAIRES: Record<string, string[]> = {
  buzz: ['Enfin quelqu\'un qui le dit clairement.', 'Partagé. Tout le monde devrait lire ça.', 'Je ne vote pas pour vous d\'habitude, mais là, respect.', 'On en reparle dans six mois, quand il faudra passer aux actes ?'],
  normal: ['D\'accord sur le constat. Et concrètement, vous faites quoi ?', 'Merci d\'en parler, on se sent moins seuls.', 'Facile à dire dans l\'opposition.', 'Vous étiez où quand c\'était le moment de voter contre ?', 'Venez le dire chez nous, on vous attend.'],
  polemique: ['Supprimez ça avant que ça empire.', 'Capture d\'écran faite. Internet n\'oublie pas.', 'Vous vous relisez avant de publier ?', 'Même vos soutiens sont gênés, là.'],
};

export interface DemandePost { format: string; ton: string; sujet: string; axe: number; texte?: string; reaction?: number; force?: number }
// Publie un message. auteur null : compte officiel du parti (qualité de l'équipe numérique).
export function publierAgora(e: Etat, d: Donnees, rng: Rng, P: Parti, auteur: Perso | null, q: DemandePost, moi = false): Post {
  const g = agoraDe(e, d); const F = FORMATS[q.format] ?? FORMATS.texte, T = TONS[q.ton] ?? TONS.pedagogue; const nP = e.partis.length;
  const equipe = [P.bureau.jeunes, P.bureau.porte_parole, P.chef].filter(i => i >= 0).map(i => attr(d, e.persos[i], A.reseaux, 'reseaux'));
  const niveau = auteur ? attr(d, auteur, A.reseaux, 'reseaux') + (q.format === 'direct' ? (attr(d, auteur, A.eloquence, 'tv') - 10) * 0.4 : 0) : Math.max(8, ...equipe) * 0.8 + 2 + Math.min(3, P.budgetCom / 40000);
  const tendance = g.tendances.find(t => t.axe === q.axe || t.sujet === q.sujet); const coherence = q.axe >= 0 && Math.abs(P.axes[q.axe]) >= 2 ? 0.25 : 0;
  // Réagir dans la semaine de l'événement rapporte plus et expose davantage.
  const frais = q.reaction !== undefined ? (g.reactions.find(r => r.id === q.reaction)?.s === e.semaine ? 0.6 : 0.2) : 0;
  let usure = 1; if (moi) { if (g.semaineJoueur !== e.semaine) { g.semaineJoueur = e.semaine; g.nbJoueur = 0; } usure = [1, 0.6, 0.35][g.nbJoueur] ?? 0.15; g.nbJoueur++; }
  const x = (niveau - 10) / 4 + rng.gauss() + (tendance ? 0.25 + tendance.force * 0.35 : 0) + coherence + frais + (q.force ?? 0);
  const risque = 0.1 * F.risque * T.risque * (frais > 0.5 ? 1.4 : 1) * (auteur ? modTrait(d, auteur, 'gaffe', 1, true) : 0.8);
  const rate = x < -0.5 && rng.chance(clamp(risque, 0, 0.6)); const buzz = !rate && x > 2.1;
  const ab = auteur ? abonnesDe(d, auteur) : g.abP[P.idx]; const base = Math.max(200, ab) * F.portee * (0.12 + 0.1 * rng.next());
  const vues = Math.round(base * Math.exp(clamp(x, -1.5, 2.6) * 0.5 * F.viral * T.viral / 1.2) * (rate ? 3 : 1) * (buzz ? 1.7 : 1) + (auteur ? g.abP[P.idx] * 0.01 : 0));
  const tauxLike = rate ? 0.008 : 0.025 + 0.02 * clamp(x, 0, 2); const likes = Math.round(vues * tauxLike); const partages = Math.round(vues * (rate ? 0.03 : 0.004 + 0.006 * T.viral * clamp(x, 0, 2.5))); const comm = Math.round(vues * (rate ? 0.02 : 0.003 * T.risque + 0.002));
  const ville = villeDe(d, rng, auteur); const sujetTxt = minuscule(q.sujet);
  // Aucun propos inventé pour une personne réelle : description neutre de la publication.
  const texte = q.texte && moi ? q.texte.slice(0, 280) : auteur?.reel ? `Publie ${NOMS_FORMAT[q.format] ?? 'un message'} sur le thème : ${sujetTxt}. Ton : ${T.nom.toLowerCase()}.` : rediger(e, d, rng, P, ville, q.ton, q.sujet, q.axe);
  const post: Post = { id: g.prochain++, s: e.semaine, perso: auteur ? auteur.id : -1, parti: P.idx, compte: auteur ? nomComplet(auteur) : P.nom, genre: auteur ? 'elu' : 'parti', format: q.format, ton: q.ton, sujet: q.sujet, texte, vues, likes, partages, comm, etat: rate ? 'polemique' : buzz ? 'buzz' : '', moi };
  if (moi) { const pool = COMMENTAIRES[rate ? 'polemique' : buzz ? 'buzz' : 'normal']; const deja: number[] = []; post.commentaires = [0, 1, 2].map(() => { let k = rng.int(0, pool.length - 1); while (deja.includes(k)) k = (k + 1) % pool.length; deja.push(k); const sexe = rng.chance(0.5) ? 'F' : 'M'; const gen = d.noms.prenoms[sexe]; const l = gen[rng.int(0, gen.length - 1)]; return { qui: `${l[rng.int(0, l.length - 1)]}_${String(rng.int(1, 95)).padStart(2, '0')}`, t: pool[k] }; }); }
  g.posts.push(post); if (g.posts.length > 90) g.posts.splice(0, g.posts.length - 90);
  // Effets. Le poids dépend de l'audience réelle et du rang de celui qui parle.
  const poids = (auteur ? Math.min(1, 0.25 + 0.2 * auteur.rang) : 1) * usure; const portee = clamp(Math.log10(Math.max(10, vues)) / 6, 0.15, 1.25) * poids;
  if (rate) {
    P.viralite += 2 * F.viral * portee; P.gaffes += 1.1 * poids; P.credibilite = clamp(P.credibilite - 1.4 * T.risque * portee, 0, 100);
    d.segments.forEach((s, si) => { if (s.etiquettes.includes('jeunes')) e.opinion[si * nP + P.idx] -= 0.015 * portee; });
    if (auteur) { auteur.abonnes = Math.round(abonnesDe(d, auteur) * (1 - 0.02) + vues * 0.002); auteur.moral = clamp(auteur.moral - 4, 0, 100); auteur.notoriete = clamp(auteur.notoriete + 0.6 * portee, 0, 100); } else g.abP[P.idx] = Math.round(g.abP[P.idx] * 0.985);
    if (vues > 150000) journal(e, `Mauvais buzz pour ${P.sigle} sur Agora`);
  } else {
    const k = (buzz ? 1.7 : x > 0.3 ? 1 : 0.45) * portee;
    P.viralite += 1.6 * F.viral * k; P.credibilite = clamp(P.credibilite + (T.cred + F.cred) * 0.2 * k, 0, 100); P.militants *= 1 + 0.002 * F.militants * k; P.notoriete = clamp(P.notoriete + 0.03 * k, 0, 100);
    d.segments.forEach((s, si) => { if (s.etiquettes.includes('jeunes')) e.opinion[si * nP + P.idx] += 0.008 * F.jeunes * k; });
    if (buzz) { P.tresorerie += Math.round(Math.min(vues, 2e6) * 0.004 * poids); P.dynamique = clamp(P.dynamique + 0.15 * portee, -50, 50); if (vues > 1500000 && (g.dernierTitre ?? -1) < e.semaine) { g.dernierTitre = e.semaine; journal(e, `${post.compte} (${P.sigle}) fait le plein de vues sur Agora`); } }
    const gain = Math.round(vues * (buzz ? 0.012 : 0.004) * (x > 0 ? 1 : 0.4));
    if (auteur) { auteur.abonnes = abonnesDe(d, auteur) + gain; auteur.notoriete = clamp(auteur.notoriete + (buzz ? 0.9 : 0.15) * (auteur.notoriete > 70 ? 0.3 : 1), 0, 100); g.abP[P.idx] += Math.round(gain * 0.25); } else g.abP[P.idx] += gain;
  }
  if (q.reaction !== undefined) { const r0 = g.reactions.find(r => r.id === q.reaction); const sv = r0 && moi ? (g.suivis ?? []).find(k => k.titre === r0.titre && k.ton === undefined) : null; if (sv && r0) { sv.ton = q.ton; sv.chaud = r0.s === e.semaine; } g.reactions = g.reactions.filter(r => r.id !== q.reaction); }
  return post;
}

// Appelé quand un événement national tombe : ouvre une tendance et une fenêtre de réaction pour le joueur.
export function signalerEvenement(e: Etat, d: Donnees, titre: string, axe: number, duree: number, episode = 0, ev = '') {
  const g = agoraDe(e, d); if (ev) { (g.sources ??= {})[titre] = ev; const cles = Object.keys(g.sources); if (cles.length > 30) delete g.sources[cles[0]]; } (g.suivis ??= []).push({ titre, axe, s: e.semaine, episode }); if (g.suivis.length > 12) g.suivis.shift(); g.tendances.unshift({ sujet: titre, axe, force: 1, fin: e.semaine + clamp(duree, 2, 5) }); if (g.tendances.length > 6) g.tendances.length = 6;
  g.reactions.push({ id: g.prochain++, titre, axe, s: e.semaine, expire: e.semaine + 1 }); if (g.reactions.length > 5) g.reactions.shift();
}

export function tourAgora(e: Etat, d: Donnees, rng: Rng, ctx: Ctx) {
  const g = agoraDe(e, d);
  g.tendances = g.tendances.filter(t => t.fin > e.semaine); for (const t of g.tendances) t.force = Math.max(0.2, t.force * 0.8);
  g.reactions = g.reactions.filter(r => r.expire >= e.semaine);
  // Les événements vivent en trois temps : à chaud (la semaine même), le lendemain (la presse et les rivaux), à froid (un mois après).
  const SUITES = ['{t} : le mouvement s\'étend', '{t} : le gouvernement cherche une sortie', '{t} : les premières conséquences', '{t} : la polémique rebondit'];
  const POSTURES = ['dénonce une faute du gouvernement', 'appelle au calme et à la responsabilité', 'demande une commission d\'enquête', 'y voit la preuve de ce qu\'il répète depuis des mois', 'refuse toute récupération', 'réclame des mesures immédiates'];
  const actif = !e.options.auto; const poidsJ = e.joueur.mode === 'parti' ? 1 : Math.min(1, 0.25 + 0.2 * (e.persos[e.joueur.perso]?.rang ?? 0)); const PJ = e.partis[e.joueur.parti];
  for (const sv of (g.suivis ?? []).slice()) {
    const age = e.semaine - sv.s;
    if (age === 1 && !sv.lendemain) { sv.lendemain = true; const riv = e.partis.filter(P => P.actif && P.idx !== PJ.idx).sort((a, b) => b.notoriete - a.notoriete).slice(0, 6); const deux = [riv[rng.int(0, Math.min(2, riv.length - 1))], riv[rng.int(Math.min(3, riv.length - 1), riv.length - 1)]].filter(Boolean);
      if (actif && (sv.ton || poidsJ >= 0.6)) message(e, ctx, 'actu', `Le lendemain : ${sv.titre}`, `La presse reprend l'affaire ce matin. ${deux.map(P => `${P.nom} ${rng.pick(POSTURES)}`).join('. ')}.\n\n${sv.ton ? `Votre réaction ${sv.chaud ? 'à chaud ' : ''}(ton ${TONS[sv.ton]?.nom.toLowerCase() ?? sv.ton}) est citée parmi les premières.` : 'Votre camp ne s\'est pas encore exprimé. La fenêtre pour réagir sur Agora se referme cette semaine.'}`, false);
      // Un fil qui dure : certains événements ont une suite, qui rouvre une tendance et une fenêtre de réaction.
      if (sv.episode < 2 && rng.chance(sv.episode === 0 ? 0.35 : 0.25)) { const base = sv.titre.split(' : ')[0]; const t = rng.pick(SUITES).replace('{t}', base); if (g.sources?.[sv.titre]) g.sources[t] = g.sources[sv.titre]; g.suites = [...(g.suites ?? []), { titre: t, axe: sv.axe, s: e.semaine + rng.int(1, 2), episode: sv.episode + 1 }]; } }
    if (age >= 4) { g.suivis = (g.suivis ?? []).filter(k => k !== sv); if (!sv.ton && poidsJ < 0.6) continue; const tirage = rng.next(); const issue = tirage < 0.55 ? 'confirme' : tirage < 0.75 ? 'retourne' : 'oublie'; let t = '', dc = 0;
      if (issue === 'oublie') t = 'Un mois plus tard, plus personne n\'en parle. Ni gagnant ni perdant.';
      else if (!sv.ton) { if (issue === 'confirme') { dc = -0.4; t = 'Les faits ont donné raison à ceux qui avaient parlé. On note que votre camp s\'était tu.'; } else { dc = 0.3; t = 'L\'histoire s\'est retournée contre ceux qui avaient réagi trop vite. Votre silence passe pour de la prudence.'; } }
      else if (issue === 'confirme') { dc = (sv.chaud ? 0.8 : 0.4) + (sv.ton === 'pedagogue' ? 0.3 : 0); t = `Les faits vous ont donné raison. ${sv.chaud ? 'Vous étiez parmi les premiers à le dire, et on s\'en souvient.' : 'Votre réaction, posée, a bien vieilli.'}`; }
      else { dc = sv.ton === 'offensif' ? (sv.chaud ? -1.4 : -0.8) : sv.ton === 'humour' ? -0.9 : -0.2; t = `De nouveaux éléments changent la lecture de l'affaire. ${sv.ton === 'offensif' || sv.ton === 'humour' ? 'Votre publication ressort, et elle a mal vieilli.' : 'Votre réaction mesurée vous protège.'}`; }
      if (dc) PJ.credibilite = clamp(PJ.credibilite + dc * poidsJ, 0, 100);
      if (actif) message(e, ctx, 'actu', `À froid : ${sv.titre}`, `${t}${dc ? ` Crédibilité ${dc > 0 ? 'en hausse' : 'en baisse'}.` : ''}`, false); }
  }
  for (const st of (g.suites ?? []).filter(k => k.s <= e.semaine)) { journal(e, st.titre); signalerEvenement(e, d, st.titre, st.axe, 3, st.episode); }
  g.suites = (g.suites ?? []).filter(k => k.s > e.semaine);
  // Une tendance de fond quand l'actualité est calme.
  if (g.tendances.length < 2 && rng.chance(0.6)) { const a = rng.int(0, d.axes.length - 1); if (!g.tendances.some(t => t.axe === a)) g.tendances.push({ sujet: d.axes[a].nom, axe: a, force: 0.5 + rng.next() * 0.4, fin: e.semaine + rng.int(2, 4) }); }
  const sujetPour = (P: Parti): { sujet: string; axe: number } => {
    if (g.tendances.length && rng.chance(0.6)) { const t = g.tendances[rng.int(0, g.tendances.length - 1)]; return { sujet: t.sujet, axe: t.axe }; }
    let a = 0, m = -1; P.axes.forEach((v, i) => { const s = Math.abs(v) + rng.next() * 2; if (s > m) { m = s; a = i; } }); return { sujet: d.axes[a].nom, axe: a };
  };
  for (const P of e.partis) {
    if (!P.actif) continue; const joueur = P.idx === e.joueur.parti; const parti = e.joueur.mode === 'parti';
    // Abonnés du compte du parti : tendent vers un niveau lié à la taille et à la notoriété.
    const cible = P.adherents * 4 + P.notoriete * P.notoriete * 55 + P.viralite * 4000; g.abP[P.idx] = Math.max(0, Math.round(g.abP[P.idx] + (cible - g.abP[P.idx]) * 0.012));
    const auto = !joueur || e.options.auto || (parti ? g.delegue : true);
    if (!auto) continue;
    const voix = [P.chef, P.bureau.porte_parole, P.bureau.jeunes].filter(i => i >= 0 && !(joueur && !parti && i === e.joueur.perso && !e.options.auto)).map(i => e.persos[i]);
    const rythme = clamp(0.25 + P.notoriete / 200 + (P.style === 'offensif' ? 0.15 : 0), 0.2, 0.85) * (joueur && parti && g.delegue ? 0.8 : 1);
    for (let k = 0; k < 2; k++) {
      if (!rng.chance(k === 0 ? rythme : rythme * 0.35)) continue; const s = sujetPour(P); const auteur = voix.length && rng.chance(0.65) ? voix[rng.int(0, voix.length - 1)] : null;
      const ton = rng.pick(P.style === 'offensif' ? ['offensif', 'offensif', 'humour', 'emotion', 'coulisses'] : P.style === 'prudent' ? ['pedagogue', 'pedagogue', 'emotion', 'coulisses'] : ['pedagogue', 'offensif', 'emotion', 'coulisses', 'humour']);
      const format = rng.pick(['texte', 'texte', 'image', 'video', 'video', 'direct']);
      // Une équipe déléguée publie prudemment : moins de risque, moins d'éclat.
      const post = publierAgora(e, d, rng, P, auteur, { format, ton: joueur && parti && g.delegue && ton === 'offensif' ? 'pedagogue' : ton, sujet: s.sujet, axe: s.axe, force: joueur && parti && g.delegue ? -0.25 : 0 });
      if (joueur && !e.options.auto && post.etat === 'polemique') message(e, ctx, 'medias', 'Mauvais buzz sur Agora', `La publication de ${post.compte} sur « ${post.sujet} » est détournée et moquée. ${post.vues.toLocaleString('fr-FR')} vues, pour de mauvaises raisons. Crédibilité en baisse.`, false);
    }
  }
  // Vieille publication ressortie : personnages générés uniquement.
  if (rng.chance(0.03)) { const c = e.persos.filter(p => !p.reel && p.statut === 'actif' && p.rang >= 2 && p.parti >= 0 && e.partis[p.parti].actif); if (c.length) { const p = c[rng.int(0, c.length - 1)]; const P = e.partis[p.parti]; P.credibilite = clamp(P.credibilite - 0.8, 0, 100); p.moral = clamp(p.moral - 6, 0, 100); p.abonnes = Math.round(abonnesDe(d, p) * 0.97); g.posts.push({ id: g.prochain++, s: e.semaine, perso: -1, parti: -1, compte: 'Archives du web', genre: 'citoyen', format: 'image', ton: 'offensif', sujet: 'Vieille publication', texte: `Une ancienne publication de ${nomComplet(p)} (${P.sigle}) refait surface et tourne en boucle.`, vues: rng.int(40000, 400000), likes: rng.int(800, 9000), partages: rng.int(500, 6000), comm: rng.int(300, 4000), etat: 'polemique' }); if (P.idx === e.joueur.parti && !e.options.auto) message(e, ctx, 'medias', 'Une vieille publication ressort', `Une ancienne publication de ${nomComplet(p)} circule sur Agora. Rien de grave, mais l'intéressé s'en serait passé. Crédibilité en légère baisse.`, false); } }
  // Comptes de médias : ils relaient les titres de la semaine. Comptes citoyens : ils commentent les sujets, jamais les personnes.
  const titres = e.journal.filter(x => x.s === e.semaine && !x.t.includes('Agora')).slice(-2); const nat = d.medias.filter(m => !m.regions);
  for (const t of titres) { const m = nat[rng.int(0, nat.length - 1)]; if (!m) break; const v = Math.round(m.audience * 1000 * (0.05 + rng.next() * 0.15)); g.posts.push({ id: g.prochain++, s: e.semaine, perso: -1, parti: -1, compte: m.nom, genre: 'media', format: 'texte', ton: 'pedagogue', sujet: 'Actualité', texte: t.t, vues: v, likes: Math.round(v * 0.01), partages: Math.round(v * 0.004), comm: Math.round(v * 0.003), etat: '' }); }
  const nbC = rng.int(1, 2); for (let k = 0; k < nbC; k++) { const t = g.tendances.length ? g.tendances[rng.int(0, g.tendances.length - 1)] : null; const sujet = t ? t.sujet : d.axes[rng.int(0, d.axes.length - 1)].nom; const sexe = rng.chance(0.5) ? 'F' : 'M'; const gen = d.noms.prenoms[sexe] ?? Object.values(d.noms.prenoms)[0]; const liste = gen[rng.int(0, gen.length - 1)]; const prenom = liste[rng.int(0, liste.length - 1)]; const v = rng.int(800, 60000); g.posts.push({ id: g.prochain++, s: e.semaine, perso: -1, parti: -1, compte: `${prenom}_${String(rng.int(1, 95)).padStart(2, '0')}`, genre: 'citoyen', format: 'texte', ton: 'humour', sujet, texte: remplir(rng.pick(CITOYENS), minuscule(sujet), villeDe(d, rng, null)), vues: v, likes: Math.round(v * 0.05), partages: Math.round(v * 0.01), comm: Math.round(v * 0.008), etat: '' }); }
  if (g.posts.length > 90) g.posts.splice(0, g.posts.length - 90);
  // Abonnés des personnages : croissance lente liée à la notoriété, pour les comptes déjà créés.
  if (e.semaine % 4 === 0) { for (const p of e.persos) { if (p.abonnes === undefined || p.statut !== 'actif') continue; const cible = p.notoriete * p.notoriete * 90 * (0.5 + p.attrs[A.reseaux] / 12) + p.rang * 300; p.abonnes = Math.max(0, Math.round(p.abonnes + (cible - p.abonnes) * 0.02)); }
    const moi = e.joueur.mode === 'carriere' ? e.persos[e.joueur.perso] : null; g.hist.push({ s: e.semaine, parti: g.abP[e.joueur.parti], moi: moi ? abonnesDe(d, moi) : 0 }); if (g.hist.length > 320) g.hist.shift(); }
}

// Publication du joueur. En mode Carrière : son compte personnel. En mode Parti : le compte du parti ou celui d'un dirigeant.
export function publierJoueur(e: Etat, d: Donnees, rng: Rng, a: { format: string; ton: string; cible: string; texte?: string; voix?: number }): { ok: boolean; texte: string } {
  const g = agoraDe(e, d); const P = e.partis[e.joueur.parti]; const non = (texte: string) => ({ ok: false, texte }), ok = (texte: string) => ({ ok: true, texte }); if (!FORMATS[a.format] || !TONS[a.ton]) return non('Publication impossible.');
  if (g.semaineJoueur === e.semaine && g.nbJoueur >= MAX_POSTS + 1) return non('Trop de publications cette semaine : vos abonnés décrochent. Attendez la semaine prochaine.');
  let sujet = '', axe = -1, reaction: number | undefined;
  const [type, val] = String(a.cible ?? '').split(':');
  if (type === 'reaction') { const r = g.reactions.find(x => x.id === +val); if (!r) return non('Cette actualité est déjà passée.'); sujet = r.titre; axe = r.axe; reaction = r.id; }
  else if (type === 'tendance') { const t = g.tendances[+val]; if (!t) return non('Cette tendance est retombée.'); sujet = t.sujet; axe = t.axe; }
  else { axe = clamp(+val || 0, 0, d.axes.length - 1); sujet = d.axes[axe].nom; }
  const carriere = e.joueur.mode === 'carriere'; const auteur = carriere ? e.persos[e.joueur.perso] : (a.voix !== undefined && a.voix >= 0 && [P.chef, P.bureau.porte_parole, P.bureau.jeunes].includes(a.voix) ? e.persos[a.voix] : null);
  const post = publierAgora(e, d, rng, P, auteur, { format: a.format, ton: a.ton, sujet, axe, texte: a.texte?.trim() || undefined, reaction }, true);
  const v = post.vues.toLocaleString('fr-FR');
  if (post.etat === 'polemique') return ok(`Mauvais buzz : ${v} vues, la publication est détournée et moquée. Crédibilité en baisse.`);
  if (post.etat === 'buzz') return ok(`La publication s'envole : ${v} vues, ${post.partages.toLocaleString('fr-FR')} partages. Abonnés et notoriété en hausse.`);
  return ok(post.likes > post.vues * 0.035 ? `Bon accueil : ${v} vues, ${post.likes.toLocaleString('fr-FR')} mentions j'aime.` : `Accueil poli : ${v} vues.`);
}

export function vueAgora(e: Etat, d: Donnees) {
  const g = agoraDe(e, d); const P = e.partis[e.joueur.parti]; const carriere = e.joueur.mode === 'carriere'; const moi = carriere ? e.persos[e.joueur.perso] : null;
  const comptes = [...e.partis.filter(q => q.actif).map(q => ({ nom: q.nom, parti: q.idx, perso: -1, abonnes: g.abP[q.idx] })), ...e.persos.filter(p => p.statut === 'actif' && p.rang >= 3 && p.parti >= 0).map(p => ({ nom: nomComplet(p), parti: p.parti, perso: p.id, abonnes: abonnesDe(d, p) }))].sort((x, y) => y.abonnes - x.abonnes);
  const monAb = moi ? abonnesDe(d, moi) : g.abP[P.idx]; const monRang = comptes.filter(c => c.abonnes > monAb).length;
  const voix = carriere ? [] : [P.chef, P.bureau.porte_parole, P.bureau.jeunes].filter((i, k, t) => i >= 0 && t.indexOf(i) === k).map(i => ({ id: i, nom: nomComplet(e.persos[i]), abonnes: abonnesDe(d, e.persos[i]), niveau: attr(d, e.persos[i], A.reseaux, 'reseaux') }));
  const faits = g.semaineJoueur === e.semaine ? g.nbJoueur : 0;
  return {
    abonnesParti: g.abP[P.idx], abonnesMoi: moi ? abonnesDe(d, moi) : 0, rang: monRang + 1, nbComptes: comptes.length, classement: comptes.slice(0, 12),
    posts: g.posts.slice(-45).reverse(), mesPosts: g.posts.filter(p => p.moi).slice(-6).reverse(),
    tendances: g.tendances.map((t, i) => ({ i, sujet: t.sujet, force: Math.round(t.force * 100), reste: t.fin - e.semaine })),
    reactions: g.reactions.map(r => ({ id: r.id, titre: r.titre, frais: r.s === e.semaine })),
    axes: d.axes.map((x, i) => ({ i, nom: x.nom })), formats: FORMATS, tons: TONS, voix, delegue: g.delegue, carriere, faits, max: MAX_POSTS,
    hist: g.hist.slice(-80), semaine: e.semaine,
    ligne: d.axes.map((x, i) => ({ x, v: P.axes[i] })).filter(k => Math.abs(k.v) >= 2).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 4).map(k => `${k.x.nom} : ${(k.v > 0 ? k.x.polePlus : k.x.poleMoins).split(',')[0].toLowerCase()}`).join(' ; '),
  };
}
