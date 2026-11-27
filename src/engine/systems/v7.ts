// V7 : réseau social enrichi (réponses, republications, notifications, profils), presse simulée,
// objectif du moment, recherche universelle et bilan de la semaine.
import type { Donnees, Etat, Ctx, Post, Perso, Parti, Agora } from '../types';
import { Rng, clamp } from '../rng';
import { agoraDe, abonnesDe, publierAgora, rediger, vueAgora, signalerEvenement } from './agora';
import { parcoursDe } from './parcours';
import { equipeDe } from './equipe';
import { nomComplet, nomAleatoire, LIB_MANDAT } from './personnages';
import { journal } from './inbox';
import { dateTexte, annee } from '../calendrier';

const moi = (e: Etat): Perso | null => e.joueur.mode === 'carriere' ? e.persos[e.joueur.perso] ?? null : null;
const axeDe = (d: Donnees, g: Agora, sujet: string) => { const a = d.axes.findIndex(x => x.nom === sujet); return a >= 0 ? a : (g.tendances.find(t => t.sujet === sujet)?.axe ?? g.reactions.find(r => r.titre === sujet)?.axe ?? -1); };
const mesAbonnes = (e: Etat, d: Donnees, g: Agora) => { const p = moi(e); return p ? abonnesDe(d, p) : g.abP[e.joueur.parti]; };

// ---------- Notifications ----------
export function notifier(e: Etat, g: Agora, type: string, t: string, post?: number) { g.notifs = g.notifs ?? []; g.notifs.push({ id: (g.notifs[g.notifs.length - 1]?.id ?? 0) + 1, s: e.semaine, type, t, post, lu: false }); if (g.notifs.length > 40) g.notifs.splice(0, g.notifs.length - 40); }
const SANS_COMPTE = ['DVG', 'DVC', 'DVD', 'REG']; // étiquettes, pas des partis : pas de compte officiel
const PALIERS = [100, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2500000];

// ---------- Actions ----------
const RIPOSTES = ['Répond point par point et renvoie au bilan de son propre camp.', 'Répond sèchement que les faits sont têtus.', 'Répond en invitant à un débat public sur le sujet.', 'Répond avec ironie, sans entrer dans le fond.', 'Répond en publiant ses propres chiffres.'];
export function actionSocial(e: Etat, d: Donnees, rng: Rng, a: any): { ok: boolean; texte: string } {
  const g = agoraDe(e, d); const non = (texte: string) => ({ ok: false, texte }), ok = (texte = '') => ({ ok: true, texte }); const P = e.partis[e.joueur.parti]; const car = e.joueur.mode === 'carriere'; const pc = car ? parcoursDe(e, d) : null;
  if (a.type === 'agoraLireNotifs') { for (const n of g.notifs ?? []) n.lu = true; return ok(); }
  const p = g.posts.find(x => x.id === +a.id); if (!p) return non('Cette publication n\'est plus disponible.');
  const contact = pc && p.perso >= 0 ? pc.contacts.find(c => c.perso === p.perso) : undefined;
  if (a.type === 'agoraAimer') { p.aime = !p.aime; p.likes = Math.max(0, p.likes + (p.aime ? 1 : -1)); if (p.aime && contact && (g.aimeSemaine ?? -1) !== e.semaine) { g.aimeSemaine = e.semaine; contact.relation = clamp(contact.relation + 1, 0, 100); } return ok(); }
  if (a.type === 'agoraReposter') {
    if (p.moi) return non('C\'est votre propre publication.'); if (p.repost) return non('Vous l\'avez déjà republiée.'); if ((g.repostSemaine?.s ?? -1) === e.semaine && g.repostSemaine!.n >= 3) return non('Trois republications par semaine : au-delà, vos abonnés décrochent.');
    g.repostSemaine = g.repostSemaine?.s === e.semaine ? { s: e.semaine, n: g.repostSemaine.n + 1 } : { s: e.semaine, n: 1 };
    p.repost = true; const gain = Math.round(mesAbonnes(e, d, g) * (0.05 + 0.06 * rng.next())); p.vues += gain; p.partages += 1 + Math.round(gain / 400);
    let suite = ''; if (p.parti === P.idx && p.genre !== 'citoyen') { P.unite = clamp(P.unite + 0.05, 0, 100); if (p.etat === 'polemique') { P.credibilite = clamp(P.credibilite - 0.3, 0, 100); suite = ' Vous relayez une publication qui fait polémique : votre crédibilité en prend un coup.'; } }
    if (contact) { contact.relation = clamp(contact.relation + 2, 0, 100); suite += ` ${contact.prenom} ${contact.nom} apprécie le geste.`; }
    return ok(`Republié auprès de vos abonnés : ${gain.toLocaleString('fr-FR')} vues de plus.${suite}`);
  }
  if (a.type === 'agoraRepondre') {
    if (!car && !['dirigeant', 'chef'].includes(String(e.joueur.mode)) && false) return non('');
    if (g.semaineJoueur === e.semaine && g.nbJoueur >= 4) return non('Trop de publications cette semaine : vos abonnés décrochent.');
    const ton = String(a.ton ?? 'pedagogue'); const adverse = p.parti >= 0 && p.parti !== P.idx && (p.genre === 'elu' || p.genre === 'parti'); const auteur = moi(e);
    const force = (p.etat ? 0.3 : 0) + (adverse && ton === 'offensif' ? 0.25 : 0) + Math.min(0.3, Math.log10(Math.max(10, p.vues)) / 20);
    const r = publierAgora(e, d, rng, P, auteur, { format: 'texte', ton, sujet: p.sujet, axe: axeDe(d, g, p.sujet), texte: String(a.texte ?? '').trim() || undefined, force }, true);
    r.parent = p.id; p.comm += 1; let suite = '';
    if (contact) contact.relation = clamp(contact.relation + (adverse && ton === 'offensif' ? -4 : 2), 0, 100);
    if (adverse && rng.chance(0.3 + (ton === 'offensif' ? 0.3 : 0))) { // l'adversaire répond : le fil prend, les deux y gagnent en audience
      const q = p.perso >= 0 ? e.persos[p.perso] : null; const Q = e.partis[p.parti]; const v = Math.round(Math.max(r.vues, p.vues) * (0.25 + 0.3 * rng.next()));
      const texte = q?.reel ? 'Répond à cette publication.' : rng.pick(RIPOSTES);
      const rep: Post = { id: g.prochain++, s: e.semaine, perso: p.perso, parti: p.parti, compte: p.compte, genre: p.genre, format: 'texte', ton: 'offensif', sujet: p.sujet, texte, vues: v, likes: Math.round(v * 0.03), partages: Math.round(v * 0.006), comm: Math.round(v * 0.004), etat: '', parent: r.id };
      g.posts.push(rep); r.vues = Math.round(r.vues * 1.3); r.comm += 1; Q.viralite += 0.4; P.viralite += 0.5; notifier(e, g, 'reponse', `${p.compte} vous répond sur « ${p.sujet} ».`, rep.id); suite = ` ${p.compte} vous répond : le fil prend.`;
    }
    const v = r.vues.toLocaleString('fr-FR');
    return ok(r.etat === 'polemique' ? `Votre réponse se retourne contre vous : ${v} vues, pour de mauvaises raisons.${suite}` : r.etat === 'buzz' ? `Votre réponse fait mouche : ${v} vues.${suite}` : `Réponse publiée : ${v} vues.${suite}`);
  }
  return non('Action inconnue.');
}

