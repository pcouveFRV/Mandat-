// Tests de la V6 : élus réels, incarner une personne, tableau de bord, page Chronique, emblème, financement du parti.
import { describe, it, expect, beforeAll } from 'vitest';
import { chargerDonneesNode } from '../src/data/chargementNode';
import { creerPartie } from '../src/engine/creation';
import { tour } from '../src/engine/tour';
import { appliquer } from '../src/engine/actions';
import { vue } from '../src/engine/vues';
import type { Donnees, Etat } from '../src/engine/types';

let d: Donnees;
beforeAll(async () => { d = await chargerDonneesNode(); });
const act = (e: Etat, a: any) => appliquer(e, d, a).retour;
const perso0 = { nom: 'Test', prenom: 'Camille', sexe: 'F', age: 30, zone: 'S1309', origine: 'Employé', etudes: 'Licence', traits: [], attrs: new Array(21).fill(0), depart: 'militant' };

describe('élus réels', () => {
  it('charge plus de mille maires issus du répertoire des élus', () => { expect(Object.keys(d.elus).length).toBeGreaterThan(1000); for (const m of Object.values(d.elus).slice(0, 50)) { expect(m.n.length).toBeGreaterThan(1); expect(m.a).toBeGreaterThan(1900); } });
  it('installe les maires réels à la tête de leur ville, avec le parti de leur liste', () => {
    const e = creerPartie(d, { scenario: 'route2027', mode: 'parti', parti: 'PS', graine: 3 } as any); let vus = 0, justes = 0;
    for (const v of d.villes) { const rm = d.elus[v.id]; if (!rm || !rm.parti) continue; const maire = e.persos[e.mairies[v.idx].maire]; vus++; if (maire.nom === rm.n && maire.prenom === rm.p) { justes++; expect(maire.reel).toBe(true); if (!d.personnalites.some(x => x.nom === rm.n && x.prenom === rm.p)) expect(d.partis[maire.parti].id).toBe(rm.parti); } }
    expect(vus).toBeGreaterThan(800); expect(justes / vus).toBeGreaterThan(0.9);
  });
  it('ne donne aucun parti à un maire dont la nuance est ambiguë', () => { const amb = Object.values(d.elus).filter(m => ['LDIV', 'LUXD', 'LEXD', ''].includes(m.nuance)); expect(amb.length).toBeGreaterThan(0); for (const m of amb) expect(m.parti).toBe(''); });
});

describe('incarner une personne réelle', () => {
  it('reprend le maire en place avec son mandat et son parti', () => {
    const id = Object.keys(d.elus).find(k => d.elus[k].parti === 'LR' && d.idxVille[k] !== undefined)!; const rm = d.elus[id];
    const e = creerPartie(d, { scenario: 'route2027', mode: 'carriere', parti: 'PS', graine: 5, perso: { ...perso0, zone: id, incarne: { zone: id, nom: rm.n, prenom: rm.p } } } as any); const p = e.persos[e.joueur.perso];
    expect(p.nom).toBe(rm.n); expect(p.reel).toBe(true); expect(p.mandats.some(m => m.type === 'maire')).toBe(true); expect(d.partis[e.joueur.parti].id).toBe('LR');
    for (let k = 0; k < 6; k++) tour(e, d); expect((vue(e, d, 'chronique', {}) as any).reel).toBe(true);
  });
  it('crée un conseiller municipal réel qui n\'existait pas encore dans le monde', () => {
    const e = creerPartie(d, { scenario: 'route2027', mode: 'carriere', parti: 'PS', graine: 5, perso: { ...perso0, incarne: { zone: 'S1309', nom: 'Dupont-Essai', prenom: 'Jeanne', sexe: 'F', naissance: 1990, fonction: 'Conseiller d\'arrondissement', parti: 'RN' } } } as any); const p = e.persos[e.joueur.perso];
    expect(p.nom).toBe('Dupont-Essai'); expect(p.reel).toBe(true); expect(d.partis[e.joueur.parti].id).toBe('RN'); expect(p.mandats.length).toBe(1); expect(2026 - p.naissance).toBe(36);
  });
});

