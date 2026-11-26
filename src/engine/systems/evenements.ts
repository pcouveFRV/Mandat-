// Événements : tirage hebdomadaire selon les conditions, réactions des partis, effets sur l'opinion par segment.
import type { Donnees, Etat, Parti, Ctx, DonEvenement, DonChoix } from '../types';
import { A } from '../types';
import { Rng, clamp } from '../rng';
import { mois, annee } from '../calendrier';
import { message, journal } from './inbox';
import { bougerRel, droits, rel } from './partis';
import { aMandat, nomComplet, lier, creerPerso, transferer, ajouterHist } from './personnages';
import { creerDebat } from './medias';

function roleJoueur(e: Etat): string[] { const p = e.persos[e.joueur.perso]; const r: string[] = []; if (!p) return r; if (aMandat(p, 'maire')) r.push('maire'); if (aMandat(p, 'president_dept') || aMandat(p, 'president_region')) r.push('president_local'); if (aMandat(p, 'depute')) r.push('depute'); if (aMandat(p, 'president')) r.push('president'); if (e.joueur.mode === 'parti' && e.presidence.parti === e.joueur.parti && e.presidence.perso >= 0 && e.persos[e.presidence.perso].parti === e.joueur.parti) r.push('president'); return r; }
function eligible(e: Etat, d: Donnees, ev: DonEvenement, roles: string[]): boolean {
  const c = ev.cond; const an = annee(e.semaine);
  if (c.de && an < c.de) return false; if (c.a && an > c.a) return false; if (c.mois && !c.mois.includes(mois(e.semaine))) return false;
  if (c.mode && c.mode !== e.joueur.mode) return false; if (c.role && !roles.includes(c.role)) return false;
  const vu = e.evVus[ev.id]; if (vu !== undefined && e.semaine - vu < (ev.portee === 'nat' ? 70 : 45)) return false;
  if (ev.portee === 'parti' && !droits(e).tout) return false;
  return true;
}

