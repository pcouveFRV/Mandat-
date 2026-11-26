// Terrain local : l'équipe de militants du joueur, ses quartiers, la campagne comme opération, les incidents
// et les mini-jeux de terrain (porte-à-porte, tractage, dépouillement).
// Tous les militants de l'équipe sont des personnages générés.
import type { Donnees, Etat, Ctx, Equipe, Militant, Quartier, Incident, Parti } from '../types';
import { Rng, clamp } from '../rng';
import { message, journal } from './inbox';
import { nomAleatoire } from './personnages';
import { intentions, preparer } from './electorat';
import { jourVote } from '../calendrier';

export const COMPS = ['Terrain', 'Réseaux', 'Organisation', 'Argumentaire'];
export const ACTIONS_EQUIPE: Record<string, { nom: string; comp: number; ancrage: number; mob: number; fatigue: number; tracts: number; affiches: number; desc: string }> = {
  tractage: { nom: 'Tractage', comp: 0, ancrage: 1.0, mob: 0.7, fatigue: 1.0, tracts: 150, affiches: 0, desc: 'Sorties d\'école, gares, rues passantes. Visibilité large.' },
  porte: { nom: 'Porte-à-porte', comp: 3, ancrage: 1.5, mob: 1.5, fatigue: 1.5, tracts: 60, affiches: 0, desc: 'Le plus efficace, le plus fatigant.' },
  marche: { nom: 'Marché', comp: 0, ancrage: 1.2, mob: 0.8, fatigue: 0.9, tracts: 120, affiches: 0, desc: 'Le samedi et le dimanche matin. Bon pour se faire connaître.' },
  collage: { nom: 'Collage', comp: 2, ancrage: 0.7, mob: 0.5, fatigue: 0.8, tracts: 0, affiches: 40, desc: 'La nuit, à plusieurs. Marque le territoire.' },
  phoning: { nom: 'Phoning', comp: 1, ancrage: 0.5, mob: 1.4, fatigue: 0.6, tracts: 0, affiches: 0, desc: 'Rappeler les sympathisants. Utile surtout avant un vote.' },
  reunion: { nom: 'Réunion d\'appartement', comp: 3, ancrage: 1.4, mob: 0.9, fatigue: 0.8, tracts: 30, affiches: 0, desc: 'Dix personnes chez un sympathisant. Lent mais durable.' },
  formation: { nom: 'Formation', comp: -1, ancrage: 0, mob: 0, fatigue: 0.2, tracts: 0, affiches: 0, desc: 'Une semaine pour progresser.' },
  repos: { nom: 'Repos', comp: -1, ancrage: 0, mob: 0, fatigue: 0, tracts: 0, affiches: 0, desc: 'Récupérer.' },
};
const PROFILS: { nom: string; profil: string; segs: string[]; poids: number }[] = [
  { nom: 'Centre-ville', profil: 'Commerces, étudiants, jeunes actifs', segs: ['etudiants', 'jeunes_cadres', 'cadres_actifs', 'independants'], poids: 0.18 },
  { nom: 'Les Grands Ensembles', profil: 'Quartier populaire, beaucoup d\'abstention', segs: ['jeunes_precaires', 'ouvriers_actifs', 'sans_emploi', 'employes_actifs'], poids: 0.2 },
  { nom: 'Les Pavillons', profil: 'Classes moyennes, familles, retraités', segs: ['employes_seniors', 'interm_actifs', 'retraites_moyens'], poids: 0.22 },
  { nom: 'Les Hauts', profil: 'Résidentiel aisé, forte participation', segs: ['cadres_seniors', 'retraites_aises'], poids: 0.12 },
  { nom: 'Le Faubourg', profil: 'Ancien quartier ouvrier', segs: ['ouvriers_seniors', 'retraites_modestes', 'jeunes_populaires'], poids: 0.16 },
  { nom: 'La Gare', profil: 'Agents publics, enseignants, pendulaires', segs: ['fonctionnaires', 'interm_seniors', 'etudiants'], poids: 0.12 },
];
const CARACTERES = ['fidèle', 'ambitieux', 'râleur', 'discret', 'boute-en-train', 'perfectionniste', 'tête brûlée', 'ancien'];
const PLAFOND = [0, 8, 14, 20, 24];
export const MATERIEL: Record<string, { nom: string; qte: number; prix: number; delai: number }> = { tracts: { nom: 'Tracts', qte: 2000, prix: 110, delai: 1 }, affiches: { nom: 'Affiches', qte: 200, prix: 140, delai: 2 } };
export const TEMPS_FORTS: Record<string, { nom: string; prix: number; besoin: number; elan: number; desc: string; fenetre: [number, number] }> = {
  lancement: { nom: 'Lancement de campagne', prix: 150, besoin: 3, elan: 10, desc: 'Un pot, la presse locale, les militants. Donne le ton.', fenetre: [12, 5] },
  reunion: { nom: 'Réunion publique', prix: 300, besoin: 5, elan: 16, desc: 'Une salle, un orateur, des questions. Le moment le plus risqué et le plus payant.', fenetre: [6, 2] },
  dernier: { nom: 'Dernier week-end', prix: 100, besoin: 4, elan: 12, desc: 'Tout le monde dehors, partout, jusqu\'au samedi soir.', fenetre: [1, 1] },
};

