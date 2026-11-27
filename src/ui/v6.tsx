// V6 : tableau de bord, page d'encyclopédie « Chronique », personnalisation (emblème, parti, financements).
import { useEffect, useState } from 'preact/hooks';
import { useMagasin, useVue, agir, aller, nb, euro, Bloc, Jauge, Parti, Logo, ouvrirFiche, RANGS } from './composants';
import { Portrait, Visage } from './parcours';
import { Bilan, Directeur } from './v7';

const SCRUTINS: Record<string, string> = { municipales: 'Municipales', departementales: 'Départementales', regionales: 'Régionales', legislatives: 'Législatives', europeennes: 'Européennes', senatoriales: 'Sénatoriales', presidentielle: 'Présidentielle' };
const ROLES: Record<string, string> = { mentor: 'mentor', allie: 'allié', rival: 'rival', journaliste: 'journaliste', cadre: 'cadre du parti', elu: 'élu d\'un autre parti' };

// Emblème original à composer : une forme, un symbole neutre, deux couleurs, des initiales.
const SYMBOLES = ['Initiales seules', 'Étoile', 'Soleil', 'Montagne', 'Vague', 'Arbre', 'Pont', 'Épi'];
const FORMES = ['Cercle', 'Écusson', 'Carré', 'Hexagone'];
export function Embleme({ e, taille = 40 }: { e: any; taille?: number }) {
  const f = [<circle cx="32" cy="32" r="30" fill={e.c1} />, <path d="M4 6 H60 V34 Q60 54 32 62 Q4 54 4 34Z" fill={e.c1} />, <rect x="3" y="3" width="58" height="58" rx="13" fill={e.c1} />, <path d="M32 2 L58 17 V47 L32 62 L6 47 V17Z" fill={e.c1} />][e.forme % 4];
  const s = [null, <path d="M32 10 L37 25 H52 L40 34 L45 49 L32 40 L19 49 L24 34 L12 25 H27Z" fill={e.c2} />, <g fill={e.c2}><circle cx="32" cy="30" r="10" />{[0, 45, 90, 135, 180, 225, 270, 315].map(a => <rect x="31" y="10" width="2" height="7" transform={`rotate(${a} 32 30)`} />)}</g>, <path d="M8 46 L24 20 L32 32 L40 24 L56 46Z" fill={e.c2} />, <path d="M8 34 Q16 24 24 34 T40 34 T56 34 V44 Q48 36 40 44 T24 44 T8 44Z" fill={e.c2} />, <g fill={e.c2}><circle cx="32" cy="24" r="13" /><rect x="29.5" y="34" width="5" height="14" /></g>, <g fill="none" stroke={e.c2} stroke-width="4"><path d="M8 40 Q32 12 56 40" /><path d="M8 44 H56" /></g>, <g fill={e.c2}><rect x="30.5" y="14" width="3" height="34" />{[18, 26, 34].map(y => <><ellipse cx="25" cy={y} rx="5" ry="3" transform={`rotate(-30 25 ${y})`} /><ellipse cx="39" cy={y} rx="5" ry="3" transform={`rotate(30 39 ${y})`} /></>)}</g>][e.symbole % 8];
  return <svg viewBox="0 0 64 64" width={taille} height={taille} style={{ flex: 'none' }} aria-label="Emblème">{f}{s}{e.initiales && <text x="32" y={e.symbole === 0 ? 40 : 58} text-anchor="middle" font-size={e.symbole === 0 ? (e.initiales.length > 2 ? 20 : 26) : 11} font-weight="700" fill={e.c2} font-family="system-ui, sans-serif">{e.initiales}</text>}</svg>;
}

