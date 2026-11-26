// Accueil : nouvelle partie (scénario, mode, parti, création du personnage), chargement d'une sauvegarde.
import { useEffect, useState } from 'preact/hooks';
import * as moteur from './moteur';
import * as stockage from './stockage';
import { useMagasin, maj, toast } from './composants';

const SCENARIOS = [
  { id: 'municipales2026', nom: 'Après les municipales 2026', date: 'Avril 2026', texte: 'Les municipales viennent de redessiner la carte. Un an pour préparer la présidentielle.' },
  { id: 'route2027', nom: 'La route de 2027', date: 'Septembre 2026', texte: 'Rentrée politique. Sénatoriales dans trois semaines, présidentielle dans sept mois.' },
  { id: 'monde_apres', nom: 'Le monde d\'après', date: 'Juillet 2027', texte: 'La présidentielle et les législatives de 2027 sont simulées au chargement. Vous héritez d\'un paysage inédit.' },
];
const ATTRS = ['Éloquence', 'Débat', 'Médias', 'Réseaux sociaux', 'Terrain', 'Dossiers techniques', 'Gestion', 'Négociation', 'Organisation de campagne', 'Ambition', 'Loyauté', 'Sang-froid', 'Discipline', 'Courage', 'Opportunisme', 'Rancune', 'Résistance à la pression', 'Énergie', 'Charisme', 'Réseau', 'Ancrage local'];
const ORIGINES = ['Ouvrier', 'Employé', 'Enseignant', 'Cadre du privé', 'Fonctionnaire territorial', 'Chef d\'entreprise', 'Agriculteur', 'Artisan', 'Avocat', 'Médecin', 'Étudiant', 'Collaborateur d\'élu', 'Assureur', 'Cadre associatif'];
const ETUDES = ['Droit', 'Sciences politiques', 'Économie et gestion', 'Lettres et histoire', 'École de commerce', 'Formation technique', 'Santé', 'Ingénieur', 'Autodidacte', 'Enseignement', 'Agriculture'];
const POINTS = 40;

// Choix d'une personne réelle à incarner : un élu de la ville choisie (Répertoire national des élus) ou une figure nationale.
function Incarner({ zone, choisi, choisir }: { zone: string; choisi: any; choisir: (x: any) => void }) {
  const [locaux, setLocaux] = useState<any[]>([]); const [figures, setFigures] = useState<any[]>([]); const [rech, setRech] = useState('');
  useEffect(() => { let vivant = true; fetch(new URL('./data/personnalites.json', document.baseURI).href).then(r => r.json()).then(o => { if (vivant) setFigures(o.personnalites ?? []); }).catch(() => undefined); return () => { vivant = false; }; }, []);
  useEffect(() => { let vivant = true; setLocaux([]); const dept = zone.startsWith('S') ? zone.slice(1, 3) : zone.slice(1, zone.startsWith('C97') ? 4 : 3); fetch(new URL(`./data/elus/${dept}.json`, document.baseURI).href).then(r => r.ok ? r.json() : {}).then(o => { if (vivant) setLocaux((o[zone] ?? []).map((x: any[]) => ({ zone, nom: x[0], prenom: x[1], sexe: x[2], naissance: x[3], parti: x[4], fonction: x[5] }))); }).catch(() => undefined); return () => { vivant = false; }; }, [zone]);
  const q = rech.trim().toLowerCase(); const filtre = (x: any) => !q || `${x.prenom} ${x.nom}`.toLowerCase().includes(q);
  return <div>
    <p class="doux petit-texte">Vous reprenez son nom, son parti et son mandat à la date de départ. Rien de sa vie réelle n'est inventé : la suite est une fiction propre à votre partie.</p>
    {choisi ? <div class="ligne"><b>{choisi.prenom} {choisi.nom}</b><span class="doux">{choisi.fonction ?? 'personnalité nationale'}{choisi.parti ? `, ${choisi.parti}` : ''}</span><span class="espace" /><button class="petit" onClick={() => choisir(undefined)}>Annuler</button></div>
      : <><input type="text" placeholder="Chercher un nom" value={rech} onInput={(ev: any) => setRech(ev.target.value)} style={{ width: '100%', marginBottom: '6px' }} />
        <div class="defile" style={{ maxHeight: '150px' }}>
          {locaux.filter(filtre).slice(0, 60).map(x => <div class="msg" onClick={() => choisir(x)}>{x.prenom} {x.nom} <span class="doux">({x.fonction || 'élu'}{x.parti ? `, ${x.parti}` : ', sans étiquette retenue'})</span></div>)}
          {figures.filter(filtre).slice(0, q ? 40 : 8).map(x => <div class="msg" onClick={() => choisir({ nom: x.nom, prenom: x.prenom, sexe: x.sexe, naissance: x.naissance, parti: x.parti, fonction: 'personnalité nationale' })}>{x.prenom} {x.nom} <span class="doux">(personnalité nationale, {x.parti})</span></div>)}
          {locaux.length === 0 && figures.length === 0 && <div class="doux petit-texte">Chargement de la liste...</div>}
        </div></>}
  </div>;
}

