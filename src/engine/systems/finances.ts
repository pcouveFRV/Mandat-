// Finances des partis : flux mensuels, financement public, prêts, faillite.
import type { Donnees, Etat, Parti, Ctx } from '../types';
import { Rng, clamp } from '../rng';
import { message, journal } from './inbox';
import { parlementaires } from './partis';

export const SALAIRE_PERMANENT = 4200, LOYER_FEDERATION = 700;
// Recettes et dépenses d'un mois type (hors campagnes), utilisées pour le tour mensuel et pour les prévisions.
export function fluxMensuel(e: Etat, P: Parti): Record<string, number> {
  const campagne = e.calendrier.some(x => !x.fait1 && x.s1 - e.semaine < 14 && x.s1 >= e.semaine);
  let maires = 0; for (const m of e.mairies) if (m.parti === P.idx) maires++; let locaux = 0; for (const c of e.conseilsDept) locaux += c.sieges[P.idx] ?? 0; for (const c of e.conseilsReg) locaux += c.sieges[P.idx] ?? 0;
  const feds = P.delegues.filter(x => x >= 0).length;
  const f: Record<string, number> = {
    cotisations: P.adherents * P.cotisation / 12, dons: (P.adherents * 1.1 + P.notoriete * 250) * (1 + P.dynamique / 60) * (campagne ? 1.8 : 1), public: P.financementPublic / 12, elus: parlementaires(e, P.idx) * 900 + maires * 130 + locaux * 55,
    permanents: -P.permanents * SALAIRE_PERMANENT, locaux: -feds * LOYER_FEDERATION - 6000, com: -P.budgetCom, formation: -P.budgetFormation, prets: -P.prets.reduce((s, p) => s + p.mensualite, 0),
  };
  for (const k of Object.keys(f)) f[k] = Math.round(f[k]); return f;
}
export const netMensuel = (f: Record<string, number>) => ['cotisations', 'dons', 'public', 'elus', 'permanents', 'locaux', 'com', 'formation', 'prets'].reduce((s, k) => s + (f[k] ?? 0), 0);
// Capacité d'emprunt : dépend du financement public, des adhérents, de la crédibilité et de la dynamique.
export function capaciteEmprunt(e: Etat, P: Parti): number { const dette = P.prets.reduce((s, p) => s + p.restant, 0); return Math.max(0, Math.round((P.financementPublic * 1.8 + P.adherents * 25) * clamp(0.4 + P.credibilite / 100 + P.dynamique / 100, 0.2, 1.6) - dette)); }
export function emprunter(e: Etat, P: Parti, montant: number, mois = 60): string {
  const cap = capaciteEmprunt(e, P); if (montant <= 0) return 'Montant invalide.'; if (montant > cap) return `Les banques refusent : capacité d'emprunt estimée à ${Math.round(cap / 1000)} k€.`;
  const taux = 0.04 + (60 - P.credibilite) / 1500; const mens = Math.round(montant * (1 + taux * mois / 12) / mois); P.prets.push({ montant, restant: Math.round(mens * mois), mensualite: mens, fin: mois }); P.tresorerie += montant;
  return `Prêt accordé : ${Math.round(montant / 1000)} k€ sur ${mois} mois, mensualité de ${Math.round(mens / 1000)} k€ (taux ${(taux * 100).toFixed(1)} %).`;
}

export function tourFinances(e: Etat, d: Donnees, rng: Rng, ctx: Ctx) {
  for (const P of e.partis) {
    if (!P.actif) continue; const f = fluxMensuel(e, P); const net = netMensuel(f); P.tresorerie += net;
    for (const p of P.prets) { p.restant -= p.mensualite; p.fin--; } P.prets = P.prets.filter(p => p.fin > 0 && p.restant > 0);
    // La communication courante entretient la notoriété, la formation fait progresser les cadres (voir personnages).
    P.notoriete = clamp(P.notoriete + Math.min(1.2, P.budgetCom / 120000), 0, 100);
    P.fluxMois = { ...f, campagnePrec: P.fluxMois.campagne ?? 0, remboursementPrec: P.fluxMois.remboursement ?? 0, campagne: 0, remboursement: 0 };
    P.histTreso.push(Math.round(P.tresorerie)); if (P.histTreso.length > 320) P.histTreso.shift();
    const joueur = P.idx === e.joueur.parti; const rouge = P.tresorerie < 0;
    P.scoreIA.moisRouge = rouge ? (P.scoreIA.moisRouge ?? 0) + 1 : 0;
    if (rouge) {
      const cap = capaciteEmprunt(e, P);
      if (!joueur || e.joueur.mode === 'carriere') { if (cap > -P.tresorerie) emprunter(e, P, Math.min(cap, Math.round(-P.tresorerie * 1.5 + 200000))); else { P.permanents = Math.max(1, Math.floor(P.permanents * 0.6)); P.budgetCom = Math.round(P.budgetCom * 0.3); P.budgetFormation = 0; if (P.scoreIA.moisRouge >= 4) { P.tresorerie = 0; P.credibilite = clamp(P.credibilite - 8, 0, 100); P.unite = clamp(P.unite - 8, 0, 100); P.prets = []; P.scoreIA.faillites = (P.scoreIA.faillites ?? 0) + 1; P.scoreIA.moisRouge = 0; journal(e, `${P.sigle} au bord de la faillite : plan de sauvetage, crédibilité en chute`); } } }
      else { message(e, ctx, 'finances', 'Alerte de trésorerie', `La trésorerie est négative (${Math.round(P.tresorerie / 1000)} k€) depuis ${P.scoreIA.moisRouge} mois. Capacité d'emprunt : ${Math.round(cap / 1000)} k€. Sans redressement, c'est la faillite au bout de six mois.`, true); if (P.scoreIA.moisRouge >= 6) e.joueur.fin = { type: 'defaite', titre: 'Faillite', texte: 'Le parti est en cessation de paiement. Les banques ont coupé les lignes de crédit.' }; }
    } else if (joueur && net < 0 && P.tresorerie + net * 4 < 0 && rng.chance(0.5)) message(e, ctx, 'finances', 'Le trésorier s\'inquiète', `Au rythme actuel (${Math.round(net / 1000)} k€ par mois), la caisse sera vide dans ${Math.max(1, Math.floor(P.tresorerie / -net))} mois.`, false);
  }
}