function zoneJoueur(e: Etat): number { const j = e.joueur; const p = j.mode === 'carriere' ? e.persos[j.perso] : e.persos[e.partis[j.parti].chef]; return p ? p.zone : 0; }
function accueilDe(d: Donnees, P: Parti, segs: string[]): number {
  let s = 0, n = 0; for (const id of segs) { const sg = d.segments.find(x => x.id === id); if (!sg) continue; let dist = 0; for (let a = 0; a < sg.axes.length; a++) dist += (P.axes[a] - sg.axes[a]) ** 2; s += dist; n++; }
  return clamp(1 - (s / (n || 1)) / 70, -1, 1); // 70 : distance moyenne entre un parti et un segment
}
function nouveauMilitant(e: Etat, d: Donnees, rng: Rng, g: Equipe, niveau: number): Militant {
  const sexe = rng.chance(0.45) ? 'F' : 'M'; const age = rng.chance(0.4) ? rng.int(18, 28) : rng.int(29, 72); const z = d.zones[g.zone]; const n = nomAleatoire(d, rng, sexe, 2026 - age, z.deptIdx);
  const comp = [0, 1, 2, 3].map(() => clamp(Math.round(niveau + rng.gauss() * 2.6), 2, 17)); if (age < 30) comp[1] = clamp(comp[1] + 3, 2, 18); if (age > 55) comp[2] = clamp(comp[2] + 2, 2, 18);
  return { id: g.prochain++, nom: n.nom, prenom: n.prenom, sexe, age, comp, dispo: age > 62 || age < 24 ? 3 : rng.int(1, 3), motiv: rng.int(50, 85), fatigue: 0, depuis: e.semaine, quartier: -1, action: 'repos', caractere: rng.pick(CARACTERES) };
}
export function equipeDe(e: Etat, d: Donnees, _r?: Rng): Equipe {
  if (e.equipe && e.equipe.zone === zoneJoueur(e) && e.equipe.parti === e.joueur.parti) return e.equipe;
  // Générateur propre à la création : l'équipe de départ ne dépend pas du moment où elle est créée.
  const rng = new Rng((e.graine ^ Math.imul(zoneJoueur(e) + 1, 7919) ^ Math.imul(e.joueur.parti + 1, 104729)) >>> 0);
  const P = e.partis[e.joueur.parti]; const zone = zoneJoueur(e);
  const g: Equipe = { zone, parti: P.idx, membres: [], candidats: [], quartiers: [], prochain: 1, caisse: 600, tracts: 800, affiches: 60, commandes: [], campagne: null, incident: null, journal: [], jeu: null, jeux: {}, auto: true, bilan: null };
  g.quartiers = PROFILS.map(q => ({ nom: q.nom, profil: q.profil, segs: q.segs, poids: q.poids, accueil: accueilDe(d, P, q.segs), ancrage: clamp(Math.round(12 + (e.impl[zone * e.partis.length + P.idx] ?? 0) * 20 + rng.gauss() * 6), 2, 60), contacts: rng.int(10, 60) }));
  const n = clamp(Math.round(3 + P.militants / 4000), 3, 7); for (let k = 0; k < n; k++) g.membres.push(nouveauMilitant(e, d, rng, g, 8));
  repartir(g); e.equipe = g; return g;
}
// Répartition automatique : les meilleurs sur les quartiers les plus porteurs, les fatigués au repos.
export function repartir(g: Equipe) {
  const ordre = g.quartiers.map((q, i) => ({ i, v: q.poids * (1.2 + q.accueil) * (1 - q.ancrage / 130) })).sort((a, b) => b.v - a.v);
  const dispo = g.membres.filter(m => m.action !== 'formation'); let k = 0;
  for (const m of dispo.sort((a, b) => b.comp[0] + b.comp[3] - a.comp[0] - a.comp[3])) {
    if (m.fatigue > 65 || m.motiv < 25) { m.action = 'repos'; m.quartier = -1; continue; }
    const q = ordre[k % Math.max(1, Math.min(ordre.length, 4))].i; k++; m.quartier = q;
    const fort = m.comp.indexOf(Math.max(...m.comp)); m.action = g.campagne && g.campagne.s1 - g.campagne.maintenant <= 2 && fort === 1 ? 'phoning' : fort === 3 ? (m.fatigue > 40 ? 'reunion' : 'porte') : fort === 2 ? (g.affiches >= 40 ? 'collage' : 'tractage') : fort === 1 ? 'phoning' : (k % 2 ? 'tractage' : 'marche');
  }
}
const plafond = (e: Etat) => { const j = e.joueur; if (j.mode === 'parti') return 16; const p = e.persos[j.perso]; return PLAFOND[clamp(e.partis[j.parti].chef === p.id ? 4 : p.rang, 0, 4)]; };
export const dirige = (e: Etat) => e.joueur.mode === 'parti' || (e.persos[e.joueur.perso]?.rang ?? 0) >= 1 || e.partis[e.joueur.parti].chef === e.joueur.perso;
const note = (g: Equipe, t: string) => { g.journal.unshift(t); if (g.journal.length > 12) g.journal.length = 12; };

