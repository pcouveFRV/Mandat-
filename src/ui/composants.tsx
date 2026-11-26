// Composants partagés et petit magasin d'état de l'interface.
import { useEffect, useState, useMemo } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import * as moteur from './moteur';

// ---------- Magasin ----------
export interface Magasin { phase: 'chargement' | 'menu' | 'jeu'; base: any; ref: any; ecran: string; params: any; tick: number; toast: { texte: string; ok: boolean } | null; occupe: string; fiche: number; soiree: boolean; menuJeu: boolean; nomPartie: string; erreur: string }
let etat: Magasin = { phase: 'chargement', base: null, ref: null, ecran: 'inbox', params: {}, tick: 0, toast: null, occupe: '', fiche: -1, soiree: false, menuJeu: false, nomPartie: '', erreur: '' };
const abonnes = new Set<() => void>();
export const lireMagasin = () => etat;
export function maj(p: Partial<Magasin>) { etat = { ...etat, ...p }; abonnes.forEach(f => f()); }
export function useMagasin(): Magasin { const [, set] = useState(0); useEffect(() => { const f = () => set(x => x + 1); abonnes.add(f); return () => { abonnes.delete(f); }; }, []); return etat; }
let minuterie: any;
export function toast(texte: string, ok = true) { if (!texte) return; clearTimeout(minuterie); maj({ toast: { texte, ok } }); minuterie = setTimeout(() => maj({ toast: null }), 5200); }
export async function agir(a: any, silencieux = false): Promise<boolean> { try { const r = await moteur.action(a); maj({ base: r.base, tick: etat.tick + 1 }); if (!silencieux || !r.retour.ok) toast(r.retour.texte, r.retour.ok); return r.retour.ok; } catch (err: any) { toast(String(err.message ?? err), false); return false; } }
export const aller = (ecran: string, params: any = {}) => maj({ ecran, params, fiche: -1 });
export const ouvrirFiche = (id: number) => { if (id >= 0) maj({ fiche: id }); };
// Charge une vue du moteur et la recharge à chaque changement d'état du jeu.
export function useVue<T = any>(nom: string, params?: any): T | null { const m = useMagasin(); const [v, set] = useState<T | null>(null); const cle = JSON.stringify(params ?? {}); useEffect(() => { let vivant = true; moteur.vue(nom, params).then(x => { if (vivant) set(x); }).catch(e => toast(String(e.message ?? e), false)); return () => { vivant = false; }; }, [nom, cle, m.tick]); return v; }

// ---------- Formatage ----------
export const euro = (x: number) => { const a = Math.abs(x); const s = x < 0 ? '-' : ''; return a >= 1e6 ? `${s}${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace('.', ',')} M€` : a >= 1000 ? `${s}${Math.round(a / 1000)} k€` : `${s}${Math.round(a)} €`; };
export const nb = (x: number) => Math.round(x).toLocaleString('fr-FR');
export const pc = (x: number) => `${String(Math.round(x * 10) / 10).replace('.', ',')} %`;
export const RANGS = ['Militant', 'Cadre local', 'Cadre départemental', 'Figure nationale', 'Premier plan'];
export const THEME_COULEURS = ['#e0a030', '#c0392b', '#8e44ad', '#16a085', '#2980b9', '#d35400', '#27ae60', '#7f8c8d', '#f39c12', '#2c3e50', '#3498db', '#9b59b6', '#95a5a6', '#1abc9c', '#a3be4c'];