// ---------- Tour hebdomadaire du réseau ----------
export function tourSocial(e: Etat, d: Donnees, rng: Rng, _ctx: Ctx) {
  const g = agoraDe(e, d); const P = e.partis[e.joueur.parti]; const actif = !e.options.auto;
  // Les comptes politiques se répondent entre eux.
  const recents = g.posts.filter(x => x.s === e.semaine && !x.parent && (x.genre === 'elu' || x.genre === 'parti') && x.parti >= 0);
  for (let k = 0; k < 2 && recents.length; k++) { if (!rng.chance(0.55)) continue; const cible = recents[rng.int(0, recents.length - 1)]; const rivaux = e.partis.filter(Q => Q.actif && Q.idx !== cible.parti && Q.idx !== P.idx && Q.notoriete > 15 && !SANS_COMPTE.includes(Q.id)); if (!rivaux.length) break; const Q = rivaux[rng.int(0, rivaux.length - 1)]; const a = axeDe(d, g, cible.sujet);
    const v = Math.round(g.abP[Q.idx] * (0.02 + 0.05 * rng.next())); g.posts.push({ id: g.prochain++, s: e.semaine, perso: -1, parti: Q.idx, compte: Q.nom, genre: 'parti', format: 'texte', ton: 'offensif', sujet: cible.sujet, texte: rediger(e, d, rng, Q, '', rng.pick(['offensif', 'pedagogue', 'humour']), cible.sujet, a), vues: v, likes: Math.round(v * 0.03), partages: Math.round(v * 0.006), comm: Math.round(v * 0.004), etat: '', parent: cible.id }); cible.comm += 1; }
  // Un parti rival s'en prend à la ligne du parti du joueur : occasion de répondre.
  if (actif && P.notoriete > 10 && rng.chance(0.08)) { const rivaux = e.partis.filter(Q => Q.actif && Q.idx !== P.idx && Q.notoriete > 30 && !SANS_COMPTE.includes(Q.id)); if (rivaux.length) { const Q = rivaux[rng.int(0, rivaux.length - 1)]; let a = 0, m = -1; P.axes.forEach((x, i) => { const s = Math.abs(x - Q.axes[i]) + rng.next(); if (s > m) { m = s; a = i; } });
    const v = Math.round(g.abP[Q.idx] * (0.04 + 0.06 * rng.next())); const post: Post = { id: g.prochain++, s: e.semaine, perso: -1, parti: Q.idx, compte: Q.nom, genre: 'parti', format: 'texte', ton: 'offensif', sujet: d.axes[a].nom, texte: `${rediger(e, d, rng, Q, '', 'offensif', d.axes[a].nom, a)} Et ${P.sigle}, sur ce sujet, on attend toujours.`, vues: v, likes: Math.round(v * 0.03), partages: Math.round(v * 0.008), comm: Math.round(v * 0.005), etat: '' }; g.posts.push(post); notifier(e, g, 'mention', `${Q.nom} interpelle ${P.sigle} sur « ${d.axes[a].nom} ».`, post.id); } }
  // Paliers d'abonnés et comptes suivis.
  const ab = mesAbonnes(e, d, g); const palier = PALIERS.filter(x => x <= ab).length; if (g.palier === undefined) g.palier = palier; else if (palier > g.palier) { g.palier = palier; if (actif) notifier(e, g, 'abonnes', `Vous passez le cap des ${PALIERS[palier - 1].toLocaleString('fr-FR')} abonnés.`); } else g.palier = Math.min(g.palier, palier + 1);
  if (actif && e.joueur.mode === 'carriere') { const pc = parcoursDe(e, d); for (const x of g.posts) if (x.s === e.semaine && x.etat === 'buzz' && x.perso >= 0 && pc.suivis.includes(x.perso)) notifier(e, g, 'suivi', `${x.compte}, que vous suivez, fait le plein de vues sur « ${x.sujet} ».`, x.id); }
  for (const x of g.posts) if (x.moi && x.s === e.semaine - 1 && x.etat && actif) notifier(e, g, x.etat, x.etat === 'buzz' ? `Votre publication sur « ${x.sujet} » continue de tourner : ${x.vues.toLocaleString('fr-FR')} vues.` : `Votre publication sur « ${x.sujet} » est encore moquée.`, x.id);
  if (g.posts.length > 110) g.posts.splice(0, g.posts.length - 110);
}

// ---------- Vues du réseau ----------
function decorer(e: Etat, d: Donnees, g: Agora, x: Post, suivis: number[]) { const parent = x.parent ? g.posts.find(k => k.id === x.parent) : undefined; const age = e.semaine - x.s;
  return { ...x, reponses: g.posts.filter(k => k.parent === x.id).length, parentDe: parent ? { id: parent.id, compte: parent.compte } : null, suivi: (x.perso >= 0 && suivis.includes(x.perso)) || (x.parti === e.joueur.parti && x.genre !== 'citoyen'), reel: x.perso >= 0 ? !!e.persos[x.perso]?.reel : false,
    score: Math.log10(Math.max(10, x.vues)) * (x.etat ? 1.35 : 1) / (1 + age * 0.6) + (x.moi ? 0.4 : 0) }; }
