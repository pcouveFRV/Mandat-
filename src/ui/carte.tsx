// Carte de France en SVG : niveau national (départements, régions, outre-mer en encarts), zoom département (communes, bassins, circonscriptions, secteurs).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useMagasin, useVue, Parti, Bloc, couleurParti, THEME_COULEURS, nb, pc, NomPerso, Jauge, Legende, toast } from './composants';

const K = 60, COS = Math.cos(46.5 * Math.PI / 180);
const px = (lon: number) => (lon + 5.5) * COS * K, py = (lat: number) => (51.5 - lat) * K;
const cache: Record<string, Promise<any>> = {};
function charger(f: string): Promise<any> { return cache[f] ??= fetch(new URL(`./data/geo/${f}`, document.baseURI).href).then(r => { if (!r.ok) throw new Error(`Carte introuvable : ${f}`); return r.json(); }); }
const DROM: Record<string, number> = { '971': 0, '972': 1, '973': 2, '974': 3, '976': 4 };
function chemin(rings: number[][], ech: number, code?: string): string {
  let s = '';
  if (code !== undefined && DROM[code] !== undefined) { // encart : mise à l'échelle dans une case
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const r of rings) for (let i = 0; i < r.length; i += 2) { const x = r[i] / ech, y = r[i + 1] / ech; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const k = 44 / Math.max(x1 - x0, y1 - y0, 0.01); const ox = -62, oy = 250 + DROM[code] * 56;
    for (const r of rings) { for (let i = 0; i < r.length; i += 2) s += `${i ? 'L' : 'M'}${(ox + (r[i] / ech - x0) * k).toFixed(1)} ${(oy + (y1 - r[i + 1] / ech) * k).toFixed(1)}`; s += 'Z'; } return s;
  }
  for (const r of rings) { for (let i = 0; i < r.length; i += 2) s += `${i ? 'L' : 'M'}${px(r[i] / ech).toFixed(1)} ${py(r[i + 1] / ech).toFixed(1)}`; s += 'Z'; } return s;
}
function teinte(val: { c: number; v: number } | undefined, couche: string, avecParti: boolean): { fill: string; op: number } {
  if (!val) return { fill: 'var(--fond3)', op: 1 }; const { c, v } = val;
  if (c <= -2) return { fill: THEME_COULEURS[(-2 - c) % THEME_COULEURS.length], op: 0.85 };
  if (couche === 'sociologie') return { fill: 'var(--accent)', op: Math.max(0.08, Math.min(1, v / 45)) };
  if (c < 0) return { fill: 'var(--fond3)', op: 1 };
  if (couche === 'intentions') return { fill: couleurParti(c), op: Math.max(0.12, Math.min(1, avecParti ? v / 40 : (v - 12) / 30)) };
  if (couche === 'implantation') return v < 0 ? { fill: 'var(--danger)', op: Math.min(1, -v / 20) } : { fill: couleurParti(c), op: Math.max(0.06, Math.min(1, v / 25)) };
  if (couche === 'federations') return { fill: couleurParti(c), op: Math.max(0.08, Math.min(1, Math.log10(v + 1) / 4)) };
  return { fill: couleurParti(c), op: 1 };
}

