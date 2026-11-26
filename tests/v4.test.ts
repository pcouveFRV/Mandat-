// Tests de la V4 : réseau social Agora et exécutif national.
import { describe, it, expect, beforeAll } from 'vitest';
import { chargerDonneesNode } from '../src/data/chargementNode';
import { creerPartie } from '../src/engine/creation';
import { tour } from '../src/engine/tour';
import { appliquer } from '../src/engine/actions';
import { vue } from '../src/engine/vues';
import { soutienOpinion } from '../src/engine/systems/executif';
import type { Donnees, Etat } from '../src/engine/types';

let d: Donnees;
beforeAll(async () => { d = await chargerDonneesNode(); });
const nouvelle = (parti: string, mode: 'parti' | 'carriere' = 'parti', graine = 7): Etat => creerPartie(d, { scenario: 'route2027', mode, parti, graine } as any);

describe('Agora', () => {
  it('fait vivre le fil, les tendances et les abonnés sans intervention du joueur', () => {
    const e = nouvelle('PS'); for (let k = 0; k < 12; k++) tour(e, d);
    const v: any = vue(e, d, 'agora', {}); expect(v.posts.length).toBeGreaterThan(10); expect(v.classement.length).toBe(12); expect(v.abonnesParti).toBeGreaterThan(0);
    expect(new Set(v.posts.map((p: any) => p.genre)).size).toBeGreaterThanOrEqual(3);
  });
  it('n\'attribue aucun propos aux personnes réelles', () => {
    const e = nouvelle('PS'); for (let k = 0; k < 30; k++) tour(e, d);
    const reels = e.agora!.posts.filter(p => p.perso >= 0 && e.persos[p.perso].reel); expect(reels.length).toBeGreaterThan(0);
    for (const p of reels) expect(p.texte.startsWith('Publie ')).toBe(true);
  });
  it('publie pour le joueur, garde son texte et réduit la portée des publications en rafale', () => {
    const e = nouvelle('PS'); tour(e, d); const avant = e.agora!.posts.length;
    const r = appliquer(e, d, { type: 'agoraPublier', format: 'texte', ton: 'pedagogue', cible: 'axe:0', texte: 'Bonjour Agora.' } as any); expect(r.retour.ok).toBe(true);
    const p = e.agora!.posts[e.agora!.posts.length - 1]; expect(e.agora!.posts.length).toBe(avant + 1); expect(p.texte).toBe('Bonjour Agora.'); expect(p.moi).toBe(true);
    for (let k = 0; k < 3; k++) appliquer(e, d, { type: 'agoraPublier', format: 'texte', ton: 'pedagogue', cible: 'axe:0' } as any);
    expect(appliquer(e, d, { type: 'agoraPublier', format: 'texte', ton: 'pedagogue', cible: 'axe:0' } as any).retour.ok).toBe(false);
  });
  it('laisse un militant publier sur son compte personnel en mode Carrière', () => {
    const e = nouvelle('LR', 'carriere'); tour(e, d); const r = appliquer(e, d, { type: 'agoraPublier', format: 'video', ton: 'emotion', cible: 'axe:3' } as any); expect(r.retour.ok).toBe(true);
    const p = e.agora!.posts[e.agora!.posts.length - 1]; expect(p.perso).toBe(e.joueur.perso);
  });
  it('reste déterministe', () => { const a = nouvelle('PS'), b = nouvelle('PS'); for (let k = 0; k < 10; k++) { tour(a, d); tour(b, d); } expect(JSON.stringify(a.agora)).toBe(JSON.stringify(b.agora)); });
});

describe('exécutif', () => {
  it('refuse de gouverner à un parti d\'opposition', () => { const e = nouvelle('PS'); expect(appliquer(e, d, { type: 'execReforme', axe: 0, sens: 1 } as any).retour.ok).toBe(false); });
  it('mène une réforme étape par étape quand le joueur tient l\'Élysée', () => {
    const e = nouvelle('RE'); expect(e.presidence.parti).toBe(e.joueur.parti); e.partis[e.joueur.parti].capital = 90;
    expect(appliquer(e, d, { type: 'execReforme', axe: 0, sens: 1 } as any).retour.ok).toBe(true); const r = e.executif!.reformes[0]; expect(r.etape).toBe(0);
    appliquer(e, d, { type: 'execAvancer', id: r.id } as any); expect(r.etape).toBe(1);
    expect(appliquer(e, d, { type: 'execAvancer', id: r.id } as any).retour.ok).toBe(false); // une étape par semaine
    tour(e, d); appliquer(e, d, { type: 'execAvancer', id: r.id } as any); expect(r.etape).toBe(2);
    tour(e, d); appliquer(e, d, { type: 'execAvancer', id: r.id, mode: '49.3' } as any); expect(r.etape).toBe(3);
  });
  it('avance les législatives après une dissolution', () => {
    const e = nouvelle('RE'); for (let k = 0; k < 8; k++) tour(e, d); const ech = e.calendrier.find(x => x.type === 'legislatives' && !x.fait1)!; const prevu = ech.s1;
    expect(appliquer(e, d, { type: 'execDissolution' } as any).retour.ok).toBe(true); expect(ech.s1).toBe(e.semaine + 4); expect(ech.s1).toBeLessThan(prevu);
    for (let k = 0; k < 8; k++) tour(e, d); expect(e.archives.some(a => a.type === 'legislatives' && a.tour === 2)).toBe(true);
  });
  it('mesure un soutien de l\'opinion entre 0 et 100 dans les deux sens', () => { for (let a = 0; a < d.axes.length; a++) { const p = soutienOpinion(d, a, 1), c = soutienOpinion(d, a, -1); expect(p).toBeGreaterThan(5); expect(p).toBeLessThan(95); expect(Math.abs(p + c - 100)).toBeLessThan(12); } });
});

describe('progression', () => {
  it('ouvre tous les écrans en mode Parti', async () => { const { accesJoueur, ACCES } = await import('../src/engine/systems/carriere'); expect(accesJoueur(nouvelle('PS')).length).toBe(Object.keys(ACCES).length - 3); /* Mon parcours et Carnet sont propres au mode Carrière */ });
  it('ne montre que la boîte de réception et Agora à un simple militant, puis ouvre le reste avec le rang', async () => {
    const { accesJoueur } = await import('../src/engine/systems/carriere'); const e = nouvelle('LR', 'carriere'); const p = e.persos[e.joueur.perso]; const P = e.partis[e.joueur.parti]; p.mandats = []; p.rang = 0; if (P.chef === p.id) P.chef = -1; for (const k of Object.keys(P.bureau)) if (P.bureau[k] === p.id) P.bureau[k] = -1;
    expect(accesJoueur(e)).toEqual(['accueil', 'perso', 'chronique', 'inbox', 'agora', 'equipe', 'profil', 'contacts', 'annuaire']); tour(e, d);
    p.rang = 1; expect(accesJoueur(e)).toContain('campagne'); expect(accesJoueur(e)).not.toContain('finances'); const avant = e.inbox.length; tour(e, d);
    expect(e.inbox.length).toBeGreaterThan(avant); expect(e.joueur.nouveaux).toContain('carte');
    p.rang = 2; expect(accesJoueur(e)).toContain('finances'); expect(accesJoueur(e)).not.toContain('doctrine'); p.rang = 3; expect(accesJoueur(e)).toContain('doctrine');
  });
});