const INCIDENTS: { id: string; titre: string; texte: string; campagne?: boolean; choix: { t: string; effet: string }[] }[] = [
  { id: 'affiches', titre: 'Affiches arrachées', texte: 'Toutes vos affiches de {q} ont été arrachées ou recouvertes dans la nuit. {m} est furieux et veut y retourner dès ce soir.', campagne: true, choix: [{ t: 'Recoller cette nuit', effet: 'recoller' }, { t: 'Publier les photos et dénoncer', effet: 'denoncer' }, { t: 'Laisser tomber ce quartier pour l\'instant', effet: 'laisser' }] },
  { id: 'derapage', titre: 'Un militant dérape', texte: '{m} a publié un message agressif sur Agora après une altercation sur le marché. Une capture d\'écran circule déjà.', choix: [{ t: 'Le recadrer en privé', effet: 'recadrer' }, { t: 'L\'écarter de l\'équipe', effet: 'ecarter' }, { t: 'Le couvrir : il a été provoqué', effet: 'couvrir' }] },
  { id: 'querelle', titre: 'Querelle dans l\'équipe', texte: '{m} et {n} ne se parlent plus depuis la dernière réunion. Chacun vous demande de trancher sur l\'organisation des sorties.', choix: [{ t: 'Donner raison à {m}', effet: 'raisonM' }, { t: 'Donner raison à {n}', effet: 'raisonN' }, { t: 'Les réunir autour d\'un verre', effet: 'mediation' }] },
  { id: 'don', titre: 'Un commerçant propose son aide', texte: 'Le patron d\'un café de {q} propose de prêter sa salle et d\'offrir les boissons pour vos réunions. Il aimerait en retour que vous parliez de la piétonnisation de sa rue.', choix: [{ t: 'Accepter et porter son sujet', effet: 'accepter' }, { t: 'Accepter la salle, sans engagement', effet: 'salle' }, { t: 'Refuser poliment', effet: 'refuser' }] },
  { id: 'rumeur', titre: 'Une rumeur dans le quartier', texte: 'À {q}, on raconte que votre section ne vient que pendant les campagnes. {m} l\'a entendu trois fois cette semaine.', choix: [{ t: 'Organiser une permanence chaque semaine', effet: 'permanence' }, { t: 'Répondre par un tract local', effet: 'tract' }, { t: 'Ne pas relever', effet: 'ignorer' }] },
  { id: 'copie', titre: 'Un rival copie votre idée', texte: 'La section d\'en face reprend mot pour mot votre proposition phare pour {q}, tract à l\'appui.', campagne: true, choix: [{ t: 'Le faire savoir, preuves à l\'appui', effet: 'denoncer' }, { t: 'Aller plus loin avec une proposition chiffrée', effet: 'surencherir' }, { t: 'En rire sur Agora', effet: 'rire' }] },
];
function ouvrirIncident(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, g: Equipe) {
  const liste = INCIDENTS.filter(i => (!i.campagne || g.campagne) && (i.id !== 'querelle' || g.membres.length >= 2)); if (!liste.length || !g.membres.length) return;
  const def = rng.pick(liste); const q = rng.int(0, g.quartiers.length - 1); const m = rng.pick(g.membres); const autres = g.membres.filter(x => x.id !== m.id); const n = autres.length ? rng.pick(autres) : m;
  const rem = (t: string) => t.replace(/\{q\}/g, g.quartiers[q].nom).replace(/\{m\}/g, `${m.prenom} ${m.nom}`).replace(/\{n\}/g, `${n.prenom} ${n.nom}`);
  g.incident = { id: def.id, titre: def.titre, texte: rem(def.texte), choix: def.choix.map(c => ({ t: rem(c.t), effet: c.effet })), quartier: q, m: m.id, n: n.id, expire: e.semaine + 2 };
  if (dirige(e) && !e.options.auto) message(e, ctx, 'terrain', def.titre, g.incident.texte + '\n\nÀ régler dans l\'écran Terrain.', true);
}
export function reglerIncident(e: Etat, d: Donnees, rng: Rng, g: Equipe, choix: number): string {
  const inc = g.incident; if (!inc) return ''; const c = inc.choix[clamp(choix, 0, inc.choix.length - 1)]; const q = g.quartiers[inc.quartier]; const m = g.membres.find(x => x.id === inc.m); const n = g.membres.find(x => x.id === inc.n); const P = e.partis[g.parti]; g.incident = null; let t = '';
  switch (c.effet) {
    case 'recoller': if (g.affiches >= 40) { g.affiches -= 40; q.ancrage = clamp(q.ancrage + 3, 0, 100); if (m) { m.fatigue = clamp(m.fatigue + 25, 0, 100); m.motiv = clamp(m.motiv + 8, 0, 100); } t = 'Au matin, tout est recollé. L\'équipe est fatiguée mais fière.'; } else { if (m) m.motiv = clamp(m.motiv - 6, 0, 100); t = 'Plus assez d\'affiches en stock. Commandez-en avant de promettre.'; } break;
    case 'denoncer': { const ok = rng.chance(0.6); P.notoriete = clamp(P.notoriete + (ok ? 0.05 : 0), 0, 100); q.ancrage = clamp(q.ancrage + (ok ? 2 : -1), 0, 100); t = ok ? 'La presse locale reprend l\'histoire. Vous passez pour les victimes d\'un procédé déloyal.' : 'On vous reproche de pleurnicher. L\'effet est nul, voire un peu négatif.'; break; }
    case 'laisser': q.ancrage = clamp(q.ancrage - 3, 0, 100); if (m) m.motiv = clamp(m.motiv - 8, 0, 100); t = 'Le quartier comprend que vous avez reculé.'; break;
    case 'recadrer': if (m) m.motiv = clamp(m.motiv - 10, 0, 100); P.credibilite = clamp(P.credibilite - 0.1, 0, 100); t = 'Il supprime son message et s\'excuse. L\'affaire retombe en deux jours.'; break;
    case 'ecarter': if (m) g.membres = g.membres.filter(x => x.id !== m.id); for (const x of g.membres) x.motiv = clamp(x.motiv - 4, 0, 100); t = 'Vous perdez un militant, et les autres notent que vous ne couvrez personne.'; break;
    case 'couvrir': { const mal = rng.chance(0.45); if (m) m.motiv = clamp(m.motiv + 15, 0, 100); if (mal) { P.credibilite = clamp(P.credibilite - 0.4, 0, 100); q.ancrage = clamp(q.ancrage - 4, 0, 100); } t = mal ? 'La capture tourne toute la semaine. Vous êtes associé au dérapage.' : 'L\'histoire s\'éteint. L\'équipe apprécie que vous l\'ayez défendu.'; break; }
    case 'raisonM': if (m) m.motiv = clamp(m.motiv + 12, 0, 100); if (n) n.motiv = clamp(n.motiv - 18, 0, 100); t = 'Décision nette. L\'un est ravi, l\'autre le prend mal.'; break;
    case 'raisonN': if (n) n.motiv = clamp(n.motiv + 12, 0, 100); if (m) m.motiv = clamp(m.motiv - 18, 0, 100); t = 'Décision nette. L\'un est ravi, l\'autre le prend mal.'; break;
    case 'mediation': if (g.caisse >= 30) { g.caisse -= 30; const ok = rng.chance(0.65); for (const x of [m, n]) if (x) x.motiv = clamp(x.motiv + (ok ? 8 : -4), 0, 100); t = ok ? 'Après deux tournées, ils se serrent la main.' : 'La soirée tourne court. Rien n\'est réglé.'; } else t = 'La caisse est vide, même pour un verre.'; break;
    case 'accepter': g.caisse += 150; q.ancrage = clamp(q.ancrage + 4, 0, 100); P.credibilite = clamp(P.credibilite - 0.05, 0, 100); t = 'Vous avez une salle et un allié. Et désormais un sujet à défendre que vous n\'aviez pas choisi.'; break;
    case 'salle': { const ok = rng.chance(0.5); if (ok) { g.caisse += 60; q.ancrage = clamp(q.ancrage + 2, 0, 100); } t = ok ? 'Il accepte quand même. La salle est à vous le jeudi soir.' : 'Il retire son offre, vexé.'; break; }
    case 'refuser': t = 'Vous restez libre de vos positions.'; break;
    case 'permanence': q.ancrage = clamp(q.ancrage + 5, 0, 100); for (const x of g.membres) x.fatigue = clamp(x.fatigue + 5, 0, 100); t = 'Une table, deux chaises, tous les mardis. La rumeur s\'éteint d\'elle-même.'; break;
    case 'tract': if (g.tracts >= 300) { g.tracts -= 300; q.ancrage = clamp(q.ancrage + 2, 0, 100); t = 'Un tract de quartier, avec des dates et des photos. Réponse correcte.'; } else t = 'Plus assez de tracts.'; break;
    case 'ignorer': q.ancrage = clamp(q.ancrage - 2, 0, 100); t = 'La rumeur continue de courir.'; break;
    case 'surencherir': { const ok = rng.chance(0.55 + (P.credibilite - 50) / 200); q.ancrage = clamp(q.ancrage + (ok ? 5 : 0), 0, 100); t = ok ? 'Votre version chiffrée rend la copie ridicule.' : 'Vos chiffres sont contestés. Match nul.'; break; }
    case 'rire': { const ok = rng.chance(0.5); P.viralite += ok ? 2 : 0; q.ancrage = clamp(q.ancrage + (ok ? 2 : -1), 0, 100); t = ok ? 'Le montage fait rire tout le quartier.' : 'La blague ne prend pas.'; break; }
  }
  note(g, `${inc.titre} : ${t}`); return t;
}

