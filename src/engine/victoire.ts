// Conditions de victoire et de défaite, score final, Panthéon.
import type { Donnees, Etat, Ctx } from './types';
import { SEMAINE_FIN, annee, dateTexte } from './calendrier';
import { message } from './systems/inbox';
import { nbDeputes } from './systems/partis';
import { nomComplet, LIB_MANDAT } from './systems/personnages';

export const VICTOIRES: Record<string, { nom: string; points: number; desc: string }> = {
  elysee: { nom: 'Élysée', points: 1000, desc: 'Remporter l\'élection présidentielle.' },
  majorite: { nom: 'Majorité absolue', points: 600, desc: 'Obtenir 289 députés.' },
  hegemonie: { nom: 'Hégémonie locale', points: 500, desc: 'Diriger la majorité des villes de plus de 30 000 habitants et des régions.' },
  culture: { nom: 'Victoire culturelle', points: 400, desc: 'Atteindre 100 points d\'hégémonie culturelle : vos propositions sont reprises par les autres.' },
  longevite: { nom: 'Longévité', points: 400, desc: 'Rester 25 ans au premier plan.' },
};
export function tourVictoire(e: Etat, d: Donnees, ctx: Ctx) {
  const j = e.joueur; const P = e.partis[j.parti]; const pv = j.pointsVictoire; if (!P) return;
  const gagner = (k: string, txt: string) => { if (pv[k]) return; pv[k] = 1; message(e, ctx, 'victoire', `Victoire : ${VICTOIRES[k].nom}`, `${txt} (+${VICTOIRES[k].points} points). La partie continue.`, true, { action: { type: 'victoire', data: { type: k } } }); };
  if (P.actif) {
    if (nbDeputes(e, P.idx) >= 289) gagner('majorite', `${P.nom} détient la majorité absolue à l'Assemblée nationale.`);
    const gv = d.villes.filter(v => v.pop >= 30000 && v.plm !== 2); const mv = gv.filter(v => e.mairies[v.idx].parti === P.idx).length; const rg = e.conseilsReg.filter(c => c.parti >= 0); const mr = rg.filter(c => c.parti === P.idx).length;
    if (mv > gv.length / 2 && mr > rg.length / 2) gagner('hegemonie', `${P.nom} dirige ${mv} grandes villes sur ${gv.length} et ${mr} régions sur ${rg.length}.`);
    if (P.culture >= 100) gagner('culture', 'Vos idées dominent le débat : les autres partis reprennent vos propositions.');
    // Premier plan : parti parmi les trois premiers en intentions ou au gouvernement (mode Parti), personnage de rang national (mode Carrière).
    if (j.mode === 'parti') { const rangP = e.partis.filter(q => q.actif && (e.intentions[q.idx] ?? 0) > (e.intentions[P.idx] ?? 0)).length; if (rangP < 3 || e.gouvernement.coalition.includes(P.idx)) pv.semainesPremierPlan = (pv.semainesPremierPlan ?? 0) + 1; }
    else if ((e.persos[j.perso]?.rang ?? 0) >= 3) pv.semainesPremierPlan = (pv.semainesPremierPlan ?? 0) + 1;
    if ((pv.semainesPremierPlan ?? 0) >= 25 * 52) gagner('longevite', 'Vingt-cinq ans au premier plan de la vie politique.');
  }
  if (e.semaine >= SEMAINE_FIN && !j.fin) j.fin = { type: 'fin', titre: 'Fin de la partie', texte: `Nous sommes le ${dateTexte(e.semaine)}. L'heure du bilan a sonné.` };
  if (j.fin && j.scoreFinal === undefined) j.scoreFinal = score(e, d);
}
export function score(e: Etat, d: Donnees): number {
  const j = e.joueur; const P = e.partis[j.parti]; const pv = j.pointsVictoire; let s = 0;
  for (const k of Object.keys(VICTOIRES)) s += (pv[k] ?? 0) * VICTOIRES[k].points;
  if (P && P.actif) { s += nbDeputes(e, P.idx) * 1.2 + e.mairies.filter(m => m.parti === P.idx).length * 0.6 + e.conseilsReg.filter(c => c.parti === P.idx).length * 15 + e.conseilsDept.filter(c => c.parti === P.idx).length * 4 + P.culture * 2 + (e.intentions[P.idx] ?? 0) * 500; }
  const p = e.persos[j.perso]; if (j.mode === 'carriere' && p) s += p.notoriete * 3 + p.victoires * 20 + p.hist.length * 2 + (pv.activite ?? 0) * 2;
  s += Math.round((pv.semainesPremierPlan ?? 0) / 52) * 12 - j.trahisons * 40;
  return Math.max(0, Math.round(s));
}
// Fiche de carrière façon encyclopédie.
export function pantheon(e: Etat, d: Donnees) {
  const j = e.joueur; const P = e.partis[j.parti]; const p = e.persos[j.perso]; const pv = j.pointsVictoire;
  const victoires = Object.keys(VICTOIRES).filter(k => pv[k]).map(k => VICTOIRES[k].nom);
  const elections = e.archives.filter(a => a.tour !== 1).map(a => ({ titre: a.titre, resume: a.resume, joueur: a.sieges ? a.sieges[j.parti] : undefined }));
  const records: string[] = [];
  if (P) { const best = e.histIntentions.reduce((m, h) => Math.max(m, h.v[P.idx] ?? 0), 0); records.push(`Meilleur sondage : ${best} %`); const maxS = e.archives.filter(a => a.type === 'legislatives' && a.sieges).reduce((m, a) => Math.max(m, a.sieges![P.idx] ?? 0), 0); records.push(`Record de députés : ${maxS}`); records.push(`Villes dirigées à la fin : ${e.mairies.filter(m => m.parti === P.idx).length}`); records.push(`Points d'hégémonie culturelle : ${Math.round(P.culture)}`); }
  return {
    titre: j.mode === 'carriere' && p ? nomComplet(p) : P?.nom ?? '', sousTitre: j.mode === 'carriere' && p ? `${p.sexe === 'F' ? 'Femme' : 'Homme'} politique, née ou né en ${p.naissance} (${d.depts[p.dept]?.nom ?? ''})` : `Parti politique français (${P?.sigle ?? ''})`,
    periode: `${annee(e.debut)} - ${annee(e.semaine)}`, score: j.scoreFinal ?? score(e, d), victoires, fin: j.fin ?? null,
    mandats: p ? p.hist.filter(h => /Élu|Devient|Nommé|Prend|Fonde|Rejoint|Quitte|Investi/.test(h.t)).map(h => ({ date: dateTexte(h.s), texte: h.t })) : [], mandatsActuels: p ? p.mandats.map(m => LIB_MANDAT[m.type]) : [],
    records, trahisons: j.trahisons, citations: p ? p.citations.slice(-8) : [], elections,
    carte: Object.fromEntries(d.depts.map((dep, i) => [dep.code, e.conseilsDept[i]?.parti === j.parti ? 2 : d.villes.some(v => v.deptIdx === i && e.mairies[v.idx].parti === j.parti) || d.circos.some((c, ci) => c.dept === dep.code && e.assemblee[ci]?.parti === j.parti) ? 1 : 0])),
  };
}
