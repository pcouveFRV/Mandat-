// Personnages : génération, attributs, traits, progression, moral, relations, observation, mercato.
import type { Donnees, Etat, Perso, Ctx, Mandat } from '../types';
import { A, NB_ATTRS, NB_AXES } from '../types';
import { Rng, clamp } from '../rng';
import { annee } from '../calendrier';
import { message } from './inbox';

const FORMATIONS = ['Droit', 'Sciences politiques', 'Économie et gestion', 'Lettres et histoire', 'École de commerce', 'Formation technique', 'Santé', 'Ingénieur', 'Autodidacte', 'Haute fonction publique', 'Enseignement', 'Agriculture'];
const PROFESSIONS = ['Avocat', 'Enseignant', 'Cadre du privé', 'Fonctionnaire territorial', 'Chef d\'entreprise', 'Médecin', 'Agriculteur', 'Artisan', 'Collaborateur d\'élu', 'Ouvrier', 'Employé', 'Infirmier', 'Journaliste', 'Ingénieur', 'Commerçant', 'Étudiant', 'Cadre associatif', 'Haut fonctionnaire', 'Syndicaliste', 'Assureur'];
const ROLE_TRAITS: Record<string, string[]> = { chef_parti: ['homme_appareil', 'stratege'], maire: ['notable', 'gestionnaire'], president_region: ['notable', 'gestionnaire'], depute: ['populaire', 'debatteur'], senateur: ['homme_dossiers', 'negociateur'], eurodepute: ['homme_dossiers', 'intellectuel'], figure: ['tribun', 'bete_tele'], president_republique: ['stratege', 'sang_froid'], premier_ministre: ['homme_dossiers', 'bosseur'], president_senat: ['rassembleur', 'negociateur'], president_assemblee: ['rassembleur', 'sang_froid'] };
const INCOMPATIBLES: [string, string][] = [['fidele', 'opportuniste'], ['fidele', 'franc_tireur'], ['enfant_pays', 'parachute'], ['notable', 'parachute'], ['heritier', 'self_made'], ['gaffeur', 'sang_froid'], ['gaffeur', 'discret'], ['infatigable', 'fragile'], ['rassembleur', 'clivant'], ['bete_tele', 'discret'], ['idealiste', 'pragmatique'], ['idealiste', 'opportuniste'], ['technocrate', 'populaire'], ['bosseur', 'bete_tele']];

export interface OptPerso { parti: number; dept: number; zone?: number; age?: number; rang?: number; sexe?: 'M' | 'F'; nom?: string; prenom?: string; reel?: boolean; naissance?: number | null; roles?: string[]; niveau?: number }

export function nomAleatoire(d: Donnees, rng: Rng, sexe: 'M' | 'F', naissance: number, dept: number): { nom: string; prenom: string } {
  const gen = naissance < 1965 ? 0 : naissance < 1990 ? 1 : 2; const reg = d.depts[dept]?.region ?? '';
  const om = ['01', '02', '03', '04', '06', 'COM'].includes(reg); const locaux = om ? d.noms.noms.om : d.noms.noms[reg];
  const nom = locaux && rng.chance(om ? 0.6 : 0.4) ? rng.pick(locaux) : rng.pick(d.noms.noms.national);
  return { nom, prenom: rng.pick(d.noms.prenoms[sexe][gen]) };
}