export function tourEquipe(e: Etat, d: Donnees, rng: Rng, ctx: Ctx) {
  const g = equipeDe(e, d, rng); const P = e.partis[g.parti]; const nP = e.partis.length; const chefEquipe = dirige(e) && !e.options.auto; g.jeux = {}; g.jeu = null;
  // Campagne : ouverte douze semaines avant un scrutin, close après le vote.
  const ech = e.calendrier.find(k => !k.fait1 && k.s1 >= e.semaine && k.type !== 'senatoriales'); /* les sénatoriales se jouent entre grands électeurs, pas sur le terrain */ const c = g.campagne;
  if (c && e.semaine > c.s1) cloreCampagne(e, d, rng, ctx, g);
  if (!g.campagne && ech && ech.s1 - e.semaine <= 12 && ech.s1 > e.semaine) { g.campagne = { type: ech.type, s1: ech.s1, maintenant: e.semaine, temps: {}, elan: 0, ref: 0 }; const cache = preparer(e, d); g.campagne.ref = intentions(e, d, cache, [g.zone])[P.idx] ?? 0; if (chefEquipe) message(e, ctx, 'terrain', 'La campagne est ouverte', `Scrutin dans ${ech.s1 - e.semaine} semaines (${jourVote(ech.s1)}). Commandez le matériel, placez l'équipe, préparez les temps forts dans l'écran Terrain.`, false); }
  if (g.campagne) { g.campagne.maintenant = e.semaine; g.campagne.elan *= 0.85; }
  // Livraisons.
  for (const k of g.commandes.filter(x => x.livraison <= e.semaine)) { if (k.quoi === 'tracts') g.tracts += k.qte; else g.affiches += k.qte; note(g, `Livraison : ${k.qte} ${k.quoi}.`); }
  g.commandes = g.commandes.filter(x => x.livraison > e.semaine);
  if (g.auto || !chefEquipe) { repartir(g); if (g.tracts < 400 && g.caisse >= MATERIEL.tracts.prix && !g.commandes.some(k => k.quoi === 'tracts')) commander(e, g, 'tracts'); if (g.campagne && g.affiches < 60 && g.caisse >= MATERIEL.affiches.prix + 100 && !g.commandes.some(k => k.quoi === 'affiches')) commander(e, g, 'affiches'); }
  // Travail de la semaine.
  let implZone = 0, mobZone = 0; const lieutenant = g.membres.some(m => m.lieutenant);
  for (const m of g.membres) {
    const act = ACTIONS_EQUIPE[m.action] ?? ACTIONS_EQUIPE.repos;
    if (m.action === 'repos' || m.quartier < 0) { m.fatigue = clamp(m.fatigue - 28, 0, 100); m.motiv = clamp(m.motiv + (m.motiv < 60 ? 2 : -1), 0, 100); continue; }
    if (m.action === 'formation') { const k = m.cible ?? 0; if (m.comp[k] < 18) m.comp[k]++; m.fatigue = clamp(m.fatigue - 10, 0, 100); m.motiv = clamp(m.motiv + 5, 0, 100); m.action = 'repos'; note(g, `${m.prenom} ${m.nom} progresse en ${COMPS[k].toLowerCase()} (${m.comp[k]}).`); continue; }
    const q = g.quartiers[m.quartier]; let mat = 1; if (act.tracts) { if (g.tracts >= act.tracts) g.tracts -= act.tracts; else mat = 0.5; } if (act.affiches) { if (g.affiches >= act.affiches) g.affiches -= act.affiches; else mat = 0.2; }
    const eff = (m.comp[act.comp] / 10) * m.dispo * (1 - m.fatigue / 150) * (0.4 + m.motiv / 110) * (0.7 + 0.3 * (q.accueil + 1) / 2) * mat * (lieutenant ? 1.1 : 1) * (m.bonus === e.semaine ? 1.4 : 1);
    q.ancrage = clamp(q.ancrage + eff * act.ancrage * 0.9 * (1 - q.ancrage / 100), 0, 100); q.contacts += Math.round(eff * act.ancrage * 3);
    implZone += eff * act.ancrage * q.poids; mobZone += eff * act.mob * q.poids;
    m.fatigue = clamp(m.fatigue + m.dispo * act.fatigue * 7, 0, 100); m.motiv = clamp(m.motiv + (m.fatigue > 75 ? -5 : 0) + (q.accueil < -0.3 ? -2 : 0.5) + (g.campagne ? 1 : 0), 0, 100);
    if (rng.chance(0.04) && m.comp[act.comp] < 17) m.comp[act.comp]++;
  }
  for (const q of g.quartiers) q.ancrage = clamp(q.ancrage - 0.25, 0, 100);
  const i = g.zone * nP + P.idx; e.impl[i] = clamp(e.impl[i] + 0.0022 * implZone, -2, 2); if (g.campagne) e.mob[i] = clamp(e.mob[i] + 0.012 * mobZone + g.campagne.elan * 0.004, 0, 1.2);
  // Départs, cotisations, candidats.
  for (const m of g.membres.slice()) if (m.motiv < 14 && rng.chance(0.4)) { g.membres = g.membres.filter(x => x.id !== m.id); note(g, `${m.prenom} ${m.nom} quitte l'équipe, démotivé.`); if (chefEquipe) message(e, ctx, 'terrain', 'Un militant s\'en va', `${m.prenom} ${m.nom} ne viendra plus. Trop de fatigue, pas assez de reconnaissance.`, false); }
  g.caisse += Math.round(g.membres.length * 4 + (g.campagne ? 12 : 0));
  g.candidats = g.candidats.filter(k => e.semaine - k.depuis < 5); const contacts = g.quartiers.reduce((s, q) => s + q.contacts, 0);
  if (g.candidats.length < 4 && rng.chance(clamp(0.1 + contacts / 6000 + (g.campagne ? 0.12 : 0) + P.dynamique / 300, 0.04, 0.5))) { const k = nouveauMilitant(e, d, rng, g, 6.5 + rng.next() * 3); g.candidats.push(k); if (!chefEquipe && g.membres.length < 7) { g.membres.push(k); g.candidats = g.candidats.filter(x => x.id !== k.id); } }
  if (!chefEquipe && g.incident) { reglerIncident(e, d, rng, g, rng.int(0, 2)); }
  if (g.incident && g.incident.expire < e.semaine) reglerIncident(e, d, rng, g, 2);
  if (!g.incident && rng.chance(g.campagne ? 0.16 : 0.05)) ouvrirIncident(e, d, rng, ctx, g);
  // Temps forts automatiques quand le joueur ne dirige pas.
  if (!chefEquipe && g.campagne) for (const k of Object.keys(TEMPS_FORTS)) { const T = TEMPS_FORTS[k]; const r = g.campagne.s1 - e.semaine; if (!g.campagne.temps[k] && r <= T.fenetre[0] && r >= T.fenetre[1] && g.caisse >= T.prix && g.membres.length >= T.besoin && rng.chance(0.6)) tempsFort(e, d, rng, g, k); }
}
export function commander(e: Etat, g: Equipe, quoi: string): string { const M = MATERIEL[quoi]; if (!M) return ''; if (g.caisse < M.prix) return `Il faut ${M.prix} € en caisse.`; g.caisse -= M.prix; g.commandes.push({ quoi, qte: M.qte, livraison: e.semaine + M.delai }); return `${M.qte} ${M.nom.toLowerCase()} commandés. Livraison dans ${M.delai} semaine${M.delai > 1 ? 's' : ''}.`; }
export function tempsFort(e: Etat, d: Donnees, rng: Rng, g: Equipe, k: string): string {
  const T = TEMPS_FORTS[k]; const c = g.campagne; if (!T || !c) return 'Pas de campagne en cours.'; if (c.temps[k]) return 'Déjà fait.'; const r = c.s1 - e.semaine; if (r > T.fenetre[0] || r < T.fenetre[1]) return `Ce temps fort se place entre ${T.fenetre[0]} et ${T.fenetre[1]} semaine(s) avant le vote.`;
  const dispo = g.membres.filter(m => m.fatigue < 80).length; if (dispo < T.besoin) return `Il faut ${T.besoin} militants en état de venir. Vous en avez ${dispo}.`; if (g.caisse < T.prix) return `Il faut ${T.prix} € en caisse.`;
  g.caisse -= T.prix; c.temps[k] = true; const orga = g.membres.reduce((s, m) => s + m.comp[2], 0) / (g.membres.length || 1); const x = (orga - 9) / 4 + rng.gauss() * 0.8 + dispo / 12; const reussi = x > 0;
  c.elan += T.elan * (reussi ? 1 : 0.35); for (const m of g.membres) { m.motiv = clamp(m.motiv + (reussi ? 8 : -3), 0, 100); m.fatigue = clamp(m.fatigue + 10, 0, 100); } for (const q of g.quartiers) q.ancrage = clamp(q.ancrage + (reussi ? 1.5 : 0.3), 0, 100);
  if (reussi) g.caisse += Math.round(T.prix * 0.5 + rng.next() * T.prix); const t = reussi ? `${T.nom} : salle pleine, ambiance, des dons à la sortie. L'élan est là.` : `${T.nom} : peu de monde, quelques couacs d'organisation. Effet limité.`; note(g, t); return t;
}
function cloreCampagne(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, g: Equipe) {
  const c = g.campagne!; const P = e.partis[g.parti]; const cache = preparer(e, d); const ints = intentions(e, d, cache, [g.zone]); const part = ints[P.idx] ?? 0; const rang = ints.filter(v => v > part).length + 1; const z = d.zones[g.zone];
  // Deux bureaux par quartier, autour du score de la zone, décalés selon l'accueil et l'ancrage.
  const bureaux: { nom: string; score: number; inscrits: number; enTete: boolean }[] = []; const seuil = Math.max(...ints.filter((_, k) => k !== P.idx));
  g.quartiers.forEach(q => { for (let b = 1; b <= 2; b++) { const s = clamp(part * (1 + q.accueil * 0.35 + (q.ancrage - 25) / 160) + rng.gauss() * 0.02, 0.005, 0.85); bureaux.push({ nom: `${q.nom}, bureau ${b}`, score: Math.round(s * 1000) / 10, inscrits: Math.round(z.inscrits * q.poids / 2 / 12) * 12 || 900, enTete: s > seuil * (1 - q.accueil * 0.1) }); } });
  for (let k = bureaux.length - 1; k > 0; k--) { const j2 = rng.int(0, k); [bureaux[k], bureaux[j2]] = [bureaux[j2], bureaux[k]]; }
  g.bilan = { type: c.type, s: e.semaine, score: Math.round(part * 1000) / 10, ref: Math.round(c.ref * 1000) / 10, rang, bureaux, annonce: null, temps: Object.keys(c.temps).length };
  for (const m of g.membres) m.motiv = clamp(m.motiv + (part > c.ref * 1.03 ? 10 : part < c.ref * 0.95 ? -10 : 2), 0, 100); g.campagne = null;
  if (dirige(e) && !e.options.auto) message(e, ctx, 'terrain', 'Soir de vote dans votre secteur', `Les bureaux de ${z.nom} remontent un par un. Suivez le dépouillement dans l'écran Terrain et choisissez le moment de vous exprimer.`, false);
  void journal;
}

