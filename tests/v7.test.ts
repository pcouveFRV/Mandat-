// Tests de la V7 : réseau social enrichi, presse simulée, objectif, recherche, bilan, logos.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
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
const partie = (mode: string, graine = 21, n = 8) => { const e = creerPartie(d, { scenario: 'route2027', mode, parti: 'LR', graine, perso: mode === 'carriere' ? perso0 : undefined } as any); for (let k = 0; k < n; k++) tour(e, d); return e; };

describe('réseau social', () => {
  it('aime, republie une seule fois et limite les republications', () => {
    const e = partie('carriere'); const v: any = vue(e, d, 'agora', {}); const autres = v.posts.filter((x: any) => !x.moi); const p = autres[0];
    expect(act(e, { type: 'agoraAimer', id: p.id }).ok).toBe(true); expect(e.agora!.posts.find(x => x.id === p.id)!.aime).toBe(true); act(e, { type: 'agoraAimer', id: p.id }); expect(e.agora!.posts.find(x => x.id === p.id)!.aime).toBe(false);
    const vues0 = e.agora!.posts.find(x => x.id === p.id)!.vues; expect(act(e, { type: 'agoraReposter', id: p.id }).ok).toBe(true); expect(e.agora!.posts.find(x => x.id === p.id)!.vues).toBeGreaterThan(vues0); expect(act(e, { type: 'agoraReposter', id: p.id }).ok).toBe(false);
    act(e, { type: 'agoraReposter', id: autres[1].id }); act(e, { type: 'agoraReposter', id: autres[2].id }); expect(act(e, { type: 'agoraReposter', id: autres[3].id }).ok).toBe(false);
    expect(act(e, { type: 'agoraAimer', id: 999999 }).ok).toBe(false);
  }, 60000);
  it('répond dans un fil, et un adversaire peut répondre à son tour', () => {
    let reponsesAdverses = 0;
    for (let g = 0; g < 6; g++) { const e = partie('carriere', 30 + g); const v: any = vue(e, d, 'agora', {}); const cible = v.posts.find((x: any) => x.parti >= 0 && x.parti !== e.joueur.parti && (x.genre === 'elu' || x.genre === 'parti')); if (!cible) continue;
      const r = act(e, { type: 'agoraRepondre', id: cible.id, ton: 'offensif', texte: 'Ma réponse.' }); expect(r.ok).toBe(true); const mien = e.agora!.posts.find(x => x.moi && x.parent === cible.id)!; expect(mien.texte).toBe('Ma réponse.');
      const f: any = vue(e, d, 'agoraFil', { id: mien.id }); expect(f.parents[f.parents.length - 1].id).toBe(cible.id); expect(f.post.parentDe.compte).toBe(cible.compte);
      const rep = e.agora!.posts.find(x => x.parent === mien.id); if (rep) { reponsesAdverses++; expect(rep.compte).toBe(cible.compte); if (rep.perso >= 0 && e.persos[rep.perso].reel) expect(rep.texte).toBe('Répond à cette publication.'); expect(e.agora!.notifs!.some(n => n.type === 'reponse')).toBe(true); } }
    expect(reponsesAdverses).toBeGreaterThan(0);
  }, 60000);
  it('tient des notifications, des profils et un fil trié', () => {
    const e = partie('parti', 21, 40); const v: any = vue(e, d, 'agora', {}); expect(v.posts.length).toBeGreaterThan(20); expect(v.posts.every((x: any) => Number.isFinite(x.score))).toBe(true); expect(v.posts.some((x: any) => x.parentDe)).toBe(true); expect(Array.isArray(v.notifs)).toBe(true);
    expect(v.notifs.every((n: any) => !/Divers|Régionalistes/.test(n.t))).toBe(true); if (v.nonLus) { act(e, { type: 'agoraLireNotifs' }); expect((vue(e, d, 'agora', {}) as any).nonLus).toBe(0); }
    const pr: any = vue(e, d, 'agoraProfil', { perso: -1, parti: e.joueur.parti }); expect(pr.existe).toBe(true); expect(pr.genre).toBe('parti'); expect(pr.abonnes).toBeGreaterThan(0);
    const fig = e.persos.find(x => x.reel && x.rang >= 4)!; const pf: any = vue(e, d, 'agoraProfil', { perso: fig.id }); expect(pf.reel).toBe(true); expect(pf.nom).toContain(fig.nom); expect((vue(e, d, 'agoraProfil', { perso: -1, parti: -1 }) as any).existe).toBe(false);
  }, 60000);
  it('ne prête aucun texte inventé à une personne réelle', () => { const e = partie('parti', 5, 60); for (const p of e.agora!.posts) if (p.perso >= 0 && e.persos[p.perso]?.reel && !p.moi) expect(p.texte).toMatch(/^(Publie |Répond à cette publication\.)/); }, 60000);
});