export function creerPerso(e: Etat, d: Donnees, rng: Rng, o: OptPerso): Perso {
  const an = annee(e.semaine); const rang = o.rang ?? 0;
  const age = o.age ?? (o.naissance ? an - o.naissance : rang >= 3 ? rng.int(42, 68) : rang === 2 ? rng.int(35, 66) : rang === 1 ? rng.int(28, 64) : rng.int(19, 45));
  const naissance = o.naissance ?? an - age; const sexe = o.sexe ?? (rng.chance(0.45) ? 'F' : 'M');
  const nm = o.nom ? { nom: o.nom, prenom: o.prenom ?? '' } : nomAleatoire(d, rng, sexe, naissance, o.dept);
  const zs = d.zonesParDept[o.dept] ?? []; const zone = o.zone ?? (zs.length ? zs[rng.pondere(zs.map(z => d.zones[z].pop))] : 0);
  // Niveau moyen des attributs techniques : fonction neutre du rang (taille du mandat, ancienneté) plus un bruit.
  const niveau = o.niveau ?? [6.5, 9, 11, 12.8, 14.2][Math.min(4, rang)] + Math.min(1.5, Math.max(0, age - 35) * 0.04);
  const attrs: number[] = [];
  for (let i = 0; i < NB_ATTRS; i++) { const mental = i >= 9 && i <= 16; attrs.push(clamp(Math.round(mental ? 10.5 + rng.gauss() * 3.2 : niveau + rng.gauss() * 2.4), 1, 20)); }
  if (age > 62) attrs[A.energie] = clamp(attrs[A.energie] - Math.round((age - 62) / 4), 1, 20);
  attrs[A.ancrage] = clamp(attrs[A.ancrage] + (rang <= 2 ? 1 : -1), 1, 20);
  const reel = !!o.reel; let traits: string[] = [];
  if (reel) { for (const r of o.roles ?? []) { const k = r.split(':')[0]; for (const t of ROLE_TRAITS[k] ?? []) if (!traits.includes(t) && traits.length < 3) traits.push(t); } if (traits.length < 2) traits.push('pragmatique'); }
  else { const n = rng.int(2, 4); let garde = 0; while (traits.length < n && garde++ < 40) { const t = rng.pick(d.traits).id; if (traits.includes(t)) continue; if (INCOMPATIBLES.some(([a, b]) => (a === t && traits.includes(b)) || (b === t && traits.includes(a)))) continue; traits.push(t); } }
  const P = e.partis[o.parti]; const bruit = reel ? 0.9 : 1.8;
  const axes = Array.from({ length: NB_AXES }, (_, i) => clamp(Math.round((P ? P.axes[i] : 0) + rng.gauss() * bruit), -5, 5));
  const moyenne = attrs.slice(0, 9).reduce((a, b) => a + b, 0) / 9;
  const p: Perso = {
    id: e.persos.length, nom: nm.nom, prenom: nm.prenom, sexe, naissance, parti: o.parti, reel, dept: o.dept, zone, attrs,
    notoriete: clamp(Math.round([2, 8, 18, 45, 72][Math.min(4, rang)] + rng.gauss() * 5), 0, 100),
    pot: clamp(Math.round(moyenne + (age < 30 ? rng.int(1, 7) : age < 45 ? rng.int(0, 4) : rng.int(0, 2))), 1, 20),
    casserole: reel ? 0 : (rng.chance(0.12) ? 0.15 + rng.next() * 0.45 : rng.next() * 0.08),
    fidelite: clamp(Math.round(attrs[A.loyaute] + rng.gauss() * 3 + (traits.includes('fidele') ? 5 : 0) - (traits.includes('opportuniste') ? 4 : 0)), 1, 20),
    traits, axes, moral: 60 + rng.int(-10, 15), forme: 85 + rng.int(-10, 10), mandats: [], postes: [], rel: {}, hist: [], citations: [],
    statut: 'actif', formation: rng.pick(FORMATIONS), profession: age < 24 ? 'Étudiant' : rng.pick(PROFESSIONS), rang, victoires: 0, defaites: 0,
  };
  if (traits.includes('heritier')) p.attrs[A.reseau] = clamp(p.attrs[A.reseau] + 4, 1, 20);
  e.persos.push(p); return p;
}