// Carte nationale réutilisable. Soit une couche du moteur, soit des couleurs fournies (soirée électorale, Panthéon).
export function CarteFrance({ couche, parti, etiquette, theme, couleurs, niveau = 'dept', clic, choisi }: { couche?: string; parti?: number; etiquette?: string; theme?: number; couleurs?: Record<string, number>; niveau?: string; clic?: (code: string) => void; choisi?: string }) {
  const m = useMagasin(); const [geo, setGeo] = useState<any>(null); const v = useVue(couche ? 'carte' : 'options', couche ? { couche, niveau: 'nat', parti, etiquette, theme } : undefined);
  useEffect(() => { charger('france.json').then(setGeo).catch(e => toast(String(e.message), false)); }, []);
  const chemins = useMemo(() => geo ? Object.keys(geo.depts).map(code => ({ code, d: chemin(geo.depts[code], geo.echelle, code) })) : [], [geo]);
  if (!geo) return <div class="doux">Chargement de la carte...</div>;
  const regDe: Record<string, string> = {}; for (const d of m.ref.depts) regDe[d.code] = d.region; const nomDe: Record<string, string> = {}; for (const d of m.ref.depts) nomDe[d.code] = d.nom;
  return <svg class="carte" viewBox="-70 20 700 600" preserveAspectRatio="xMidYMid meet">
    {chemins.map(({ code, d }) => { let t = { fill: 'var(--fond3)', op: 1 }; let titre = `${code} ${nomDe[code] ?? ''}`;
      if (couleurs) { const c = couleurs[niveau === 'region' ? regDe[code] : code]; if (c !== undefined && c >= 0) t = { fill: couleurParti(c), op: 1 }; if (c !== undefined && c >= 0) titre += ` : ${m.base.partis[c]?.sigle ?? ''}`; }
      else if (v?.valeurs) { const x = v.valeurs[code]; t = teinte(x, couche!, parti !== undefined); if (x) titre += ` : ${x.t}`; }
      return <path d={d} fill={t.fill} fill-opacity={t.op} class={choisi === code ? 'choisi' : ''} style={choisi === code ? { stroke: '#fff', strokeWidth: '2.5' } : undefined} onClick={() => clic?.(code)}><title>{titre}</title></path>; })}
    {Object.keys(DROM).map(c => <text x={-62} y={246 + DROM[c] * 56}>{nomDe[c]}</text>)}
  </svg>;
}

const COUCHES: [string, string, string][] = [
  ['resultats', 'Résultats (députés et maires)', 'Niveau national : parti qui a le plus de députés dans le département. Niveau département : maire de chaque ville, sensibilité dominante des bassins de petites communes.'],
  ['intentions', 'Intentions de vote', 'Estimation du vote si une législative avait lieu dimanche, chaque parti seul. Comme un sondage, l\'estimation a une marge d\'erreur.'],
  ['implantation', 'Implantation et mobilisation', 'Ce que votre travail de terrain, vos élus et vos campagnes ont ajouté (ou retiré) à votre socle local depuis le début de la partie.'],
  ['federations', 'Fédérations (adhérents)', 'Nombre d\'adhérents par département et délégué en poste.'],
  ['sociologie', 'Sociologie', 'Part d\'un groupe social dans la population. Données de substitution, voir docs/DATA.md.'],
  ['priorites', 'Priorités de l\'opinion', 'Thème qui compte le plus localement, ou intensité d\'un thème choisi. L\'actualité déplace ces priorités, parfois dans une seule région.'],
  ['mairies', 'Mairies', 'Parti qui dirige le plus d\'habitants parmi les villes simulées du département.'],
  ['departements', 'Conseils départementaux', 'Parti du président du conseil départemental.'],
  ['regions', 'Conseils régionaux', 'Parti du président du conseil régional.'],
];
const ETIQUETTES: [string, string][] = [['populaire', 'Classes populaires'], ['moyen', 'Classes moyennes'], ['aise', 'Catégories aisées'], ['jeunes', 'Jeunes'], ['retraites', 'Retraités'], ['diplomes', 'Diplômés'], ['precaires', 'Précaires'], ['independants', 'Indépendants'], ['agri', 'Agriculteurs'], ['public', 'Agents publics']];