export function Accueil() {
  const m = useMagasin(); const ref = m.ref; const [etape, setEtape] = useState(0); const [fiches, setFiches] = useState<stockage.Fiche[]>([]);
  const [scenario, setScenario] = useState('route2027'); const [mode, setMode] = useState<'parti' | 'carriere'>('parti'); const [parti, setParti] = useState('PS'); const [graine, setGraine] = useState(() => Math.floor(Math.random() * 1e9)); const [tuto, setTuto] = useState(true);
  const [perso, setPerso] = useState({ nom: '', prenom: '', sexe: 'M', age: 22, zone: 'S1309', origine: ORIGINES[10], etudes: ETUDES[2], traits: [] as string[], attrs: new Array(21).fill(0), depart: 'militant' });
  const [rech, setRech] = useState('Marseille'); const [charge, setCharge] = useState('');
  useEffect(() => { stockage.lister().then(setFiches).catch(() => { }); const f = moteur.ecouter(x => { if (x.t === 'progression') setCharge(x.texte); }); return f; }, []);
  const reste = POINTS - perso.attrs.reduce((a, b) => a + b, 0);
  const lancer = async () => {
    if (mode === 'carriere' && (!perso.nom.trim() || !perso.prenom.trim())) { toast('Donnez un nom et un prénom à votre personnage.', false); return; }
    if (mode === 'carriere' && perso.traits.length !== 2) { toast('Choisissez deux traits.', false); return; }
    setCharge('Création de la partie'); try { const r = await moteur.nouvelle({ scenario, mode, parti, graine, tutoriel: tuto, perso: mode === 'carriere' ? perso : undefined }); maj({ phase: 'jeu', base: r.base, tick: m.tick + 1, ecran: 'accueil', nomPartie: '', soiree: false, fiche: -1, occupe: '' }); } catch (err: any) { toast(String(err.message ?? err), false); } setCharge('');
  };
  const chargerF = async (n: string) => { const f = await stockage.lire(n); if (!f) return; const r = await moteur.charger(f.etat); maj({ phase: 'jeu', base: r.base, tick: m.tick + 1, ecran: 'accueil', nomPartie: n }); };
  const villes = (ref.villes as any[]).filter(v => v.nom.toLowerCase().includes(rech.toLowerCase())).sort((a, b) => b.pop - a.pop).slice(0, 12);
  const traits = (ref.traits as any[]).filter(t => !['gaffeur', 'fragile', 'opportuniste'].includes(t.id));
  if (charge) return <div class="accueil"><h1>MANDAT</h1><div class="sous">Politique Manager</div><p>{charge}...</p></div>;
  return <div class="accueil">
    <h1>MANDAT</h1><div class="sous">Politique Manager</div>
    {etape === 0 && <div>
      <div class="ligne" style={{ marginBottom: '20px' }}><button class="principal" onClick={() => setEtape(1)}>Nouvelle partie</button>
        <label class="doux">Importer un fichier .mandat : <input type="file" accept=".mandat,application/json" onChange={async (ev: any) => { const f = ev.target.files[0]; if (!f) return; try { const e = await stockage.importer(f); const r = await moteur.charger(e); maj({ phase: 'jeu', base: r.base, tick: m.tick + 1, ecran: 'accueil' }); } catch (err: any) { toast(String(err.message ?? err), false); } }} /></label></div>
      <h3>Charger une partie</h3>
      {fiches.length === 0 && <p class="doux">Aucune sauvegarde sur cet appareil.</p>}
      {fiches.map(f => <div class="bloc ligne" style={{ marginBottom: '6px' }}><b>{f.nom}</b><span class="doux">{f.resume}</span><span class="espace" /><span class="doux petit-texte">{new Date(f.date).toLocaleDateString('fr-FR')}</span><button onClick={() => chargerF(f.nom)}>Charger</button><button class="danger petit" onClick={async () => { await stockage.supprimer(f.nom); setFiches(await stockage.lister()); }}>Supprimer</button></div>)}
      <p class="doux petit-texte" style={{ marginTop: '30px' }}>Jeu de gestion politique au tour par tour. La France, les partis et le calendrier électoral sont réels au départ. Dès le premier tour, l'histoire diverge. Les attributs des personnes réelles sont calculés de façon neutre à partir de leurs mandats. Usage privé.</p>
    </div>}
    {etape === 1 && <div>
      <h2>1. Scénario</h2>
      <div class="cartes" style={{ marginBottom: '16px' }}>{SCENARIOS.map(s => <div class={`carte-choix ${scenario === s.id ? 'choisi' : ''}`} onClick={() => setScenario(s.id)}><b>{s.nom}</b><div class="doux">{s.date}</div><p style={{ marginTop: '6px' }}>{s.texte}</p></div>)}</div>
      <h2>2. Mode</h2>
      <div class="cartes" style={{ marginBottom: '16px' }}>
        <div class={`carte-choix ${mode === 'parti' ? 'choisi' : ''}`} onClick={() => setMode('parti')}><b>Mode Parti</b><p style={{ marginTop: '6px' }}>Vous dirigez un parti : ligne, finances, investitures, alliances, campagnes.</p></div>
        <div class={`carte-choix ${mode === 'carriere' ? 'choisi' : ''}`} onClick={() => setMode('carriere')}><b>Mode Carrière</b><p style={{ marginTop: '6px' }}>Vous incarnez un personnage, du militantisme de base jusqu'au sommet. Vous ne décidez que de ce que vos postes permettent.</p></div>
      </div>
      <h2>3. Parti</h2>
      <div class="cartes" style={{ marginBottom: '16px' }}>{(ref.partis as any[]).map(p => <div class={`carte-choix ${parti === p.id ? 'choisi' : ''}`} onClick={() => setParti(p.id)} style={{ borderLeft: `5px solid ${p.couleur}` }}><b>{p.sigle}</b> <span class="doux">{p.nom}</span><div class="petit-texte doux">{Math.round(p.adherents / 1000)} 000 adhérents, {(p.tresorerie / 1e6).toFixed(1).replace('.', ',')} M€</div></div>)}</div>
      <div class="ligne"><button onClick={() => setEtape(0)}>Retour</button><span class="espace" /><label><input type="checkbox" checked={tuto} onChange={(ev: any) => setTuto(ev.target.checked)} /> Tutoriel</label><label class="doux">Graine <input type="number" value={graine} style={{ width: '120px' }} onInput={(ev: any) => setGraine(+ev.target.value || 1)} /></label>
        {mode === 'parti' ? <button class="principal" onClick={lancer}>Commencer</button> : <button class="principal" onClick={() => setEtape(2)}>Créer mon personnage</button>}</div>
    </div>}
    {etape === 2 && <div>
      <h2>Votre personnage</h2>
      <div class="grille g2">
        <div class="bloc">
          <div class="ligne" style={{ marginBottom: '8px' }}><input type="text" placeholder="Prénom" value={perso.prenom} onInput={(ev: any) => setPerso({ ...perso, prenom: ev.target.value })} /><input type="text" placeholder="Nom" value={perso.nom} onInput={(ev: any) => setPerso({ ...perso, nom: ev.target.value })} />
            <select value={perso.sexe} onChange={(ev: any) => setPerso({ ...perso, sexe: ev.target.value })}><option value="M">Homme</option><option value="F">Femme</option></select>
            <label>Âge <input type="number" min="18" max="65" value={perso.age} style={{ width: '60px' }} onInput={(ev: any) => setPerso({ ...perso, age: Math.max(18, Math.min(65, +ev.target.value || 18)) })} /></label></div>
          <div class="ligne" style={{ marginBottom: '8px' }}><label>Profession <select value={perso.origine} onChange={(ev: any) => setPerso({ ...perso, origine: ev.target.value })}>{ORIGINES.map(o => <option>{o}</option>)}</select></label><label>Études <select value={perso.etudes} onChange={(ev: any) => setPerso({ ...perso, etudes: ev.target.value })}>{ETUDES.map(o => <option>{o}</option>)}</select></label></div>
          <h3>Ville de départ</h3>
          <input type="text" placeholder="Chercher une ville ou un secteur" value={rech} onInput={(ev: any) => setRech(ev.target.value)} style={{ width: '100%', marginBottom: '6px' }} />
          <div class="defile" style={{ maxHeight: '170px' }}>{villes.map(v => <div class={`msg ${perso.zone === v.id ? 'choisi' : ''}`} onClick={() => setPerso({ ...perso, zone: v.id })}>{v.nom} <span class="doux">({v.dept}, {v.pop.toLocaleString('fr-FR')} hab.)</span></div>)}</div>
          <h3 style={{ marginTop: '10px' }}>Incarner une personne réelle (facultatif)</h3>
          <Incarner zone={perso.zone} choisi={(perso as any).incarne} choisir={(x: any) => setPerso({ ...perso, ...(x ? { nom: x.nom, prenom: x.prenom, sexe: x.sexe ?? perso.sexe, age: x.naissance ? Math.max(18, Math.min(65, 2026 - x.naissance)) : perso.age, depart: 'conseiller' } : {}), incarne: x } as any)} />
          <h3 style={{ marginTop: '10px' }}>Départ</h3>
          <div class="ligne"><label><input type="radio" checked={perso.depart === 'militant'} onChange={() => setPerso({ ...perso, depart: 'militant' })} /> Simple militant</label><label><input type="radio" checked={perso.depart === 'conseiller'} onChange={() => setPerso({ ...perso, depart: 'conseiller' })} /> Conseiller municipal d'opposition</label></div>
          <h3 style={{ marginTop: '10px' }}>Deux traits ({perso.traits.length}/2)</h3>
          <div class="defile" style={{ maxHeight: '190px' }}>{traits.map(t => <label class="ligne" style={{ padding: '2px 0' }}><input type="checkbox" checked={perso.traits.includes(t.id)} disabled={!perso.traits.includes(t.id) && perso.traits.length >= 2} onChange={(ev: any) => setPerso({ ...perso, traits: ev.target.checked ? [...perso.traits, t.id] : perso.traits.filter(x => x !== t.id) })} /><b>{t.nom}</b><span class="doux petit-texte">{t.description}</span></label>)}</div>
        </div>
        <div class="bloc">
          <h3>Attributs : {reste} points à répartir</h3>
          <p class="doux petit-texte">Tous les attributs partent de 7. Maximum 15 à la création. Ils progresseront avec la pratique.</p>
          {ATTRS.map((a, i) => <div class="ligne" style={{ padding: '1px 0' }}>{(i === 9 || i === 17) && <div style={{ flexBasis: '100%', height: '6px' }} />}<span style={{ width: '190px' }}>{a}</span><button class="petit" disabled={perso.attrs[i] <= 0} onClick={() => { const t = perso.attrs.slice(); t[i]--; setPerso({ ...perso, attrs: t }); }}>-</button><b style={{ width: '24px', textAlign: 'center' }}>{7 + perso.attrs[i]}</b><button class="petit" disabled={reste <= 0 || perso.attrs[i] >= 8} onClick={() => { const t = perso.attrs.slice(); t[i]++; setPerso({ ...perso, attrs: t }); }}>+</button></div>)}
        </div>
      </div>
      <div class="ligne" style={{ marginTop: '12px' }}><button onClick={() => setEtape(1)}>Retour</button><span class="espace" /><button class="principal" onClick={lancer}>Commencer</button></div>
    </div>}
  </div>;
}