export const nomComplet = (p: Perso) => `${p.prenom} ${p.nom}`.trim();
export const age = (e: Etat, p: Perso) => annee(e.semaine) - p.naissance;
export function ajouterHist(e: Etat, p: Perso, t: string) { p.hist.push({ s: e.semaine, t }); if (p.hist.length > 60) p.hist.splice(1, 1); }
export function donnerMandat(e: Etat, p: Perso, type: Mandat['type'], lieu: number, silencieux = false) { p.mandats = p.mandats.filter(m => !(m.type === type)); p.mandats.push({ type, lieu, debut: e.semaine }); if (!silencieux) ajouterHist(e, p, `Devient ${LIB_MANDAT[type]}`); const r = RANG_MANDAT[type]; if (r > p.rang) p.rang = r; }
export function retirerMandat(p: Perso, type: Mandat['type'], lieu?: number) { p.mandats = p.mandats.filter(m => !(m.type === type && (lieu === undefined || m.lieu === lieu))); }
export const aMandat = (p: Perso, type: Mandat['type']) => p.mandats.find(m => m.type === type);
export const LIB_MANDAT: Record<string, string> = { maire: 'maire', adjoint: 'adjoint au maire', conseiller_municipal: 'conseiller municipal', depute: 'député', senateur: 'sénateur', eurodepute: 'député européen', conseiller_dept: 'conseiller départemental', president_dept: 'président du conseil départemental', conseiller_reg: 'conseiller régional', president_region: 'président de région', president: 'président de la République', premier_ministre: 'Premier ministre' };
const RANG_MANDAT: Record<string, number> = { maire: 2, adjoint: 1, conseiller_municipal: 1, depute: 3, senateur: 3, eurodepute: 3, conseiller_dept: 1, president_dept: 3, conseiller_reg: 1, president_region: 3, president: 4, premier_ministre: 4 };
// Limitation du cumul : un parlementaire ne peut pas diriger un exécutif local (maire, président de département ou de région).
export function cumulInterdit(p: Perso, nouveau: Mandat['type']): Mandat['type'] | null {
  const parl = ['depute', 'senateur', 'eurodepute'], exec = ['maire', 'president_dept', 'president_region', 'adjoint'];
  if (parl.includes(nouveau)) { const m = p.mandats.find(x => exec.includes(x.type) || (parl.includes(x.type) && x.type !== nouveau)); return m ? m.type : null; }
  if (exec.includes(nouveau)) { const m = p.mandats.find(x => parl.includes(x.type) || (x.type !== nouveau && ['maire', 'president_dept', 'president_region'].includes(x.type) && nouveau !== 'adjoint')); return m ? m.type : null; }
  return null;
}

// Attribut effectif dans un contexte, avec les traits, la forme et le moral.
export function attr(d: Donnees, p: Perso, i: number, ctx?: string, chezLui = true): number {
  let v = p.attrs[i];
  if (ctx) for (const t of p.traits) { const m = d.traitsParId[t]?.mods; if (!m) continue; if (m[ctx]) v += m[ctx]; if (chezLui && m.local && (ctx === 'terrain' || ctx === 'campagne')) v += m.local * 0.5; if (!chezLui && m.ailleurs && (ctx === 'terrain' || ctx === 'campagne')) v += m.ailleurs; }
  v *= 0.75 + 0.25 * (p.forme / 100); v += (p.moral - 60) / 40;
  return clamp(v, 1, 22);
}
export function modTrait(d: Donnees, p: Perso, cle: string, defaut: number, produit = false): number { let v = defaut; for (const t of p.traits) { const m = d.traitsParId[t]?.mods?.[cle]; if (m !== undefined) v = produit ? v * m : v + m; } return v; }
// Qualité de candidat (bonus d'utilité électorale, de -0,3 à +0,7 environ).
export function qualiteCandidat(d: Donnees, p: Perso, zoneLocale: boolean, national = false): number {
  const base = national ? (attr(d, p, A.charisme, 'campagne') + attr(d, p, A.eloquence, 'campagne') + attr(d, p, A.medias, 'tv')) / 3 : (attr(d, p, A.terrain, 'terrain', zoneLocale) + attr(d, p, A.charisme, 'campagne', zoneLocale) + (zoneLocale ? p.attrs[A.ancrage] + modTrait(d, p, 'local', 0) : 6 + modTrait(d, p, 'ailleurs', 0))) / 3;
  return clamp((base - 10) * 0.06 + (p.notoriete - (national ? 50 : 20)) * (national ? 0.008 : 0.004), -0.4, 0.9);
}

