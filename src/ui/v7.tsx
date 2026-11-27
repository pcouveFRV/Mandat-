// V7 : actualité simulée, recherche universelle, objectif du moment, bilan de la semaine.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useMagasin, useVue, agir, aller, maj, Bloc, Parti, ouvrirFiche, toast } from './composants';
import { assistantActif, developper, conseiller } from './assistant';
import * as moteur from './moteur';

const RUBRIQUES: Record<string, string> = { une: 'À la une', politique: 'Politique', economie: 'Économie', local: 'Chez vous', enquete: 'Feuilleton', societe: 'En bref' };
function Article({ a, grand }: { a: any; grand?: boolean }) {
  const [long, setLong] = useState(''); const [attente, setAttente] = useState(false);
  const etoffer = async () => { setAttente(true); try { setLong(await developper(a.titre, a.chapo, a.corps)); } catch (err: any) { toast(String(err?.message ?? err), false); } setAttente(false); };
  return <article class={`article ${grand ? 'manchette' : ''}`}>
    <div class="sur"><span class="rub">{RUBRIQUES[a.rubrique] ?? a.rubrique}</span><span>{a.media}</span><span>{a.il === 0 ? 'cette semaine' : a.il === 1 ? 'la semaine dernière' : `il y a ${a.il} semaines`}</span></div>
    <h2>{a.titre}</h2>
    <p class="chapo">{a.chapo}</p>
    <p>{long || a.corps}</p>
    <div class="ligne">{a.reagir && <button class="petit principal" onClick={() => aller('agora')}>Réagir sur Agora</button>}{a.local && <button class="petit" onClick={() => aller('equipe')}>Aller sur le terrain</button>}{assistantActif() && !long && <button class="petit" disabled={attente} onClick={etoffer}>{attente ? 'Rédaction...' : 'Lire l\'article complet'}</button>}{a.axeNom && <span class="doux petit-texte">Thème : {a.axeNom}</span>}</div>
  </article>;
}
export function Actualite() {
  const v = useVue('presse'); const [rub, setRub] = useState('tout');
  useEffect(() => { if (v?.nonLus) agir({ type: 'presseLire' }, true); }, [v?.nonLus]);
  if (!v) return <div>Chargement...</div>;
  const liste = v.articles.filter((a: any) => rub === 'tout' || a.rubrique === rub); const une = rub === 'tout' ? liste.find((a: any) => a.rubrique === 'une' && a.il <= 1) ?? liste[0] : null; const reste = liste.filter((a: any) => a !== une);
  return <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
    <div class="ligne" style={{ alignItems: 'baseline' }}><h1 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 400, fontSize: '34px', marginBottom: '4px' }}>L'Actualité</h1><span class="doux">Semaine du {v.date}</span></div>
    <p class="doux petit-texte" style={{ marginBottom: '12px' }}>Journal de votre partie. Les faits politiques viennent de la simulation. Les histoires locales et les feuilletons sont inventés : lieux, entreprises et personnes cités n'existent pas.</p>
    <div class="onglets">{[['tout', 'Tout'], ...Object.entries(RUBRIQUES)].map(([k, n]) => <a class={rub === k ? 'actif' : ''} onClick={() => setRub(k)}>{n}</a>)}</div>
    {liste.length === 0 && <p class="doux">Rien dans cette rubrique pour l'instant. Avancez d'une semaine.</p>}
    {une && <Article a={une} grand />}
    <div class="kiosque">{reste.map((a: any) => <Article key={a.id} a={a} />)}</div>
  </div>;
}

