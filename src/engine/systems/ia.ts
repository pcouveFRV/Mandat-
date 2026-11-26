// IA des partis rivaux : mêmes actions et mêmes contraintes que le joueur (terrain, doctrine, finances, alliances, mercato, congrès).
import type { Donnees, Etat, Parti, Ctx, Scrutin, Accord } from '../types';
import { A } from '../types';
import { Rng, clamp } from '../rng';
import { DUREE_CAMPAGNE, NOM_SCRUTIN } from '../calendrier';
import { message, journal } from './inbox';
import { rel, bougerRel, cadres, droits, nbDeputes } from './partis';
import { adopter, bougerAxe, etatProposition } from './doctrine';
import { fluxMensuel, netMensuel, emprunter, capaciteEmprunt } from './finances';
import { chanceDebauchage, transferer, nomComplet } from './personnages';
import { accordsActifs, politique } from './campagnes';
import { distancePartis } from './electorat';

// Le joueur garde la main sur un domaine s'il en a le droit ; sinon l'IA de son parti décide (mode Carrière).
export function iaDecide(e: Etat, P: Parti, domaine: 'terrain' | 'doctrine' | 'finances' | 'alliances' | 'mercato' | 'investitures'): boolean {
  if (P.idx !== e.joueur.parti || e.options.auto) return true; const dr = droits(e); if (dr.tout) return false;
  if (domaine === 'terrain') return dr.terrain !== 'tous'; return !(dr as any)[domaine];
}

export function repartirTerrain(e: Etat, d: Donnees, P: Parti, garder: number[] = []) {
  const ech = e.calendrier.find(x => !x.fait2 && !x.fait1 && x.s1 - e.semaine < 16); const campagne = !!ech;
  const score = d.depts.map((dep, i) => { if (!d.zonesParDept[i].length) return 0; const a = P.adhDept[i] || 0; const base = P.strategie === 'local' ? a * 1.5 + dep.pop * 0.002 : dep.pop * 0.01 + a; return base * (P.delegues[i] >= 0 ? 1.3 : 0.8); });
  const ordre = score.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]).slice(0, campagne ? 14 : 8).map(x => x[1]);
  const actions = campagne ? ['porte_a_porte', 'tractage', 'phoning'] : P.strategie === 'local' ? ['marches', 'reunions', 'tractage'] : ['tractage', 'collage', 'reunions'];
  const intens = campagne ? 0.7 : P.fatigue > 50 ? 0.2 : 0.4; const anciens = P.terrain.filter(t => garder.includes(t.dept));
  P.terrain = [...anciens, ...ordre.filter(x => !garder.includes(x)).map((dept, k) => ({ dept, action: actions[k % actions.length], part: intens / ordre.length }))];
}