// ---------- Mini-jeux ----------
function themeFort(d: Donnees, seg: number, rng: Rng, fiable: boolean): number { const pr = d.segments[seg].priorites; if (!fiable) return rng.int(0, pr.length - 1); let m = 0; pr.forEach((v, i) => { if (v > pr[m]) m = i; }); return m; }
const accord = (d: Donnees, P: Parti, seg: number, theme: number) => { const ax = d.themes[theme]?.axes ?? []; if (!ax.length) return 0; let s = 0; for (const a of ax) s += Math.sign(P.axes[a] * d.segments[seg].axes[a]) * Math.min(1, Math.abs(d.segments[seg].axes[a]) / 2); return s / ax.length; };
export function demarrerJeu(e: Etat, d: Donnees, rng: Rng, type: string, quartier: number): string {
  const g = equipeDe(e, d, rng); if (g.jeux[type]) return 'Une sortie de ce type par semaine.'; const q = g.quartiers[clamp(quartier, 0, g.quartiers.length - 1)]; const qi = g.quartiers.indexOf(q); const P = e.partis[g.parti];
  if (type === 'porte') {
    const portes = []; for (let k = 0; k < 5; k++) { const id = rng.pick(q.segs); const seg = d.segments.findIndex(s => s.id === id); const fiable = rng.chance(0.7); const th = themeFort(d, seg, rng, fiable); const autres = d.themes.map((_, i) => i).filter(i => i !== th); const opts = [th]; while (opts.length < 4) { const o = autres.splice(rng.int(0, autres.length - 1), 1)[0]; opts.push(o); } for (let a = opts.length - 1; a > 0; a--) { const b = rng.int(0, a); [opts[a], opts[b]] = [opts[b], opts[a]]; }
      portes.push({ seg, qui: d.segments[seg].nom, indice: d.themes[th].nom, humeur: rng.pick(['pressé', 'méfiant', 'bavard', 'poli', 'curieux']), options: opts, fait: -2, resultat: '' }); }
    g.jeu = { type, quartier: qi, portes, i: 0, score: 0 }; g.jeux[type] = true; return '';
  }
  if (type === 'tractage') {
    const lieux = [['Marché du samedi', 5], ['Sortie d\'école', 3], ['Gare, 7 heures', 4], ['Centre commercial', 4], ['Sortie des bureaux', 3], ['Place, dimanche matin', 2]] as [string, number][];
    const spots = lieux.map(([nom, base]) => { const id = rng.pick(q.segs); const seg = d.segments.findIndex(s => s.id === id); const aff = clamp(base + rng.int(-1, 1), 1, 5); let dist = 0; for (let a = 0; a < P.axes.length; a++) dist += (P.axes[a] - d.segments[seg].axes[a]) ** 2; return { nom, affluence: aff, public: d.segments[seg].nom, valeur: aff * (0.6 + clamp(1 - dist / 70, -0.5, 1) * 0.6) * (0.85 + rng.next() * 0.3), choisi: false }; });
    g.jeu = { type, quartier: qi, spots, restants: 3, score: 0, fini: false }; g.jeux[type] = true; return '';
  }
  return 'Jeu inconnu.';
}
export function jouer(e: Etat, d: Donnees, rng: Rng, a: any): string {
  const g = equipeDe(e, d, rng); const J = g.jeu; if (!J) return 'Aucune sortie en cours.'; const q = g.quartiers[J.quartier]; const P = e.partis[g.parti]; const nP = e.partis.length; const moi = e.joueur.mode === 'carriere' ? e.persos[e.joueur.perso] : null;
  if (J.type === 'porte') {
    const p = J.portes[J.i]; if (!p) return ''; const choix = +a.choix; let pts = 0; let t = '';
    if (choix === -1) { pts = 1; t = 'Vous écoutez dix minutes sans rien vendre. Il prend le tract et vous remercie d\'être venu.'; }
    else { const pr = d.segments[p.seg].priorites[choix] ?? 0; const ac = accord(d, P, p.seg, choix); if (ac < -0.25) { pts = -1; t = `Mauvais terrain : sur « ${d.themes[choix].nom} », il pense l'inverse de vous. La porte se referme.`; } else if (pr >= 4 && ac > 0.2) { pts = 3; t = `En plein dans le mille. « ${d.themes[choix].nom} », c'est son sujet, et vous êtes d'accord. Il veut être rappelé.`; } else if (pr >= 3) { pts = 2; t = 'Le sujet l\'intéresse. La discussion dure, il garde le tract.'; } else { pts = 0; t = 'Ce n\'est pas son sujet. Il hoche la tête et attend que vous partiez.'; } }
    p.fait = choix; p.resultat = t; J.score += pts; J.i++;
    if (J.i >= J.portes.length) finJeu(e, g, q, J.score / 15, moi, nP, P, 'porte');
    return t;
  }
  if (J.type === 'tractage') {
    const s = J.spots[+a.choix]; if (!s || s.choisi || J.restants <= 0) return ''; s.choisi = true; J.restants--; J.score += s.valeur;
    if (J.restants === 0) { const max = J.spots.map((x: any) => x.valeur).sort((x: number, y: number) => y - x).slice(0, 3).reduce((x: number, y: number) => x + y, 0); finJeu(e, g, q, J.score / (max || 1), moi, nP, P, 'tractage'); }
    return `${s.nom} : ${s.valeur > 3 ? 'les tracts partent tout seuls' : s.valeur > 1.8 ? 'accueil correct' : 'peu de monde, ou pas le bon public'}.`;
  }
  return '';
}
function finJeu(e: Etat, g: Equipe, q: Quartier, ratio: number, moi: any, nP: number, P: Parti, type: string) {
  const r = clamp(ratio, -0.3, 1); q.ancrage = clamp(q.ancrage + 4 * r, 0, 100); q.contacts += Math.round(12 * Math.max(0, r)); const i = g.zone * nP + P.idx; e.impl[i] = clamp(e.impl[i] + 0.004 * r * q.poids * 5, -2, 2); if (g.campagne) e.mob[i] = clamp(e.mob[i] + 0.01 * r, 0, 1.2);
  if (moi) { e.joueur.pointsVictoire.estime = clamp((e.joueur.pointsVictoire.estime ?? 0) + 1.2 * Math.max(0, r), 0, 100); moi.forme = clamp(moi.forme - 4, 0, 100); }
  for (const m of g.membres) if (m.quartier === g.quartiers.indexOf(q)) m.motiv = clamp(m.motiv + 3 * r, 0, 100);
  g.jeu.fini = true; g.jeu.bilan = r >= 0.75 ? 'Excellente sortie. On reparlera de vous dans le quartier.' : r >= 0.4 ? 'Bonne sortie. Quelques contacts à rappeler.' : r >= 0.1 ? 'Sortie moyenne.' : 'Sortie ratée. Le quartier n\'était pas d\'humeur.'; note(g, `${type === 'porte' ? 'Porte-à-porte' : 'Tractage'} à ${q.nom} : ${g.jeu.bilan}`);
}
// Dépouillement : le joueur annonce quand il veut. Tôt et juste, c'est payant. Tôt et faux, c'est une gaffe.
export function annoncer(e: Etat, d: Donnees, rng: Rng, vus: number, enTete: boolean): string {
  const g = equipeDe(e, d, rng); const b = g.bilan; if (!b || b.annonce) return ''; const vrai = b.rang === 1; const juste = vrai === enTete; const tot = b.bureaux.length; const avance = clamp((tot - vus) / tot, 0, 1); const P = e.partis[g.parti]; const moi = e.joueur.mode === 'carriere' ? e.persos[e.joueur.perso] : null;
  b.annonce = { vus, enTete, juste };
  if (juste) { const gain = 0.5 + 2.5 * avance; if (moi) { moi.notoriete = clamp(moi.notoriete + gain * 0.5, 0, 100); e.joueur.pointsVictoire.estime = clamp((e.joueur.pointsVictoire.estime ?? 0) + gain, 0, 100); } for (const m of g.membres) m.motiv = clamp(m.motiv + 4, 0, 100); return avance > 0.5 ? 'Vous parlez le premier, et vous avez raison. La presse locale reprend votre déclaration.' : 'Annonce prudente et juste.'; }
  P.gaffes += 0.6; P.credibilite = clamp(P.credibilite - 0.3, 0, 100); if (moi) { moi.moral = clamp(moi.moral - 8, 0, 100); e.joueur.pointsVictoire.estime = clamp((e.joueur.pointsVictoire.estime ?? 0) - 3, 0, 100); } return 'Vous avez parlé trop vite. Les derniers bureaux vous donnent tort, et la séquence tourne en boucle.';
}

