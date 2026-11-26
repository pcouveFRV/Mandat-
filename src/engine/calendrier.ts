// Calendrier : 1 tour = 1 semaine. La semaine 0 commence le lundi 5 janvier 2026.
import type { Echeance, Scrutin } from './types';

const EPOCH = Date.UTC(2026, 0, 5);
const JOUR = 86400000;
export const SEMAINE_FIN = semaineDe(2050, 12, 31);
export function dateDe(s: number): Date { return new Date(EPOCH + s * 7 * JOUR); }
export function semaineDe(annee: number, mois: number, jour: number): number { return Math.floor((Date.UTC(annee, mois - 1, jour) - EPOCH) / (7 * JOUR)); }
export function annee(s: number): number { return dateDe(s).getUTCFullYear(); }
export function mois(s: number): number { return dateDe(s).getUTCMonth() + 1; }
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export function dateTexte(s: number): string { const d = dateDe(s); const j = d.getUTCDate(); return `${j === 1 ? '1er' : j} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; }
export function moisTexte(s: number): string { const d = dateDe(s); return `${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; }
// Dimanche de vote = fin de la semaine s. On renvoie la semaine qui contient ce dimanche.
const dim = (a: number, m: number, j: number) => semaineDe(a, m, j);
export const NOM_SCRUTIN: Record<Scrutin, string> = { municipales: 'Élections municipales', departementales: 'Élections départementales', regionales: 'Élections régionales', legislatives: 'Élections législatives', europeennes: 'Élections européennes', senatoriales: 'Élections sénatoriales', presidentielle: 'Élection présidentielle' };
export const DUREE_CAMPAGNE: Record<Scrutin, number> = { municipales: 10, departementales: 8, regionales: 8, legislatives: 6, europeennes: 8, senatoriales: 6, presidentielle: 12 };

// Calendrier réel puis projeté selon les durées légales des mandats (jusqu'en 2050).
// Présidentielle : avril 2027 puis tous les 5 ans. Législatives : juin, après la présidentielle (le président élu dissout ou le mandat arrive à terme).
// Municipales : mars 2032, 2038, 2044, 2050. Départementales et régionales : mars 2028 puis tous les 6 ans. Européennes : juin 2029 puis tous les 5 ans.
// Sénatoriales : septembre 2026 (série 2), puis tous les 3 ans en alternant les séries.
export function calendrierInitial(depuis: number): Echeance[] {
  const l: Echeance[] = [];
  for (let a = 2027; a <= 2050; a += 5) { l.push({ type: 'presidentielle', s1: dim(a, 4, 11), s2: dim(a, 4, 25) }); l.push({ type: 'legislatives', s1: dim(a, 6, 13), s2: dim(a, 6, 20) }); }
  for (let a = 2032; a <= 2050; a += 6) l.push({ type: 'municipales', s1: dim(a, 3, 14), s2: dim(a, 3, 21) });
  for (let a = 2028; a <= 2050; a += 6) { l.push({ type: 'departementales', s1: dim(a, 3, 12), s2: dim(a, 3, 19) }); l.push({ type: 'regionales', s1: dim(a, 3, 12), s2: dim(a, 3, 19) }); }
  for (let a = 2029; a <= 2050; a += 5) l.push({ type: 'europeennes', s1: dim(a, 6, 10), s2: -1 });
  let serie = 2; for (let a = 2026; a <= 2050; a += 3) { l.push({ type: 'senatoriales', s1: dim(a, 9, 27), s2: -1, serie }); serie = serie === 2 ? 1 : 2; }
  return l.filter(e => e.s1 >= depuis).sort((a, b) => a.s1 - b.s1 || a.type.localeCompare(b.type));
}
export function prochaine(cal: Echeance[], s: number, type?: Scrutin): Echeance | undefined { return cal.find(e => (e.s2 > 0 ? e.s2 : e.s1) >= s && (!type || e.type === type)); }
