// Générateur aléatoire à graine (mulberry32). L'état du générateur est un entier stocké dans l'état de jeu :
// une même graine et les mêmes choix donnent exactement la même partie.
export class Rng {
  s: number;
  constructor(seed: number) { this.s = seed >>> 0; }
  next(): number { let a = (this.s = (this.s + 0x6D2B79F5) | 0); let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  int(min: number, max: number): number { return min + Math.floor(this.next() * (max - min + 1)); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(a: readonly T[]): T { return a[Math.floor(this.next() * a.length)]; }
  // Loi normale approchée (somme de 4 uniformes), moyenne 0, écart-type 1.
  gauss(): number { return (this.next() + this.next() + this.next() + this.next() - 2) * 1.732; }
  pondere(poids: number[]): number { let t = 0; for (const p of poids) t += p > 0 ? p : 0; if (t <= 0) return 0; let r = this.next() * t; for (let i = 0; i < poids.length; i++) { const p = poids[i] > 0 ? poids[i] : 0; if (r < p) return i; r -= p; } return poids.length - 1; }
  melange<T>(a: T[]): T[] { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
}
export function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export const clamp = (x: number, a: number, b: number) => x < a ? a : x > b ? b : x;