// ---------- Composants ----------
export function Parti({ i, long }: { i: number; long?: boolean }) { const b = etat.base; const p = b?.partis[i]; if (!p) return <span class="doux">sans étiquette</span>; return <span class="pastille" style={{ background: p.couleur }} title={p.nom}>{long ? p.nom : p.sigle}</span>; }
export const couleurParti = (i: number) => etat.base?.partis[i]?.couleur ?? '#666';
export function Jauge({ v, max = 100, couleur }: { v: number; max?: number; couleur?: string }) { const p = Math.max(0, Math.min(100, 100 * v / max)); return <div class="jauge"><i style={{ width: `${p}%`, background: couleur ?? (p < 30 ? 'var(--danger)' : p < 55 ? 'var(--alerte)' : 'var(--ok)') }} /></div>; }
export function Attr({ v }: { v: number }) { return <span class={`attr ${v >= 16 ? 'a4' : v >= 13 ? 'a3' : v >= 9 ? 'a2' : 'a1'}`}>{v}</span>; }
// Avatar généré : forme et couleur tirées du nom, initiales. Aucune photo.
export function Avatar({ nom, parti, taille = 34 }: { nom: string; parti: number; taille?: number }) { let h = 0; for (let k = 0; k < nom.length; k++) h = (h * 31 + nom.charCodeAt(k)) >>> 0; const ini = nom.split(/[\s-]+/).filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase(); const rayons = ['50%', '6px', '50% 50% 6px 6px', '6px 50% 50% 6px']; return <span class="avatar" style={{ width: `${taille}px`, height: `${taille}px`, borderRadius: rayons[h % 4], background: couleurParti(parti), fontSize: `${Math.round(taille * 0.38)}px`, filter: `hue-rotate(${(h % 5) * 6 - 12}deg)` }}>{ini}</span>; }
export function NomPerso({ p }: { p: { id: number; nom: string } | null }) { if (!p) return <span class="doux">Poste vacant</span>; return <a onClick={(ev: any) => { ev.stopPropagation(); ouvrirFiche(p.id); }}>{p.nom}</a>; }
export function Info({ t, children }: { t: string; children: ComponentChildren }) { return <span data-info={t}>{children}</span>; }
export function Bloc({ titre, children, actions }: { titre?: string; children: ComponentChildren; actions?: ComponentChildren }) { return <div class="bloc">{(titre || actions) && <div class="ligne" style={{ marginBottom: '6px' }}>{titre && <h3 style={{ margin: 0 }}>{titre}</h3>}<span class="espace" />{actions}</div>}{children}</div>; }
export function Onglets({ liste, actif, choisir }: { liste: [string, string][]; actif: string; choisir: (k: string) => void }) { return <div class="onglets">{liste.map(([k, n]) => <a class={k === actif ? 'actif' : ''} onClick={() => choisir(k)}>{n}</a>)}</div>; }