// Discussions écrites avec un militant : une par semaine et par personne. La réponse dépend de son caractère et de son état.
const REPLIQUES: Record<string, (m: Militant, q: Quartier | null) => string> = {
  nouvelles: (m) => m.fatigue > 70 ? 'Franchement ? Je suis rincé. Trois sorties cette semaine, et lundi je bosse. Il faut que ça tourne un peu.' : m.motiv < 35 ? 'Bof. J\'ai l\'impression qu\'on colle des affiches pour rien. Personne ne nous dit jamais si ça sert.' : m.caractere === 'râleur' ? 'Ça va, ça va. Enfin, si on avait des tracts qui arrivent à l\'heure, ça irait mieux.' : m.caractere === 'ambitieux' ? 'Très bien. D\'ailleurs je voulais te parler : je pourrais prendre plus de responsabilités.' : 'Ça va bien. On a une bonne équipe, ça fait plaisir de venir.',
  quartier: (m, q) => !q ? 'Je suis au repos cette semaine, je n\'ai rien entendu de neuf.' : q.accueil < -0.2 ? `À ${q.nom}, c'est dur. On nous écoute poliment, mais on sent que ce n'est pas chez nous. Il faudrait y être toute l'année, pas seulement avant les votes.` : q.ancrage > 50 ? `À ${q.nom}, on commence à nous reconnaître. Les gens viennent nous parler d'eux-mêmes.` : `À ${q.nom}, les gens sont ouverts mais ils ne nous connaissent pas encore. Il faut insister.`,
  effort: (m) => m.fatigue > 60 ? 'Ce week-end ? Tu me demandes beaucoup. Bon, je viendrai, mais après je souffle.' : m.motiv > 60 ? 'Compte sur moi. Dis-moi où et à quelle heure.' : 'Je vais voir. Je ne te promets rien.',
};
export function parler(e: Etat, d: Donnees, rng: Rng, id: number, sujet: string): { ok: boolean; texte: string } {
  const g = equipeDe(e, d); const m = g.membres.find(x => x.id === id); if (!m) return { ok: false, texte: 'Militant introuvable.' }; if (m.parle === e.semaine) return { ok: false, texte: `Vous avez déjà pris le temps de parler avec ${m.prenom} cette semaine.` };
  m.parle = e.semaine; const q = m.quartier >= 0 ? g.quartiers[m.quartier] : null;
  if (sujet === 'libre') { m.motiv = clamp(m.motiv + 3, 0, 100); return { ok: true, texte: '' }; }
  const f = REPLIQUES[sujet] ?? REPLIQUES.nouvelles; const t = f(m, q);
  if (sujet === 'nouvelles') m.motiv = clamp(m.motiv + 4, 0, 100); if (sujet === 'quartier' && q) q.contacts += 2;
  if (sujet === 'effort') { if (m.fatigue > 60) { m.fatigue = clamp(m.fatigue + 12, 0, 100); m.motiv = clamp(m.motiv - 5, 0, 100); m.bonus = e.semaine + 1; } else if (m.motiv > 60) { m.bonus = e.semaine + 1; m.fatigue = clamp(m.fatigue + 8, 0, 100); } }
  return { ok: true, texte: t };
}

