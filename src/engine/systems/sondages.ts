// Sondages : intentions de vote réelles (cachées), publications des instituts avec marge d'erreur et biais, sondages commandés.
import type { Donnees, Etat, Ctx, Sondage } from '../types';
import { Rng, clamp, hash } from '../rng';
import { preparer, intentions, voter, FACTEUR_ABST } from './electorat';
import { candidatsPresidentielle } from './scrutins';
import { message } from './inbox';

// Instituts fictifs : écart-type du bruit (points) et biais selon la famille politique.
export const INSTITUTS = [
  { nom: 'Institut Montaigne Opinion', bruit: 1.1, biais: { droite_nationale: -0.8, gauche: 0.3 } }, { nom: 'Odyssée Sondages', bruit: 1.4, biais: { centre: 0.7 } },
  { nom: 'Baromètre Clisthène', bruit: 0.9, biais: {} }, { nom: 'Vox Populi Études', bruit: 1.8, biais: { droite_nationale: 0.9, gauche: -0.5 } }, { nom: 'Harmonie Interactive', bruit: 1.3, biais: { droite: 0.5 } },
] as const;

function publier(e: Etat, rng: Rng, vrai: number[], type: string, institut: typeof INSTITUTS[number], bruitK = 1, extra: Partial<Sondage> = {}): Sondage {
  const scores = vrai.map((v, i) => { if (v <= 0) return 0; const b = (institut.biais as any)[e.partis[i]?.famille] ?? 0; return Math.max(0, v * 100 + b + rng.gauss() * institut.bruit * bruitK * Math.sqrt(Math.max(0.05, v * (1 - v)) / 0.16)); });
  const tot = scores.reduce((a, b) => a + b, 0) || 1; const s: Sondage = { s: e.semaine, institut: institut.nom, type, scores: scores.map(x => Math.round(x * 1000 / tot) / 10), marge: Math.round(institut.bruit * bruitK * 20) / 10, ...extra };
  e.sondages.push(s); if (e.sondages.length > 160) e.sondages.shift(); return s;
}
export function tourSondages(e: Etat, d: Donnees, rng: Rng, ctx: Ctx) {
  const c = preparer(e, d); const avant = e.intentions; e.intentions = intentions(e, d, c);
  // La tendance des intentions nourrit la dynamique.
  if (avant.length) for (const P of e.partis) if (P.actif) P.dynamique = clamp(P.dynamique + (e.intentions[P.idx] - avant[P.idx]) * 250, -50, 50);
  if (e.semaine % 2 === 0) {
    const inst = INSTITUTS[(e.semaine / 2) % INSTITUTS.length | 0]; const s = publier(e, rng, e.intentions, 'legislatives', inst);
    if (e.semaine % 4 === 0) { e.histIntentions.push({ s: e.semaine, v: s.scores }); if (e.histIntentions.length > 330) e.histIntentions.shift(); const j = e.joueur.parti; message(e, ctx, 'sondage', `Sondage ${inst.nom}`, `Intentions de vote aux législatives : ${e.partis.filter(p => p.actif).sort((a, b) => s.scores[b.idx] - s.scores[a.idx]).slice(0, 6).map(p => `${p.sigle} ${s.scores[p.idx]} %`).join(', ')}. Votre parti : ${s.scores[j]} %. Marge d'erreur : ${s.marge} points.`, false); }
  }
  const pres = e.calendrier.find(x => x.type === 'presidentielle' && !x.fait1);
  if (pres && pres.s1 - e.semaine <= 34 && pres.s1 - e.semaine > 0 && e.semaine % 3 === 0) { const sp = sondagePresidentielle(e, d, rng, INSTITUTS[e.semaine % INSTITUTS.length]); if (sp && (pres.s1 - e.semaine) % 6 === 0) message(e, ctx, 'sondage', 'Sondage présidentielle', `Premier tour : ${sp.noms.slice(0, 6).join(', ')}.`, false); }
}
export function sondagePresidentielle(e: Etat, d: Donnees, rng: Rng, inst: typeof INSTITUTS[number], commande = false): { s: Sondage; noms: string[] } | null {
  const cands = e.partis.filter(P => P.actif && P.candidatPres >= 0); if (cands.length < 2) return null; const c = preparer(e, d); const zs = d.zones.map(z => z.idx); const L = cands.length;
  const reels = candidatsPresidentielle(e, d); const liste = reels.length >= 2 ? reels.map(x => ({ parti: x.parti, perso: x.perso, q: x.qualite, soutiens: x.soutiens })) : cands.map(P => ({ parti: P.idx, perso: P.candidatPres, q: 0, soutiens: [] as number[] }));
  const bonus = new Float32Array(zs.length * liste.length); for (let i = 0; i < zs.length; i++) for (let l = 0; l < liste.length; l++) bonus[i * liste.length + l] = liste[l].q * 1.7;
  const v = voter(e, d, c, zs, { partis: liste.map(x => x.parti), soutiens: liste.map(x => x.soutiens), bonus, facteur: FACTEUR_ABST.presidentielle }); void L;
  const tot = new Array(e.partis.length).fill(0); let T = 0; for (let i = 0; i < zs.length; i++) for (let l = 0; l < liste.length; l++) { tot[liste[l].parti] += v.voix[i * liste.length + l]; T += v.voix[i * liste.length + l]; }
  const s = publier(e, rng, tot.map(x => x / (T || 1)), 'presidentielle', inst, commande ? 0.6 : 1, { commande });
  const noms = liste.slice().sort((a, b) => s.scores[b.parti] - s.scores[a.parti]).map(x => `${e.persos[x.perso].prenom} ${e.persos[x.perso].nom} ${s.scores[x.parti]} %`);
  return { s, noms };
}
// Sondage commandé par le joueur : plus précis, national ou local (département).
export function commander(e: Etat, d: Donnees, rng: Rng, dept: number): { texte: string; cout: number } {
  const c = preparer(e, d); const local = dept >= 0; const cout = local ? 9000 : 28000; const zs = local ? d.zonesParDept[dept] : undefined;
  const vrai = local ? intentions(e, d, c, zs) : e.intentions; const s = publier(e, rng, vrai, 'legislatives', INSTITUTS[2], local ? 1.3 : 0.5, { commande: true, zone: local ? d.depts[dept].nom : undefined });
  return { cout, texte: `Sondage confidentiel${local ? ` (${d.depts[dept].nom})` : ''} : ${e.partis.filter(p => p.actif).sort((a, b) => s.scores[b.idx] - s.scores[a.idx]).slice(0, 8).map(p => `${p.sigle} ${s.scores[p.idx]} %`).join(', ')}. Marge d'erreur : ${s.marge} points.` };
}
// Estimation affichée sur la carte : valeur réelle brouillée de façon stable (le joueur ne voit jamais la valeur exacte).
export function brouiller(v: number, cle: string, semaine: number): number { const h = hash(cle + ':' + Math.floor(semaine / 4)); return Math.max(0, v + ((h % 2000) / 1000 - 1) * 0.02); }