// Progression mensuelle : pratique, formation, mentorat, âge, usure.
export function progressionMensuelle(e: Etat, d: Donnees, rng: Rng) {
  const an = annee(e.semaine);
  for (const p of e.persos) {
    if (p.statut !== 'actif') continue; const ag = an - p.naissance; const P = p.parti >= 0 ? e.partis[p.parti] : null;
    const vitesse = modTrait(d, p, 'progression', 1, true) * (ag < 30 ? 1.6 : ag < 45 ? 1 : ag < 60 ? 0.5 : 0.15) * (P ? 1 + P.budgetFormation / 400000 : 1);
    const mentor = Object.values(p.rel).some(r => r.t === 'mentor') ? 1.3 : 1;
    const actif = p.mandats.length > 0 || p.postes.length > 0 ? 1.4 : 1;
    if (rng.chance(0.16 * vitesse * mentor * actif)) { // un attribut technique ou social progresse vers le potentiel
      const pool = p.mandats.some(m => m.type === 'maire' || m.type.startsWith('president')) ? [A.gestion, A.dossiers, A.negociation, A.ancrage, A.reseau] : p.mandats.some(m => m.type === 'depute' || m.type === 'senateur') ? [A.debat, A.dossiers, A.eloquence, A.medias, A.reseau] : [A.terrain, A.organisation, A.eloquence, A.reseaux, A.ancrage, A.charisme];
      const i = rng.pick(pool); if (p.attrs[i] < p.pot + 2 && p.attrs[i] < 20) p.attrs[i]++;
    }
    if (ag > 62 && rng.chance(0.05 + (ag - 62) * 0.006)) { const i = rng.pick([A.energie, A.terrain, A.reseaux, A.resistance]); if (p.attrs[i] > 3) p.attrs[i]--; }
    // Forme et moral reviennent lentement vers leur niveau de repos.
    const usure = modTrait(d, p, 'usure', 1, true); p.forme = clamp(p.forme + (88 - p.forme) * 0.25 / usure + (p.attrs[A.energie] - 10) * 0.3, 5, 100); p.moral = clamp(p.moral + (60 - p.moral) * 0.12, 0, 100);
    if (p.notoriete > 3 && p.mandats.length === 0 && p.postes.length === 0 && rng.chance(0.3)) p.notoriete -= 1;
  }
}

// Vieillissement annuel : retraits, décès (personnages générés uniquement), nouveaux talents.
export function cycleAnnuel(e: Etat, d: Donnees, rng: Rng, ctx: Ctx) {
  const an = annee(e.semaine);
  for (const p of e.persos) {
    if (p.statut !== 'actif' || p.id === e.joueur.perso) continue; const ag = an - p.naissance;
    if (!p.reel && ag > 55 && rng.chance(Math.min(0.2, 0.0006 * Math.exp((ag - 55) * 0.11)))) { p.statut = 'mort'; liberer(e, p); if (p.parti === e.joueur.parti && p.rang >= 2) message(e, ctx, 'parti', `Décès de ${nomComplet(p)}`, `${nomComplet(p)} est décédé à ${ag} ans. Le parti lui rend hommage.`, false); continue; }
    if (ag >= 70 && p.mandats.length === 0 && rng.chance(0.25)) { p.statut = 'retire'; liberer(e, p); continue; }
    if (ag >= 78 && rng.chance(0.35) && !p.mandats.some(m => m.type === 'president')) { p.statut = 'retire'; ajouterHist(e, p, 'Se retire de la vie politique'); liberer(e, p); }
  }
  for (const P of e.partis) {
    if (!P.actif) continue; const n = clamp(Math.round(P.adherents / 9000), 2, 12);
    for (let i = 0; i < n; i++) { const dept = rng.pondere(P.adhDept); const p = creerPerso(e, d, rng, { parti: P.idx, dept, age: rng.int(18, 27), rang: 0 }); p.postes.push('jeune'); if (rng.chance(0.25)) p.pot = clamp(p.pot + rng.int(2, 5), 1, 20); if (P.idx === e.joueur.parti && p.pot >= 15 && e.joueur.mode === 'parti') message(e, ctx, 'parti', 'Un jeune talent repéré', `${nomComplet(p)}, ${an - p.naissance} ans, militant en ${d.depts[dept].nom}, impressionne ses responsables. Un rapport d'observation permettrait d'en savoir plus.`, false); }
  }
}
// Libère les postes d'un personnage qui quitte la vie politique (les sièges sont remplacés par un suppléant du même parti).
export function liberer(e: Etat, p: Perso) {
  for (const P of e.partis) { if (P.chef === p.id) P.chef = -1; for (const k of Object.keys(P.bureau)) if (P.bureau[k] === p.id) P.bureau[k] = -1; for (let i = 0; i < P.delegues.length; i++) if (P.delegues[i] === p.id) P.delegues[i] = -1; }
  p.postes = [];
}

