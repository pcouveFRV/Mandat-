// Doctrine : mouvement sur les axes, propositions phares, hégémonie culturelle.
import type { Donnees, Etat, Parti, Ctx, DonProposition } from '../types';
import { Rng, clamp } from '../rng';
import { message, journal } from './inbox';
import { cadres } from './partis';
import { nomComplet } from './personnages';

export function etatProposition(e: Etat, d: Donnees, P: Parti, pr: DonProposition): { ok: boolean; raison: string; adoptee: boolean } {
  if (P.propositions.includes(pr.id)) return { ok: false, raison: 'Déjà au programme', adoptee: true };
  const a = d.axes.findIndex(x => x.id === pr.axe); const pos = P.axes[a] * pr.pole;
  if (pos < pr.positionRequise) return { ok: false, raison: `Position requise sur l'axe ${d.axes[a].nom} : ${pr.pole > 0 ? '+' : '-'}${pr.positionRequise} ou plus marqué`, adoptee: false };
  if (P.credibilite < pr.credibiliteRequise) return { ok: false, raison: `Crédibilité requise : ${pr.credibiliteRequise}`, adoptee: false };
  if (P.capital < pr.coutCapital) return { ok: false, raison: `Capital politique requis : ${pr.coutCapital}`, adoptee: false };
  return { ok: true, raison: '', adoptee: false };
}
export function adopter(e: Etat, d: Donnees, ctx: Ctx | null, P: Parti, id: string): string {
  const pr = d.propositions.find(x => x.id === id); if (!pr) return 'Proposition inconnue.'; const st = etatProposition(e, d, P, pr); if (!st.ok) return st.raison + '.';
  P.capital -= pr.coutCapital; P.propositions.push(id); P.notoriete = clamp(P.notoriete + 0.5, 0, 100);
  const th = d.themes.findIndex(t => t.id === pr.theme); if (th >= 0) e.chocs.push({ theme: th, region: -1, val: 0.4, debut: e.semaine, fin: e.semaine + 20 });
  // Hégémonie culturelle : les partis qui portaient déjà la proposition marquent des points quand un autre la reprend.
  for (const Q of e.partis) { if (Q.idx === P.idx || !Q.propositions.includes(id)) continue; Q.culture += 10; if (Q.idx === e.joueur.parti && ctx) message(e, ctx, 'doctrine', 'Vos idées font école', `${P.nom} reprend votre proposition « ${pr.nom} ». Vous gagnez 10 points de victoire culturelle.`, false); }
  journal(e, `${P.sigle} met à son programme : ${pr.nom}`);
  return `« ${pr.nom} » entre au programme.`;
}
// Bouger sur un axe coûte de la crédibilité, d'autant plus que les mouvements récents sont nombreux, et peut braquer des cadres.
export function coutMouvement(P: Parti, delta: number): { credibilite: number; capital: number } { const recents = P.scoreIA.mouvements ?? 0; return { credibilite: Math.round(10 * Math.abs(delta) * 1.6 * (1 + recents * 0.8)) / 10, capital: 6 * Math.abs(delta) }; }
export function bougerAxe(e: Etat, d: Donnees, rng: Rng, ctx: Ctx | null, P: Parti, axe: number, delta: number): string {
  delta = clamp(Math.round(delta), -2, 2); if (!delta) return ''; const nv = clamp(P.axes[axe] + delta, -5, 5); if (nv === P.axes[axe]) return 'Position extrême déjà atteinte.';
  const c = coutMouvement(P, delta); if (P.capital < c.capital) return `Capital politique insuffisant (${c.capital} requis).`;
  P.capital -= c.capital; P.credibilite = clamp(P.credibilite - c.credibilite, 0, 100); P.scoreIA.mouvements = (P.scoreIA.mouvements ?? 0) + Math.abs(delta); P.axes[axe] = nv; P.unite = clamp(P.unite - 1.5 * Math.abs(delta), 0, 100);
  let frondeurs = 0; const departs: string[] = [];
  for (const p of cadres(e, P.idx, 2)) { const ecart = Math.abs(p.axes[axe] - nv); if (ecart >= 4) { frondeurs++; p.moral = clamp(p.moral - 12, 0, 100); if (p.moral < 25 && p.fidelite < 9 && p.id !== P.chef && p.id !== e.joueur.perso && rng.chance(0.25)) { departs.push(nomComplet(p)); p.parti = -1; p.postes = []; for (let i = 0; i < P.delegues.length; i++) if (P.delegues[i] === p.id) P.delegues[i] = -1; for (const k of Object.keys(P.bureau)) if (P.bureau[k] === p.id) P.bureau[k] = -1; p.hist.push({ s: e.semaine, t: `Quitte ${P.sigle} en désaccord avec la nouvelle ligne` }); } } else if (ecart <= 1) p.moral = clamp(p.moral + 3, 0, 100); }
  for (const cr of P.courants) if (cr.axe === axe) cr.humeur = clamp(cr.humeur + (Math.sign(delta) === cr.sens ? 15 : -15) * Math.abs(delta), 0, 100);
  // Les propositions qui ne correspondent plus à la ligne sont retirées.
  P.propositions = P.propositions.filter(id => { const pr = d.propositions.find(x => x.id === id)!; const a = d.axes.findIndex(x => x.id === pr.axe); return a !== axe || P.axes[a] * pr.pole >= pr.positionRequise - 1; });
  journal(e, `${P.sigle} déplace sa ligne sur l'axe ${d.axes[axe].nom}`);
  return `Ligne déplacée sur l'axe ${d.axes[axe].nom} (${nv > 0 ? '+' : ''}${nv}). Crédibilité -${c.credibilite}. ${frondeurs} cadres en désaccord${departs.length ? `, départ de ${departs.join(', ')}` : ''}.`;
}
export function tourDoctrine(e: Etat) { for (const P of e.partis) if (P.scoreIA.mouvements) P.scoreIA.mouvements = Math.max(0, P.scoreIA.mouvements - 0.12); }