export function TableauDeBord() {
  const m = useMagasin(); const b = m.base; const v = useVue('tableau'); if (!v) return <div>Chargement...</div>; const acces: string[] = b.acces ?? [];
  const va = (ecran: string) => aller(acces.includes(ecran) ? ecran : 'inbox');
  return <div>
    <div class="ligne" style={{ gap: '16px', marginBottom: '16px' }}>{v.carriere && b.portrait ? <Portrait p={b.portrait} taille={72} /> : <Logo i={b.parti} taille={64} />}
      <div><h1 style={{ margin: 0 }}>{v.moi ? v.moi.nom : v.parti.nom}</h1><div class="doux">{v.moi ? `${RANGS[v.moi.rang]}, ${v.lieu}` : 'Direction du parti'} · {v.date}</div></div><span class="espace" />
      {v.ambition && <div class="bloc" style={{ minWidth: '280px', cursor: 'pointer' }} onClick={() => aller('profil')}><h3>Mon ambition</h3><b>{v.ambition.nom}</b><div class="doux petit-texte">Étape {Math.min(v.ambition.total, v.ambition.faites + 1)} sur {v.ambition.total} : {v.ambition.etape.toLowerCase()}</div><Jauge v={v.ambition.faites} max={v.ambition.total} /></div>}</div>
    <div class="grille g21">
      <div class="grille" style={{ alignContent: 'start' }}>
        <Bloc titre="Cette semaine">{v.taches.length === 0 && <p class="doux">Rien ne presse. Avancez d'une semaine, ou allez sur le terrain.</p>}
          {v.taches.map((t: any) => <div class="ligne" style={{ padding: '7px 0', borderBottom: '1px solid var(--bord)', cursor: 'pointer' }} onClick={() => va(t.ecran)}><span style={{ width: '8px', height: '8px', borderRadius: '50%', background: t.urgent ? 'var(--danger)' : 'var(--accent)', flex: 'none' }} /><span style={{ flex: 1, fontWeight: t.urgent ? 600 : 400 }}>{t.t}</span><span class="doux">ouvrir</span></div>)}</Bloc>
        <div class="grille g2">
          <Bloc titre={`Mon secteur : ${v.lieu}`}>{v.quartiers.map((q: any) => <div class="ligne" style={{ flexWrap: 'nowrap', padding: '2px 0' }}><span style={{ width: '150px' }}>{q.nom}</span><div style={{ flex: 1 }}><Jauge v={q.ancrage} couleur={q.accueil > 20 ? 'var(--ok)' : q.accueil > -20 ? 'var(--accent-t)' : 'var(--alerte)'} /></div><span style={{ width: '24px' }} class="droite">{q.ancrage}</span></div>)}
            <p class="doux petit-texte" style={{ marginTop: '6px' }}>{v.equipe.n} militants, motivation {v.equipe.motiv}{v.equipe.fatigues ? `, ${v.equipe.fatigues} épuisé${v.equipe.fatigues > 1 ? 's' : ''}` : ''}. Caisse : {nb(v.equipe.caisse)} €.</p><button class="petit" onClick={() => aller('equipe')}>Aller sur le terrain</button></Bloc>
          <Bloc titre="Intentions de vote">{v.classement.map((c: any) => <div class="ligne" style={{ flexWrap: 'nowrap', padding: '2px 0' }}><Logo i={c.parti} taille={24} /><span style={{ width: '48px' }}><Parti i={c.parti} /></span><div style={{ flex: 1 }}><Jauge v={c.v} max={40} couleur={b.partis[c.parti].couleur} /></div><span style={{ width: '48px', fontWeight: c.parti === b.parti ? 700 : 400 }} class="droite">{String(c.v).replace('.', ',')} %</span></div>)}</Bloc>
        </div>
        <Bloc titre="Sur Agora">{v.tendances.length > 0 && <p class="doux petit-texte">Tendances : {v.tendances.join(' · ')}</p>}{v.fil.map((x: any) => <div style={{ padding: '6px 0', borderBottom: '1px solid var(--bord)' }}><b>{x.compte}</b> {x.parti >= 0 && <Parti i={x.parti} />}{x.etat === 'polemique' && <span class="danger-t petit-texte"> polémique</span>}<div style={{ whiteSpace: 'normal' }}>{x.texte}</div></div>)}<div class="ligne" style={{ marginTop: '8px' }}><span class="doux petit-texte">{nb(v.abonnes)} abonnés</span><span class="espace" /><button class="petit" onClick={() => aller('agora')}>Ouvrir Agora</button></div></Bloc>
      </div>
      <div class="grille" style={{ alignContent: 'start' }}>
        <Directeur v={v} />
        <Bilan />
        <Bloc titre="Calendrier">{v.campagne && <p class="alerte">Campagne des {(SCRUTINS[v.campagne.type] ?? '').toLowerCase()} : J-{v.campagne.dans * 7}, élan {v.campagne.elan}.</p>}{v.echeances.map((x: any) => <div class="tendance"><span><b>{SCRUTINS[x.type]}</b><div class="doux petit-texte">{x.date}</div></span><span class="echeance" style={{ alignSelf: 'center', background: 'var(--accent-doux)', color: 'var(--accent-t)', borderRadius: '980px', padding: '2px 10px', fontWeight: 600, fontSize: '12px' }}>J-{x.dans * 7}</span></div>)}</Bloc>
        {v.moi && <Bloc titre="Moi"><div class="ligne" style={{ gap: '14px' }}><span style={{ flex: 1 }}>Forme<Jauge v={v.moi.forme} /></span><span style={{ flex: 1 }}>Moral<Jauge v={v.moi.moral} /></span></div><table style={{ marginTop: '6px' }}><tbody><tr><td>Compte</td><td class={`droite ${v.moi.argent < 0 ? 'danger-t' : ''}`}><b>{nb(v.moi.argent)} €</b></td></tr><tr><td>Notoriété</td><td class="droite">{v.moi.notoriete}</td></tr><tr><td>Estime du parti</td><td class="droite">{v.moi.estime}</td></tr></tbody></table><div class="ligne" style={{ marginTop: '8px' }}><button class="petit" onClick={() => aller('profil')}>Mon parcours</button><button class="petit" onClick={() => aller('chronique')}>Ma page Chronique</button></div></Bloc>}
        <Bloc titre={`Mon parti : ${v.parti.sigle}`}><table><tbody><tr><td>Intentions de vote</td><td class="droite"><b>{String(v.parti.intentions).replace('.', ',')} %</b></td></tr><tr><td>Adhérents</td><td class="droite">{nb(v.parti.adherents)}</td></tr><tr><td>Unité</td><td class="droite">{v.parti.unite}</td></tr>{acces.includes('finances') && <tr><td>Trésorerie</td><td class={`droite ${v.parti.tresorerie < 0 ? 'danger-t' : ''}`}>{euro(v.parti.tresorerie)}</td></tr>}</tbody></table></Bloc>
        {v.carriere && (v.negliges.length > 0 || v.dettes.length > 0) && <Bloc titre="Mes proches">{v.negliges.map((c: any) => <div class="petit-texte" style={{ padding: '3px 0' }}><b>{c.nom}</b> ({ROLES[c.role]}) : {c.depuis < 0 ? 'jamais rencontré' : `pas vu depuis ${c.depuis} semaines`}</div>)}{v.dettes.length > 0 && <p class="alerte petit-texte" style={{ marginTop: '4px' }}>Vous devez un service à {v.dettes.join(', ')}.</p>}<button class="petit" style={{ marginTop: '6px' }} onClick={() => aller('contacts')}>Ouvrir le carnet</button></Bloc>}
      </div>
    </div>
  </div>;
}

// Page d'encyclopédie du jeu. Mise en page propre au jeu, sans rapport avec un site existant.
export function Chronique() {
  const m = useMagasin(); const id = m.params?.perso; const v = useVue('chronique', { id }); if (!v) return <div>Chargement...</div>;
  const H = ({ children }: { children: any }) => <h2 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 400, fontSize: '21px', borderBottom: '1px solid var(--bord)', paddingBottom: '4px', margin: '22px 0 10px' }}>{children}</h2>;
  return <div style={{ maxWidth: '1040px', margin: '0 auto' }}>
    <div class="ligne doux petit-texte" style={{ marginBottom: '6px' }}><b style={{ letterSpacing: '.18em', color: 'var(--texte)' }}>CHRONIQUE</b><span>l'encyclopédie de votre partie</span><span class="espace" /><span>Dernière mise à jour : {v.maj}</span></div>
    {v.reel && <div class="bloc" style={{ borderColor: 'var(--alerte)', marginBottom: '12px' }}><b class="alerte">Fiction générée par le jeu.</b> Cette page décrit ce qui arrive à ce personnage dans votre partie, à partir de la date de départ. Elle ne dit rien de la vie réelle de la personne qui porte ce nom.</div>}
    <h1 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 400, fontSize: '34px', borderBottom: '1px solid var(--bord)', paddingBottom: '6px' }}>{v.nom}</h1>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 280px', gap: '24px', alignItems: 'start' }}>
      <div style={{ fontSize: '14px', lineHeight: 1.6 }}>
        <p>{v.chapeau}</p>
        {(v.bio || v.estMoi) && <><H>Biographie</H>{v.bio ? <p class="pre">{v.bio}</p> : <p class="doux">Section vide. Écrivez votre biographie dans Mon parcours.</p>}</>}
        <H>Parcours politique</H>{v.parcours.length === 0 && <p class="doux">Aucun fait marquant pour l'instant.</p>}{v.parcours.map((x: any) => <p><b>{x.an}.</b> {x.texte}</p>)}
        {v.positions.length > 0 && <><H>Prises de position</H>{v.positions.map((x: any) => <p>Le {x.date} : « {x.texte} » <span class="doux">({nb(x.vues)} vues sur Agora)</span></p>)}</>}
        {v.promesses.length > 0 && <><H>Engagements</H><ul style={{ margin: 0, paddingLeft: '20px' }}>{v.promesses.map((x: any) => <li>{x.t} <span class={x.regle === 'tenue' ? 'ok' : x.regle === 'dedit' ? 'danger-t' : 'doux'}>({x.regle === 'tenue' ? 'tenu' : x.regle === 'dedit' ? 'renié' : 'en cours'})</span></li>)}</ul></>}
        {v.controverses.length > 0 && <><H>Controverses</H><ul style={{ margin: 0, paddingLeft: '20px' }}>{v.controverses.map((t: string) => <li>{t}</li>)}</ul></>}
        <H>Résultats électoraux</H><p>{v.elections.victoires + v.elections.defaites === 0 ? 'Aucune candidature à ce jour.' : `${v.elections.victoires} élection${v.elections.victoires > 1 ? 's' : ''} gagnée${v.elections.victoires > 1 ? 's' : ''}, ${v.elections.defaites} perdue${v.elections.defaites > 1 ? 's' : ''}.`}</p>
        <H>Historique de la page</H>{v.modifs.length === 0 && <p class="doux">Page créée.</p>}{v.modifs.map((x: any) => <div class="petit-texte doux">{x.date} : ajout de « {x.t} »</div>)}
      </div>
      <div class="bloc" style={{ fontSize: '13px' }}>
        <div class="centre" style={{ marginBottom: '8px' }}>{v.portrait ? <Portrait p={v.portrait} taille={150} /> : !v.reel ? <Visage nom={v.nom} couleur={v.parti >= 0 ? m.base.partis[v.parti].couleur : undefined} taille={150} /> : <span class="avatar" style={{ width: '110px', height: '110px', borderRadius: '24%', background: v.parti >= 0 ? m.base.partis[v.parti].couleur : '#8e8e93', fontSize: '34px' }}>{v.nom.split(' ').map((x: string) => x[0]).slice(0, 2).join('')}</span>}<div style={{ marginTop: '6px' }}><b>{v.nom}</b></div></div>
        <table><tbody>
          {v.fonctions.map((f: any) => <tr><td style={{ whiteSpace: 'normal' }}><b>{f.nom.charAt(0).toUpperCase() + f.nom.slice(1)}</b><div class="doux petit-texte">depuis le {f.depuis}</div></td></tr>)}
          {v.postes.map((t: string) => <tr><td style={{ whiteSpace: 'normal' }}>{t.charAt(0).toUpperCase() + t.slice(1)}</td></tr>)}
          <tr><td style={{ whiteSpace: 'normal' }}>Naissance : {v.naissance}{v.lieu ? `, ${v.lieu}` : ''}</td></tr>
          <tr><td>Parti : {v.parti >= 0 ? <Parti i={v.parti} /> : 'aucun'}</td></tr>
          {v.profession && <tr><td style={{ whiteSpace: 'normal' }}>Profession : {v.profession}</td></tr>}
          <tr><td>Notoriété : {v.notoriete} sur 100</td></tr>{v.abonnes > 0 && <tr><td>Agora : {nb(v.abonnes)} abonnés</td></tr>}
        </tbody></table>
        {!v.estMoi && <button class="petit" style={{ marginTop: '8px' }} onClick={() => ouvrirFiche(v.id)}>Ouvrir sa fiche</button>}
      </div>
    </div>
  </div>;
}