// Relations.
export function lier(a: Perso, b: Perso, t: 'ami' | 'rival' | 'dette' | 'mentor' | 'inimitie', v: number) { a.rel[b.id] = { t, v }; b.rel[a.id] = { t: t === 'mentor' ? 'dette' : t, v }; if (Object.keys(a.rel).length > 12) delete a.rel[+Object.keys(a.rel)[0]]; }
export function tisserRelations(e: Etat, rng: Rng, persos: Perso[]) {
  for (const p of persos) { if (!rng.chance(0.5) || persos.length < 3) continue; const q = rng.pick(persos); if (q.id === p.id || p.rel[q.id]) continue; const proche = p.axes.reduce((s, x, i) => s + Math.abs(x - q.axes[i]), 0) < 9; const r = rng.next(); if (q.naissance < p.naissance - 15 && r < 0.25) lier(q, p, 'mentor', 60); else if (proche && r < 0.6) lier(p, q, 'ami', 40 + rng.int(0, 40)); else if (!proche || r > 0.85) lier(p, q, p.attrs[A.rancune] > 13 ? 'inimitie' : 'rival', 30 + rng.int(0, 50)); }
}

// Rapport d'observation : estimation des valeurs cachées avec une marge qui dépend de l'observateur.
export function observer(e: Etat, d: Donnees, rng: Rng, observateur: Perso, cible: Perso) {
  const comp = (attr(d, observateur, A.reseau) + attr(d, observateur, A.dossiers) + attr(d, observateur, A.negociation)) / 3; const marge = clamp(Math.round(6 - comp / 3.5), 1, 5);
  const est = (v: number) => clamp(Math.round(v + rng.gauss() * marge * 0.6), 1, 20);
  cible.observe = { s: e.semaine, pot: est(cible.pot), fidelite: est(cible.fidelite), casserole: clamp(Math.round((cible.casserole + rng.gauss() * marge * 0.04) * 100) / 100, 0, 1), marge };
}

// Mercato : probabilité qu'un personnage accepte de changer de parti.
export function chanceDebauchage(e: Etat, d: Donnees, cible: Perso, vers: number, offre: string): number {
  if (cible.parti === vers || cible.statut !== 'actif') return 0; const de = cible.parti >= 0 ? e.partis[cible.parti] : null; const V = e.partis[vers];
  let dist = 0; for (let i = 0; i < NB_AXES; i++) dist += Math.abs(cible.axes[i] - V.axes[i]);
  let x = -1.5 - (cible.fidelite - 10) * 0.28 + (cible.attrs[A.opportunisme] - 10) * 0.15 + (cible.attrs[A.ambition] - 10) * 0.1 - dist * 0.09;
  x += { poste: 0.8, investiture: 1.0, tete_de_liste: 1.4, rien: 0 }[offre] ?? 0;
  if (de) { x += (60 - de.unite) / 40 + (cible.moral < 40 ? 0.8 : 0) + (V.dynamique - de.dynamique) / 25; if (de.chef === cible.id) x -= 4; }
  if (cible.reel && cible.rang >= 4) x -= 2.5;
  return clamp(1 / (1 + Math.exp(-x)), 0, 0.9);
}
export function transferer(e: Etat, d: Donnees, cible: Perso, vers: number) {
  const de = cible.parti; liberer(e, cible); cible.parti = vers; ajouterHist(e, cible, `Rejoint ${e.partis[vers].sigle}${de >= 0 ? ' en quittant ' + e.partis[de].sigle : ''}`);
  // Une partie de son électorat local le suit.
  const nP = e.partis.length; const poids = clamp(cible.attrs[A.ancrage] * 0.012 + cible.notoriete * 0.002, 0.03, 0.4);
  const zs = cible.mandats.some(m => m.type === 'depute' || m.type === 'senateur' || m.type.startsWith('president')) ? d.zonesParDept[cible.dept].filter(z => d.zones[z].circos.some(c => d.zones[cible.zone].circos.some(c2 => c2[0] === c[0]))) : [cible.zone];
  for (const z of zs) { e.impl[z * nP + vers] += poids; if (de >= 0) e.impl[z * nP + de] -= poids * 0.7; }
  for (const s of e.assemblee) if (s.perso === cible.id) s.parti = vers; for (const l of e.senat) for (const s of l) if (s.perso === cible.id) s.parti = vers; for (const s of e.europe) if (s.perso === cible.id) s.parti = vers;
  for (const m of e.mairies) if (m.maire === cible.id) { m.parti = vers; }
  if (de >= 0) { const n = e.partis.length; e.relPartis[de * n + vers] -= 6; e.relPartis[vers * n + de] -= 6; }
}
