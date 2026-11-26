// Annuaire des élus : qui tient quoi autour du joueur, et prise de contact avec un élu.
import type { Donnees, Etat, Perso, Contact, Mandat } from '../types';
import { Rng, clamp } from '../rng';
import { nomComplet, LIB_MANDAT, creerPerso, donnerMandat, ajouterHist } from './personnages';
import { parcoursDe } from './parcours';
import { annee } from '../calendrier';

const POIDS: Record<string, number> = { president: 100, premier_ministre: 95, president_region: 80, president_dept: 75, senateur: 70, depute: 68, eurodepute: 60, maire: 55, conseiller_reg: 40, conseiller_dept: 38, adjoint: 30, conseiller_municipal: 20 };
const PORTEES = ['secteur', 'dept', 'region', 'national'];
function lieu(d: Donnees, m: Mandat): string { switch (m.type) { case 'maire': case 'adjoint': case 'conseiller_municipal': return d.villes[m.lieu]?.nom ?? ''; case 'depute': return d.circos[m.lieu]?.nomCourt ?? ''; case 'senateur': case 'president_dept': case 'conseiller_dept': return d.depts[m.lieu]?.nom ?? ''; case 'president_region': case 'conseiller_reg': return d.regions[m.lieu]?.nom ?? ''; default: return ''; } }
const poids = (p: Perso) => Math.max(0, ...p.mandats.map(m => POIDS[m.type] ?? 0)) + p.rang * 3 + p.notoriete / 20;
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function dansPortee(e: Etat, d: Donnees, p: Perso, moi: Perso, portee: string): boolean {
  const z = d.zones[moi.zone]; if (!z) return false; const villes = d.villes.filter(v => v.zones.includes(moi.zone)).map(v => v.idx); const circos = new Set(z.circos.map(c => c[0]));
  if (portee === 'national') return p.rang >= 4 || p.mandats.some(m => ['president', 'premier_ministre', 'president_region', 'eurodepute'].includes(m.type)) || p.notoriete >= 55;
  if (portee === 'region') return d.zones[p.zone]?.regIdx === z.regIdx && p.mandats.some(m => (POIDS[m.type] ?? 0) >= 38 || (m.type === 'maire' && (d.villes[m.lieu]?.pop ?? 0) >= 30000));
  if (portee === 'dept') return p.dept === z.deptIdx && (p.mandats.length > 0 || p.rang >= 2);
  return p.mandats.some(m => ((m.type === 'maire' || m.type === 'adjoint' || m.type === 'conseiller_municipal') && villes.includes(m.lieu)) || (m.type === 'depute' && circos.has(m.lieu)) || ((m.type === 'senateur' || m.type === 'president_dept') && m.lieu === z.deptIdx) || (m.type === 'president_region' && m.lieu === z.regIdx)) || (p.zone === moi.zone && (p.mandats.length > 0 || p.rang >= 1));
}

