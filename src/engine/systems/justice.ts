// Affaires et justice : uniquement pour les personnages générés (aucune affaire n'est attribuée à une personne réelle).
import type { Donnees, Etat, Ctx, Affaire } from '../types';
import { Rng, clamp } from '../rng';
import { message, journal } from './inbox';
import { nomComplet, ajouterHist, liberer } from './personnages';

const TITRES = ['Soupçons d\'emplois fictifs', 'Marchés publics truqués', 'Prise illégale d\'intérêts', 'Financement de campagne irrégulier', 'Détournement de fonds publics', 'Favoritisme', 'Fraude fiscale', 'Abus de biens sociaux'];
const ETAPES = ['Enquête préliminaire', 'Mise en examen', 'Procès', 'Jugement'];

export function tourJustice(e: Etat, d: Donnees, rng: Rng, ctx: Ctx) {
  // Ouverture de nouvelles affaires (tirage mensuel).
  if (e.semaine % 4 === 0) for (const p of e.persos) {
    if (p.reel || p.statut !== 'actif' || p.casserole < 0.1 || p.parti < 0 || p.id === e.joueur.perso) continue; if (p.rang < 2 && !p.mandats.length) continue; if (e.affaires.some(a => a.perso === p.id && !a.close)) continue;
    const P = e.partis[p.parti]; if (!rng.chance(p.casserole * 0.012 * (1 + P.inegibiliteRisque * 0.3) * (1 + p.rang * 0.3))) continue;
    const a: Affaire = { id: e.prochainMsg++, perso: p.id, parti: p.parti, titre: rng.pick(TITRES), etape: 0, prochaine: e.semaine + rng.int(10, 30), gravite: clamp(p.casserole + rng.next() * 0.3, 0.1, 1), soutenu: null, close: false };
    e.affaires.push(a); P.credibilite = clamp(P.credibilite - 1 - p.notoriete * 0.04, 0, 100); P.gaffes += 0.5; journal(e, `Affaire : ${a.titre.toLowerCase()} visant ${nomComplet(p)} (${P.sigle})`);
    if (p.parti === e.joueur.parti && !e.options.auto) message(e, ctx, 'justice', `Affaire : ${nomComplet(p)}`, `${a.titre}. Le parquet ouvre une enquête préliminaire visant ${nomComplet(p)}. Il clame son innocence. Que fait le parti ?`, true, { choix: [{ t: 'Le soutenir', info: 'Unité préservée. Si l\'affaire tourne mal, la crédibilité paiera.' }, { t: 'Le suspendre', info: 'Crédibilité protégée. Il vous en voudra, ses proches aussi.' }], action: { type: 'affaire', data: { id: a.id } } });
    else a.soutenu = P.style !== 'prudent';
  }
  for (const a of e.affaires) {
    if (a.close || e.semaine < a.prochaine) continue; const p = e.persos[a.perso]; const P = e.partis[a.parti]; if (a.soutenu === null) a.soutenu = true;
    if (p.statut !== 'actif') { a.close = true; continue; }
    a.etape++; const joueur = a.parti === e.joueur.parti; const poids = (0.5 + p.notoriete / 60) * (a.soutenu ? 1.6 : 0.5);
    if (a.etape === 1) { if (rng.chance(0.35 - a.gravite * 0.25)) { a.close = true; P.credibilite = clamp(P.credibilite + 0.8, 0, 100); ajouterHist(e, p, `Affaire classée sans suite (${a.titre.toLowerCase()})`); if (joueur) message(e, ctx, 'justice', 'Affaire classée', `L'enquête visant ${nomComplet(p)} est classée sans suite.`, false); continue; } P.credibilite = clamp(P.credibilite - 1.5 * poids, 0, 100); a.prochaine = e.semaine + rng.int(30, 70); ajouterHist(e, p, `Mis en examen (${a.titre.toLowerCase()})`); }
    else if (a.etape === 2) { P.credibilite = clamp(P.credibilite - 1.0 * poids, 0, 100); a.prochaine = e.semaine + rng.int(6, 14); }
    else { a.close = true; const condamne = rng.chance(0.3 + a.gravite * 0.55);
      if (condamne) { P.credibilite = clamp(P.credibilite - 3 * poids, 0, 100); P.dynamique -= 3 * poids; p.statut = 'ineligible'; p.ineligibleJusqua = e.semaine + rng.int(104, 260); ajouterHist(e, p, `Condamné et déclaré inéligible (${a.titre.toLowerCase()})`); liberer(e, p); for (const m of e.mairies) if (m.maire === p.id) m.bilan = clamp(m.bilan - 15, 0, 100); }
      else { P.credibilite = clamp(P.credibilite + (a.soutenu ? 2 : 0.5), 0, 100); ajouterHist(e, p, `Relaxé (${a.titre.toLowerCase()})`); if (!a.soutenu) { p.moral = clamp(p.moral - 20, 0, 100); p.fidelite = clamp(p.fidelite - 5, 1, 20); P.unite = clamp(P.unite - 2, 0, 100); } }
      journal(e, `Jugement : ${nomComplet(p)} (${P.sigle}) ${condamne ? 'condamné' : 'relaxé'}`); if (joueur) message(e, ctx, 'justice', `Jugement : ${nomComplet(p)}`, condamne ? `${nomComplet(p)} est condamné et déclaré inéligible. ${a.soutenu ? 'Le parti l\'avait soutenu jusqu\'au bout : la crédibilité en prend un coup.' : 'Le parti avait pris ses distances : les dégâts sont limités.'}` : `${nomComplet(p)} est relaxé. ${a.soutenu ? 'Votre soutien est salué en interne.' : 'Il n\'oubliera pas que le parti l\'a lâché.'}`, true); continue; }
    if (joueur) message(e, ctx, 'justice', `${ETAPES[a.etape]} : ${nomComplet(p)}`, `${a.titre}. L'affaire franchit une étape : ${ETAPES[a.etape].toLowerCase()}. La crédibilité du parti en souffre${a.soutenu ? ', d\'autant que vous le soutenez' : ''}.`, false);
  }
  // Fin des peines d'inéligibilité.
  for (const p of e.persos) if (p.statut === 'ineligible' && p.ineligibleJusqua !== undefined && e.semaine >= p.ineligibleJusqua) { p.statut = 'actif'; p.ineligibleJusqua = undefined; }
  if (e.affaires.length > 80) e.affaires = e.affaires.filter(a => !a.close || e.semaine - a.prochaine < 200);
}
