// Règles des modes de scrutin, en fonctions pures (testées dans tests/regles.test.ts).

// Représentation proportionnelle à la plus forte moyenne (méthode d'Hondt) entre les listes qui atteignent le seuil (part des exprimés).
export function plusForteMoyenne(voix: number[], sieges: number, seuil = 0): number[] {
  const tot = voix.reduce((a, b) => a + b, 0); const res = voix.map(() => 0); if (tot <= 0 || sieges <= 0) return res;
  const ok = voix.map(v => v / tot >= seuil && v > 0);
  for (let s = 0; s < sieges; s++) { let best = -1, bq = -1; for (let i = 0; i < voix.length; i++) { if (!ok[i]) continue; const q = voix[i] / (res[i] + 1); if (q > bq) { bq = q; best = i; } } if (best < 0) break; res[best]++; }
  return res;
}
// Scrutin de liste avec prime majoritaire (municipales : prime de 50 %, régionales et conseils de Paris, Lyon, Marseille : 25 %).
// La liste arrivée en tête reçoit la prime (arrondie à l'entier supérieur pour 50 %, au plus proche sinon), le reste est réparti à la proportionnelle
// à la plus forte moyenne entre toutes les listes ayant obtenu au moins 5 % des exprimés.
export function primeMajoritaire(voix: number[], sieges: number, prime: number, seuil = 0.05): number[] {
  let g = 0; for (let i = 1; i < voix.length; i++) if (voix[i] > voix[g]) g = i;
  const nPrime = prime >= 0.5 ? Math.ceil(sieges * prime) : Math.round(sieges * prime);
  const res = plusForteMoyenne(voix, sieges - nPrime, seuil); res[g] += nPrime; return res;
}
// Municipales et régionales, premier tour : une liste est élue si elle dépasse 50 % des exprimés. Sinon, les listes à 10 % peuvent se maintenir,
// celles entre 5 % et 10 % peuvent fusionner avec une liste maintenue.
export function tourDeListe(voix: number[]): { gagnant: number; maintien: number[]; fusion: number[] } {
  const tot = voix.reduce((a, b) => a + b, 0) || 1; let gagnant = -1; const maintien: number[] = [], fusion: number[] = [];
  voix.forEach((v, i) => { const p = v / tot; if (p > 0.5) gagnant = i; if (p >= 0.1) maintien.push(i); else if (p >= 0.05) fusion.push(i); });
  if (maintien.length < 2 && gagnant < 0) { const ordre = voix.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).map(x => x[1]); maintien.length = 0; maintien.push(...ordre.slice(0, 2)); for (const i of maintien) { const k = fusion.indexOf(i); if (k >= 0) fusion.splice(k, 1); } }
  return { gagnant, maintien, fusion };
}
// Législatives (et départementales), premier tour : élu si majorité absolue des exprimés et au moins 25 % des inscrits.
// Qualifiés pour le second tour : candidats ayant au moins 12,5 % des inscrits ; s'il y en a moins de deux, les deux premiers.
export function tourUninominal(voix: number[], inscrits: number): { elu: number; qualifies: number[] } {
  const tot = voix.reduce((a, b) => a + b, 0) || 1; const ordre = voix.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
  const p = ordre[0]; if (voix[p] / tot > 0.5 && voix[p] >= 0.25 * inscrits) return { elu: p, qualifies: [] };
  let q = ordre.filter(i => voix[i] >= 0.125 * inscrits); if (q.length < 2) q = ordre.slice(0, 2);
  return { elu: -1, qualifies: q };
}
// Européennes : proportionnelle nationale à la plus forte moyenne, seuil de 5 % des exprimés.
export function europeennes(voix: number[], sieges = 81): number[] { return plusForteMoyenne(voix, sieges, 0.05); }
// Sénatoriales : proportionnelle à la plus forte moyenne dans les départements élisant 3 sénateurs ou plus, scrutin majoritaire sinon.
export function senatoriales(grandsElecteurs: number[], sieges: number): number[] {
  if (sieges >= 3) return plusForteMoyenne(grandsElecteurs, sieges, 0);
  const res = grandsElecteurs.map(() => 0); let g = 0; for (let i = 1; i < grandsElecteurs.length; i++) if (grandsElecteurs[i] > grandsElecteurs[g]) g = i; res[g] = sieges; return res;
}

