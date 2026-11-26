// Vues : données dérivées de l'état pour l'interface. Aucune vue ne modifie l'état. Les valeurs cachées ne sortent jamais d'ici.
import { accesJoueur } from './systems/carriere';
import { vueExecutif, roleExecutif } from './systems/executif';
import { vueAgora } from './systems/agora';
import type { Donnees, Etat, Perso, Scrutin } from './types';
import { ATTRS_NOM, A } from './types';
import { dateTexte, annee, NOM_SCRUTIN, DUREE_CAMPAGNE, SEMAINE_FIN } from './calendrier';
import { droits, rel, nbDeputes, parlementaires, ACTIONS_TERRAIN, cadres } from './systems/partis';
import { nomComplet, LIB_MANDAT, qualiteCandidat, aMandat } from './systems/personnages';
import { fluxMensuel, netMensuel, capaciteEmprunt } from './systems/finances';
import { etatProposition, coutMouvement } from './systems/doctrine';
import { preparer, voter, priorites, FACTEUR_ABST } from './systems/electorat';
import { brouiller } from './systems/sondages';
import { plafondParti, vivierParrains, politique, accordsActifs } from './systems/campagnes';
import { PROJETS_MAIRIE, DELEGATIONS, PROJETS_CONSEIL, ACTIONS_PARLEMENT, coutProjet, mairieDuJoueur, conseilDuJoueur } from './systems/mandats';
import { REPONSES, PUBLICATIONS } from './systems/medias';
import { ACTIVITES, LIB_POSTE, estime } from './systems/carriere';
import { pantheon, score, VICTOIRES } from './victoire';
import { SIEGES_REGION } from './donnees';

const r1 = (x: number) => Math.round(x * 10) / 10;
import { jourVote } from './calendrier';
function resumePerso(e: Etat, d: Donnees, p: Perso) { return { id: p.id, nom: nomComplet(p), parti: p.parti, age: annee(e.semaine) - p.naissance, sexe: p.sexe, dept: d.depts[p.dept]?.nom ?? '', deptCode: d.depts[p.dept]?.code ?? '', rang: p.rang, postes: p.postes.map(x => LIB_POSTE[x] ?? x), mandats: p.mandats.map(m => LIB_MANDAT[m.type]), notoriete: Math.round(p.notoriete), moral: Math.round(p.moral), forme: Math.round(p.forme), attrs: p.attrs, traits: p.traits, statut: p.statut, reel: p.reel }; }
function lieuMandat(d: Donnees, m: { type: string; lieu: number }): string { switch (m.type) { case 'maire': case 'adjoint': case 'conseiller_municipal': return d.villes[m.lieu]?.nom ?? ''; case 'depute': return d.circos[m.lieu]?.nomCourt ?? ''; case 'senateur': case 'president_dept': case 'conseiller_dept': return d.depts[m.lieu]?.nom ?? ''; case 'president_region': case 'conseiller_reg': return d.regions[m.lieu]?.nom ?? ''; default: return ''; } }