// Objectif du moment : une seule consigne claire, dans la barre du haut.
export function Objectif() {
  const b = useMagasin().base; const o = b?.objectif; const acces: string[] = b?.acces ?? []; if (!o) return null;
  return <a class="objectif" title="Votre objectif du moment. Cliquez pour ouvrir l'écran concerné." onClick={() => aller(acces.includes(o.ecran) ? o.ecran : 'accueil')}><small>Objectif</small><span>{o.t}</span></a>;
}
// Bilan de la semaine, sur le tableau de bord.
export function Bilan() {
  const b = useMagasin().base; const x = b?.bilan; if (!x || (!x.lignes.length && !x.faits.length)) return null;
  return <Bloc titre="Ce qui a changé cette semaine">
    {x.lignes.map((l: any) => <div class="ligne" style={{ flexWrap: 'nowrap', padding: '3px 0' }}><span style={{ flex: 1 }}>{l.t}</span><b class={l.bon ? 'ok' : 'danger-t'}>{l.v}</b></div>)}
    {x.lignes.length === 0 && <p class="doux">Semaine calme : aucun de vos chiffres n'a vraiment bougé.</p>}
    {x.faits.length > 0 && <div style={{ marginTop: '6px', borderTop: '1px solid var(--bord)', paddingTop: '6px' }}>{x.faits.map((t: string) => <div class="doux petit-texte" style={{ padding: '1px 0', whiteSpace: 'normal' }}>{t}</div>)}<a class="petit-texte" onClick={() => aller('presse')}>Lire l'actualité</a></div>}
  </Bloc>;
}

// Recherche universelle : un écran, une personne, une ville. S'ouvre avec Ctrl+K, Cmd+K ou la touche /.
export function Palette({ ecrans }: { ecrans: [string, string][] }) {
  const [ouvert, setOuvert] = useState(false); const [q, setQ] = useState(''); const [r, setR] = useState<any>(null); const [sel, setSel] = useState(0); const champ = useRef<HTMLInputElement>(null);
  useEffect(() => { const k = (ev: KeyboardEvent) => { const cible = ev.target as HTMLElement; const saisie = ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible?.tagName ?? ''); if ((ev.key === 'k' && (ev.ctrlKey || ev.metaKey)) || (ev.key === '/' && !saisie)) { ev.preventDefault(); setOuvert(true); } else if (ev.key === 'Escape') setOuvert(false); }; const ouvrir = () => setOuvert(true); window.addEventListener('keydown', k); window.addEventListener('mandat-recherche', ouvrir); return () => { window.removeEventListener('keydown', k); window.removeEventListener('mandat-recherche', ouvrir); }; }, []);
  useEffect(() => { if (ouvert) { setQ(''); setR(null); setSel(0); setTimeout(() => champ.current?.focus(), 30); } }, [ouvert]);
  useEffect(() => { if (!ouvert || q.trim().length < 2) { setR(null); return; } let vivant = true; const t = setTimeout(() => { moteur.vue('rechercheTout', { q }).then((x: any) => { if (vivant) { setR(x); setSel(0); } }); }, 120); return () => { vivant = false; clearTimeout(t); }; }, [q, ouvert]);
  if (!ouvert) return null;
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); const nq = norm(q.trim());
  const items: { t: string; s: string; f: () => void }[] = [];
  for (const [k, n] of ecrans) if (!nq || norm(n).includes(nq)) items.push({ t: n, s: 'Écran', f: () => aller(k) });
  if (r) { for (const p of r.persos) items.push({ t: p.nom, s: p.fonction ? p.fonction.charAt(0).toUpperCase() + p.fonction.slice(1) : 'Personnalité', f: () => ouvrirFiche(p.id) }); for (const v of r.villes) items.push({ t: v.nom, s: 'Ville', f: () => aller('carte', { ville: v.idx }) }); for (const P of r.partis) items.push({ t: P.nom, s: 'Parti', f: () => aller('historique') }); }
  const liste = items.slice(0, 14); const choisir = (i: number) => { const x = liste[i]; if (x) { setOuvert(false); x.f(); } };
  return <div class="voile" style={{ alignItems: 'flex-start', paddingTop: '12vh' }} onClick={() => setOuvert(false)}><div class="modale palette" onClick={(ev: any) => ev.stopPropagation()}>
    <input ref={champ} type="text" aria-label="Recherche" placeholder="Chercher un écran, un élu, une ville..." value={q} onInput={(ev: any) => setQ(ev.target.value)} onKeyDown={(ev: any) => { if (ev.key === 'ArrowDown') { ev.preventDefault(); setSel(Math.min(liste.length - 1, sel + 1)); } else if (ev.key === 'ArrowUp') { ev.preventDefault(); setSel(Math.max(0, sel - 1)); } else if (ev.key === 'Enter') choisir(sel); }} />
    <div class="resultats">{liste.map((x, i) => <div class={`res-l ${i === sel ? 'sel' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => choisir(i)}><span>{x.t}</span><small>{x.s}</small></div>)}{liste.length === 0 && <div class="doux" style={{ padding: '10px' }}>Aucun résultat.</div>}</div>
    <div class="doux petit-texte" style={{ padding: '6px 10px 0' }}>Flèches pour choisir, Entrée pour ouvrir, Échap pour fermer.</div>
  </div></div>;
}
export const ouvrirRecherche = () => window.dispatchEvent(new Event('mandat-recherche'));
export const basculerMenu = () => maj({ menuOuvert: !(window as any).__mandat.lire().menuOuvert } as any);

// Le mot du directeur de campagne : l'assistant lit les chiffres du tableau de bord et propose les priorités de la semaine.
export function Directeur({ v }: { v: any }) {
  const b = useMagasin().base; const [t, setT] = useState(''); const [sem, setSem] = useState(-1); const [attente, setAttente] = useState(false);
  if (!assistantActif()) return null;
  const demander = async () => { setAttente(true); try {
    const L: string[] = [`Date : ${v.date}. ${v.carriere && v.moi ? `Je suis ${['militant', 'cadre local', 'cadre', 'dirigeant', 'figure nationale', 'chef'][Math.min(5, v.moi.rang)]} à ${v.lieu}, notoriété ${v.moi.notoriete} sur 100, estime du parti ${v.moi.estime} sur 100, forme ${v.moi.forme}, moral ${v.moi.moral}, compte personnel ${v.moi.argent} euros.` : `Je dirige le parti ${v.parti.nom}.`}`,
      `Parti : ${v.parti.sigle}, ${String(v.parti.intentions).replace('.', ',')} % d'intentions de vote, unité ${v.parti.unite} sur 100. Classement : ${v.classement.slice(0, 5).map((c: any) => `${b.partis[c.parti].sigle} ${c.v} %`).join(', ')}.`,
      v.ambition ? `Mon ambition : ${v.ambition.nom}. Prochaine étape : ${v.ambition.etape}.` : '', b.objectif ? `Objectif affiché par le jeu : ${b.objectif.t}.` : '',
      `À faire cette semaine : ${v.taches.map((x: any) => x.t).join(' ; ') || 'rien d\'urgent'}.`,
      `Mes quartiers (ancrage sur 100) : ${v.quartiers.map((q: any) => `${q.nom} ${q.ancrage}`).join(', ')}. Équipe : ${v.equipe.n} militants, motivation ${v.equipe.motiv}, ${v.equipe.fatigues} épuisés, caisse ${v.equipe.caisse} euros.`,
      `Calendrier : ${v.echeances.map((x: any) => `${x.type} dans ${x.dans} semaines`).join(', ')}.${v.campagne ? ` Campagne en cours : ${v.campagne.type}, élan ${v.campagne.elan}.` : ''}`,
      `Agora : ${v.abonnes} abonnés. Tendances : ${v.tendances.join(', ') || 'aucune'}.`, b.bilan?.lignes?.length ? `Cette semaine : ${b.bilan.lignes.map((l: any) => `${l.t} ${l.v}`).join(' ; ')}.` : '',
      v.negliges?.length ? `Contacts que je néglige : ${v.negliges.length}.` : '', v.dettes?.length ? `Je dois un service à ${v.dettes.length} personne(s).` : ''];
    setT(await conseiller(L.filter(Boolean).join('\n'))); setSem(b.semaine); } catch (err: any) { toast(String(err?.message ?? err), false); } setAttente(false); };
  return <Bloc titre="Le mot du directeur de campagne">
    {t ? <p style={{ whiteSpace: 'pre-line', lineHeight: 1.5 }}>{t}</p> : <p class="doux">Votre directeur de campagne lit vos chiffres et vous dit par quoi commencer.</p>}
    <button class="petit" disabled={attente} onClick={demander}>{attente ? 'Il réfléchit...' : t ? (sem === b.semaine ? 'Redemander' : 'Mettre à jour pour cette semaine') : 'Lui demander son avis'}</button>
  </Bloc>;
}