describe('presse simulée', () => {
  it('publie des articles de toutes les rubriques, avec des chiffres plausibles', () => {
    const e = partie('carriere', 9, 70); const arts = e.presse!.articles; const rub = new Set(arts.map(a => a.rubrique)); for (const r of ['une', 'local', 'economie', 'politique', 'enquete']) expect(rub.has(r)).toBe(true);
    for (const a of arts) { expect(a.titre.length).toBeGreaterThan(8); expect(a.chapo.length).toBeGreaterThan(20); expect(a.titre + a.chapo + a.corps).not.toMatch(/\{\w+\}|undefined|NaN/); const m = /(gagne|perd) ([\d,]+) point/.exec(a.titre); if (m) expect(parseFloat(m[2].replace(',', '.'))).toBeLessThanOrEqual(8); }
    expect(arts.length).toBeLessThanOrEqual(60);
  }, 60000);
  it('ne cite aucune personne réelle dans les histoires inventées', () => {
    const e = partie('carriere', 12, 120); const reels = d.personnalites.map(p => `${p.prenom} ${p.nom}`); for (const a of e.presse!.articles.filter(x => x.rubrique === 'local' || x.rubrique === 'enquete' || x.rubrique === 'societe')) for (const n of reels) expect(a.titre + a.chapo + a.corps).not.toContain(n);
  }, 60000);
  it('ouvre une fenêtre de réaction sur Agora pour une histoire locale', () => {
    let vu = false; for (let g = 0; g < 4 && !vu; g++) { const e = partie('carriere', 50 + g, 6); const v: any = vue(e, d, 'presse', {}); const a = v.articles.find((x: any) => x.reagir && x.local); if (a) { vu = true; expect(e.agora!.reactions.some(r => r.titre === a.titre)).toBe(true); } act(e, { type: 'presseLire' }); expect((vue(e, d, 'presse', {}) as any).nonLus).toBe(0); }
    expect(vu).toBe(true);
  }, 60000);
});

describe('aides de jeu', () => {
  it('donne toujours un objectif, et un bilan après chaque semaine', () => {
    for (const mode of ['carriere', 'parti']) { const e = partie(mode, 3, 1); for (let k = 0; k < 30; k++) { tour(e, d); const b: any = vue(e, d, 'base', {}); expect(b.objectif.t.length).toBeGreaterThan(5); expect(b.acces).toContain(b.objectif.ecran === 'campagne' || b.objectif.ecran === 'profil' ? b.acces.includes(b.objectif.ecran) ? b.objectif.ecran : 'accueil' : b.objectif.ecran); expect(b.bilan.s).toBe(e.semaine); expect(b.bilan.lignes.length).toBeLessThanOrEqual(6); } }
  }, 60000);
  it('cherche une personne, une ville ou un parti sans tenir compte des accents', () => {
    const e = partie('parti', 3, 1); const r: any = vue(e, d, 'rechercheTout', { q: 'melenchon' }); expect(r.persos.some((p: any) => /Mélenchon/.test(p.nom))).toBe(true); expect((vue(e, d, 'rechercheTout', { q: 'marsei' }) as any).villes.some((v: any) => /Marseille/.test(v.nom))).toBe(true); expect((vue(e, d, 'rechercheTout', { q: 'a' }) as any).persos).toEqual([]); expect((vue(e, d, 'rechercheTout', { q: 'socialiste' }) as any).partis.length).toBe(1);
  }, 60000);
  it('reste reproductible : même graine, même partie', () => {
    const a = partie('carriere', 77, 25), b = partie('carriere', 77, 25); expect(a.intentions).toEqual(b.intentions); expect(a.presse!.articles.map(x => x.titre)).toEqual(b.presse!.articles.map(x => x.titre)); expect(a.agora!.posts.length).toBe(b.agora!.posts.length);
  }, 60000);
});

describe('logos', () => {
  it('déclare des fichiers qui existent, et documente leur source', () => {
    const idx = JSON.parse(fs.readFileSync('public/data/logos/index.json', 'utf8')); const src = fs.readFileSync('public/data/logos/SOURCES.md', 'utf8'); expect(idx.fichiers.length).toBeGreaterThanOrEqual(12);
    for (const f of idx.fichiers) { expect(fs.existsSync(`public/data/logos/${f}`)).toBe(true); expect(fs.statSync(`public/data/logos/${f}`).size).toBeGreaterThan(300); const id = f.split('.')[0]; expect(d.partis.some(p => p.id === id)).toBe(true); expect(src).toContain(`| ${id} | ${f} |`); }
  }, 60000);
});