export function actionEquipe(e: Etat, d: Donnees, rng: Rng, a: any): { ok: boolean; texte: string } {
  const g = equipeDe(e, d, rng); const non = (t: string) => ({ ok: false, texte: t }), ok = (t = '') => ({ ok: true, texte: t }); const m = g.membres.find(x => x.id === a.id);
  if (a.type === 'jeuDemarrer') { const t = demarrerJeu(e, d, rng, a.jeu, +a.quartier); return t ? non(t) : ok(); }
  if (a.type === 'jeuChoix') return ok(jouer(e, d, rng, a));
  if (a.type === 'jeuFermer') { if (g.jeu?.fini) g.jeu = null; return ok(); }
  if (a.type === 'equipeAnnonce') return ok(annoncer(e, d, rng, +a.vus, !!a.enTete));
  if (a.type === 'equipeBilanVu') { g.bilan = null; return ok(); }
  if (a.type === 'equipeParler') return parler(e, d, rng, +a.id, String(a.sujet));
  if (!dirige(e)) return non('C\'est le responsable de section qui organise l\'équipe.');
  switch (a.type) {
    case 'equipeAuto': g.auto = !!a.valeur; if (g.auto) repartir(g); return ok(g.auto ? 'Votre lieutenant répartit l\'équipe chaque semaine.' : 'Vous placez l\'équipe vous-même.');
    case 'equipeAffecter': if (!m) return non('Militant introuvable.'); if (!ACTIONS_EQUIPE[a.action]) return non('Action inconnue.'); g.auto = false; m.action = a.action; m.quartier = a.action === 'repos' ? -1 : clamp(+a.quartier, 0, g.quartiers.length - 1); if (a.action === 'formation') m.cible = clamp(+a.cible | 0, 0, 3); return ok();
    case 'equipeRepartir': repartir(g); return ok('Équipe répartie.');
    case 'equipeRecruter': { const k = g.candidats.find(x => x.id === a.id); if (!k) return non('Candidat introuvable.'); if (g.membres.length >= plafond(e)) return non(`Votre équipe est au complet (${plafond(e)}). Il faut monter en responsabilité pour encadrer plus de monde.`); g.candidats = g.candidats.filter(x => x.id !== k.id); k.depuis = e.semaine; g.membres.push(k); return ok(`${k.prenom} ${k.nom} rejoint l'équipe.`); }
    case 'equipeRefuser': g.candidats = g.candidats.filter(x => x.id !== a.id); return ok();
    case 'equipeLieutenant': if (!m) return non('Militant introuvable.'); for (const x of g.membres) if (x.lieutenant && x.id !== m.id) { x.lieutenant = false; x.motiv = clamp(x.motiv - 12, 0, 100); } m.lieutenant = !m.lieutenant; m.motiv = clamp(m.motiv + (m.lieutenant ? 15 : -15), 0, 100); return ok(m.lieutenant ? `${m.prenom} ${m.nom} devient votre bras droit.` : `${m.prenom} ${m.nom} n'est plus votre bras droit.`);
    case 'equipeEcarter': if (!m) return non('Militant introuvable.'); g.membres = g.membres.filter(x => x.id !== m.id); for (const x of g.membres) x.motiv = clamp(x.motiv - 3, 0, 100); return ok(`${m.prenom} ${m.nom} quitte l'équipe.`);
    case 'equipeConvivial': if (g.caisse < 80) return non('Il faut 80 € en caisse.'); if (g.convivial === e.semaine) return non('Un moment convivial par semaine suffit.'); g.caisse -= 80; g.convivial = e.semaine; for (const x of g.membres) { x.motiv = clamp(x.motiv + 9, 0, 100); x.fatigue = clamp(x.fatigue - 8, 0, 100); } return ok('Apéritif de section. Tout le monde repart avec le sourire.');
    case 'equipeCommander': { const t = commander(e, g, a.quoi); return t.startsWith('Il faut') || !t ? non(t || 'Commande impossible.') : ok(t); }
    case 'equipeTemps': { const t = tempsFort(e, d, rng, g, a.quoi); return g.campagne?.temps[a.quoi] ? ok(t) : non(t); }
    case 'equipeIncident': return ok(reglerIncident(e, d, rng, g, +a.choix));
  }
  return non('Action inconnue.');
}