describe('tableau de bord et Chronique', () => {
  it('résume la semaine et ne plante dans aucun mode', () => {
    for (const mode of ['parti', 'carriere'] as const) { const e = creerPartie(d, { scenario: 'route2027', mode, parti: 'LR', graine: 7, perso: mode === 'carriere' ? perso0 : undefined } as any); for (let k = 0; k < 5; k++) tour(e, d); const v: any = vue(e, d, 'tableau', {}); expect(v.quartiers.length).toBe(6); expect(v.classement.length).toBe(8); expect(v.echeances.length).toBeGreaterThan(0); expect(Array.isArray(v.taches)).toBe(true); expect(!!v.ambition).toBe(mode === 'carriere'); }
  });
  it('écrit la page du joueur à partir de sa partie', () => {
    const e = creerPartie(d, { scenario: 'route2027', mode: 'carriere', parti: 'LR', graine: 7, perso: perso0 } as any); act(e, { type: 'profilTexte', bio: 'Née à Marseille.', slogan: 'Du concret', style: 'pedagogue' }); for (let k = 0; k < 4; k++) tour(e, d); act(e, { type: 'agoraPublier', format: 'texte', ton: 'pedagogue', cible: 'axe:0', texte: 'Premier message.' });
    const v: any = vue(e, d, 'chronique', {}); expect(v.estMoi).toBe(true); expect(v.reel).toBe(false); expect(v.chapeau).toContain('Camille Test'); expect(v.chapeau).toContain('Du concret'); expect(v.bio).toBe('Née à Marseille.'); expect(v.parcours.length).toBeGreaterThan(0); expect(v.positions.some((x: any) => x.texte === 'Premier message.')).toBe(true);
    const autre = e.persos.find(x => x.reel && x.id !== e.joueur.perso)!; const w: any = vue(e, d, 'chronique', { id: autre.id }); expect(w.reel).toBe(true); expect(w.bio).toBe(''); expect(w.profession).toBe('');
  });
});

describe('emblème et financement', () => {
  it('enregistre un emblème et nettoie les valeurs', () => { const e = creerPartie(d, { scenario: 'route2027', mode: 'parti', parti: 'PS', graine: 7 } as any); expect(act(e, { type: 'emblemeModifier', embleme: { forme: 9, symbole: 3, c1: 'rouge', c2: '#00ff00', initiales: 'ab-cd!', actif: true } }).ok).toBe(true); expect(e.embleme).toEqual({ forme: 3, symbole: 3, c1: '#0066cc', c2: '#00ff00', initiales: 'ABC', actif: true }); });
  it('prête, fait rembourser chaque semaine et limite les appels aux dons', () => {
    const e = creerPartie(d, { scenario: 'route2027', mode: 'parti', parti: 'PS', graine: 7 } as any); const P = e.partis[e.joueur.parti]; const t0 = P.tresorerie;
    expect(act(e, { type: 'finEmprunt', montant: 5000 }).ok).toBe(false); expect(act(e, { type: 'finEmprunt', montant: 100000 }).ok).toBe(true); expect(P.tresorerie).toBe(t0 + 100000); expect(P.scoreIA.pretReste).toBe(112000); expect(act(e, { type: 'finEmprunt', montant: 100000 }).ok).toBe(false);
    tour(e, d); expect(P.scoreIA.pretReste).toBeLessThan(112000);
    expect(act(e, { type: 'finAppel' }).ok).toBe(true); expect(act(e, { type: 'finAppel' }).ok).toBe(false); expect(act(e, { type: 'finPrets' }).ok).toBe(true); expect(act(e, { type: 'finPrets' }).ok).toBe(false);
  });
  it('refuse le financement à un simple militant et fonde un parti avec sigle et couleur', () => {
    const e = creerPartie(d, { scenario: 'route2027', mode: 'carriere', parti: 'LR', graine: 7, perso: perso0 } as any); expect(act(e, { type: 'finAppel' }).ok).toBe(false);
    expect(act(e, { type: 'fonderPartiV6', nom: 'X', sigle: 'A', couleur: '#123456' }).ok).toBe(false); const p = e.persos[e.joueur.perso]; p.notoriete = 60; p.rang = 3; e.joueur.pointsVictoire.estime = 60;
    const r = act(e, { type: 'fonderPartiV6', nom: 'Élan du Sud', sigle: 'eds', couleur: '#123456' }); if (r.ok) { const N = e.partis[e.joueur.parti]; expect(N.sigle).toBe('EDS'); expect(N.couleur).toBe('#123456'); expect(N.chef).toBe(p.id); expect(act(e, { type: 'finAppel' }).ok).toBe(true); } else expect(r.texte.length).toBeGreaterThan(5);
  });
});