export function vue(e: Etat, d: Donnees, nom: string, p: any = {}): any {
  const j = e.joueur; const P = e.partis[j.parti]; const moi = e.persos[j.perso]; const nP = e.partis.length;
  switch (nom) {
    case 'base': {
      const proch = e.calendrier.filter(x => !x.fait2 && (x.s2 > 0 ? x.s2 : x.s1) >= e.semaine).slice(0, 4).map(x => ({ type: x.type, nom: NOM_SCRUTIN[x.type], s1: x.s1, date: jourVote(x.s1), dans: x.s1 - e.semaine, tour2: x.fait1 && !x.fait2, date2: x.s2 > 0 ? jourVote(x.s2) : '' }));
      return { semaine: e.semaine, date: dateTexte(e.semaine), annee: annee(e.semaine), fini: e.semaine >= SEMAINE_FIN, scenario: e.scenario, graine: e.graine, mode: j.mode, parti: j.parti, perso: j.perso, tutoriel: j.tutoriel, fin: j.fin ?? null, scoreFinal: j.scoreFinal, droits: droits(e),
        partis: e.partis.map(q => ({ idx: q.idx, id: q.id, sigle: q.sigle, nom: q.nom, couleur: q.couleur, actif: q.actif, famille: q.famille })),
        res: P ? { tresorerie: Math.round(P.tresorerie), militants: Math.round(P.militants), adherents: Math.round(P.adherents), capital: Math.round(P.capital), credibilite: Math.round(P.credibilite), notoriete: Math.round(P.notoriete), unite: Math.round(P.unite), dynamique: Math.round(P.dynamique), fatigue: Math.round(P.fatigue), usure: Math.round((P.scoreIA.usure ?? 0) * 100) } : null,
        agora: { aReagir: (e.agora?.reactions ?? []).length }, acces: accesJoueur(e), nouveaux: j.nouveaux ?? [],
        moi: moi ? { ...resumePerso(e, d, moi), estime: Math.round(estime(e)), activite: e.options.activite ?? 'terrain', zone: d.zones[moi.zone]?.nom } : null, activites: ACTIVITES,
        nonLus: e.inbox.filter(m => !m.lu).length, aRepondre: e.inbox.filter(m => m.choix && m.repondu === undefined).length, prochaines: proch, soiree: !!e.soiree, debat: e.debat ? { fini: e.debat.fini, type: e.debat.type } : null, entreDeux: Object.keys(e.entreDeux),
        grandDebat: !!e.entreDeux.presidentielle && !e.entreDeux.presidentielle.debatFait && e.entreDeux.presidentielle.unites.PR.maintenus.some(i => e.entreDeux.presidentielle.unites.PR.cands[i].parti === j.parti),
        president: e.presidence.perso >= 0 ? { nom: nomComplet(e.persos[e.presidence.perso]), parti: e.presidence.parti, popularite: Math.round(e.presidence.popularite) } : null, gouvernement: e.gouvernement, eco: { croissance: r1(e.eco.croissance), chomage: r1(e.eco.chomage), inflation: r1(e.eco.inflation) },
        victoires: Object.keys(VICTOIRES).map(k => ({ id: k, ...VICTOIRES[k], acquis: !!j.pointsVictoire[k] })), score: score(e, d), culture: P ? Math.round(P.culture) : 0, premierPlan: Math.round((j.pointsVictoire.semainesPremierPlan ?? 0) / 52 * 10) / 10 };
    }
    case 'inbox': return { messages: e.inbox.slice(-200).reverse().map(m => ({ ...m, date: dateTexte(m.s) })) };
    case 'perso': {
      const x = e.persos[p.id]; if (!x) return null; const mien = x.parti === j.parti; const Q = x.parti >= 0 ? e.partis[x.parti] : null;
      return { ...resumePerso(e, d, x), prenom: x.prenom, nomFamille: x.nom, naissance: x.naissance, formation: x.formation, profession: x.profession, zone: d.zones[x.zone]?.nom, attrsNom: ATTRS_NOM, axes: x.axes, axesParti: Q ? Q.axes : null,
        mandatsDetail: x.mandats.map(m => ({ type: LIB_MANDAT[m.type], lieu: lieuMandat(d, m), depuis: dateTexte(m.debut) })), relations: Object.keys(x.rel).map(k => ({ id: +k, nom: e.persos[+k] ? nomComplet(e.persos[+k]) : '?', type: x.rel[+k].t, force: x.rel[+k].v, parti: e.persos[+k]?.parti ?? -1 })),
        hist: x.hist.map(h => ({ date: dateTexte(h.s), texte: h.t })), citations: x.citations.slice(-6), victoires: x.victoires, defaites: x.defaites, observe: x.observe ? { ...x.observe, date: dateTexte(x.observe.s) } : null, mien, estMoi: x.id === j.perso,
        traitsDetail: x.traits.map(t => d.traitsParId[t]).filter(Boolean), frondeur: Q ? x.axes.reduce((s, v, i) => s + Math.abs(v - Q.axes[i]), 0) > 16 : false, affaire: e.affaires.find(a => a.perso === x.id && !a.close)?.titre ?? null, ineligible: x.statut === 'ineligible' };
    }
    case 'effectif': { const parti = p.parti ?? j.parti; const l = e.persos.filter(x => x.parti === parti && x.statut === 'actif' && (p.tous || x.rang >= 1 || x.postes.length || x.mandats.length)); return { parti, persos: l.slice(0, 1500).map(x => resumePerso(e, d, x)), attrsNom: ATTRS_NOM, total: e.persos.filter(x => x.parti === parti && x.statut === 'actif').length }; }
    case 'recherche': { const q = String(p.q ?? '').toLowerCase(); if (q.length < 2) return { persos: [] }; return { persos: e.persos.filter(x => x.statut === 'actif' && nomComplet(x).toLowerCase().includes(q)).slice(0, 40).map(x => resumePerso(e, d, x)) }; }
    case 'parti': {
      const Q = e.partis[p.parti ?? j.parti]; const mien = Q.idx === j.parti; const f = (id: number) => id >= 0 && e.persos[id] ? resumePerso(e, d, e.persos[id]) : null;
      return { idx: Q.idx, nom: Q.nom, sigle: Q.sigle, couleur: Q.couleur, famille: Q.famille, strategie: Q.strategie, style: Q.style, mien, chef: f(Q.chef), bureau: Object.keys(Q.bureau).map(k => ({ poste: k, lib: LIB_POSTE[k], perso: f(Q.bureau[k]) })),
        feds: d.depts.map((dep, i) => ({ dept: i, code: dep.code, nom: dep.nom, adherents: Math.round(Q.adhDept[i]), delegue: mien || true ? f(Q.delegues[i]) : null, terrain: Q.terrain.filter(t => t.dept === i).map(t => ({ action: t.action, part: t.part })) })).filter(x => x.adherents > 0 || x.delegue),
        courants: Q.courants.map(c => ({ ...c, chefNom: e.persos[c.chef] ? nomComplet(e.persos[c.chef]) : '', axeNom: d.axes[c.axe].nom, humeur: mien ? Math.round(c.humeur) : null })), congres: dateTexte(Q.prochainCongres),
        relations: e.partis.filter(x => x.actif && x.idx !== Q.idx).map(x => ({ parti: x.idx, valeur: Math.round(rel(e, Q.idx, x.idx)) })).sort((a, b) => b.valeur - a.valeur), accords: e.accords.filter(a => !a.rompu && a.partis.includes(Q.idx) && a.fin >= e.semaine).map(a => ({ id: a.id, type: NOM_SCRUTIN[a.type as Scrutin] ?? a.type, partis: a.partis })),
        elus: { deputes: nbDeputes(e, Q.idx), senateurs: e.senat.reduce((s, l) => s + l.filter(x => x.parti === Q.idx).length, 0), eurodeputes: e.europe.filter(s => s.parti === Q.idx).length, mairies: e.mairies.filter(m => m.parti === Q.idx).length, depts: e.conseilsDept.filter(c => c.parti === Q.idx).length, regions: e.conseilsReg.filter(c => c.parti === Q.idx).length },
        res: { adherents: Math.round(Q.adherents), militants: Math.round(Q.militants), notoriete: Math.round(Q.notoriete), credibilite: Math.round(Q.credibilite), unite: mien ? Math.round(Q.unite) : null, capital: mien ? Math.round(Q.capital) : null, fatigue: Math.round(Q.fatigue), usure: Math.round((Q.scoreIA.usure ?? 0) * 100) }, axes: Q.axes, propositions: Q.propositions, actionsTerrain: ACTIONS_TERRAIN, terrain: Q.terrain, jeunes: e.persos.filter(x => x.parti === Q.idx && x.statut === 'actif' && x.postes.includes('jeune')).length };
    }
    case 'finances': { const f = fluxMensuel(e, P); const net = netMensuel(f); return { tresorerie: Math.round(P.tresorerie), flux: f, dernier: P.fluxMois, net, hist: P.histTreso, prets: P.prets, capacite: capaciteEmprunt(e, P), financementPublic: Math.round(P.financementPublic), pariteRetenue: Math.round(P.pariteRetenue), voixLeg: Math.round(P.voixLeg), parlementaires: parlementaires(e, P.idx), comptes: P.comptes.slice(-8).map(c => ({ ...c, nom: NOM_SCRUTIN[c.scrutin as Scrutin], date: dateTexte(c.semaine) })), cotisation: P.cotisation, permanents: P.permanents, budgetCom: P.budgetCom, budgetFormation: P.budgetFormation, prevision: Array.from({ length: 13 }, (_, i) => Math.round(P.tresorerie + net * i)), campagne: P.campagne }; }
    case 'doctrine': return { axes: d.axes.map((a, i) => ({ ...a, pos: P.axes[i], pos0: P.axes0[i], cout: coutMouvement(P, 1), autres: e.partis.filter(q => q.actif && q.idx !== P.idx).map(q => ({ parti: q.idx, pos: q.axes[i] })) })), themes: d.themes.map(t => ({ id: t.id, nom: t.nom })),
      propositions: d.propositions.map(pr => ({ ...pr, axeNom: d.axes.find(a => a.id === pr.axe)!.nom, themeNom: d.themes.find(t => t.id === pr.theme)!.nom, etat: etatProposition(e, d, P, pr), chez: e.partis.filter(q => q.actif && q.propositions.includes(pr.id)).map(q => q.idx) })), capital: Math.round(P.capital), credibilite: Math.round(P.credibilite), culture: Math.round(P.culture), mouvements: r1(P.scoreIA.mouvements ?? 0),
      priorites: d.themes.map((t, ti) => ({ nom: t.nom, v: r1(d.segments.reduce((s, _, si) => s + priorites(e, d, si, 0)[ti], 0) / d.segments.length) })).sort((a, b) => b.v - a.v) };
    case 'agora': return vueAgora(e, d);
    case 'medias': return { medias: d.medias, debat: e.debat ? { ...e.debat, persoNom: nomComplet(e.persos[e.debat.perso]), advNom: e.debat.adversaire >= 0 ? nomComplet(e.persos[e.debat.adversaire]) : '', advParti: e.debat.adversaire >= 0 ? e.persos[e.debat.adversaire].parti : -1, mediaNom: d.medias.find(m => m.id === e.debat!.media)?.nom ?? 'Débat' } : null, reponses: REPONSES.map(r => ({ id: r.id, nom: r.nom, desc: r.desc, attr: ATTRS_NOM[r.attr] })), publications: PUBLICATIONS, viralite: r1(P.viralite), gaffes: r1(P.gaffes), dernierePub: (P.scoreIA.dernierePub ?? -9) >= e.semaine,
      sondages: e.sondages.slice(-14).reverse().map(s => ({ ...s, date: dateTexte(s.s) })), hist: e.histIntentions, porteParole: P.bureau.porte_parole >= 0 ? resumePerso(e, d, e.persos[P.bureau.porte_parole]) : null };
    case 'historique': return { archives: e.archives.slice().reverse().map(a => ({ ...a, date: jourVote(a.s), lieux: undefined })), journal: e.journal.slice(-150).reverse().map(x => ({ date: dateTexte(x.s), t: x.t })), abstention: e.abstentionHist, hist: e.histIntentions };
    case 'soiree': return e.soiree;
    case 'pantheon': return pantheon(e, d);
    case 'institutions': return { assemblee: e.partis.map(q => nbDeputes(e, q.idx)), senat: e.partis.map(q => e.senat.reduce((s, l) => s + l.filter(x => x.parti === q.idx).length, 0)), europe: e.partis.map(q => e.europe.filter(s => s.parti === q.idx).length), mairies: e.partis.map(q => e.mairies.filter(m => m.parti === q.idx && d.villes[m.ville].plm !== 2).length), grandesVilles: e.partis.map(q => e.mairies.filter(m => m.parti === q.idx && d.villes[m.ville].pop >= 30000 && d.villes[m.ville].plm !== 2).length), depts: e.partis.map(q => e.conseilsDept.filter(c => c.parti === q.idx).length), regions: e.partis.map(q => e.conseilsReg.filter(c => c.parti === q.idx).length),
      gouvernement: { ...e.gouvernement, pmNom: e.gouvernement.pm >= 0 && e.persos[e.gouvernement.pm] ? nomComplet(e.persos[e.gouvernement.pm]) : '' }, president: e.presidence.perso >= 0 ? { nom: nomComplet(e.persos[e.presidence.perso]), id: e.presidence.perso, parti: e.presidence.parti, popularite: Math.round(e.presidence.popularite), depuis: dateTexte(e.presidence.debut) } : null,
      regionsDetail: e.conseilsReg.filter(c => c.parti >= 0).map(c => ({ nom: d.regions[c.lieu].nom, parti: c.parti, president: c.president >= 0 ? nomComplet(e.persos[c.president]) : '', id: c.president, bilan: Math.round(c.bilan) })) };
    case 'mandat': {
      const m = mairieDuJoueur(e); const c = conseilDuJoueur(e); const dep = moi ? aMandat(moi, 'depute') : null; const out: any = { projetsNom: PROJETS_MAIRIE, delegations: DELEGATIONS, actionsParlement: ACTIONS_PARLEMENT, deputes: nbDeputes(e, j.parti), majorite: e.gouvernement.coalition.includes(j.parti), capital: P ? Math.round(P.capital) : 0, activite: j.pointsVictoire.activite ?? 0, mandats: moi ? moi.mandats.map(x => ({ type: LIB_MANDAT[x.type], lieu: lieuMandat(d, x), depuis: dateTexte(x.debut) })) : [], estDepute: !!dep || (j.mode === 'parti' && nbDeputes(e, j.parti) > 0) };
      if (m) { const v = d.villes[m.ville]; out.mairie = { ville: v.nom, pop: v.pop, bilan: Math.round(m.bilan), budget: Math.round(m.budget), impots: m.impots, opposition: Math.round(m.opposition), interco: Math.round(m.interco), projets: m.projets.map((n, i) => ({ nom: PROJETS_MAIRIE[i], niveau: n, cout: coutProjet(v.pop, n) })), sieges: m.sieges, total: v.sieges, adjoints: m.adjoints.map(a => ({ ...a, nom: nomComplet(e.persos[a.perso]), gestion: e.persos[a.perso].attrs[A.gestion] })), equipe: e.persos.filter(x => x.statut === 'actif' && x.parti === m.parti && x.id !== m.maire && x.mandats.some(k => (k.type === 'conseiller_municipal' || k.type === 'adjoint') && k.lieu === m.ville)).map(x => resumePerso(e, d, x)) }; }
      if (c) { const pop = c.type === 'dept' ? d.depts[c.c.lieu].pop : d.zones.filter(z => z.regIdx === c.c.lieu).reduce((s, z) => s + z.pop, 0); out.conseil = { type: c.type, nom: c.type === 'dept' ? d.depts[c.c.lieu].nom : d.regions[c.c.lieu].nom, bilan: Math.round(c.c.bilan), budget: Math.round(c.c.budget), sieges: c.c.sieges, projets: c.c.projets.map((n, i) => ({ nom: PROJETS_CONSEIL[c.type][i], niveau: n, cout: Math.round(pop * 14 * (1 + n * 0.6)) })) }; }
      { const role = roleExecutif(e); if (role.gouverne) out.executif = vueExecutif(e, d); }
      if (e.presidence.parti === j.parti && e.presidence.perso >= 0 && (j.mode === 'parti' || e.presidence.perso === j.perso)) out.presidence = { popularite: Math.round(e.presidence.popularite), reformes: e.presidence.reformes, budget: e.presidence.budget, depuis: dateTexte(e.presidence.debut) };
      return out;
    }
    case 'campagne': return vueCampagne(e, d, p);
    case 'carte': return vueCarte(e, d, p);
    case 'zone': {
      const z = d.zones[p.idx]; if (!z) return null; const c = preparer(e, d); const act = e.partis.filter(q => q.actif).map(q => q.idx); const v = voter(e, d, c, [z.idx], { partis: act, facteur: FACTEUR_ABST.sondage }); const tot = v.voix.reduce((a, b) => a + b, 0) || 1;
      const vi = d.villes.find(x => x.zones.includes(z.idx) && x.plm !== 1); const m = vi ? e.mairies[vi.idx] : null; const cd = e.conseilsDept[z.deptIdx];
      return { idx: z.idx, nom: z.nom, type: ['Commune', 'Bassin de petites communes', 'Secteur', 'Outre-mer et étranger'][z.type], dept: d.depts[z.deptIdx].nom, pop: z.pop, inscrits: z.inscrits, terr: ['Urbain dense', 'Périurbain', 'Rural'][z.terr], nbCommunes: z.nbCommunes, circos: z.circos.map(([ci, f]) => ({ id: d.circos[ci].id, nom: d.circos[ci].nomCourt, part: f, depute: e.assemblee[ci]?.perso >= 0 ? nomComplet(e.persos[e.assemblee[ci].perso]) : 'Siège vacant', deputeId: e.assemblee[ci]?.perso ?? -1, parti: e.assemblee[ci]?.parti ?? -1 })),
        intentions: act.map((q, l) => ({ parti: q, v: r1(brouiller(v.voix[l] / tot, z.id + q, e.semaine) * 100) })).sort((a, b) => b.v - a.v).slice(0, 8), segments: d.segments.map((s, si) => ({ nom: s.nom, part: d.socio[z.idx * d.segments.length + si] / 10 })).sort((a, b) => b.part - a.part).slice(0, 8),
        maire: m ? { nom: nomComplet(e.persos[m.maire]), id: m.maire, parti: m.parti, bilan: Math.round(m.bilan), sieges: m.sieges, total: vi!.sieges } : null, partsBassin: z.type === 1 ? e.partis.filter(q => q.actif).map(q => ({ parti: q.idx, v: Math.round(100 * e.partsBassin[z.idx * nP + q.idx]) })).filter(x => x.v >= 3).sort((a, b) => b.v - a.v) : null,
        conseilDept: cd && cd.parti >= 0 ? { parti: cd.parti, president: cd.president >= 0 ? nomComplet(e.persos[cd.president]) : '' } : null, impl: r1(e.impl[z.idx * nP + j.parti] * 100), mob: r1(e.mob[z.idx * nP + j.parti] * 100),
        priorites: d.themes.map((t, ti) => ({ nom: t.nom, v: r1(d.segments.reduce((s, _, si) => s + priorites(e, d, si, z.regIdx)[ti] * d.socio[z.idx * d.segments.length + si] / 1000, 0)) })).sort((a, b) => b.v - a.v).slice(0, 5) };
    }
    case 'options': return { ...e.options, activites: ACTIVITES };
    default: return null;
  }
}

