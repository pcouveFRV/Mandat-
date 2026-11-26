// Tests des modes de scrutin, du financement public et des comptes de campagne.
import { describe, it, expect } from 'vitest';
import { plusForteMoyenne, primeMajoritaire, tourDeListe, tourUninominal, europeennes, senatoriales, financementPublic, plafond, remboursement, risqueRejet, EURO_PAR_VOIX, EURO_PAR_PARLEMENTAIRE } from '../src/engine/systems/regles';

describe('proportionnelle à la plus forte moyenne', () => {
  it('répartit tous les sièges', () => { const s = plusForteMoyenne([340000, 280000, 160000, 60000, 15000], 7); expect(s.reduce((a, b) => a + b, 0)).toBe(7); expect(s).toEqual([3, 3, 1, 0, 0]); });
  it('écarte les listes sous le seuil', () => { const s = plusForteMoyenne([500, 300, 150, 49], 10, 0.05); expect(s[3]).toBe(0); expect(s.reduce((a, b) => a + b, 0)).toBe(10); });
});
describe('municipales : prime majoritaire de 50 %', () => {
  it('donne la moitié des sièges arrondie au supérieur à la liste en tête, puis la proportionnelle', () => {
    // 35 sièges, listes à 45 %, 35 %, 16 %, 4 % : prime de 18, puis 17 sièges entre les listes à 5 % et plus.
    const s = primeMajoritaire([4500, 3500, 1600, 400], 35, 0.5); expect(s.reduce((a, b) => a + b, 0)).toBe(35); expect(s[3]).toBe(0); expect(s[0]).toBe(18 + plusForteMoyenne([4500, 3500, 1600, 400], 17, 0.05)[0]); expect(s[0]).toBeGreaterThan(35 / 2);
  });
  it('garantit une majorité absolue au vainqueur même avec une faible avance', () => { const s = primeMajoritaire([3400, 3300, 3300], 33, 0.5); expect(s[0]).toBeGreaterThanOrEqual(17); });
  it('premier tour : élection à plus de 50 %, maintien à 10 %, fusion entre 5 % et 10 %', () => {
    expect(tourDeListe([5100, 3000, 1900]).gagnant).toBe(0);
    const t = tourDeListe([4000, 3000, 1500, 800, 700]); expect(t.gagnant).toBe(-1); expect(t.maintien).toEqual([0, 1, 2]); expect(t.fusion).toEqual([3, 4]);
  });
});
describe('régionales et Paris, Lyon, Marseille : prime de 25 %', () => {
  it('attribue un quart des sièges au vainqueur', () => { const s = primeMajoritaire([40, 35, 25], 100, 0.25); expect(s.reduce((a, b) => a + b, 0)).toBe(100); expect(s[0]).toBe(25 + 30); expect(s[1]).toBe(26); expect(s[2]).toBe(19); });
});
describe('législatives : scrutin uninominal à deux tours', () => {
  it('élit au premier tour avec la majorité absolue et 25 % des inscrits', () => { expect(tourUninominal([30000, 15000, 10000], 100000).elu).toBe(0); });
  it('n\'élit pas si le quart des inscrits n\'est pas atteint', () => { const t = tourUninominal([20000, 10000, 5000], 100000); expect(t.elu).toBe(-1); });
  it('qualifie les candidats à 12,5 % des inscrits', () => { const t = tourUninominal([22000, 18000, 13000, 9000], 100000); expect(t.qualifies).toEqual([0, 1, 2]); });
  it('qualifie les deux premiers si un seul ou aucun n\'atteint le seuil', () => { expect(tourUninominal([14000, 9000, 8000], 100000).qualifies).toEqual([0, 1]); expect(tourUninominal([9000, 8000, 7000], 100000).qualifies).toEqual([0, 1]); });
});
describe('européennes', () => {
  it('répartit 81 sièges entre les listes à 5 % et plus', () => { const v = [31.4, 14.6, 13.8, 9.9, 7.2, 5.5, 5.5, 4.9, 2.4, 2.0, 2.8]; const s = europeennes(v); expect(s.reduce((a, b) => a + b, 0)).toBe(81); expect(s[7]).toBe(0); expect(s[0]).toBe(30); expect(s[1]).toBe(13); expect(s[2]).toBe(13); expect(s[3]).toBe(9); });
});
describe('sénatoriales', () => {
  it('proportionnelle à partir de 3 sièges', () => { const s = senatoriales([500, 300, 200], 5); expect(s.reduce((a, b) => a + b, 0)).toBe(5); expect(s).toEqual([3, 1, 1]); });
  it('scrutin majoritaire pour 1 ou 2 sièges', () => { expect(senatoriales([500, 300, 200], 2)).toEqual([2, 0, 0]); });
});
describe('présidentielle', () => {
  it('qualifie les deux premiers quand personne n\'a la majorité absolue', () => { const t = tourUninominal([28, 24, 22, 15, 11].map(x => x * 100000), 48000000); expect(t.elu).toBe(-1); });
});
describe('financement public', () => {
  it('exige 1 % des voix dans 50 circonscriptions', () => { expect(financementPublic(500000, 49, 10, 280, 280).total).toBe(0); });
  it('additionne la fraction voix et la fraction parlementaires', () => { const f = financementPublic(1000000, 400, 50, 289, 288); expect(f.premiere).toBeCloseTo(1000000 * EURO_PAR_VOIX, 0); expect(f.seconde).toBe(50 * EURO_PAR_PARLEMENTAIRE); expect(f.retenue).toBe(0); });
  it('retient 150 % de l\'écart de parité sur la première fraction', () => { const f = financementPublic(1000000, 400, 0, 400, 200); const ecart = 200 / 600; expect(f.retenue).toBeCloseTo(1000000 * EURO_PAR_VOIX * 1.5 * ecart, 0); expect(f.total).toBeLessThan(1000000 * EURO_PAR_VOIX); });
});
describe('comptes de campagne', () => {
  it('plafonne la présidentielle à 16,851 M€ au premier tour et 22,509 M€ au second', () => { expect(plafond('presidentielle', 0)).toBe(16851000); expect(plafond('presidentielle', 0, true)).toBe(22509000); });
  it('plafonne les législatives à 38 000 € plus 0,15 € par habitant', () => { expect(plafond('legislatives', 120000)).toBe(38000 + 18000); });
  it('rembourse 47,5 % du plafond au-dessus de 5 % des voix, sans dépasser les dépenses', () => { expect(remboursement('legislatives', 56000, 40000, 0.12, false)).toBeCloseTo(26600, 0); expect(remboursement('legislatives', 56000, 10000, 0.12, false)).toBe(10000); expect(remboursement('legislatives', 56000, 40000, 0.04, false)).toBe(0); });
  it('ne rembourse rien en cas de rejet', () => { expect(remboursement('presidentielle', 16851000, 12000000, 0.2, true)).toBe(0); });
  it('rejette toujours un compte qui dépasse le plafond', () => { expect(risqueRejet(101, 100, 0)).toBe(1); expect(risqueRejet(90, 100, 0)).toBe(0); expect(risqueRejet(90, 100, 2)).toBeGreaterThan(0); });
});