export function vueAgora2(e: Etat, d: Donnees) {
  const g = agoraDe(e, d); const v: any = vueAgora(e, d); const suivis = e.joueur.mode === 'carriere' ? parcoursDe(e, d).suivis : [];
  v.posts = g.posts.slice(-70).reverse().map(x => decorer(e, d, g, x, suivis)); v.mesPosts = g.posts.filter(x => x.moi).slice(-8).reverse().map(x => decorer(e, d, g, x, suivis));
  v.notifs = (g.notifs ?? []).slice().reverse(); v.nonLus = (g.notifs ?? []).filter(n => !n.lu).length;
  const miens = g.posts.filter(x => x.moi); v.stats = { n: miens.length, vues: miens.reduce((s, x) => s + x.vues, 0), meilleur: miens.slice().sort((a, b) => b.vues - a.vues)[0]?.id ?? -1, buzz: miens.filter(x => x.etat === 'buzz').length, polemiques: miens.filter(x => x.etat === 'polemique').length };
  v.contacts = e.joueur.mode === 'carriere' ? parcoursDe(e, d).contacts.map(c => ({ id: c.id, nom: `${c.prenom} ${c.nom}`, role: c.role, qui: c.qui, relation: Math.round(c.relation), parle: c.parle < 0 ? -1 : e.semaine - c.parle })) : [];
  return v;
}
export function vueFil(e: Etat, d: Donnees, id: number) {
  const g = agoraDe(e, d); const suivis = e.joueur.mode === 'carriere' ? parcoursDe(e, d).suivis : []; const x = g.posts.find(k => k.id === +id); if (!x) return { post: null, parents: [], reponses: [], semaine: e.semaine };
  const parents: any[] = []; let c: Post | undefined = x; for (let k = 0; k < 6 && c?.parent; k++) { c = g.posts.find(q => q.id === c!.parent); if (c) parents.unshift(decorer(e, d, g, c, suivis)); }
  return { post: decorer(e, d, g, x, suivis), parents, reponses: g.posts.filter(k => k.parent === x.id).map(k => decorer(e, d, g, k, suivis)), semaine: e.semaine };
}
export function vueProfilAgora(e: Etat, d: Donnees, o: { perso?: number; parti?: number }) {
  const g = agoraDe(e, d); const suivis = e.joueur.mode === 'carriere' ? parcoursDe(e, d).suivis : []; const perso = o.perso !== undefined && o.perso >= 0 ? e.persos[+o.perso] : null; const pi = perso ? perso.parti : +(o.parti ?? -1); const P: Parti | undefined = e.partis[pi];
  if (!perso && !P) return { existe: false };
  const posts = g.posts.filter(x => perso ? x.perso === perso.id : x.perso < 0 && x.parti === pi && x.genre === 'parti').slice(-12).reverse().map(x => decorer(e, d, g, x, suivis));
  const fonctions = perso ? perso.mandats.map(m => LIB_MANDAT[m.type]) : [];
  return { existe: true, perso: perso ? perso.id : -1, parti: pi, nom: perso ? nomComplet(perso) : P!.nom, genre: perso ? 'elu' : 'parti', reel: !!perso?.reel, estMoi: !!perso && perso.id === e.joueur.perso && e.joueur.mode === 'carriere',
    abonnes: perso ? abonnesDe(d, perso) : g.abP[pi], bio: perso ? `${fonctions.length ? fonctions.map(f => f.charAt(0).toUpperCase() + f.slice(1)).join(', ') : 'Engagé en politique'}${P ? `. ${P.nom}` : ''}.` : `Compte officiel. ${Math.round(P!.adherents).toLocaleString('fr-FR')} adhérents.`,
    suivi: perso ? suivis.includes(perso.id) : false, posts, semaine: e.semaine, n: posts.length };
}

