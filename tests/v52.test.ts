// Tests de la V5.2 : parcours personnel, investiture, contacts, réunion publique, textes d'Agora.
import { describe, it, expect, beforeAll } from 'vitest';
import { chargerDonneesNode } from '../src/data/chargementNode';
import { creerPartie } from '../src/engine/creation';
import { tour } from '../src/engine/tour';
import { appliquer } from '../src/engine/actions';
import { vue } from '../src/engine/vues';
import type { Donnees, Etat } from '../src/engine/types';

let d: Donnees;
beforeAll(async () => { d = await chargerDonneesNode(); });
const carriere = (parti = 'LR', graine = 7): Etat => creerPartie(d, { scenario: 'route2027', mode: 'carriere', parti, graine } as any);
const act = (e: Etat, a: any) => appliquer(e, d, a).retour;

describe('parcours personnel', () => {
  it('crée la fiche, cinq contacts et une ambition avec ses étapes', () => {
    const e = carriere(); const v: any = vue(e, d, 'parcours', {}); expect(v.carriere).toBe(true); expect(v.contacts.length).toBe(5); expect(v.etapes.length).toBe(4); expect(v.portrait.length).toBe(6);
    expect(new Set(v.contacts.map((c: any) => c.role))).toEqual(new Set(['mentor', 'allie', 'rival', 'journaliste', 'cadre']));
  });
  it('modifie le portrait, la biographie, l\'entraînement et l\'ambition', () => {
    const e = carriere(); vue(e, d, 'parcours', {});
    expect(act(e, { type: 'profilPortrait', portrait: [1, 2, 3, 1, 2, 0] }).ok).toBe(true); expect(e.parcours!.portrait).toEqual([1, 2, 3, 1, 2, 0]);
    expect(act(e, { type: 'profilTexte', bio: 'Né à Marseille.', slogan: 'Du concret', style: 'offensif' }).ok).toBe(true); expect(e.parcours!.bio).toBe('Né à Marseille.'); expect(e.parcours!.style).toBe('offensif');
    expect(act(e, { type: 'profilEntrainement', attrs: [0, 4, 5, 7] }).ok).toBe(true); expect(e.parcours!.entrainement).toEqual([0, 4, 5]);
    expect(act(e, { type: 'profilEntrainement', attrs: [9] }).ok).toBe(false); // l'ambition ne s'entraîne pas
    expect(act(e, { type: 'profilAmbition', ambition: 'depute' }).ok).toBe(true); expect((vue(e, d, 'parcours', {}) as any).etapes[3].nom).toContain('député');
  });
  it('fait vivre l\'argent selon le métier et bloque les changements trop rapprochés', () => {
    const e = carriere(); vue(e, d, 'parcours', {}); const p = e.persos[e.joueur.perso]; p.mandats = []; const a0 = e.parcours!.argent; tour(e, d); expect(e.parcours!.argent).toBe(a0 + 420 - 330);
    expect(act(e, { type: 'profilMetier', metier: 'aucun' }).ok).toBe(true); const a1 = e.parcours!.argent; tour(e, d); expect(e.parcours!.argent).toBe(a1 - 330);
    expect(act(e, { type: 'profilMetier', metier: 'plein' }).ok).toBe(false);
  });
  it('refuse le parcours personnel en mode Parti', () => { const e = creerPartie(d, { scenario: 'route2027', mode: 'parti', parti: 'PS', graine: 7 } as any); expect((vue(e, d, 'parcours', {}) as any).carriere).toBe(false); expect(act(e, { type: 'profilAmbition', ambition: 'depute' }).ok).toBe(false); });
});