export function vueAnnuaire(e: Etat, d: Donnees, o: { portee?: string; q?: string; parti?: number }) {
  const moi = e.persos[e.joueur.perso]; if (!moi) return { lignes: [], total: 0, portee: 'secteur', reperes: [], partis: [], carriere: false, zone: '', dept: '', lieu: '' };
  const g = e.joueur.mode === 'carriere' ? parcoursDe(e, d) : null; const portee = PORTEES.includes(o.portee ?? '') ? o.portee! : 'secteur'; const q = norm(String(o.q ?? '')).slice(0, 40); const z = d.zones[moi.zone];
  let liste = e.persos.filter(p => p.statut === 'actif' && p.id !== moi.id && dansPortee(e, d, p, moi, portee));
  const parPartis: Record<number, number> = {}; for (const p of liste) parPartis[p.parti] = (parPartis[p.parti] ?? 0) + 1;
  const total = liste.length; if (o.parti !== undefined && o.parti >= 0) liste = liste.filter(p => p.parti === o.parti); if (q) liste = liste.filter(p => norm(nomComplet(p)).includes(q));
  liste.sort((a, b) => poids(b) - poids(a));
  const ligne = (p: Perso) => { const c = g?.contacts.find(x => x.perso === p.id); return { id: p.id, nom: nomComplet(p), parti: p.parti, age: annee(e.semaine) - p.naissance, reel: !!p.reel, rang: p.rang, notoriete: Math.round(p.notoriete), fonctions: p.mandats.slice().sort((a, b) => (POIDS[b.type] ?? 0) - (POIDS[a.type] ?? 0)).map(m => `${LIB_MANDAT[m.type]}${lieu(d, m) ? ` (${lieu(d, m)})` : ''}`), suivi: !!g?.suivis.includes(p.id), contact: c ? Math.round(c.relation) : -1, refus: g?.refus?.[p.id] !== undefined && e.semaine - g.refus[p.id] < 8 }; };
  // Repères : les quelques personnes qui tiennent le territoire du joueur.
  const reperes: { titre: string; id: number; nom: string; parti: number }[] = []; const rep = (titre: string, p?: Perso) => { if (p && p.statut === 'actif') reperes.push({ titre, id: p.id, nom: nomComplet(p), parti: p.parti }); };
  if (z) { const v = d.villes.find(x => x.zones.includes(moi.zone) && x.plm !== 1) ?? d.villes.find(x => x.zones.includes(moi.zone)); if (v) rep(`Maire de ${v.nom}`, e.persos[e.mairies[v.idx]?.maire]);
    for (const [ci] of z.circos.slice(0, 2)) rep(`Député (${d.circos[ci]?.nomCourt ?? ''})`, e.persos.find(p => p.statut === 'actif' && p.mandats.some(m => m.type === 'depute' && m.lieu === ci)));
    rep(`Président du département (${d.depts[z.deptIdx]?.nom ?? ''})`, e.persos.find(p => p.statut === 'actif' && p.mandats.some(m => m.type === 'president_dept' && m.lieu === z.deptIdx)));
    rep(`Président de région (${d.regions[z.regIdx]?.nom ?? ''})`, e.persos.find(p => p.statut === 'actif' && p.mandats.some(m => m.type === 'president_region' && m.lieu === z.regIdx))); }
  return { carriere: !!g, portee, total, lignes: liste.slice(0, 150).map(ligne), coupe: liste.length > 150, reperes, partis: Object.keys(parPartis).map(k => ({ parti: +k, n: parPartis[+k] })).filter(x => x.parti >= 0).sort((a, b) => b.n - a.n),
    zone: z?.id ?? '', dept: z?.dept ?? '', lieu: z?.nom ?? '', priseReste: g ? Math.max(0, 2 - (g.prises?.s === e.semaine ? g.prises.n : 0)) : 0, contactsRepertoire: g ? g.contacts.filter(c => c.repertoire).map(c => norm(`${c.prenom} ${c.nom}`)) : [] };
}