// Applique un choix d'événement à un parti. Renvoie un court résumé des effets.
export function appliquerChoix(e: Etat, d: Donnees, rng: Rng, ctx: Ctx | null, P: Parti, ev: DonEvenement, ch: DonChoix, rival = -1): string {
  const nP = e.partis.length; const out: string[] = []; const joueur = P.idx === e.joueur.parti; const moi = joueur ? e.persos[e.joueur.perso] : P.chef >= 0 ? e.persos[P.chef] : null;
  if (ch.axe && ch.sens) {
    const a = d.axes.findIndex(x => x.id === ch.axe); const pos = P.axes[a]; const sens = ch.sens; const coh = Math.abs(pos) >= 1 ? Math.sign(pos) * sens : 0;
    P.credibilite = clamp(P.credibilite + coh * 0.5, 0, 100); if (coh < 0) { P.unite = clamp(P.unite - 1, 0, 100); out.push('position contraire à votre ligne : crédibilité en baisse'); } else if (coh > 0) out.push('position cohérente avec votre ligne');
    d.segments.forEach((s, si) => { const acc = s.axes[a] * sens; e.opinion[si * nP + P.idx] += clamp(acc * 0.012, -0.05, 0.05) * (0.5 + s.volatilite); });
    P.notoriete = clamp(P.notoriete + 0.3, 0, 100);
  }
  if (ch.opinion) d.segments.forEach((s, si) => { for (const t of Object.keys(ch.opinion!)) if (s.etiquettes.includes(t)) e.opinion[si * nP + P.idx] += ch.opinion![t] * 0.012; });
  const ef = ch.eff ?? {};
  for (const k of Object.keys(ef)) { const v = ef[k];
    switch (k) {
      case 'capital': P.capital = clamp(P.capital + v, 0, 100); break; case 'credibilite': P.credibilite = clamp(P.credibilite + v, 0, 100); break; case 'notoriete': P.notoriete = clamp(P.notoriete + v, 0, 100); break;
      case 'unite': P.unite = clamp(P.unite + v, 0, 100); break; case 'argent': P.tresorerie += v; break; case 'militants': P.militants *= 1 + v / 100; P.adherents *= 1 + v / 300; break; case 'viralite': P.viralite += v; break;
      case 'moral': if (moi) moi.moral = clamp(moi.moral + v, 0, 100); break; case 'forme': if (moi) moi.forme = clamp(moi.forme + v, 0, 100); break;
      case 'notorietePerso': if (moi) moi.notoriete = clamp(moi.notoriete + v, 0, 100); break; case 'credibilitePerso': case 'capitalPerso': if (joueur) e.joueur.pointsVictoire.estime = (e.joueur.pointsVictoire.estime ?? 0) + v; break;
      case 'reseau': if (moi) moi.attrs[A.reseau] = clamp(moi.attrs[A.reseau] + v, 1, 20); break; case 'ancrage': if (moi) moi.attrs[A.ancrage] = clamp(moi.attrs[A.ancrage] + (rng.chance(0.5) ? v : 0), 1, 20); break;
      case 'loyaute': if (moi) moi.fidelite = clamp(moi.fidelite + v, 1, 20); break; case 'repos': break;
      case 'formationPerso': if (moi) { const i = rng.pick([A.eloquence, A.dossiers, A.organisation, A.debat, A.negociation]); moi.attrs[i] = clamp(moi.attrs[i] + 1, 1, 20); out.push('un attribut progresse'); } break;
      case 'mentor': if (moi) { const m = e.persos.filter(p => p.parti === P.idx && p.rang >= 3 && p.id !== moi.id && p.statut === 'actif').sort((a, b) => b.attrs[A.reseau] - a.attrs[A.reseau])[rng.int(0, 4)]; if (m) { lier(m, moi, 'mentor', 70); out.push(`${nomComplet(m)} devient votre mentor`); } } break;
      case 'bilan': case 'budget': case 'activite': { if (!joueur || !moi) break; const mm = aMandat(moi, 'maire'), pd = aMandat(moi, 'president_dept'), prg = aMandat(moi, 'president_region'); const cible: any = ev.cond.role === 'maire' && mm ? e.mairies[mm.lieu] : pd ? e.conseilsDept[pd.lieu] : prg ? e.conseilsReg[prg.lieu] : mm ? e.mairies[mm.lieu] : null; if (k === 'activite') { e.joueur.pointsVictoire.activite = (e.joueur.pointsVictoire.activite ?? 0) + v; P.credibilite = clamp(P.credibilite + v * 0.15, 0, 100); break; } if (cible) { if (k === 'bilan') cible.bilan = clamp(cible.bilan + v, 0, 100); else cible.budget += v; } else if (k === 'bilan') moi.notoriete = clamp(moi.notoriete + v * 0.3, 0, 100); break; }
      case 'popularite': if (e.presidence.parti === P.idx) e.presidence.popularite = clamp(e.presidence.popularite + v, 5, 90); break; case 'budgetEtat': e.presidence.budget += v; break; case 'referendum': e.presidence.reformes++; break;
      case 'relationRival': if (rival >= 0) bougerRel(e, P.idx, rival, v); break; case 'voleRival': if (rival >= 0) for (let z = 0; z < d.zones.length; z += 1) { e.impl[z * nP + P.idx] += 0.01; e.impl[z * nP + rival] -= 0.01; } break;
      case 'ralliement': { const src = e.partis.filter(q => q.actif && q.idx !== P.idx && rel(e, q.idx, P.idx) > -30).sort((a, b) => a.unite - b.unite)[0]; if (src) { const c = e.persos.find(p => p.parti === src.idx && p.statut === 'actif' && p.rang === 2 && !p.reel && p.id !== src.chef); if (c) { transferer(e, d, c, P.idx); out.push(`${nomComplet(c)} (ex-${src.sigle}) vous rejoint`); } } break; }
      case 'risqueAffaire': P.inegibiliteRisque += v; break; case 'risqueGaffe': if (rng.chance(0.25 * v)) { P.gaffes += 1; P.credibilite = clamp(P.credibilite - 1.5, 0, 100); out.push('un dérapage vient gâcher la séquence'); } break;
      case 'formation': for (const p of e.persos) if (p.parti === P.idx && p.statut === 'actif' && p.rang >= 1 && p.rang <= 2 && rng.chance(0.15)) { const i = rng.pick([A.organisation, A.terrain, A.eloquence]); if (p.attrs[i] < p.pot) p.attrs[i]++; } break;
      case 'cadreMoral': { const c = P.courants[0]; if (c && c.chef >= 0) e.persos[c.chef].moral = clamp(e.persos[c.chef].moral + v, 0, 100); break; }
      case 'interview': if (joueur && ctx && !e.debat && moi) { e.debat = creerDebat(e, d, rng, 'interview', 'intermatin', moi.id, -1, 4, 1); out.push('entretien à jouer dans l\'écran Médias'); } break;
      case 'offreDebauchage': if (joueur && ctx) { const Q = e.partis.filter(q => q.actif && q.idx !== P.idx).sort((a, b) => rel(e, b.idx, P.idx) - rel(e, a.idx, P.idx))[0]; if (Q) message(e, ctx, 'carriere', `Une offre de ${Q.sigle}`, `${Q.nom} vous propose de les rejoindre, avec une place dans l'équipe de direction locale.`, true, { choix: [{ t: 'Accepter et changer de parti' }, { t: 'Refuser' }], action: { type: 'debauchage_joueur', data: { parti: Q.idx } } }); } break;
    }
  }
  void creerPerso; void ajouterHist;
  return out.join(', ');
}
// Choix d'un parti IA : le plus cohérent avec sa doctrine et son style.
function choixIA(e: Etat, d: Donnees, rng: Rng, P: Parti, ev: DonEvenement): number {
  let best = 0, bs = -1e9; ev.choix.forEach((c, i) => { let s = rng.next() * 1.5; if (c.axe && c.sens) { const a = d.axes.findIndex(x => x.id === c.axe); s += P.axes[a] * c.sens * 0.8; if (P.style === 'offensif') s += 0.8; } else { s += P.style === 'prudent' ? 1.2 : 0.2; if (c.t.startsWith('Ne pas')) s -= 0.8; } if (c.eff?.argent && P.tresorerie + c.eff.argent < 0) s -= 5; if (s > bs) { bs = s; best = i; } }); return best;
}

