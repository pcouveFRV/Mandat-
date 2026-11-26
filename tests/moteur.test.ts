// Tests du moteur : calibrage sur les résultats réels, déterminisme, sérialisation, tenue dans le temps, performance.
import { describe, it, expect, beforeAll } from 'vitest';
import { chargerDonneesNode } from '../src/data/chargementNode';
import { creerPartie } from '../src/engine/creation';
import { tour } from '../src/engine/tour';
import { appliquer } from '../src/engine/actions';
import { vue } from '../src/engine/vues';
import { ecartCalibrage } from '../src/engine/systems/electorat';
import type { Donnees, Etat } from '../src/engine/types';

let d: Donnees;
beforeAll(async () => { d = await chargerDonneesNode(); });
const nouvelle = (graine: number, parti = 'PS', scenario: any = 'route2027'): Etat => creerPartie(d, { scenario, mode: 'parti', parti, graine });

describe('données', () => {
  it('contient 577 circonscriptions, plus de 200 événements et 60 propositions', () => { expect(d.circos.length).toBe(577); expect(d.evenements.length).toBeGreaterThanOrEqual(200); expect(d.propositions.length).toBeGreaterThanOrEqual(60); expect(d.traits.length).toBeGreaterThanOrEqual(30); });
  it('simule environ 1 000 communes et 8 secteurs à Marseille', () => { expect(d.zones.filter(z => z.type === 0).length).toBeGreaterThan(900); expect(d.zones.filter(z => z.ville === 'Marseille').length).toBe(8); });
  it('rattache chaque circonscription à au moins une zone', () => { expect(d.zonesParCirco.filter(z => z.length === 0).length).toBe(0); });
});
describe('calibrage', () => {
  it('reproduit le premier tour réel des législatives 2024 à quelques points près', () => {
    const e = nouvelle(1); const r = ecartCalibrage(e, d);
    expect(r.moyen).toBeLessThan(2.5); expect(r.p90).toBeLessThan(6);
    for (const b of r.national) expect(Math.abs(b.reel - b.simule)).toBeLessThan(1.5);
  });
  it('installe les 577 députés réels', () => { const e = nouvelle(1); expect(e.assemblee.length).toBe(577); const f = e.persos[e.assemblee[d.idxCirco['13-06']].perso]; expect(f.nom).toBe('Fayssat'); expect(e.partis[f.parti].id).toBe('UDR'); });
});
describe('déterminisme', () => {
  it('une même graine et les mêmes choix donnent la même partie', () => {
    const a = nouvelle(42), b = nouvelle(42); a.options.auto = b.options.auto = true; for (let i = 0; i < 12; i++) { tour(a, d); tour(b, d); }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('des graines différentes donnent des parties différentes', () => { const a = nouvelle(1), b = nouvelle(2); expect(JSON.stringify(a.persos.slice(600, 640))).not.toBe(JSON.stringify(b.persos.slice(600, 640))); });
  it('l\'état survit à une sauvegarde JSON', () => {
    const a = nouvelle(7); a.options.auto = true; for (let i = 0; i < 6; i++) tour(a, d); const b: Etat = JSON.parse(JSON.stringify(a)); for (let i = 0; i < 6; i++) { tour(a, d); tour(b, d); }
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
describe('partie', () => {
  it('se crée dans les trois scénarios et les deux modes', () => {
    for (const sc of ['municipales2026', 'route2027'] as const) { const e = nouvelle(3, 'RN', sc); expect(e.partis.filter(p => p.actif).length).toBe(19); expect(vue(e, d, 'base').res.adherents).toBeGreaterThan(0); }
    const c = creerPartie(d, { scenario: 'route2027', mode: 'carriere', parti: 'RN', graine: 5, perso: { nom: 'Test', prenom: 'Camille', sexe: 'F', age: 24, zone: 'S1309', origine: 'Employé', etudes: 'Droit', traits: ['tribun', 'enfant_pays'], attrs: new Array(21).fill(1), depart: 'conseiller' } });
    const p = c.persos[c.joueur.perso]; expect(p.nom).toBe('Test'); expect(p.mandats[0].type).toBe('conseiller_municipal'); expect(vue(c, d, 'base').droits.tout).toBe(false);
  });
  it('traverse la présidentielle et les législatives de 2027 sans erreur, en moins de 200 ms par semaine en moyenne', () => {
    const e = nouvelle(11); e.options.auto = true; const t0 = Date.now(); let n = 0; while (n < 52) { tour(e, d); n++; }
    const ms = (Date.now() - t0) / n; expect(ms).toBeLessThan(200); expect((Date.now() - t0) / 1000).toBeLessThan(15);
    expect(e.archives.some(a => a.type === 'presidentielle' && a.tour === 2)).toBe(true); expect(e.archives.some(a => a.type === 'legislatives' && a.tour === 2)).toBe(true);
    expect(e.assemblee.filter(s => s.parti >= 0).length).toBe(577); for (const P of e.partis) { expect(Number.isFinite(P.tresorerie)).toBe(true); expect(P.unite).toBeGreaterThanOrEqual(0); expect(P.unite).toBeLessThanOrEqual(100); }
  });
  it('applique les actions du joueur et refuse celles qui dépassent ses droits', () => {
    const e = nouvelle(9); expect(appliquer(e, d, { type: 'finances', permanents: 12 }).retour.ok).toBe(true); expect(e.partis[e.joueur.parti].permanents).toBe(12);
    expect(appliquer(e, d, { type: 'terrain', affectations: [{ dept: 12, action: 'tractage', part: 0.3 }] }).retour.ok).toBe(true); expect(appliquer(e, d, { type: 'terrain', affectations: [{ dept: 12, action: 'tractage', part: 1.3 }] }).retour.ok).toBe(false);
    const c = creerPartie(d, { scenario: 'route2027', mode: 'carriere', parti: 'PS', graine: 5, perso: { nom: 'Test', prenom: 'Paul', sexe: 'M', age: 30, zone: 'C31555', origine: 'Employé', etudes: 'Droit', traits: ['tribun', 'bosseur'], attrs: new Array(21).fill(0), depart: 'militant' } });
    expect(appliquer(c, d, { type: 'bougerAxe', axe: 0, delta: 1 }).retour.ok).toBe(false); expect(appliquer(c, d, { type: 'activite', valeur: 'reseau' }).retour.ok).toBe(true);
  });
});