export function Personnalisation() {
  const m = useMagasin(); const b = m.base; const v = useVue('tableau'); const e0 = b.embleme ?? { forme: 0, symbole: 1, c1: b.partis[b.parti].couleur, c2: '#ffffff', initiales: b.partis[b.parti].sigle.slice(0, 3), actif: false };
  const [e, setE] = useState<any>(e0); const [nom, setNom] = useState(''); const [sigle, setSigle] = useState(''); const [couleur, setCouleur] = useState('#0a7d5a'); const [montant, setMontant] = useState(50000);
  const chg = (k: string, x: any) => setE({ ...e, [k]: x }); const carriere = b.mode === 'carriere';
  return <div>
    <h1>Personnalisation</h1>
    <div class="grille g2">
      <Bloc titre="Atelier d'emblème">
        <div class="ligne" style={{ gap: '18px', alignItems: 'flex-start' }}><Embleme e={e} taille={112} />
          <div class="grille" style={{ gap: '6px', flex: 1 }}>
            <label class="ligne"><span style={{ width: '80px' }} class="doux">Forme</span><select aria-label="Forme" value={e.forme} onChange={(ev: any) => chg('forme', +ev.target.value)}>{FORMES.map((n, i) => <option value={i}>{n}</option>)}</select></label>
            <label class="ligne"><span style={{ width: '80px' }} class="doux">Symbole</span><select aria-label="Symbole" value={e.symbole} onChange={(ev: any) => chg('symbole', +ev.target.value)}>{SYMBOLES.map((n, i) => <option value={i}>{n}</option>)}</select></label>
            <label class="ligne"><span style={{ width: '80px' }} class="doux">Initiales</span><input type="text" aria-label="Initiales" maxLength={3} style={{ width: '80px' }} value={e.initiales} onInput={(ev: any) => chg('initiales', ev.target.value.toUpperCase())} /></label>
            <div class="ligne"><span style={{ width: '80px' }} class="doux">Couleurs</span><input type="color" aria-label="Couleur de fond" value={e.c1} onInput={(ev: any) => chg('c1', ev.target.value)} /><input type="color" aria-label="Couleur du symbole" value={e.c2} onInput={(ev: any) => chg('c2', ev.target.value)} /></div>
            <label class="ligne"><input type="checkbox" checked={e.actif} onChange={(ev: any) => chg('actif', ev.target.checked)} /> Afficher cet emblème à la place de la pastille de mon parti</label>
            <div><button class="principal" onClick={() => agir({ type: 'emblemeModifier', embleme: e })}>Enregistrer l'emblème</button></div>
          </div></div>
        <p class="doux petit-texte" style={{ marginTop: '8px' }}>L'emblème est un dessin original composé ici. Pour utiliser une image à vous, déposez-la dans le dossier des logos du jeu (voir public/data/logos).</p>
      </Bloc>
      {carriere && <Bloc titre="Mon personnage"><div class="ligne" style={{ gap: '14px' }}>{b.portrait && <Portrait p={b.portrait} taille={84} />}<div><b>{b.moi?.nom}</b><div class="doux">{RANGS[b.moi?.rang ?? 0]}</div><div class="ligne" style={{ marginTop: '8px' }}><button onClick={() => aller('profil')}>Modifier ma fiche</button><button onClick={() => aller('chronique')}>Voir ma page Chronique</button></div></div></div></Bloc>}
      {carriere && !b.estChef && <Bloc titre="Fonder mon parti">
        <p>Quitter votre parti pour créer le vôtre. Vous partez de presque rien : il faut être connu (notoriété 25 au moins) pour que quelqu'un vous suive.</p>
        <div class="grille" style={{ gap: '6px' }}><input type="text" aria-label="Nom du parti" maxLength={40} placeholder="Nom du parti" value={nom} onInput={(ev: any) => setNom(ev.target.value)} />
          <div class="ligne"><input type="text" aria-label="Sigle" maxLength={5} placeholder="Sigle" style={{ width: '100px' }} value={sigle} onInput={(ev: any) => setSigle(ev.target.value.toUpperCase())} /><span class="doux">Couleur</span><input type="color" aria-label="Couleur du parti" value={couleur} onInput={(ev: any) => setCouleur(ev.target.value)} /><span class="espace" /><button class="principal" disabled={nom.trim().length < 3 || sigle.length < 2} onClick={() => agir({ type: 'fonderPartiV6', nom, sigle, couleur })}>Fonder le parti</button></div></div>
      </Bloc>}
      {b.estChef && v && <Bloc titre="Financer le parti">
        <table><tbody><tr><td>Trésorerie</td><td class={`droite ${v.parti.tresorerie < 0 ? 'danger-t' : ''}`}><b>{euro(v.parti.tresorerie)}</b></td></tr><tr><td>Adhérents</td><td class="droite">{nb(v.parti.adherents)}</td></tr>{v.parti.pret > 0 && <tr><td>Reste à rembourser</td><td class="droite alerte">{euro(v.parti.pret)}</td></tr>}</tbody></table>
        <div class="choix">
          <button onClick={() => agir({ type: 'finAppel' })}>Lancer un appel aux dons sur Agora<small>Dépend de vos abonnés, de votre dynamique et de l'unité du parti. Une fois par trimestre.</small></button>
          <button onClick={() => agir({ type: 'finPrets' })}>Demander des prêts à vos adhérents<small>De l'argent tout de suite, à rembourser sur trois ans. Coûte un peu d'unité. Une fois par semestre.</small></button>
        </div>
        <div class="ligne" style={{ marginTop: '8px' }}><span>Emprunt bancaire</span><input type="number" aria-label="Montant de l'emprunt" min={10000} step={10000} style={{ width: '130px' }} value={montant} onInput={(ev: any) => setMontant(+ev.target.value)} /><span>€</span><button onClick={() => agir({ type: 'finEmprunt', montant })}>Demander</button></div>
        <p class="doux petit-texte" style={{ marginTop: '6px' }}>La banque prête selon vos sondages et vos adhérents, à 12 % sur trois ans. Le financement public, lui, ne tombe qu'après des législatives : 1 % des voix dans 50 circonscriptions au moins.</p>
      </Bloc>}
    </div>
  </div>;
}