export function vueEquipe(e: Etat, d: Donnees) {
  const g = equipeDe(e, d); const z = d.zones[g.zone]; const c = g.campagne;
  return {
    lieu: z.nom, parti: e.partis[g.parti].nom, dirige: dirige(e), auto: g.auto, plafond: plafond(e), caisse: g.caisse, tracts: g.tracts, affiches: g.affiches, commandes: g.commandes.map(k => ({ ...k, dans: k.livraison - e.semaine })),
    membres: g.membres.map(m => ({ ...m, anciennete: e.semaine - m.depuis })), candidats: g.candidats, quartiers: g.quartiers.map((q, i) => ({ ...q, i, ancrage: Math.round(q.ancrage), accueil: Math.round(q.accueil * 100), effectif: g.membres.filter(m => m.quartier === i).length })),
    actions: ACTIONS_EQUIPE, comps: COMPS, materiel: MATERIEL, tempsForts: TEMPS_FORTS, incident: g.incident, journal: g.journal, jeu: g.jeu, jeux: g.jeux, bilan: g.bilan,
    campagne: c ? { type: c.type, dans: c.s1 - e.semaine, date: jourVote(c.s1), elan: Math.round(c.elan), temps: c.temps, ref: Math.round(c.ref * 1000) / 10 } : null,
    themes: d.themes.map(t => t.nom),
  };
}