export function EcranCarte() {
  const m = useMagasin(); const b = m.base; const [couche, setCouche] = useState('resultats'); const [parti, setParti] = useState<number>(-1); const [etiquette, setEtiquette] = useState('populaire'); const [theme, setTheme] = useState(-1); const [dept, setDept] = useState<string | null>(null); const [zone, setZone] = useState(-1);
  const avecParti = ['intentions', 'implantation', 'federations'].includes(couche); const pSel = couche === 'intentions' ? (parti >= 0 ? parti : undefined) : avecParti ? (parti >= 0 ? parti : b.parti) : undefined;
  const info = COUCHES.find(c => c[0] === couche)!; const di = dept ? m.ref.depts.findIndex((x: any) => x.code === dept) : -1;
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '12px', height: '100%' }}>
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div class="ligne" style={{ marginBottom: '8px' }}>
        <select value={couche} onChange={(ev: any) => { setCouche(ev.target.value); setZone(-1); }}>{COUCHES.filter(c => !dept || !['federations', 'departements', 'regions'].includes(c[0])).map(c => <option value={c[0]}>{c[1]}</option>)}</select>
        {avecParti && <select value={parti} onChange={(ev: any) => setParti(+ev.target.value)}>{couche === 'intentions' ? <option value={-1}>Parti en tête</option> : <option value={-1}>Votre parti</option>}{b.partis.filter((p: any) => p.actif).map((p: any) => <option value={p.idx}>{p.sigle}</option>)}</select>}
        {couche === 'sociologie' && <select value={etiquette} onChange={(ev: any) => setEtiquette(ev.target.value)}>{ETIQUETTES.map(([k, n]) => <option value={k}>{n}</option>)}</select>}
        {couche === 'priorites' && <select value={theme} onChange={(ev: any) => setTheme(+ev.target.value)}><option value={-1}>Thème dominant</option>{THEMES.map((n, i) => <option value={i}>{n}</option>)}</select>}
        {dept && <button onClick={() => { setDept(null); setZone(-1); }}>Retour à la France</button>}
        <span class="espace" /><span class="doux petit-texte" style={{ maxWidth: '420px', whiteSpace: 'normal' }}>{info[2]}</span>
      </div>
      <div style={{ flex: 1, minHeight: '420px' }}>
        {!dept ? <CarteFrance couche={couche} parti={pSel} etiquette={etiquette} theme={theme >= 0 ? theme : undefined} clic={c => { setDept(c); setZone(-1); if (['federations', 'departements', 'regions'].includes(couche)) setCouche('resultats'); }} />
          : <CarteDept code={dept} idx={di} couche={couche} parti={pSel} etiquette={etiquette} theme={theme >= 0 ? theme : undefined} zone={zone} choisir={setZone} />}
      </div>
      {couche === 'priorites' && theme < 0 && <div class="ligne petit-texte" style={{ marginTop: '6px' }}>{THEMES.map((n, i) => <span><span class="pastille" style={{ background: THEME_COULEURS[i] }}>{n}</span></span>)}</div>}
    </div>
    <div style={{ overflow: 'auto' }}>{zone >= 0 ? <FicheZone idx={zone} /> : <Bloc titre={dept ? `${dept} ${m.ref.depts[di]?.nom ?? ''}` : 'France'}><p class="doux">{dept ? 'Cliquez sur une commune, un bassin ou un secteur pour voir le détail : population, sociologie, intentions de vote, élus.' : 'Cliquez sur un département pour zoomer jusqu\'aux communes de plus de 10 000 habitants, aux bassins de petites communes et aux secteurs de Paris, Lyon et Marseille.'}</p><p class="doux petit-texte">Les contours en trait clair sont ceux des circonscriptions législatives.</p></Bloc>}</div>
  </div>;
}
const THEMES = ['Pouvoir d\'achat', 'Sécurité', 'Immigration', 'Santé', 'École', 'Emploi', 'Écologie', 'Retraites', 'Logement', 'Services publics', 'Europe', 'Identité', 'Dette', 'Transports', 'Agriculture'];