// ---------- Presse simulée ----------
// Des histoires crédibles mais inventées : lieux, entreprises et personnes cités dans ces articles sont fictifs.
export interface Article { id: number; s: number; rubrique: string; media: string; titre: string; chapo: string; corps: string; axe: number; local?: boolean; reaction?: string; arc?: string; lu?: boolean }
export interface Presse { articles: Article[]; prochain: number; arcs: { cle: string; ep: number; s: number; nom: string; ville: string; qui: string }[]; faits: string[] }
export function presseDe(e: Etat): Presse { if (!e.presse) e.presse = { articles: [], prochain: 1, arcs: [], faits: [] }; return e.presse; }
const axeNom = (d: Donnees, mots: RegExp) => Math.max(0, d.axes.findIndex(x => mots.test(x.nom)));
const ENTREPRISES = ['Valmont Industries', 'les Fonderies du Midi', 'Sorélec', 'la verrerie Delaunay', 'Transports Bréval', 'les Ateliers Morvan', 'Néotex', 'la papeterie des Trois-Rivières', 'Agrinord', 'la conserverie Le Goff'];
const ETABLISSEMENTS = ['la clinique des Tilleuls', 'l\'hôpital de proximité', 'le lycée Jean-Moulin', 'la maternité', 'le collège des Hauts', 'la gare', 'le bureau de poste', 'la caserne des pompiers', 'la piscine municipale', 'le tribunal de proximité'];
const LOCAUX: { t: string; c: string; k: string; mots: RegExp; rural?: boolean }[] = [
  { t: 'Une classe menacée de fermeture à l\'école {q}', c: 'Le rectorat prévoit de supprimer un poste à la rentrée. Les parents d\'élèves ont lancé une pétition qui a réuni {n} signatures en une semaine.', k: 'Les enseignants parlent d\'effectifs à 29 élèves par classe si la mesure est maintenue. Une réunion publique est annoncée.', mots: /[ée]ducation|[ée]cole|service/i },
  { t: 'Les urgences de {v} ferment la nuit', c: 'Faute de médecins, l\'accueil sera régulé par le 15 de 20 heures à 8 heures. La direction parle d\'une mesure provisoire.', k: 'Le collectif d\'usagers rappelle que le service voisin est à quarante minutes de route. Les syndicats demandent des renforts.', mots: /sant[ée]|service|social/i },
  { t: 'Cambriolages en série dans le quartier {q}', c: '{n2} plaintes ont été déposées en un mois. Les habitants réclament des rondes et de l\'éclairage.', k: 'La préfecture promet des patrouilles supplémentaires. Une réunion de quartier a fait salle comble.', mots: /s[ée]curit|ordre|autorit/i },
  { t: '{E} annonce {n3} suppressions de postes à {v}', c: 'La direction invoque la hausse des coûts de l\'énergie et la concurrence. Les salariés ont débrayé deux heures ce matin.', k: 'Le site emploie {n4} personnes. Les élus locaux demandent une table ronde avec l\'État.', mots: /[ée]conom|emploi|travail|industri/i },
  { t: 'Le projet de parc éolien divise autour de {v}', c: 'Six machines de 180 mètres sont prévues sur les hauteurs. L\'enquête publique s\'ouvre dans un mois.', k: 'Les opposants dénoncent le bruit et la baisse du prix des maisons. Les partisans mettent en avant les recettes pour les communes.', mots: /[ée]colog|environ|[ée]nergie|climat/i, rural: true },
  { t: 'La ligne de bus {n5} supprimée dans le quartier {q}', c: 'La régie invoque une fréquentation trop faible. Les habitants, souvent âgés, se disent abandonnés.', k: 'Une délégation sera reçue la semaine prochaine. La décision doit être confirmée en conseil.', mots: /transport|service|territ/i },
  { t: 'Loyers : les locataires de {q} dénoncent une hausse de 8 %', c: 'Le bailleur met en avant les travaux d\'isolation. Les familles parlent de charges devenues impayables.', k: 'Une association de locataires s\'est créée. Elle demande un gel et un calendrier clair des travaux.', mots: /logement|social|pouvoir|[ée]conom/i },
  { t: 'Le marché du {q} menacé par les travaux', c: 'Le chantier de la place durera dix-huit mois. Les commerçants craignent de perdre la moitié de leur clientèle.', k: 'La mairie propose un déplacement provisoire. Les forains jugent l\'emplacement trop à l\'écart.', mots: /[ée]conom|commerce|territ/i },
  { t: '{T} en danger faute de subvention', c: 'Le club, qui compte {n6} licenciés, a perdu une partie de son aide. Les bénévoles lancent une collecte.', k: 'Sans solution d\'ici la fin de la saison, l\'équipe première ne repartira pas. Les parents se mobilisent.', mots: /sport|jeunes|culture|social|service/i },
  { t: 'Des agriculteurs bloquent le rond-point de {v}', c: 'Ils dénoncent les prix d\'achat et les contrôles. Une trentaine de tracteurs ont passé la nuit sur place.', k: 'Le blocage a été levé après une rencontre en préfecture. Une nouvelle action est annoncée si rien ne bouge.', mots: /agricul|rural|[ée]conom|territ|europe/i, rural: true },
  { t: 'Rixe devant {S} : trois blessés légers', c: 'Les faits se sont produits à la sortie des cours. Deux mineurs ont été entendus.', k: 'Les parents demandent une présence d\'adultes aux abords. Le chef d\'établissement réunit les familles jeudi.', mots: /s[ée]curit|[ée]ducation|autorit/i },
  { t: 'Désert médical : {v} perd son dernier généraliste', c: 'Le médecin part à la retraite sans successeur. {n7} patients se retrouvent sans médecin traitant.', k: 'La commune propose un local gratuit et une aide à l\'installation. Aucun candidat pour l\'instant.', mots: /sant[ée]|territ|service/i, rural: true },
  { t: 'Inondations : le quartier {q} les pieds dans l\'eau', c: 'L\'orage de mardi a noyé une cinquantaine de caves. Les riverains accusent un réseau d\'évacuation jamais refait.', k: 'L\'état de catastrophe naturelle est demandé. Les travaux promis depuis des années reviennent dans le débat.', mots: /[ée]colog|environ|territ|climat/i },
  { t: 'Une usine de méthanisation en projet près de {v}', c: 'Le porteur de projet promet du gaz vert et des emplois. Les voisins redoutent les odeurs et les camions.', k: 'Une réunion d\'information a tourné à l\'affrontement verbal. Le dossier passera devant la commission en fin d\'année.', mots: /[ée]colog|environ|agricul|[ée]nergie/i, rural: true },
  { t: 'La mairie veut armer sa police municipale', c: 'Le projet sera soumis au conseil le mois prochain. L\'opposition demande d\'abord un bilan des effectifs.', k: 'Les agents y sont favorables. Une partie des habitants s\'inquiète du coût et des dérives possibles.', mots: /s[ée]curit|ordre|autorit/i },
  { t: 'Fermeture annoncée de la trésorerie de {v}', c: 'Les usagers devront se rendre à trente kilomètres ou passer par internet. Les élus dénoncent un nouveau recul.', k: 'Une permanence deux matinées par semaine est à l\'étude. Les syndicats appellent à un rassemblement.', mots: /service|territ|[ée]tat|d[ée]centr/i, rural: true },
];
const ARCS: { cle: string; mots: RegExp; ep: { t: string; c: string; k: string }[] }[] = [
  { cle: 'usine', mots: /[ée]conom|emploi|travail|industri/i, ep: [
    { t: '{E} envisage de fermer son site de {v}', c: 'Un document interne évoque un transfert de la production à l\'étranger. {n4} emplois sont en jeu.', k: 'La direction ne confirme pas. Les syndicats exigent un comité exceptionnel avant la fin du mois.' },
    { t: '{E} : les salariés occupent l\'usine de {v}', c: 'La fermeture est confirmée pour l\'an prochain. Le piquet de grève tient depuis quatre jours.', k: 'Un repreneur se serait manifesté. Le ministère de l\'Industrie reçoit les élus et les syndicats.' },
    { t: '{E} : {issue}', c: '{issueC}', k: 'L\'affaire aura duré plusieurs mois et laissé des traces dans tout le bassin d\'emploi.' }] },
  { cle: 'hopital', mots: /sant[ée]|service|social/i, ep: [
    { t: 'La maternité de {v} pourrait fermer', c: 'L\'agence de santé juge le nombre de naissances insuffisant. Les sages-femmes parlent d\'une décision comptable.', k: 'La prochaine maternité est à cinquante minutes. Une chaîne humaine est prévue samedi.' },
    { t: 'Maternité de {v} : {n8} personnes dans la rue', c: 'La mobilisation dépasse les attentes. Des élus de tous bords étaient dans le cortège.', k: 'L\'agence de santé promet de réexaminer le dossier. Le collectif dit ne plus croire aux promesses.' },
    { t: 'Maternité de {v} : {issue}', c: '{issueC}', k: 'Le dossier est devenu un symbole de l\'accès aux soins hors des grandes villes.' }] },
  { cle: 'marche', mots: /probit|institution|d[ée]mocra|[ée]tat|justice/i, ep: [
    { t: 'Soupçons sur un marché public à {v}', c: 'Un rapport de la chambre des comptes relève des anomalies dans l\'attribution d\'un chantier. Le montant dépasse {n9} millions d\'euros.', k: 'Le parquet a ouvert une enquête préliminaire. {qui}, qui suit les travaux à la mairie, dit n\'avoir rien à se reprocher.' },
    { t: 'Marché public de {v} : perquisition à l\'hôtel de ville', c: 'Les enquêteurs ont saisi des documents dans plusieurs bureaux. {qui} a été entendu.', k: 'L\'opposition municipale réclame sa mise en retrait. La majorité invoque la présomption d\'innocence.' },
    { t: 'Marché public de {v} : {issue}', c: '{issueC}', k: 'L\'affaire relance le débat sur le contrôle des marchés des collectivités.' }] },
  { cle: 'ecole', mots: /[ée]ducation|[ée]cole|jeunes/i, ep: [
    { t: 'Violences au lycée de {v} : les professeurs exercent leur droit de retrait', c: 'Un enseignant a été agressé dans un couloir. Les cours sont suspendus depuis lundi.', k: 'Le rectorat envoie une équipe de sécurité. Les parents demandent des surveillants en plus.' },
    { t: 'Lycée de {v} : le ministre sur place', c: 'Il annonce quatre postes de surveillants et un audit. Les professeurs jugent la réponse tardive.', k: 'Les cours reprennent lundi. Le débat sur l\'autorité à l\'école est relancé dans tout le pays.' }] },
  { cle: 'eau', mots: /[ée]colog|environ|agricul|climat/i, ep: [
    { t: 'Sécheresse : l\'eau rationnée autour de {v}', c: 'La préfecture interdit l\'arrosage et limite l\'irrigation. Les nappes sont au plus bas depuis vingt ans.', k: 'Les agriculteurs demandent des dérogations. Les associations réclament un partage plus strict.' },
    { t: 'Eau : le projet de retenue de {v} met le feu aux poudres', c: 'Une réserve de {n9} hectares est à l\'étude. Deux manifestations se sont fait face ce week-end.', k: 'Le préfet suspend le projet le temps d\'une médiation. Chaque camp crie victoire.' }] },
  { cle: 'transport', mots: /transport|territ|service/i, ep: [
    { t: 'La ligne de train de {v} menacée', c: 'Le rapport d\'audit chiffre les travaux à {n9}0 millions d\'euros. Sans décision, la ligne fermera dans deux ans.', k: 'La région et l\'État se renvoient la facture. Les usagers lancent une pétition.' },
    { t: 'Train de {v} : {issue}', c: '{issueC}', k: 'Le dossier des petites lignes revient dans le débat national.' }] },
];
const ISSUES: Record<string, [string, string][]> = {
  usine: [['un repreneur sauve les deux tiers des emplois', 'L\'accord a été signé dans la nuit. Les salariés restants gardent leur ancienneté, les autres partiront avec un plan de reclassement.'], ['le site fermera à l\'été', 'Aucune offre sérieuse n\'a été déposée. Les salariés ont obtenu des indemnités supérieures au minimum légal.']],
  hopital: [['le service est maintenu pour trois ans', 'L\'agence de santé recule et promet deux postes de praticiens. Le collectif reste vigilant.'], ['la fermeture est confirmée', 'Un centre de suivi des grossesses prendra le relais. Les élus locaux dénoncent une décision prise d\'avance.']],
  marche: [['l\'enquête est classée sans suite', 'Le parquet ne retient aucune infraction. La personne visée parle de mois très durs pour sa famille.'], ['un renvoi devant le tribunal', 'La personne mise en cause quitte ses délégations en attendant le procès et conteste les faits.']],
  transport: [['la région paiera les travaux', 'Le chantier commencera l\'an prochain. La ligne restera fermée huit mois.'], ['la ligne sera remplacée par des cars', 'La décision a été prise faute d\'accord sur le financement. Les usagers promettent de continuer le combat.']],
};
const BREVES = ['Canicule tardive : les préfectures prolongent les plans d\'alerte', 'La natalité recule encore, selon les chiffres de l\'année', 'Les prix de l\'électricité repartent à la hausse', 'Record de fréquentation pour les trains régionaux', 'Les Français n\'ont jamais autant épargné', 'Pénurie de conducteurs de car à la rentrée', 'Les maires alertent sur la hausse des agressions d\'élus', 'Le nombre de médecins généralistes continue de baisser', 'Les faillites d\'entreprises au plus haut depuis dix ans', 'Les ventes de voitures électriques marquent le pas', 'Les associations d\'aide alimentaire débordées', 'Hausse des inscriptions sur les listes électorales chez les jeunes'];
function remplirArt(s: string, x: Record<string, string>) { return s.replace(/\{(\w+)\}/g, (_m, k) => x[k] ?? '').replace(/\b([dD])e ([AEIOUYÉÈÎ])/g, '$1\'$2').replace(/\b([dD])e Le /g, '$1u ').replace(/\b([dD])e Les /g, '$1es ').replace(/\bà Le /g, 'au ').replace(/\bà Les /g, 'aux '); }
function publierArticle(e: Etat, a: Omit<Article, 'id' | 's'>) { const pr = presseDe(e); const art: Article = { ...a, id: pr.prochain++, s: e.semaine }; pr.articles.push(art); if (pr.articles.length > 60) pr.articles.splice(0, pr.articles.length - 60); return art; }
export function tourPresse(e: Etat, d: Donnees, rng: Rng, _ctx: Ctx) {
  const pr = presseDe(e); const g = agoraDe(e, d); const nat = d.medias.filter(m => !m.regions); const media = () => nat.length ? nat[rng.int(0, nat.length - 1)].nom : 'La Dépêche nationale'; const p0 = e.persos[e.joueur.perso]; const zi = equipeDe(e, d).zone; const z = d.zones[zi];
  const villeHasard = () => d.villes[rng.int(0, d.villes.length - 1)]?.nom ?? 'la ville'; const eq = equipeDe(e, d);
  const jetons = (ville: string): Record<string, string> => ({ v: ville, q: eq.quartiers[rng.int(0, eq.quartiers.length - 1)]?.nom ?? 'du centre', E: rng.pick(ENTREPRISES), S: rng.pick(ETABLISSEMENTS), T: rng.pick(['Le club de football', 'Le club de handball', 'L\'école de musique', 'Le club de natation', 'La maison des jeunes', 'Le club de pétanque']), n: String(rng.int(4, 19) * 100), n2: String(rng.int(12, 60)), n3: String(rng.int(4, 30) * 10), n4: String(rng.int(15, 90) * 10), n5: String(rng.int(2, 48)), n6: String(rng.int(8, 45) * 10), n7: String(rng.int(6, 22) * 100), n8: String(rng.int(2, 9) * 1000), n9: String(rng.int(2, 9)) });
  // 1. La une : le fait politique de la semaine, tiré de ce qui s'est vraiment passé dans la partie.
  const suitesRx = /: (le mouvement s'étend|le gouvernement cherche une sortie|les premières conséquences|la polémique rebondit)$/; const faits = e.journal.filter(x => x.s === e.semaine && !x.t.includes('Agora') && !pr.faits.includes(x.t) && !suitesRx.test(x.t) && !pr.articles.some(k => k.titre === x.t)); const lead = e.partis.filter(P => P.actif).sort((a, b) => (e.intentions[b.idx] ?? 0) - (e.intentions[a.idx] ?? 0)); const pop = Math.round(e.presidence.popularite);
  if (faits.length) { const poidsFait = (t: string) => /[ÉE]lection|élu|censure|dissolution|référendum|remaniement|Premier ministre/i.test(t) ? 3 : /met à son programme|rejoint|quitte/i.test(t) ? 0 : 1; const f = faits.slice().sort((x, y) => poidsFait(y.t) - poidsFait(x.t))[0]; pr.faits.push(f.t); if (pr.faits.length > 30) pr.faits.shift(); publierArticle(e, { rubrique: 'une', media: media(), titre: f.t, chapo: rng.pick([`C'est le fait politique de la semaine. Il intervient alors que le président est à ${pop} % d'opinions favorables et que ${lead[0]?.nom ?? 'le premier parti'} domine les intentions de vote (${Math.round((e.intentions[lead[0]?.idx ?? 0] ?? 0) * 100)} %).`, `L'information a dominé la semaine politique. À l'Élysée, où la popularité du président est à ${pop} %, on suit le dossier de près.`, `Le sujet s'est imposé dans toutes les rédactions. ${lead[0]?.nom ?? 'Le premier parti'}, en tête des sondages, y voit une confirmation de ses thèses ; ses adversaires, une alerte.`, `La semaine se termine sur cette nouvelle, à ${Math.max(1, Math.round(((e.calendrier.find(k => !k.fait2 && k.s1 >= e.semaine)?.s1 ?? e.semaine + 20) - e.semaine)))} semaines du prochain scrutin.`]), corps: `${lead[1] ? rng.pick([`${lead[1].nom} et ${lead[2]?.nom ?? 'les autres formations'} ont réagi dans la journée.`, `Les réactions n'ont pas tardé, de ${lead[1].sigle} à ${lead[lead.length > 4 ? 4 : lead.length - 1].sigle}.`, `Plusieurs responsables demandent des explications au gouvernement.`, `Dans les partis, chacun mesure ce que l'épisode peut lui coûter ou lui rapporter.`]) : ''} ${(() => { const t = g.tendances.find(k => !f.t.includes(k.sujet) && !k.sujet.includes(f.t.split(' : ')[0]) && d.axes.some(x => x.nom === k.sujet)); return t ? `Dans le même temps, le débat reste dominé par un thème : ${t.sujet.toLowerCase()}.` : 'Les états-majors pèsent leurs mots avant les prochaines échéances.'; })()} ${(() => { const autre = faits.find(k => k !== f); return autre ? `Autre fait de la semaine : ${autre.t.charAt(0).toLowerCase() + autre.t.slice(1)}.` : ''; })()}`.trim(), axe: g.tendances[0]?.axe ?? -1 }); }
  // 2. Politique : la lecture des sondages, une semaine sur trois.
  if (e.semaine % 3 === 0 && e.sondages.length >= 2) { const dernier = e.sondages.filter(s => !s.zone).slice(-1)[0]; const nats = e.sondages.filter(s => !s.zone && s.type === dernier?.type); const a = nats[nats.length - 1], b = nats[Math.max(0, nats.length - 4)]; const ech = (a?.scores ?? []).reduce((x, y) => x + y, 0) > 3 ? 1 : 100; const pc = (v: number) => (v * ech).toFixed(1).replace('.', ',');
    if (a && b && a !== b) { let mi = -1, mv = 0; a.scores.forEach((v, i) => { const dv = v - (b.scores[i] ?? v); if (e.partis[i]?.actif && !SANS_COMPTE.includes(e.partis[i].id) && Math.abs(dv) > Math.abs(mv)) { mv = dv; mi = i; } });
      if (mi >= 0 && Math.abs(mv) * ech >= 0.4 && Math.abs(mv) * ech <= 8) { const Q = e.partis[mi]; publierArticle(e, { rubrique: 'politique', media: media(), titre: `Sondage : ${Q.nom} ${mv > 0 ? 'gagne' : 'perd'} ${pc(Math.abs(mv))} point${Math.abs(mv) * ech >= 2 ? 's' : ''}`, chapo: `Selon l'institut ${a.institut}, ${Q.sigle} est mesuré à ${pc(a.scores[mi])} % des intentions de vote. La marge d'erreur est de ${pc(a.marge)} points.`, corps: `${mv > 0 ? 'La dynamique tient à une séquence médiatique réussie et à un électorat mobilisé.' : 'Le parti paie des semaines difficiles et un message brouillé.'} En tête, ${lead[0].nom} est à ${pc(a.scores[lead[0].idx])} %. Les sondeurs rappellent qu'une enquête est une photographie, pas une prévision.`, axe: -1 }); } } }
  // 3. Économie : les chiffres du mois.
  if (e.semaine % 4 === 2) { const c = e.eco; publierArticle(e, { rubrique: 'economie', media: media(), titre: c.chomage > 8 ? `Le chômage à ${c.chomage.toFixed(1).replace('.', ',')} % : le gouvernement sous pression` : c.croissance < 0.5 ? `Croissance à ${c.croissance.toFixed(1).replace('.', ',')} % : l'économie patine` : `Chômage à ${c.chomage.toFixed(1).replace('.', ',')} %, croissance à ${c.croissance.toFixed(1).replace('.', ',')} %`, chapo: `Les chiffres du mois : ${c.chomage.toFixed(1).replace('.', ',')} % de chômage, ${c.croissance.toFixed(1).replace('.', ',')} % de croissance sur un an, ${c.inflation.toFixed(1).replace('.', ',')} % d'inflation.`, corps: `${c.inflation > 3 ? 'La hausse des prix reste la première préoccupation des ménages.' : 'L\'inflation est contenue, mais le pouvoir d\'achat reste un sujet sensible.'} ${c.chomage > 8 ? 'L\'opposition parle d\'échec. La majorité renvoie à la conjoncture européenne.' : 'La majorité y voit le résultat de sa politique. L\'opposition juge l\'embellie fragile.'}`, axe: axeNom(d, /[ée]conom|emploi|travail/i) }); }
  // 4. Chez vous : une histoire locale, avec la possibilité de s'en saisir.
  if (z && rng.chance(0.5)) { const urbain = z.pop > 60000 || /secteur|arrondissement/i.test(z.nom); const pool = LOCAUX.filter(k => !(urbain && k.rural)); const L = pool[rng.int(0, pool.length - 1)]; const x = jetons(z.nom.replace(/ \d+e[r]? (secteur|arrondissement).*$/i, '').replace(/ \(.*\)$/, '')); const titre = remplirArt(L.t, x); const axe = axeNom(d, L.mots); publierArticle(e, { rubrique: 'local', media: 'L\'Écho local', titre, chapo: remplirArt(L.c, x), corps: remplirArt(L.k, x), axe, local: true, reaction: titre }); if (!e.options.auto) g.reactions.push({ id: g.prochain++, titre, axe, s: e.semaine, expire: e.semaine + 2 }); }
  // 5. Feuilletons : des histoires en plusieurs épisodes, ailleurs dans le pays.
  for (const arc of pr.arcs.slice()) { if (arc.s > e.semaine) continue; const A = ARCS.find(k => k.cle === arc.cle)!; const ep = A.ep[arc.ep]; const dernier = arc.ep === A.ep.length - 1; const issue = dernier && ISSUES[arc.cle] ? rng.pick(ISSUES[arc.cle]) : ['', '']; const x = { ...jetons(arc.ville), E: arc.nom, qui: arc.qui, issue: issue[0], issueC: issue[1] }; const titre = remplirArt(ep.t, x); const axe = axeNom(d, A.mots);
    publierArticle(e, { rubrique: 'enquete', media: media(), titre, chapo: remplirArt(ep.c, x), corps: remplirArt(ep.k, x), axe, reaction: titre, arc: arc.cle }); journal(e, titre); signalerEvenement(e, d, titre, axe, 2);
    if (dernier) pr.arcs = pr.arcs.filter(k => k !== arc); else { arc.ep++; arc.s = e.semaine + rng.int(2, 4); } }
  if (pr.arcs.length < 2 && rng.chance(0.16)) { const dispo = ARCS.filter(A => !pr.arcs.some(k => k.cle === A.cle)); const A = dispo[rng.int(0, dispo.length - 1)]; const sexe = rng.chance(0.5) ? 'F' : 'M'; const n = nomAleatoire(d, rng, sexe, annee(e.semaine) - rng.int(38, 62), p0?.dept ?? 0); pr.arcs.push({ cle: A.cle, ep: 0, s: e.semaine + 1, nom: rng.pick(ENTREPRISES), ville: villeHasard(), qui: `${n.prenom} ${n.nom}` }); }
  // 6. En bref.
  if (rng.chance(0.35)) { const t = rng.pick(BREVES); if (!pr.articles.slice(-12).some(k => k.titre === t)) publierArticle(e, { rubrique: 'societe', media: media(), titre: t, chapo: 'Les chiffres publiés cette semaine confirment une tendance de fond.', corps: 'Les partis s\'en emparent chacun à leur manière, les uns pour dénoncer, les autres pour relativiser.', axe: -1 }); }
}
export function vuePresse(e: Etat, d: Donnees) {
  const pr = presseDe(e); const g = agoraDe(e, d);
  return { semaine: e.semaine, date: dateTexte(e.semaine), articles: pr.articles.slice(-36).reverse().map(a => ({ ...a, il: e.semaine - a.s, axeNom: a.axe >= 0 ? d.axes[a.axe]?.nom ?? '' : '', reagir: !!a.reaction && g.reactions.some(r => r.titre === a.reaction) })), feuilletons: pr.arcs.length, nonLus: pr.articles.filter(a => !a.lu && e.semaine - a.s <= 1).length };
}
export function actionPresse(e: Etat, _d: Donnees, a: any): { ok: boolean; texte: string } { const pr = presseDe(e); if (a.type === 'presseLire') { for (const x of pr.articles) x.lu = true; return { ok: true, texte: '' }; } return { ok: false, texte: 'Action inconnue.' }; }

// ---------- Objectif du moment ----------
export function objectif(e: Etat, d: Donnees): { t: string; ecran: string } | null {
  if (e.options.auto) return null; const rep = e.inbox.filter(m => m.choix && m.repondu === undefined).length; if (rep) return { t: `Répondez à ${rep > 1 ? `vos ${rep} décisions` : 'la décision'} en attente`, ecran: 'inbox' };
  const eq = equipeDe(e, d); if (eq.bilan && !eq.bilan.annonce) return { t: 'Soir de vote : suivez le dépouillement de votre secteur', ecran: 'equipe' }; if (eq.incident) return { t: 'Réglez l\'incident dans votre équipe', ecran: 'equipe' };
  const g = agoraDe(e, d); const chaud = g.reactions.find(r => r.s === e.semaine); if (chaud) return { t: `Réagissez à chaud : ${chaud.titre}`, ecran: 'agora' };
  if (e.joueur.mode === 'carriere') { const pc = parcoursDe(e, d); if (pc.dossier && !pc.dossier.verdict) return { t: pc.dossier.commission <= e.semaine ? 'Passez devant la commission d\'investiture' : `Réunissez des soutiens pour votre investiture (${pc.dossier.soutiens} sur 100)`, ecran: 'profil' };
    const p = e.persos[e.joueur.perso]; if (p && p.rang === 0) { if (eq.membres.length < 4) return { t: `Recrutez votre équipe : ${eq.membres.length} militant${eq.membres.length > 1 ? 's' : ''} sur 4`, ecran: 'equipe' }; const anc = eq.quartiers.reduce((s, q) => s + q.ancrage, 0) / Math.max(1, eq.quartiers.length); if (anc < 25) return { t: `Faites-vous connaître dans vos quartiers (ancrage moyen ${Math.round(anc)} sur 25)`, ecran: 'equipe' }; return { t: 'Faites vos preuves pour obtenir une responsabilité dans le parti', ecran: 'profil' }; }
    if (pc.contacts.filter(c => c.role !== 'rival').length < 4) return { t: 'Élargissez votre carnet : prenez contact avec un élu', ecran: 'annuaire' }; }
  const ech = e.calendrier.filter(k => !k.fait2 && k.s1 >= e.semaine)[0]; if (ech && ech.s1 - e.semaine <= 26) return { t: `Préparez les ${ech.type} : J-${(ech.s1 - e.semaine) * 7}`, ecran: e.joueur.mode === 'parti' ? 'campagne' : 'equipe' };
  return { t: 'Gagnez du terrain : une sortie cette semaine', ecran: 'equipe' };
}

// ---------- Recherche universelle ----------
export function vueRecherche(e: Etat, d: Donnees, q0: string) {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); const q = norm(String(q0 ?? '')).trim().slice(0, 40); if (q.length < 2) return { persos: [], villes: [], partis: [] };
  const persos = e.persos.filter(p => p.statut === 'actif' && norm(nomComplet(p)).includes(q)).sort((a, b) => b.notoriete - a.notoriete).slice(0, 8).map(p => ({ id: p.id, nom: nomComplet(p), parti: p.parti, fonction: p.mandats[0] ? LIB_MANDAT[p.mandats[0].type] : '' }));
  return { persos, villes: d.villes.filter(v => norm(v.nom).includes(q)).sort((a, b) => b.pop - a.pop).slice(0, 5).map(v => ({ idx: v.idx, nom: v.nom })), partis: e.partis.filter(P => P.actif && (norm(P.nom).includes(q) || norm(P.sigle) === q)).slice(0, 4).map(P => ({ idx: P.idx, nom: P.nom })) };
}