// ---------- Financement ----------
// Financement public annuel (loi de 1988) : première fraction selon les voix du premier tour des législatives pour les partis
// ayant obtenu au moins 1 % dans au moins 50 circonscriptions (environ 1,64 euro par voix et par an) ; seconde fraction
// selon le nombre de parlementaires rattachés (environ 37 000 euros par parlementaire et par an), réservée aux bénéficiaires de la première.
// La première fraction est réduite si la parité des candidatures n'est pas respectée : retenue de 150 % de l'écart entre les parts de candidats de chaque sexe.
export const EURO_PAR_VOIX = 1.64, EURO_PAR_PARLEMENTAIRE = 37400;
export function financementPublic(voix: number, circosAuDessusDe1: number, parlementaires: number, candidatsH: number, candidatsF: number): { premiere: number; seconde: number; retenue: number; total: number } {
  if (circosAuDessusDe1 < 50) return { premiere: 0, seconde: 0, retenue: 0, total: 0 };
  const brut = voix * EURO_PAR_VOIX; const n = candidatsH + candidatsF; const ecart = n > 0 ? Math.abs(candidatsH - candidatsF) / n : 0;
  const retenue = ecart > 0.02 ? Math.min(brut, brut * 1.5 * ecart) : 0; const premiere = brut - retenue; const seconde = parlementaires * EURO_PAR_PARLEMENTAIRE;
  return { premiere, seconde, retenue, total: premiere + seconde };
}
// Plafonds de dépenses de campagne (ordres de grandeur légaux) et remboursement forfaitaire.
// Présidentielle : 16,85 M d'euros au premier tour, 22,5 M pour les finalistes ; remboursement de 47,5 % du plafond au-dessus de 5 % des voix, 4,75 % en dessous.
// Législatives : 38 000 euros + 0,15 euro par habitant par candidat ; remboursement de 47,5 % du plafond si le candidat atteint 5 %.
// Listes (européennes : 9,2 M ; régionales et municipales : selon la population) ; remboursement à partir de 3 % (européennes) ou 5 %.
export function plafond(scrutin: string, population: number, finaliste = false): number {
  switch (scrutin) {
    case 'presidentielle': return finaliste ? 22509000 : 16851000;
    case 'legislatives': return 38000 + 0.15 * population;
    case 'europeennes': return 9200000;
    case 'regionales': return 0.42 * population + 100000;
    case 'departementales': return 0.5 * population + 5000;
    case 'municipales': return population < 15000 ? 1.22 * population : population < 100000 ? 1.0 * population + 5000 : 0.85 * population + 30000;
    default: return 0.3 * population;
  }
}
export function remboursement(scrutin: string, plafondApplicable: number, depenses: number, partVoix: number, rejete: boolean): number {
  if (rejete) return 0; const seuil = scrutin === 'europeennes' ? 0.03 : 0.05;
  const taux = partVoix >= seuil ? 0.475 : (scrutin === 'presidentielle' ? 0.0475 : 0);
  return Math.min(depenses, plafondApplicable * taux);
}
// Contrôle du compte de campagne : rejet si le plafond est dépassé ou si une irrégularité est relevée.
// Renvoie la probabilité de rejet à partir du dépassement et du niveau de risque (dons douteux, gestion faible).
export function risqueRejet(depenses: number, plafondApplicable: number, risque: number): number {
  if (depenses > plafondApplicable * 1.0001) return 1; return Math.min(0.6, Math.max(0, risque) * 0.08);
}