function CarteDept({ code, idx, couche, parti, etiquette, theme, zone, choisir }: { code: string; idx: number; couche: string; parti?: number; etiquette?: string; theme?: number; zone: number; choisir: (z: number) => void }) {
  const [geo, setGeo] = useState<any>(null); const [gc, setGc] = useState<any>(null); const v = useVue('carte', { couche, niveau: 'dept', dept: idx, parti, etiquette, theme }); const [vb, setVb] = useState<number[] | null>(null); const glisse = useRef<any>(null); const svg = useRef<SVGSVGElement>(null);
  useEffect(() => { setGeo(null); setVb(null); charger(`d/${code}.json`).then(setGeo).catch(e => toast(String(e.message), false)); charger('circos.json').then(setGc).catch(() => { }); }, [code]);
  const dessin = useMemo(() => { if (!geo) return null; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const l = geo.communes.map((c: any) => { for (const r of c[3]) for (let i = 0; i < r.length; i += 2) { const x = px(r[i] / geo.echelle), y = py(r[i + 1] / geo.echelle); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } return { code: c[0], nom: c[1], zone: c[2], d: chemin(c[3], geo.echelle) }; }); const mg = (x1 - x0) * 0.04 + 1; return { l, boite: [x0 - mg, y0 - mg, x1 - x0 + 2 * mg, y1 - y0 + 2 * mg] }; }, [geo]);
  const contours = useMemo(() => gc && v?.circos ? Object.keys(v.circos).filter(id => gc.circos[id]).map(id => ({ id, d: chemin(gc.circos[id], gc.echelle) })) : [], [gc, v]);
  if (!dessin) return <div class="doux">Chargement de la carte du département...</div>; const B = vb ?? dessin.boite; const ech = B[2] / 600;
  const molette = (ev: WheelEvent) => { ev.preventDefault(); const k = ev.deltaY > 0 ? 1.2 : 1 / 1.2; const r = svg.current!.getBoundingClientRect(); const fx = (ev.clientX - r.left) / r.width, fy = (ev.clientY - r.top) / r.height; const w = Math.min(dessin.boite[2] * 1.2, B[2] * k), h = Math.min(dessin.boite[3] * 1.2, B[3] * k); setVb([B[0] + (B[2] - w) * fx, B[1] + (B[3] - h) * fy, w, h]); };
  return <svg ref={svg} class="carte" viewBox={B.join(' ')} preserveAspectRatio="xMidYMid meet" onWheel={molette as any} onMouseDown={(ev: any) => { glisse.current = { x: ev.clientX, y: ev.clientY, B }; }} onMouseUp={() => { glisse.current = null; }} onMouseLeave={() => { glisse.current = null; }}
    onMouseMove={(ev: any) => { const g = glisse.current; if (!g) return; const r = svg.current!.getBoundingClientRect(); const k = Math.max(g.B[2] / r.width, g.B[3] / r.height); setVb([g.B[0] - (ev.clientX - g.x) * k, g.B[1] - (ev.clientY - g.y) * k, g.B[2], g.B[3]]); }}>
    {dessin.l.map((c: any) => { const x = v?.valeurs?.[c.zone]; const t = teinte(x, couche, parti !== undefined); return <path d={c.d} fill={t.fill} fill-opacity={t.op} style={zone === c.zone && c.zone >= 0 ? { stroke: '#fff', strokeWidth: '2' } : undefined} onClick={() => { if (c.zone >= 0) choisir(c.zone); }}><title>{c.nom}{x ? `\n${x.t}` : ''}</title></path>; })}
    {contours.map(c => <path class="contour" d={c.d} />)}
    {(geo.secteurs ?? []).map((s: any) => { const x = v?.valeurs?.[s[0]]; const t = teinte(x, couche, parti !== undefined); const r = Math.sqrt(s[4]) * 0.0011 * (dessin.boite[2] / 30 + 0.3); return <g><circle cx={px(s[2])} cy={py(s[3])} r={r} fill={t.fill} fill-opacity={Math.max(0.5, t.op)} stroke={zone === s[0] ? '#fff' : 'var(--fond)'} stroke-width={ech * (zone === s[0] ? 2.5 : 1)} style={{ cursor: 'pointer' }} onClick={() => choisir(s[0])}><title>{s[1]}{x ? `\n${x.t}` : ''}</title></circle><text x={px(s[2])} y={py(s[3]) + ech * 3} text-anchor="middle" style={{ fontSize: `${ech * 9}px` }}>{s[1].replace(/^(Paris|Lyon|Marseille) /, '').replace(/ secteur.*/, ' sect.')}</text></g>; })}
    {(v?.zones ?? []).filter((z: any) => z.type === 0 && z.pop > 25000).map((z: any) => <text x={px(z.lon)} y={py(z.lat)} text-anchor="middle" style={{ fontSize: `${ech * 10}px` }}>{z.nom}</text>)}
  </svg>;
}