// Meilleur candidat disponible du parti pour une unité (suggestion automatique).
export function suggestion(e: Etat, d: Donnees, parti: number, deptIdx: number, pris: Set<number>, zone?: number): number {
  let best = -1, bs = -1e9; for (const p of e.persos) { if (p.parti !== parti || p.statut !== 'actif' || pris.has(p.id) || p.rang < 1) continue; if (p.dept !== deptIdx) continue; if (p.mandats.some(m => ['maire', 'president_dept', 'president_region', 'senateur', 'eurodepute', 'president', 'depute'].includes(m.type))) continue; const s = qualiteCandidat(d, p, zone === undefined || p.zone === zone) + (zone !== undefined && p.zone === zone ? 0.1 : 0); if (s > bs) { bs = s; best = p.id; } } return best;
}

function vueCampagne(e: Etat, d: Donnees, p: any): any {
  const j = e.joueur; const P = e.partis[j.parti]; const nP = e.partis.length;
  const cal = e.calendrier.filter(x => !x.fait2 && (x.s2 > 0 ? x.s2 : x.s1) >= e.semaine).slice(0, 10).map(x => ({ type: x.type, nom: NOM_SCRUTIN[x.type], date: jourVote(x.s1), date2: x.s2 > 0 ? jourVote(x.s2) : '', dans: x.s1 - e.semaine, ouverte: x.s1 - e.semaine <= DUREE_CAMPAGNE[x.type], fait1: !!x.fait1, serie: x.serie, politique: politique(e, j.parti, x.type), accords: accordsActifs(e, x.type).map(a => ({ id: a.id, partis: a.partis, mien: a.partis.includes(j.parti) })) }));
  const out: any = { calendrier: cal, campagne: P.campagne ? { ...P.campagne, plafond: Math.round(plafondParti(e, d, P, P.campagne.scrutin as Scrutin)), nom: NOM_SCRUTIN[P.campagne.scrutin as Scrutin] } : null, tresorerie: Math.round(P.tresorerie), depts: d.depts.map((x, i) => ({ idx: i, code: x.code, nom: x.nom })).filter(x => d.zonesParDept[x.idx].length), consigne: e.consignes[j.parti], estime: Math.round(estime(e)),
    presidentielle: { candidat: P.candidatPres >= 0 ? { id: P.candidatPres, nom: nomComplet(e.persos[P.candidatPres]) } : null, parrainages: P.parrainages, vivier: Math.round(vivierParrains(e, d, P)), effort: P.scoreIA.effortParrainages ?? 0, figures: cadres(e, P.idx, 3).sort((a, b) => b.notoriete - a.notoriete).slice(0, 12).map(x => ({ id: x.id, nom: nomComplet(x), notoriete: Math.round(x.notoriete), charisme: x.attrs[A.charisme] })), autres: e.partis.filter(q => q.actif && q.idx !== P.idx && q.candidatPres >= 0).map(q => ({ parti: q.idx, nom: nomComplet(e.persos[q.candidatPres]), id: q.candidatPres, parrainages: q.parrainages })), soutiens: Object.keys(e.consignes).filter(k => e.consignes[+k] === P.idx && +k !== P.idx).map(Number) } };
  // Entre-deux-tours : unités où le joueur a une décision à prendre.
  out.entreDeux = Object.keys(e.entreDeux).map(type => { const ed = e.entreDeux[type]; const us = Object.keys(ed.unites).map(uid => { const u = ed.unites[uid]; const mi = u.cands.findIndex(c => c.parti === j.parti); if (mi < 0 || u.elu >= 0) return null; const tot = u.t1.reduce((a, b) => a + b, 0) || 1; const part = u.t1[mi] / tot; const liste = type !== 'legislatives' && type !== 'departementales' && type !== 'presidentielle'; if (!u.maintenus.includes(mi) && !(liste && part >= 0.05) && u.fusions[mi] === undefined) return null;
      return { uid, nom: u.nom, moi: mi, part: r1(part * 100), rang: u.t1.filter(v => v > u.t1[mi]).length + 1, maintenu: u.maintenus.includes(mi), desiste: (e.desistements[type] ?? []).includes(uid), fusion: u.fusions[mi] ?? -1, liste, lignes: u.cands.map((c, i) => ({ i, nom: c.perso >= 0 ? nomComplet(e.persos[c.perso]) : `Candidat ${e.partis[c.parti].sigle}`, parti: c.parti, soutiens: c.soutiens, pct: r1(100 * u.t1[i] / tot), maintenu: u.maintenus.includes(i), fusionne: u.fusions[i] ?? -1 })).sort((a, b) => b.pct - a.pct).slice(0, 6) }; }).filter(Boolean) as any[];
    return { type, nom: NOM_SCRUTIN[type as Scrutin], date2: jourVote(ed.s2), unites: us.sort((a, b) => b.part - a.part).slice(0, 120), total: us.length }; });
  // Investitures pour le prochain scrutin demandé.
  const type: Scrutin | undefined = p.scrutin; if (type) {
    const inv = e.investitures[type] ?? {}; const pris = new Set<number>(Object.values(inv));
    const ligne = (uid: string, nomU: string, deptIdx: number, zone: number | undefined, sortant: { parti: number; perso: number } | undefined, force: number) => { const id = inv[`${uid}:${P.idx}`]; const pp = id !== undefined && id >= 0 ? e.persos[id] : sortant && sortant.parti === P.idx && sortant.perso >= 0 ? e.persos[sortant.perso] : null; return { uid, nom: nomU, dept: d.depts[deptIdx].code, sortant: sortant && sortant.perso >= 0 ? { nom: nomComplet(e.persos[sortant.perso]), parti: sortant.parti } : sortant ? { nom: '', parti: sortant.parti } : null, candidat: pp ? { id: pp.id, nom: nomComplet(pp), sexe: pp.sexe, qualite: r1(qualiteCandidat(d, pp, zone === undefined || pp.zone === zone) * 100), investi: id !== undefined } : null, force: r1(force * 100), suggestion: pp ? -1 : suggestion(e, d, P.idx, deptIdx, pris, zone) }; };
    const c = preparer(e, d); const act = e.partis.filter(q => q.actif).map(q => q.idx); const zs = d.zones.map(z => z.idx); const v = voter(e, d, c, zs, { partis: act, facteur: 0.8 }); const mi = act.indexOf(P.idx); const part = (zf: [number, number][]) => { let a = 0, t = 0; for (const [z, f] of zf) { for (let l = 0; l < act.length; l++) t += v.voix[z * act.length + l] * f; a += v.voix[z * act.length + mi] * f; } return brouiller(a / (t || 1), 'inv' + zf[0]?.[0], e.semaine); };
    let unites: any[] = [];
    if (type === 'legislatives') unites = d.circos.map((ci, i) => d.zonesParCirco[i].length ? ligne(ci.id, ci.nomCourt, d.idxDept[ci.dept] ?? 0, undefined, e.assemblee[i] && e.assemblee[i].parti >= 0 ? e.assemblee[i] : undefined, part(d.zonesParCirco[i])) : null).filter(Boolean);
    else if (type === 'municipales') unites = d.villes.filter(x => x.pop >= (p.popMin ?? 30000) || e.mairies[x.idx].parti === P.idx).map(x => ligne(x.id, x.nom, x.deptIdx, x.zones[0], { parti: e.mairies[x.idx].parti, perso: e.mairies[x.idx].maire }, part(x.zones.map(z => [z, 1] as [number, number]))));
    else if (type === 'regionales') unites = d.regions.map((r, i) => SIEGES_REGION[r.code] ? ligne('R' + r.code, r.nom, d.idxDept[r.depts[0]] ?? 0, undefined, e.conseilsReg[i].parti >= 0 ? { parti: e.conseilsReg[i].parti, perso: e.conseilsReg[i].president } : undefined, part(d.zones.filter(z => z.regIdx === i).map(z => [z.idx, 1] as [number, number]))) : null).filter(Boolean);
    else if (type === 'europeennes') unites = [ligne('EU', 'Liste nationale', 0, undefined, undefined, part(zs.map(z => [z, 1] as [number, number])))];
    const cands = unites.filter(u => u.candidat); out.investitures = { type, nom: NOM_SCRUTIN[type], unites, femmes: cands.filter(u => u.candidat.sexe === 'F').length, hommes: cands.filter(u => u.candidat.sexe === 'M').length, vivier: e.persos.filter(x => x.parti === P.idx && x.statut === 'actif' && x.rang >= 1).length };
  }
  void nP; return out;
}