export interface Col<T> { titre: string; val: (x: T) => any; rendu?: (x: T) => ComponentChildren; info?: string; droite?: boolean }
export function Tableau<T>({ lignes, cols, clic, tri0, desc0 = true, max = 400, choisi }: { lignes: T[]; cols: Col<T>[]; clic?: (x: T) => void; tri0?: number; desc0?: boolean; max?: number; choisi?: (x: T) => boolean }) {
  const [tri, setTri] = useState<number>(tri0 ?? -1); const [desc, setDesc] = useState(desc0);
  const l = useMemo(() => { if (tri < 0) return lignes; const c = cols[tri]; return lignes.slice().sort((a, b) => { const x = c.val(a), y = c.val(b); const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x ?? '').localeCompare(String(y ?? ''), 'fr'); return desc ? -r : r; }); }, [lignes, tri, desc]);
  return <table><thead><tr>{cols.map((c, i) => <th class={c.droite ? 'droite' : ''} title={c.info} onClick={() => { if (tri === i) setDesc(!desc); else { setTri(i); setDesc(true); } }}>{c.titre}{tri === i ? (desc ? ' ▾' : ' ▴') : ''}</th>)}</tr></thead>
    <tbody>{l.slice(0, max).map(x => <tr class={`${clic ? 'clic' : ''} ${choisi?.(x) ? 'choisi' : ''}`} onClick={() => clic?.(x)}>{cols.map(c => <td class={c.droite ? 'droite' : ''}>{c.rendu ? c.rendu(x) : c.val(x)}</td>)}</tr>)}</tbody></table>;
}
// Courbes en SVG : séries [{nom, couleur, points:[x,y][]}].
export function Courbes({ series, hauteur = 180, unite = '', min0 = true }: { series: { nom: string; couleur: string; points: [number, number][] }[]; hauteur?: number; unite?: string; min0?: boolean }) {
  const tous = series.flatMap(s => s.points); if (tous.length < 2) return <div class="doux">Pas encore assez de données.</div>;
  const x0 = Math.min(...tous.map(p => p[0])), x1 = Math.max(...tous.map(p => p[0])); let y0 = Math.min(...tous.map(p => p[1])), y1 = Math.max(...tous.map(p => p[1])); if (min0 && y0 > 0) y0 = 0; if (y1 === y0) y1 = y0 + 1;
  const L = 600, H = hauteur, mg = 34; const X = (x: number) => mg + (x - x0) / (x1 - x0 || 1) * (L - mg - 6), Y = (y: number) => H - 16 - (y - y0) / (y1 - y0) * (H - 26);
  const grad = [0, 0.25, 0.5, 0.75, 1].map(k => y0 + k * (y1 - y0));
  return <svg viewBox={`0 0 ${L} ${H}`} style={{ width: '100%', height: `${hauteur}px` }}>{grad.map(g => <g><line x1={mg} x2={L - 6} y1={Y(g)} y2={Y(g)} stroke="var(--bord)" stroke-width="0.5" /><text x={mg - 4} y={Y(g) + 3} text-anchor="end" font-size="9" fill="var(--doux)">{Math.abs(g) >= 1e6 ? `${(g / 1e6).toFixed(1)}M` : Math.abs(g) >= 1000 ? `${Math.round(g / 1000)}k` : Math.round(g * 10) / 10}{unite}</text></g>)}
    {series.map(s => <polyline fill="none" stroke={s.couleur} stroke-width="1.8" points={s.points.map(p => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')}><title>{s.nom}</title></polyline>)}</svg>;
}
export function BarreH({ parts, total }: { parts: { parti: number; v: number }[]; total?: number }) { const t = (total ?? parts.reduce((s, p) => s + p.v, 0)) || 1; return <div class="barre-h">{parts.filter(p => p.v > 0).map(p => <div style={{ width: `${100 * p.v / t}%`, background: couleurParti(p.parti) }} title={`${etat.base?.partis[p.parti]?.sigle ?? ''} : ${p.v}`}>{100 * p.v / t > 6 ? p.v : ''}</div>)}</div>; }
// Hémicycle : un point par siège, rangé par famille politique de la gauche vers la droite.
export function Hemicycle({ sieges, taille = 300 }: { sieges: number[]; taille?: number }) {
  const total = sieges.reduce((a, b) => a + b, 0); if (!total) return null; const ordre = (etat.base?.partis ?? []).map((p: any) => p.idx).filter((i: number) => sieges[i] > 0);
  const pts: { x: number; y: number; c: string }[] = []; const rangs = total > 300 ? 9 : total > 100 ? 6 : 4; const liste: number[] = []; for (const i of ordre) for (let k = 0; k < sieges[i]; k++) liste.push(i);
  const parRang: number[] = []; let somme = 0; for (let r = 0; r < rangs; r++) { parRang.push(0.45 + 0.55 * (r / (rangs - 1))); somme += parRang[r]; } const nbR = parRang.map(x => Math.round(total * x / somme)); nbR[rangs - 1] += total - nbR.reduce((a, b) => a + b, 0);
  const pos: { a: number; r: number }[] = []; nbR.forEach((n, r) => { for (let k = 0; k < n; k++) pos.push({ a: Math.PI * (1 - (k + 0.5) / n), r }); }); pos.sort((p, q) => q.a - p.a || p.r - q.r);
  pos.forEach((p, k) => { const R = 0.45 + 0.55 * (p.r / (rangs - 1)); pts.push({ x: 100 + 95 * R * Math.cos(p.a), y: 100 - 95 * R * Math.sin(p.a), c: couleurParti(liste[k]) }); });
  return <svg viewBox="0 0 200 104" style={{ width: '100%', maxWidth: `${taille}px` }}>{pts.map(p => <circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={total > 300 ? 1.7 : 2.6} fill={p.c} />)}</svg>;
}
export function Legende({ sieges }: { sieges: number[] }) { return <div class="ligne petit-texte">{(etat.base?.partis ?? []).filter((p: any) => sieges[p.idx] > 0).sort((a: any, b: any) => sieges[b.idx] - sieges[a.idx]).map((p: any) => <span><Parti i={p.idx} /> {sieges[p.idx]}</span>)}</div>; }
export function Champ({ lib, children, info }: { lib: string; children: ComponentChildren; info?: string }) { return <label class="ligne" style={{ marginBottom: '6px' }}><span style={{ minWidth: '170px' }} class="doux">{info ? <Info t={info}>{lib}</Info> : lib}</span>{children}</label>; }