// Négociation des accords électoraux entre partis IA, avant l'ouverture de chaque campagne. Les partis proposent aussi au joueur.
export function negocierAccords(e: Etat, d: Donnees, rng: Rng, ctx: Ctx, type: Scrutin, s1: number, s2: number) {
  if (type === 'senatoriales' || type === 'municipales' || type === 'departementales') return; // unions locales décidées ville par ville selon les relations
  const dejas = new Set<number>(); for (const a of accordsActifs(e, type)) a.partis.forEach(p => dejas.add(p));
  const act = e.partis.filter(P => P.actif && !dejas.has(P.idx)); const fin = (s2 > 0 ? s2 : s1) + 1; const j = e.joueur.parti;
  const pilotes = act.filter(P => (e.intentions[P.idx] ?? 0) > 0.05).sort((a, b) => e.intentions[b.idx] - e.intentions[a.idx]); const pris = new Set<number>();
  for (const P of pilotes) {
    if (pris.has(P.idx) || (P.idx === j && !iaDecide(e, P, 'alliances'))) continue; if (P.strategie === 'isolement') continue;
    const seuil = type === 'presidentielle' ? 70 : type === 'europeennes' ? 62 : type === 'legislatives' ? (P.strategie === 'union' ? 28 : 40) : 35;
    const partenaires = act.filter(Q => Q.idx !== P.idx && !pris.has(Q.idx) && Q.strategie !== 'isolement' && rel(e, P.idx, Q.idx) >= seuil && (type !== 'presidentielle' || e.intentions[Q.idx] < e.intentions[P.idx] * 0.5));
    const groupe = [P.idx]; for (const Q of partenaires.sort((a, b) => rel(e, P.idx, b.idx) - rel(e, P.idx, a.idx))) { if (!groupe.every(x => rel(e, x, Q.idx) >= seuil - 25)) continue; if (Q.idx === j && !iaDecide(e, Q, 'alliances')) { if (!e.inbox.some(m => m.action?.type === 'accord' && m.repondu === undefined && m.action.data.type === type)) message(e, ctx, 'alliances', `${P.sigle} propose un accord`, `${P.nom} vous propose un accord pour les ${NOM_SCRUTIN[type].toLowerCase().replace('élections ', '').replace('élection ', '')} : candidatures communes, répartition selon le poids de chacun. Un accord rapporte des sièges mais brouille votre identité.`, true, { choix: [{ t: 'Accepter', info: 'Crédibilité -1 par parti éloigné, relation en hausse.' }, { t: 'Refuser' }], action: { type: 'accord', data: { type, partis: groupe.slice(), s1, fin } }, expire: e.semaine + 2 }); continue; } groupe.push(Q.idx); }
    if (groupe.length < 2) continue; if (type === 'presidentielle') { for (const q of groupe.slice(1)) { e.consignes[q] = P.idx; } continue; }
    groupe.forEach(x => pris.add(x)); conclureAccord(e, d, type, groupe, s1, fin);
  }
}
export function conclureAccord(e: Etat, d: Donnees, type: Scrutin, partis: number[], s1: number, fin: number): Accord {
  const a: Accord = { id: e.prochainMsg++, type, partis, debut: e.semaine, fin };
  if (type === 'legislatives') { // répartition des circonscriptions : sortants reconduits, sinon au prorata des intentions
    const rep: Record<number, number> = {}; const quota = partis.map(p => Math.max(0.02, e.intentions[p] ?? 0.02)); const tot = quota.reduce((x, y) => x + y, 0); const compte = partis.map(() => 0);
    d.circos.forEach((_, ci) => { const s = e.assemblee[ci]; if (s && partis.includes(s.parti)) { rep[ci] = s.parti; compte[partis.indexOf(s.parti)]++; } });
    d.circos.forEach((_, ci) => { if (rep[ci] !== undefined) return; let best = 0, bs = -1e9; partis.forEach((p, k) => { const sc = quota[k] / tot - compte[k] / 577 + (e.partis[p].adhDept[d.idxDept[d.circos[ci].dept]] ?? 0) / (e.partis[p].adherents || 1) * 2; if (sc > bs) { bs = sc; best = k; } }); rep[ci] = partis[best]; compte[best]++; });
    a.repartition = rep;
  }
  e.accords.push(a); for (let i = 0; i < partis.length; i++) for (let k = i + 1; k < partis.length; k++) { bougerRel(e, partis[i], partis[k], 4); const dist = distancePartis(e, partis[i], partis[k]); if (dist > 9) { e.partis[partis[i]].credibilite = clamp(e.partis[partis[i]].credibilite - 1, 0, 100); e.partis[partis[k]].credibilite = clamp(e.partis[partis[k]].credibilite - 1, 0, 100); } }
  journal(e, `Accord pour les ${NOM_SCRUTIN[type].toLowerCase()} : ${partis.map(p => e.partis[p].sigle).join(', ')}`); return a;
}
// Réponse d'un parti IA à une proposition d'accord du joueur.
export function evaluerProposition(e: Etat, d: Donnees, rng: Rng, de: number, vers: number, type: Scrutin): { ok: boolean; raison: string } {
  const Q = e.partis[vers]; const r = rel(e, de, vers); const dist = distancePartis(e, de, vers); if (Q.strategie === 'isolement') return { ok: false, raison: `${Q.sigle} refuse toute alliance par principe.` };
  const seuil = (type === 'presidentielle' ? 65 : type === 'legislatives' ? 30 : 25) - (Q.strategie === 'union' ? 10 : 0) + (e.joueur.trahisons * 15);
  const interet = (e.intentions[de] ?? 0) > (e.intentions[vers] ?? 0) * 0.3 ? 8 : -10; const score = r + interet - dist * 0.8 + rng.gauss() * 6;
  if (type === 'presidentielle' && (e.intentions[vers] ?? 0) > (e.intentions[de] ?? 0) * 0.6) return { ok: false, raison: `${Q.sigle} veut son propre candidat.` };
  return score >= seuil ? { ok: true, raison: `${Q.sigle} accepte.` } : { ok: false, raison: r < seuil - 20 ? `${Q.sigle} refuse : les relations entre vos partis sont trop mauvaises (${Math.round(r)}).` : `${Q.sigle} décline : trop d'écart sur le fond ou pas assez d'intérêt électoral.` };
}