// Prise de contact : deux tentatives par semaine. Le résultat dépend du parti, de l'écart de rang et de la notoriété du joueur.
export function actionAnnuaire(e: Etat, d: Donnees, rng: Rng, a: any): { ok: boolean; texte: string } {
  const non = (texte: string) => ({ ok: false, texte }); if (e.joueur.mode !== 'carriere') return non('Le carnet de contacts existe en mode Carrière.'); const moi = e.persos[e.joueur.perso]; if (!moi) return non('Personnage introuvable.'); const g = parcoursDe(e, d);
  let q: Perso | undefined;
  if (a.type === 'annuaireContact') { q = e.persos[+a.id]; if (!q || q.statut !== 'actif' || q.id === moi.id) return non('Élu introuvable.'); }
  else { // un conseiller du répertoire officiel qui n'a pas encore de fiche dans la partie
    const x = a.elu ?? {}; const nom = String(x.nom ?? '').trim().slice(0, 40), prenom = String(x.prenom ?? '').trim().slice(0, 30); const zi = d.idxZone[String(x.zone ?? '')]; if (!nom || !prenom || zi === undefined || zi !== moi.zone) return non('Élu introuvable dans votre secteur.');
    q = e.persos.find(p => p.statut === 'actif' && norm(p.nom) === norm(nom) && norm(p.prenom) === norm(prenom) && p.dept === d.zones[zi].deptIdx);
    if (!q) { const pi = x.parti && d.idxParti[x.parti] !== undefined && e.partis[d.idxParti[x.parti]].actif ? d.idxParti[x.parti] : -1; const zz = d.zones[zi]; q = creerPerso(e, d, rng, { parti: pi >= 0 ? pi : moi.parti, dept: zz.deptIdx, zone: zi, rang: 1, sexe: x.sexe === 'F' ? 'F' : 'M', nom, prenom, age: clamp(annee(e.semaine) - (+x.naissance || 1975), 18, 95), reel: true }); if (pi < 0) q.parti = -1;
      const v = d.villes.find(k => k.zones.includes(zi) && k.plm !== 1) ?? d.villes.find(k => k.zones.includes(zi)); const f = String(x.fonction ?? '').slice(0, 60); if (v) { donnerMandat(e, q, /adjoint/i.test(f) ? 'adjoint' : 'conseiller_municipal', v.idx, true); ajouterHist(e, q, `${f || 'Conseiller municipal'} à ${v.nom}`); } }
  }
  if (g.contacts.some(c => c.perso === q!.id)) return non(`${nomComplet(q)} est déjà dans votre carnet.`);
  if (g.refus?.[q.id] !== undefined && e.semaine - g.refus[q.id] < 8) return non(`${nomComplet(q)} n'a pas donné suite. Laissez passer quelques semaines.`);
  const pr = g.prises?.s === e.semaine ? g.prises : { s: e.semaine, n: 0 }; if (pr.n >= 2) return non('Deux prises de contact par semaine, pas plus.'); pr.n++; g.prises = pr; moi.forme = clamp(moi.forme - 3, 0, 100);
  const meme = q.parti === moi.parti; const pm = (x: Perso) => Math.max(0, ...x.mandats.map(m => POIDS[m.type] ?? 0)); const ecart = Math.max(0, q.rang - moi.rang, Math.round((pm(q) - pm(moi)) / 20)); const chance = clamp(0.5 + (meme ? 0.25 : -0.1) - ecart * 0.13 + moi.notoriete / 160 + (q.zone === moi.zone ? 0.1 : 0), 0.03, 0.95);
  if (!rng.chance(chance)) { g.refus = g.refus ?? {}; g.refus[q.id] = e.semaine; return { ok: true, texte: `Votre message à ${nomComplet(q)} reste sans réponse. ${ecart >= 2 ? 'À ce niveau, on ne répond pas à tout le monde.' : meme ? 'Il faudra trouver une autre occasion.' : 'Vous n\'êtes pas du même bord, et il ne vous connaît pas.'}` }; }
  const fonction = q.mandats.slice().sort((x, y) => (POIDS[y.type] ?? 0) - (POIDS[x.type] ?? 0)).map(m => `${LIB_MANDAT[m.type]}${lieu(d, m) ? ` (${lieu(d, m)})` : ''}`)[0] ?? 'cadre'; const sigle = q.parti >= 0 ? e.partis[q.parti].sigle : 'sans étiquette';
  const c: Contact = { id: Math.max(0, ...g.contacts.map(x => x.id)) + 1, nom: q.nom, prenom: q.prenom, sexe: q.sexe, age: annee(e.semaine) - q.naissance, role: meme ? (ecart >= 1 ? 'cadre' : 'allie') : 'elu', qui: `${fonction.charAt(0).toUpperCase() + fonction.slice(1)}, ${sigle}`, relation: Math.round(clamp(32 + (meme ? 12 : 0) + rng.int(0, 12) - ecart * 3, 15, 60)), parle: e.semaine, dette: 0, caractere: rng.pick(['direct', 'prudent', 'chaleureux', 'calculateur', 'bourru', 'ironique']), perso: q.id, reel: !!q.reel, repertoire: a.type !== 'annuaireContact' };
  g.contacts.push(c);
  return { ok: true, texte: `${nomComplet(q)} accepte un café. Vous l'ajoutez à votre carnet.` };
}