// Annuaire des élus : qui tient quoi autour de vous, avec prise de contact.
const PORTEES: [string, string][] = [['secteur', 'Mon secteur'], ['dept', 'Mon département'], ['region', 'Ma région'], ['national', 'National']];
export function Annuaire() {
  const m = useMagasin(); const b = m.base; const [portee, setPortee] = useState('secteur'); const [q, setQ] = useState(''); const [parti, setParti] = useState(-1); const [conseil, setConseil] = useState<any[]>([]);
  const v = useVue('annuaire', { portee, q, parti });
  useEffect(() => { if (!v?.zone || !v?.dept) return; let vivant = true; fetch(new URL(`./data/elus/${v.dept}.json`, document.baseURI).href).then(r => r.ok ? r.json() : {}).then(o => { if (vivant) setConseil((o[v.zone] ?? []).map((x: any[]) => ({ zone: v.zone, nom: x[0], prenom: x[1], sexe: x[2], naissance: x[3], parti: x[4], fonction: x[5] }))); }).catch(() => undefined); return () => { vivant = false; }; }, [v?.zone, v?.dept]);
  if (!v) return <div>Chargement...</div>;
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); const connus = new Set<string>([...v.lignes.map((l: any) => norm(l.nom)), ...(v.contactsRepertoire ?? [])]); const qq = norm(q);
  const reste = conseil.filter(x => !connus.has(norm(`${x.prenom} ${x.nom}`)) && (!qq || norm(`${x.prenom} ${x.nom}`).includes(qq)) && (parti < 0 || x.parti === b.partis[parti]?.id));
  const total = v.partis.reduce((s: number, x: any) => s + x.n, 0) || 1;
  return <div>
    <h1>Annuaire des élus</h1>
    <div class="grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', marginBottom: '14px' }}>{v.reperes.map((r: any) => <div class="bloc" style={{ cursor: 'pointer' }} onClick={() => ouvrirFiche(r.id)}><h3>{r.titre}</h3><div class="ligne" style={{ flexWrap: 'nowrap' }}><Logo i={r.parti} taille={30} /><b>{r.nom}</b> <Parti i={r.parti} /></div></div>)}</div>
    <div class="ligne" style={{ marginBottom: '10px' }}>{PORTEES.map(([k, n]) => <button class={portee === k ? 'principal' : ''} onClick={() => { setPortee(k); setParti(-1); }}>{n}</button>)}<span class="espace" /><input type="text" aria-label="Chercher un élu" placeholder="Chercher un nom" value={q} onInput={(ev: any) => setQ(ev.target.value)} style={{ width: '220px' }} /></div>
    <Bloc titre={`${v.total} élus et cadres${portee === 'secteur' ? ` autour de ${v.lieu}` : ''}`}>
      <div style={{ display: 'flex', height: '10px', borderRadius: '6px', overflow: 'hidden', marginBottom: '8px' }}>{v.partis.map((x: any) => <span title={`${b.partis[x.parti].sigle} : ${x.n}`} style={{ width: `${x.n / total * 100}%`, background: b.partis[x.parti].couleur }} />)}</div>
      <div class="ligne" style={{ gap: '6px', marginBottom: '8px' }}><button class={`petit ${parti < 0 ? 'principal' : ''}`} onClick={() => setParti(-1)}>Tous</button>{v.partis.map((x: any) => <button class={`petit ${parti === x.parti ? 'principal' : ''}`} onClick={() => setParti(parti === x.parti ? -1 : x.parti)}>{b.partis[x.parti].sigle} {x.n}</button>)}{v.carriere && <><span class="espace" /><span class="doux petit-texte">Prises de contact restantes cette semaine : {v.priseReste}</span></>}</div>
      <table><thead><tr><th>Nom</th><th>Parti</th><th>Fonctions</th><th class="droite">Âge</th><th class="droite">Notoriété</th><th></th></tr></thead><tbody>
        {v.lignes.map((l: any) => <tr><td><a onClick={() => ouvrirFiche(l.id)}><b>{l.nom}</b></a>{l.suivi && <span class="doux petit-texte"> suivi</span>}</td><td>{l.parti >= 0 ? <Parti i={l.parti} /> : <span class="doux">sans</span>}</td><td style={{ whiteSpace: 'normal' }}>{l.fonctions.length ? l.fonctions.join(', ') : RANGS[l.rang]}</td><td class="droite">{l.age}</td><td class="droite">{l.notoriete}</td>
          <td class="droite" style={{ whiteSpace: 'nowrap' }}>{v.carriere && (l.contact >= 0 ? <button class="petit" onClick={() => aller('contacts')}>Dans le carnet ({l.contact})</button> : <button class="petit" disabled={l.refus || v.priseReste <= 0} onClick={() => agir({ type: 'annuaireContact', id: l.id })}>{l.refus ? 'Sans réponse' : 'Prendre contact'}</button>)} {v.carriere && <button class="petit" onClick={() => agir({ type: 'suivre', id: l.id }, true)}>{l.suivi ? 'Ne plus suivre' : 'Suivre'}</button>} <button class="petit" onClick={() => aller('chronique', { perso: l.id })}>Chronique</button></td></tr>)}
        {v.lignes.length === 0 && <tr><td colSpan={6} class="doux">Personne ne correspond.</td></tr>}</tbody></table>
      {v.coupe && <p class="doux petit-texte">Liste limitée aux 150 premiers. Affinez avec la recherche ou un parti.</p>}
    </Bloc>
    {portee === 'secteur' && reste.length > 0 && <div style={{ marginTop: '14px' }}><Bloc titre={`Conseil municipal : ${reste.length} autres élus (Répertoire national des élus)`}>
      <p class="doux petit-texte">Ces élus réels n'ont pas encore de fiche dans votre partie. Prendre contact avec l'un d'eux la crée.</p>
      <div class="defile" style={{ maxHeight: '420px' }}><table><tbody>{reste.slice(0, 200).map(x => <tr><td><b>{x.prenom} {x.nom}</b></td><td>{x.parti ? <span class="doux">{x.parti}</span> : <span class="doux">sans étiquette retenue</span>}</td><td style={{ whiteSpace: 'normal' }}>{x.fonction || 'Conseiller municipal'}</td><td class="droite">{x.naissance ? 2026 - x.naissance + ' ans' : ''}</td><td class="droite">{v.carriere && <button class="petit" disabled={v.priseReste <= 0} onClick={() => agir({ type: 'annuaireContactElu', elu: x })}>Prendre contact</button>}</td></tr>)}</tbody></table></div>
    </Bloc></div>}
  </div>;
}