export function tourIA(e: Etat, d: Donnees, rng: Rng, ctx: Ctx) {
  const mensuel = e.semaine % 4 === 1;
  for (const ech of e.calendrier) if (!ech.fait1 && !ech.negocie && e.semaine >= ech.s1 - DUREE_CAMPAGNE[ech.type] - 2 && e.semaine < ech.s1) { ech.negocie = true; negocierAccords(e, d, rng, ctx, ech.type, ech.s1, ech.s2); }
  e.accords = e.accords.filter(a => a.fin >= e.semaine - 2);
  for (const P of e.partis) {
    if (!P.actif) continue;
    if (iaDecide(e, P, 'terrain') && (e.semaine % 6 === P.idx % 6 || !P.terrain.length)) { const dr = P.idx === e.joueur.parti ? droits(e).terrain : []; repartirTerrain(e, d, P, Array.isArray(dr) ? dr : []); }
    if (!mensuel) continue;
    if (iaDecide(e, P, 'finances')) {
      const f = fluxMensuel(e, P); const net = netMensuel(f);
      if (net < 0 && P.tresorerie < -net * 10) { P.permanents = Math.max(1, P.permanents - Math.ceil(P.permanents * 0.1)); P.budgetCom = Math.round(P.budgetCom * 0.8); }
      else if (net > 20000 && P.tresorerie > 400000) { if (rng.chance(0.5)) P.permanents++; P.budgetCom = Math.min(Math.round(P.tresorerie * 0.006), P.budgetCom + 5000); P.budgetFormation = Math.min(60000, Math.round(net * 0.1)); }
      const pres = e.calendrier.find(x => x.type === 'presidentielle' && !x.fait1); if (pres && pres.s1 - e.semaine === 13 && P.candidatPres >= 0 && P.parrainages >= 300) { const cap = capaciteEmprunt(e, P); if (cap > 500000) emprunter(e, P, Math.min(cap * 0.7, 8e6), 60); }
    }
    if (iaDecide(e, P, 'doctrine')) {
      if (rng.chance(0.12)) { const dispo = d.propositions.filter(pr => etatProposition(e, d, P, pr).ok); if (dispo.length && P.capital > 35) { const reprises = dispo.filter(pr => e.partis.some(Q => Q.idx !== P.idx && Q.propositions.includes(pr.id))); const pr = P.style === 'opportuniste' && reprises.length ? rng.pick(reprises) : rng.pick(dispo); adopter(e, d, ctx, P, pr.id); } }
      // Recentrage opportuniste quand le parti décroche.
      if (P.style === 'opportuniste' && P.dynamique < -12 && P.capital > 30 && P.credibilite > 40 && rng.chance(0.15)) { const a = rng.int(0, 9); if (Math.abs(P.axes[a]) >= 2) bougerAxe(e, d, rng, ctx, P, a, -Math.sign(P.axes[a])); }
    }
    if (iaDecide(e, P, 'mercato') && rng.chance(P.style === 'opportuniste' ? 0.1 : 0.05)) {
      const proies = e.partis.filter(Q => Q.actif && Q.idx !== P.idx && Q.unite < 50 && distancePartis(e, P.idx, Q.idx) < 14);
      if (proies.length) { const Q = rng.pick(proies); const cs = cadres(e, Q.idx, 2).filter(p => p.id !== Q.chef && p.id !== e.joueur.perso && !p.reel); if (cs.length) { const c = rng.pick(cs); if (rng.chance(chanceDebauchage(e, d, c, P.idx, 'investiture'))) { transferer(e, d, c, P.idx); journal(e, `${nomComplet(c)} quitte ${Q.sigle} pour ${P.sigle}`); if (Q.idx === e.joueur.parti) message(e, ctx, 'parti', 'Un cadre vous quitte', `${nomComplet(c)} rejoint ${P.nom}. Une partie de son électorat local le suit.`, true); } } }
    }
    // Ambitions internes : un putsch se prépare quand le chef est affaibli.
    if (P.idx !== e.joueur.parti && P.dynamique < -15 && P.chef >= 0 && rng.chance(0.06)) { const chef = e.persos[P.chef]; const riv = cadres(e, P.idx, 3).find(p => p.id !== chef.id && p.attrs[A.ambition] >= 14 && p.notoriete > chef.notoriete * 0.7); if (riv) { P.prochainCongres = Math.min(P.prochainCongres, e.semaine + 6); journal(e, `${nomComplet(riv)} réclame un congrès anticipé à ${P.sigle}`); } }
    if (P.idx !== e.joueur.parti) for (const k of Object.keys(P.bureau)) if (P.bureau[k] < 0 || e.persos[P.bureau[k]].statut !== 'actif' || e.persos[P.bureau[k]].parti !== P.idx) { const c = cadres(e, P.idx, 2).filter(p => !p.postes.length)[0]; if (c) { P.bureau[k] = c.id; c.postes.push(k); } }
    if (iaDecide(e, P, 'terrain')) for (let i = 0; i < P.delegues.length; i++) { const x = P.delegues[i]; if (P.adhDept[i] > 40 && (x < 0 || e.persos[x].statut !== 'actif' || e.persos[x].parti !== P.idx)) { const c = e.persos.find(p => p.parti === P.idx && p.statut === 'actif' && p.dept === i && !p.postes.length && p.id !== e.joueur.perso && (p.rang >= 1 || (p.attrs[A.organisation] + p.attrs[A.terrain]) >= 20)); P.delegues[i] = c ? c.id : -1; if (c) { c.postes.push('delegue'); if (c.rang < 1) c.rang = 1; } } }
  }
  void nbDeputes; void politique;
}