// Carte : valeur et couleur par département (niveau national), par circonscription ou par zone (niveau département).
function vueCarte(e: Etat, d: Donnees, p: any): any {
  const couche: string = p.couche ?? 'resultats'; const niveau: string = p.niveau ?? 'nat'; const nP = e.partis.length; const j = e.joueur.parti; const cible: number = p.parti ?? j; const out: Record<string, { c: number; v: number; t: string }> = {};
  const zonesDe = (di: number) => d.zonesParDept[di];
  let V: Float64Array | null = null; const act = e.partis.filter(q => q.actif).map(q => q.idx);
  if (couche === 'intentions') { const c = preparer(e, d); V = voter(e, d, c, d.zones.map(z => z.idx), { partis: act, facteur: FACTEUR_ABST.sondage }).voix; }
  const agreg = (zs: [number, number][], cle: string) => {
    if (couche === 'intentions' && V) { const t = new Array(act.length).fill(0); for (const [z, f] of zs) for (let l = 0; l < act.length; l++) t[l] += V[z * act.length + l] * f; const tot = t.reduce((a, b) => a + b, 0) || 1; let g = 0; t.forEach((x, l) => { t[l] = brouiller(x / tot, cle + l, e.semaine); if (t[l] > t[g]) g = l; }); const mi = act.indexOf(cible); return { c: p.parti !== undefined ? cible : act[g], v: r1(100 * (p.parti !== undefined ? t[mi] ?? 0 : t[g])), t: act.map((q, l) => [q, t[l]] as [number, number]).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([q, x]) => `${e.partis[q].sigle} ${r1(x * 100)} %`).join(', ') }; }
    if (couche === 'implantation') { let a = 0, w = 0, mo = 0; for (const [z, f] of zs) { const k = d.zones[z].inscrits * f; a += e.impl[z * nP + cible] * k; mo += e.mob[z * nP + cible] * k; w += k; } return { c: cible, v: r1(100 * a / (w || 1)), t: `Implantation acquise ${r1(100 * a / (w || 1))}, mobilisation ${r1(100 * mo / (w || 1))}` }; }
    if (couche === 'sociologie') { const S = d.segments.length; const t = new Array(S).fill(0); let w = 0; for (const [z, f] of zs) { const k = d.zones[z].inscrits * f; w += k; for (let s = 0; s < S; s++) t[s] += d.socio[z * S + s] * k; } const tag: string = p.etiquette ?? 'populaire'; let part = 0; d.segments.forEach((s, si) => { if (s.etiquettes.includes(tag)) part += t[si]; }); return { c: -1, v: r1(part / (w || 1) / 10), t: `${r1(part / (w || 1) / 10)} % de la population` }; }
    if (couche === 'priorites') { const z0 = d.zones[zs[0]?.[0] ?? 0]; const pr = d.themes.map((_, ti) => d.segments.reduce((s, __, si) => { let x = 0, w = 0; for (const [z, f] of zs.slice(0, 12)) { const k = d.zones[z].inscrits * f; x += d.socio[z * d.segments.length + si] * k; w += k; } return s + priorites(e, d, si, z0.regIdx)[ti] * x / (w || 1) / 1000; }, 0)); const ti = p.theme ?? pr.indexOf(Math.max(...pr)); return { c: -2 - ti, v: r1(pr[ti]), t: `${d.themes[ti].nom} : ${r1(pr[ti])}` }; }
    return { c: -1, v: 0, t: '' };
  };
  if (niveau === 'nat') {
    d.depts.forEach((dep, di) => {
      const zs = zonesDe(di); if (!zs.length) return;
      if (couche === 'resultats') { const t = new Array(nP).fill(0); d.circos.forEach((c, ci) => { if (c.dept === dep.code && e.assemblee[ci]?.parti >= 0) t[e.assemblee[ci].parti]++; }); const g = t.indexOf(Math.max(...t)); out[dep.code] = { c: g, v: t[g], t: e.partis.filter(q => t[q.idx] > 0).sort((a, b) => t[b.idx] - t[a.idx]).map(q => `${q.sigle} ${t[q.idx]}`).join(', ') + ' députés' }; }
      else if (couche === 'departements') { const c = e.conseilsDept[di]; out[dep.code] = { c: c?.parti ?? -1, v: c ? Math.round(c.bilan) : 0, t: c && c.parti >= 0 ? `Conseil départemental : ${e.partis[c.parti].sigle}${c.president >= 0 ? ', ' + nomComplet(e.persos[c.president]) : ''}` : '' }; }
      else if (couche === 'regions') { const ri = d.idxRegion[dep.region]; const c = e.conseilsReg[ri]; out[dep.code] = { c: c?.parti ?? -1, v: c ? Math.round(c.bilan) : 0, t: c && c.parti >= 0 ? `${d.regions[ri].nom} : ${e.partis[c.parti].sigle}${c.president >= 0 ? ', ' + nomComplet(e.persos[c.president]) : ''}` : '' }; }
      else if (couche === 'mairies') { const t = new Array(nP).fill(0); for (const v of d.villes) if (v.deptIdx === di && v.plm !== 2) t[e.mairies[v.idx].parti] += v.pop; const g = t.indexOf(Math.max(...t)); out[dep.code] = { c: t[g] > 0 ? g : -1, v: d.villes.filter(v => v.deptIdx === di && e.mairies[v.idx].parti === cible).length, t: e.partis.filter(q => t[q.idx] > 0).sort((a, b) => t[b.idx] - t[a.idx]).slice(0, 4).map(q => `${q.sigle} ${d.villes.filter(v => v.deptIdx === di && v.plm !== 2 && e.mairies[v.idx].parti === q.idx).length} villes`).join(', ') }; }
      else if (couche === 'federations') { const Q = e.partis[cible]; out[dep.code] = { c: cible, v: Math.round(Q.adhDept[di]), t: `${Math.round(Q.adhDept[di])} adhérents${Q.delegues[di] >= 0 ? ', délégué : ' + nomComplet(e.persos[Q.delegues[di]]) : ', pas de délégué'}` }; }
      else out[dep.code] = agreg(zs.map(z => [z, 1] as [number, number]), 'd' + dep.code);
    });
    return { niveau, couche, valeurs: out };
  }
  // Niveau département : circonscriptions et zones.
  const di: number = p.dept; const circos: Record<string, { c: number; v: number; t: string }> = {};
  d.circos.forEach((c, ci) => { if (d.idxDept[c.dept] !== di) return; const s = e.assemblee[ci]; circos[c.id] = couche === 'resultats' ? { c: s?.parti ?? -1, v: 0, t: `${c.nomCourt} : ${s && s.perso >= 0 ? nomComplet(e.persos[s.perso]) : 'siège vacant'}${s && s.parti >= 0 ? ' (' + e.partis[s.parti].sigle + ')' : ''}` } : { ...agreg(d.zonesParCirco[ci], 'c' + c.id), t: `${c.nomCourt} : ${agreg(d.zonesParCirco[ci], 'c' + c.id).t}` }; });
  for (const z of zonesDe(di)) { const Z = d.zones[z];
    if (couche === 'resultats' || couche === 'mairies') { const vi = d.villes.find(x => x.zones.includes(z) && x.plm !== 1); if (vi) { const m = e.mairies[vi.idx]; out[z] = { c: m.parti, v: Math.round(m.bilan), t: `${Z.nom} : ${nomComplet(e.persos[m.maire])} (${e.partis[m.parti].sigle}), bilan ${Math.round(m.bilan)}` }; } else { let g = 0; for (let q = 0; q < nP; q++) if (e.partsBassin[z * nP + q] > e.partsBassin[z * nP + g]) g = q; out[z] = { c: g, v: Math.round(100 * e.partsBassin[z * nP + g]), t: `${Z.nom} : ${Z.nbCommunes} petites communes, sensibilité dominante ${e.partis[g].sigle}` }; } }
    else { const a = agreg([[z, 1]], 'z' + Z.id); out[z] = { ...a, t: `${Z.nom} : ${a.t}` }; }
  }
  return { niveau, couche, dept: di, valeurs: out, circos, zones: zonesDe(di).map(z => ({ idx: z, nom: d.zones[z].nom, type: d.zones[z].type, pop: d.zones[z].pop, lon: d.zones[z].lon, lat: d.zones[z].lat })) };
}