describe('investiture', () => {
  it('se joue en dossier, démarches, promesse, oral et verdict', () => {
    const e = carriere(); vue(e, d, 'parcours', {}); const p = e.persos[e.joueur.perso]; const P = e.partis[e.joueur.parti]; if (P.chef === p.id) P.chef = -1; for (const k of Object.keys(P.bureau)) if (P.bureau[k] === p.id) P.bureau[k] = -1; p.rang = 1;
    expect(act(e, { type: 'invOral' }).ok).toBe(false);
    const r = act(e, { type: 'invDeclarer', scrutin: 'legislatives', place: 'tete' }); expect(r.ok).toBe(true); const D = e.parcours!.dossier!; expect(D.rivaux.length).toBeGreaterThan(0);
    expect(act(e, { type: 'invDeclarer', scrutin: 'legislatives', place: 'tete' }).ok).toBe(false);
    expect(act(e, { type: 'invAgir', quoi: 'tournee' }).ok).toBe(true); expect(act(e, { type: 'invAgir', quoi: 'tournee' }).ok).toBe(false); expect(act(e, { type: 'invAgir', quoi: 'appels' }).ok).toBe(true); expect(act(e, { type: 'invAgir', quoi: 'note' }).ok).toBe(false);
    const s0 = D.soutiens; expect(act(e, { type: 'invPromettre', quoi: 'courant' }).ok).toBe(true); expect(D.soutiens).toBeGreaterThan(s0); expect(e.parcours!.promesses.length).toBe(1);
    expect(act(e, { type: 'invOral' }).ok).toBe(false); // la commission ne siège pas encore
    while (e.semaine < D.commission) tour(e, d);
    expect(act(e, { type: 'invOral' }).ok).toBe(true); for (let k = 0; k < 4; k++) expect(act(e, { type: 'invRepondre', choix: 1 }).ok).toBe(true);
    expect(D.verdict.length).toBeGreaterThan(10); expect(['investi', 'suppleant', 'ecarte']).toContain(D.issue);
    if (D.issue === 'investi') expect(Object.values(e.investitures.legislatives ?? {})).toContain(p.id);
    expect(act(e, { type: 'invFermer' }).ok).toBe(true); expect(e.parcours!.dossier).toBe(null);
  });
  it('tranche sans le joueur s\'il ne se présente pas devant la commission', () => {
    const e = carriere(); vue(e, d, 'parcours', {}); act(e, { type: 'invDeclarer', scrutin: 'legislatives', place: 'tete' }); const D = e.parcours!.dossier!;
    for (let k = 0; k < 14 && !D.verdict; k++) tour(e, d); expect(D.verdict.length).toBeGreaterThan(10);
  });
});

describe('carnet', () => {
  it('limite à une rencontre par semaine et par contact, et fait bouger la relation', () => {
    const e = carriere(); vue(e, d, 'parcours', {}); const c = e.parcours!.contacts.find(x => x.role === 'mentor')!; const r0 = c.relation;
    const r = act(e, { type: 'contactParler', id: c.id, sujet: 'conseil' }); expect(r.ok).toBe(true); expect(r.texte.length).toBeGreaterThan(20); expect(c.relation).toBeGreaterThan(r0);
    expect(act(e, { type: 'contactParler', id: c.id, sujet: 'nouvelles' }).ok).toBe(false); tour(e, d); expect(act(e, { type: 'contactParler', id: c.id, sujet: 'nouvelles' }).ok).toBe(true);
  });
  it('suit un personnage et prévient quand sa situation change', () => {
    const e = carriere(); vue(e, d, 'parcours', {}); const q = e.persos.find(x => x.statut === 'actif' && x.id !== e.joueur.perso && x.rang === 1)!;
    expect(act(e, { type: 'suivre', id: q.id }).ok).toBe(true); expect(e.parcours!.suivis).toContain(q.id); q.rang = 2; const n = e.inbox.length; tour(e, d);
    expect(e.inbox.slice(n).some(m => m.titre.startsWith('Carnet'))).toBe(true);
    expect(act(e, { type: 'suivre', id: q.id }).ok).toBe(true); expect(e.parcours!.suivis).not.toContain(q.id);
  });
});

describe('réunion publique et textes', () => {
  it('se joue en trois temps', () => {
    const e = carriere(); vue(e, d, 'equipe', {}); expect(act(e, { type: 'jeuDemarrer', jeu: 'reunion', quartier: 2 }).ok).toBe(true);
    for (let k = 0; k < 3; k++) act(e, { type: 'jeuChoix', choix: 1 }); expect(e.equipe!.jeu.fini).toBe(true); expect(act(e, { type: 'jeuDemarrer', jeu: 'reunion', quartier: 2 }).ok).toBe(false);
  });
  it('propose trois brouillons lisibles sans modifier la partie', () => {
    const e = carriere(); for (let k = 0; k < 6; k++) tour(e, d); const avant = JSON.stringify(e.rng) + e.agora!.posts.length;
    const b: any[] = vue(e, d, 'brouillons', { cible: 'axe:1', n: 0 }); expect(b.length).toBe(3); for (const x of b) { expect(x.texte.length).toBeGreaterThan(30); expect(x.texte.length).toBeLessThanOrEqual(280); expect(x.texte).not.toContain('{'); expect(x.texte).not.toContain('undefined'); }
    expect(JSON.stringify(e.rng) + e.agora!.posts.length).toBe(avant); expect((vue(e, d, 'brouillons', { cible: 'axe:1', n: 1 }) as any[])[0].texte).not.toBe('');
  });
});
