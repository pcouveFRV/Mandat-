// Tests de la V5 : terrain, équipe de militants, campagne locale, mini-jeux.
import { describe, it, expect, beforeAll } from 'vitest';
import { chargerDonneesNode } from '../src/data/chargementNode';
import { creerPartie } from '../src/engine/creation';
import { tour } from '../src/engine/tour';
import { appliquer } from '../src/engine/actions';
import { vue } from '../src/engine/vues';
import type { Donnees, Etat } from '../src/engine/types';

let d: Donnees;
beforeAll(async () => { d = await chargerDonneesNode(); });
const nouvelle = (parti: string, mode: 'parti' | 'carriere' = 'parti', graine = 7): Etat => creerPartie(d, { scenario: 'route2027', mode, parti, graine } as any);
const act = (e: Etat, a: any) => appliquer(e, d, a).retour;

describe('terrain', () => {
  it('crée une équipe et six quartiers, identiques quel que soit le moment de la première lecture', () => {
    const a = nouvelle('PS'), b = nouvelle('PS'); const va: any = vue(a, d, 'equipe', {}); tour(b, d); expect(va.quartiers.length).toBe(6); expect(va.membres.length).toBeGreaterThanOrEqual(3);
    expect(b.equipe!.membres.map(m => m.nom)).toEqual(a.equipe!.membres.map(m => m.nom));
    expect(Math.abs(va.quartiers.reduce((s: number, q: any) => s + q.poids, 0) - 1)).toBeLessThan(0.001);
  });
  it('fait progresser l\'ancrage et ouvre une campagne avant un scrutin, puis un bilan par bureau', () => {
    const e = nouvelle('PS'); const avant = (vue(e, d, 'equipe', {}) as any).quartiers.map((q: any) => q.ancrage); let campagne = false, bilan = false;
    for (let k = 0; k < 40; k++) { tour(e, d); if (e.equipe!.campagne) campagne = true; if (e.equipe!.bilan) { bilan = true; expect(e.equipe!.bilan.bureaux.length).toBe(12); break; } }
    expect(campagne).toBe(true); expect(bilan).toBe(true);
    const apres = e.equipe!.quartiers.map(q => q.ancrage); expect(apres.some((v, i) => v > avant[i])).toBe(true);
    const r = act(e, { type: 'equipeAnnonce', vus: 3, enTete: e.equipe!.bilan!.rang === 1 }); expect(r.ok).toBe(true); expect(e.equipe!.bilan!.annonce!.juste).toBe(true);
  });
  it('laisse diriger l\'équipe : missions, bras droit, commande, recrutement plafonné', () => {
    const e = nouvelle('PS'); const g = (vue(e, d, 'equipe', {}), e.equipe!); const m = g.membres[0];
    expect(act(e, { type: 'equipeAffecter', id: m.id, action: 'porte', quartier: 2 }).ok).toBe(true); expect(m.quartier).toBe(2); expect(g.auto).toBe(false);
    expect(act(e, { type: 'equipeLieutenant', id: m.id }).ok).toBe(true); expect(m.lieutenant).toBe(true);
    const caisse = g.caisse; expect(act(e, { type: 'equipeCommander', quoi: 'tracts' }).ok).toBe(true); expect(g.caisse).toBeLessThan(caisse); const tracts = g.tracts; tour(e, d); tour(e, d); expect(e.equipe!.tracts).toBeGreaterThan(tracts - 2000);
    expect(act(e, { type: 'equipeAffecter', id: m.id, action: 'formation', quartier: 0, cible: 1 }).ok).toBe(true); const niv = m.comp[1]; tour(e, d); expect(e.equipe!.membres.find(x => x.id === m.id)!.comp[1]).toBe(Math.min(18, niv + 1));
  });
  it('refuse la direction de l\'équipe à un simple militant, mais lui laisse les sorties', () => {
    const e = nouvelle('LR', 'carriere'); const p = e.persos[e.joueur.perso]; const P = e.partis[e.joueur.parti]; p.rang = 0; if (P.chef === p.id) P.chef = -1;
    vue(e, d, 'equipe', {}); expect(act(e, { type: 'equipeRepartir' }).ok).toBe(false); expect(act(e, { type: 'jeuDemarrer', jeu: 'porte', quartier: 0 }).ok).toBe(true);
  });
  it('joue un porte-à-porte et un tractage jusqu\'au bout, une fois par semaine', () => {
    const e = nouvelle('PS'); vue(e, d, 'equipe', {}); expect(act(e, { type: 'jeuDemarrer', jeu: 'porte', quartier: 1 }).ok).toBe(true); const J = e.equipe!.jeu; expect(J.portes.length).toBe(5);
    for (let k = 0; k < 5; k++) act(e, { type: 'jeuChoix', choix: J.portes[k].options[0] }); expect(e.equipe!.jeu.fini).toBe(true); act(e, { type: 'jeuFermer' });
    expect(act(e, { type: 'jeuDemarrer', jeu: 'porte', quartier: 1 }).ok).toBe(false);
    expect(act(e, { type: 'jeuDemarrer', jeu: 'tractage', quartier: 0 }).ok).toBe(true); for (const i of [0, 1, 2]) act(e, { type: 'jeuChoix', choix: i }); expect(e.equipe!.jeu.fini).toBe(true);
    tour(e, d); expect(act(e, { type: 'jeuDemarrer', jeu: 'porte', quartier: 1 }).ok).toBe(true);
  });
  it('règle un incident par un choix', () => {
    const e = nouvelle('PS'); let vu = false; for (let k = 0; k < 80 && !vu; k++) { tour(e, d); if (e.equipe!.incident) { vu = true; const r = act(e, { type: 'equipeIncident', choix: 0 }); expect(r.ok).toBe(true); expect(e.equipe!.incident).toBe(null); expect(e.equipe!.journal.length).toBeGreaterThan(0); } }
    expect(vu).toBe(true);
  });
});