export function tourEvenements(e: Etat, d: Donnees, rng: Rng, ctx: Ctx) {
  // Réponses par défaut aux messages expirés.
  for (const m of e.inbox) if (m.choix && m.repondu === undefined && m.expire !== undefined && e.semaine > m.expire) { m.repondu = m.choix.length - 1; m.lu = true; if (m.action?.type === 'evenement') { const ev = d.evenements.find(x => x.id === m.action!.data.ev); if (ev) appliquerChoix(e, d, rng, null, e.partis[e.joueur.parti], ev, ev.choix[ev.choix.length - 1], m.action.data.rival ?? -1); } }
  e.chocs = e.chocs.filter(c => c.fin > e.semaine);
  const roles = roleJoueur(e); const j = e.partis[e.joueur.parti]; const dr = droits(e);
  const tirer = (portees: string[], proba: number) => {
    if (!rng.chance(proba)) return; const pool = d.evenements.filter(ev => portees.includes(ev.portee) && eligible(e, d, ev, roles)); if (!pool.length) return;
    const ev = pool[rng.pondere(pool.map(x => x.poids))]; e.evVus[ev.id] = e.semaine;
    let rival = -1; if (ev.cond.rival) { const rs = e.partis.filter(p => p.actif && p.idx !== j.idx && e.intentions[p.idx] > 0.03); rival = rs[rng.int(0, rs.length - 1)].idx; }
    const region = ['ecologie'].includes(ev.cat) && rng.chance(0.5) ? rng.int(0, 12) : -1;
    const titre = ev.titre.replace('{rival}', rival >= 0 ? e.partis[rival].sigle : ''); const texte = (region >= 0 ? `${d.regions[region].nom} : ` : '') + ev.texte.replace(/\{rival\}/g, rival >= 0 ? e.partis[rival].nom : '');
    for (const t of Object.keys(ev.themes)) { const ti = d.themes.findIndex(x => x.id === t); if (ti >= 0) e.chocs.push({ theme: ti, region, val: ev.themes[t] * 0.6, debut: e.semaine, fin: e.semaine + Math.max(3, ev.duree) }); }
    if (ev.cat === 'economie') { e.eco.chomage = clamp(e.eco.chomage + rng.gauss() * 0.15, 4, 13); e.eco.croissance = clamp(e.eco.croissance + rng.gauss() * 0.2, -3, 4); }
    if (rival >= 0) { const R = e.partis[rival]; R.credibilite = clamp(R.credibilite - 2, 0, 100); R.dynamique = clamp(R.dynamique - 4, -50, 50); R.unite = clamp(R.unite - 2, 0, 100); }
    if (ev.portee === 'nat') { journal(e, titre); for (const P of e.partis) { if (!P.actif || P.idx === j.idx || P.idx === rival) continue; if (ev.choix.length) appliquerChoix(e, d, rng, null, P, ev, ev.choix[choixIA(e, d, rng, P, ev)], rival); } }
    const decide = !e.options.auto && (ev.portee === 'nat' || ev.portee === 'parti' ? (dr.tout || dr.medias) : true);
    if (!ev.choix.length) { message(e, ctx, 'actu', titre, texte, false); return; }
    if (decide) message(e, ctx, ev.portee === 'nat' ? 'actu' : ev.portee === 'parti' ? 'parti' : ev.portee === 'perso' ? 'carriere' : 'mandat', titre, texte, ev.portee !== 'nat', { choix: ev.choix.map(c => ({ t: c.t, info: apercu(d, j, c) })), action: { type: 'evenement', data: { ev: ev.id, rival } }, expire: e.semaine + 2 });
    else { appliquerChoix(e, d, rng, null, j, ev, ev.choix[choixIA(e, d, rng, j, ev)], rival); message(e, ctx, 'actu', titre, texte + ' La direction du parti a pris position.', false); }
  };
  tirer(['nat'], 0.5); tirer(['parti'], 0.14); if (roles.length) tirer(['mandat'], 0.3); if (e.joueur.mode === 'carriere') tirer(['perso'], 0.18);
}
function apercu(d: Donnees, P: Parti, c: DonChoix): string {
  const l: string[] = []; if (c.axe && c.sens) { const a = d.axes.findIndex(x => x.id === c.axe); const coh = Math.abs(P.axes[a]) >= 1 ? Math.sign(P.axes[a]) * c.sens : 0; l.push(coh > 0 ? 'Cohérent avec votre ligne' : coh < 0 ? 'Contraire à votre ligne' : 'Sans effet sur la cohérence'); }
  const N: Record<string, string> = { capital: 'capital politique', credibilite: 'crédibilité', notoriete: 'notoriété', unite: 'unité', argent: 'trésorerie', militants: 'militants', bilan: 'bilan', budget: 'budget', forme: 'forme', moral: 'moral', popularite: 'popularité' };
  for (const k of Object.keys(c.eff ?? {})) if (N[k]) { const v = c.eff![k]; l.push(`${N[k]} ${v > 0 ? '+' : ''}${Math.abs(v) >= 1000 ? Math.round(v / 1000) + ' k€' : v}`); }
  return l.join(', ');
}