// ---------- Bilan de la semaine ----------
export interface Photo { int: number; ab: number; argent: number; noto: number; unite: number; treso: number; ancrage: number; cred: number; adh: number }
export function photoSemaine(e: Etat, d: Donnees): Photo { const P = e.partis[e.joueur.parti]; const g = agoraDe(e, d); const p = moi(e); const eq = e.equipe; return { int: e.intentions[P.idx] ?? 0, ab: p ? abonnesDe(d, p) : g.abP[P.idx], argent: e.parcours?.argent ?? 0, noto: p ? p.notoriete : P.notoriete, unite: P.unite, treso: P.tresorerie, ancrage: eq ? eq.quartiers.reduce((s, q) => s + q.ancrage, 0) / Math.max(1, eq.quartiers.length) : 0, cred: P.credibilite, adh: P.adherents }; }
export function bilanSemaine(e: Etat, d: Donnees, avant: Photo) {
  const ap = photoSemaine(e, d); const car = e.joueur.mode === 'carriere'; const L: { t: string; v: string; bon: boolean }[] = []; const add = (t: string, dv: number, fmt: (x: number) => string, seuil: number) => { if (Math.abs(dv) >= seuil) L.push({ t, v: `${dv > 0 ? '+' : '−'}${fmt(Math.abs(dv))}`, bon: dv > 0 }); };
  add('Intentions de vote du parti', (ap.int - avant.int) * 100, x => `${x.toFixed(1).replace('.', ',')} pt`, 0.1); add('Abonnés sur Agora', ap.ab - avant.ab, x => Math.round(x).toLocaleString('fr-FR'), 5);
  if (car) { add('Votre notoriété', ap.noto - avant.noto, x => x.toFixed(1).replace('.', ','), 0.2); add('Votre compte', ap.argent - avant.argent, x => `${Math.round(x).toLocaleString('fr-FR')} €`, 20); add('Ancrage dans vos quartiers', ap.ancrage - avant.ancrage, x => x.toFixed(1).replace('.', ','), 0.3); }
  else { add('Trésorerie', ap.treso - avant.treso, x => `${Math.round(x / 1000).toLocaleString('fr-FR')} k€`, 5000); add('Adhérents', ap.adh - avant.adh, x => Math.round(x).toLocaleString('fr-FR'), 20); add('Unité du parti', ap.unite - avant.unite, x => x.toFixed(1).replace('.', ','), 0.3); }
  add('Crédibilité du parti', ap.cred - avant.cred, x => x.toFixed(1).replace('.', ','), 0.3);
  e.bilan = { s: e.semaine, lignes: L.slice(0, 6), faits: e.journal.filter(x => x.s === e.semaine).slice(-3).map(x => x.t) };
}