function FicheZone({ idx }: { idx: number }) {
  const z = useVue('zone', { idx }); const m = useMagasin(); if (!z) return <div class="bloc">Chargement...</div>;
  return <div class="grille">
    <Bloc titre={z.type}><h2>{z.nom}</h2><div class="doux">{z.dept}. {z.terr}.{z.nbCommunes > 1 ? ` ${z.nbCommunes} communes.` : ''}</div><div class="ligne" style={{ justifyContent: 'space-between', marginTop: '6px' }}><span>Population</span><b>{nb(z.pop)}</b></div><div class="ligne" style={{ justifyContent: 'space-between' }}><span>Inscrits</span><b>{nb(z.inscrits)}</b></div>
      <div class="ligne" style={{ justifyContent: 'space-between' }}><span>Votre implantation acquise</span><b class={z.impl > 0 ? 'ok' : z.impl < 0 ? 'danger-t' : ''}>{z.impl > 0 ? '+' : ''}{String(z.impl).replace('.', ',')}</b></div><div class="ligne" style={{ justifyContent: 'space-between' }}><span>Votre mobilisation</span><b>{String(z.mob).replace('.', ',')}</b></div></Bloc>
    <Bloc titre="Intentions de vote (estimation)">{z.intentions.map((x: any) => <div class="ligne" style={{ justifyContent: 'space-between' }}><Parti i={x.parti} /><span style={{ flex: 1 }}><Jauge v={x.v} max={50} couleur={couleurParti(x.parti)} /></span><b style={{ width: '48px', textAlign: 'right' }}>{pc(x.v)}</b></div>)}</Bloc>
    <Bloc titre="Élus">{z.maire && <div>Maire : <NomPerso p={z.maire} /> <Parti i={z.maire.parti} /><div class="petit-texte doux">Bilan {z.maire.bilan}/100. Conseil municipal ({z.maire.total} sièges) :</div><Legende sieges={z.maire.sieges} /></div>}
      {z.partsBassin && <div><div class="petit-texte doux">Sensibilité des maires des petites communes :</div>{z.partsBassin.map((x: any) => <span style={{ marginRight: '6px' }}><Parti i={x.parti} /> {x.v} %</span>)}</div>}
      {z.circos.map((c: any) => <div style={{ marginTop: '4px' }}>{c.nom}{c.part < 100 ? ` (${c.part} % de la zone)` : ''} : <NomPerso p={c.deputeId >= 0 ? { id: c.deputeId, nom: c.depute } : null} /> <Parti i={c.parti} /></div>)}
      {z.conseilDept && <div style={{ marginTop: '4px' }}>Département : {z.conseilDept.president} <Parti i={z.conseilDept.parti} /></div>}</Bloc>
    <Bloc titre="Sociologie">{z.segments.map((s: any) => <div class="ligne petit-texte" style={{ justifyContent: 'space-between' }}><span>{s.nom}</span><b>{pc(s.part)}</b></div>)}</Bloc>
    <Bloc titre="Priorités locales">{z.priorites.map((p: any) => <div class="ligne petit-texte" style={{ justifyContent: 'space-between' }}><span>{p.nom}</span><span style={{ width: '100px' }}><Jauge v={p.v} max={6} couleur="var(--accent)" /></span></div>)}</Bloc>
    <div style={{ display: 'none' }}>{m.tick}</div>
  </div>;
}
