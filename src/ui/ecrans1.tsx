// Écrans : boîte de réception, fiche personnage, effectif, parti.
import { useState, useMemo } from 'preact/hooks';
import { useMagasin, useVue, agir, aller, ouvrirFiche, maj, Parti, Jauge, Attr, Avatar, NomPerso, Info, Bloc, Onglets, Tableau, Col, nb, RANGS, couleurParti, BarreH } from './composants';

const CATS: Record<string, string> = { actu: 'Actualité', parti: 'Parti', campagne: 'Campagne', resultats: 'Résultats', sondage: 'Sondage', medias: 'Médias', finances: 'Finances', justice: 'Justice', mandat: 'Mandat', carriere: 'Carrière', doctrine: 'Doctrine', alliances: 'Alliances', victoire: 'Victoire' };

export function Inbox() {
  const m = useMagasin(); const v = useVue('inbox'); const [sel, setSel] = useState<number>(-1); const [filtre, setFiltre] = useState('tout'); const b = m.base;
  const msgs: any[] = v?.messages ?? []; const liste = msgs.filter(x => filtre === 'tout' || (filtre === 'decisions' ? x.choix && x.repondu === undefined : x.cat === filtre));
  const cur = msgs.find(x => x.id === sel) ?? liste.find(x => x.choix && x.repondu === undefined) ?? liste[0];
  const ouvrir = (x: any) => { setSel(x.id); if (!x.lu) agir({ type: 'lu', id: x.id }, true); };
  return <div class="grille g12" style={{ height: '100%' }}>
    <div class="bloc" style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div class="ligne" style={{ padding: '8px 10px', borderBottom: '1px solid var(--bord)' }}>
        <select value={filtre} onChange={(ev: any) => setFiltre(ev.target.value)}><option value="tout">Tous les messages</option><option value="decisions">Décisions en attente</option>{Object.keys(CATS).map(k => <option value={k}>{CATS[k]}</option>)}</select>
        <span class="espace" /><button class="petit" onClick={() => agir({ type: 'toutLu' }, true)}>Tout marquer comme lu</button></div>
      <div style={{ overflow: 'auto', flex: 1 }}>{liste.map(x => <div class={`msg ${x.lu ? '' : 'nonlu'} ${cur && cur.id === x.id ? 'choisi' : ''}`} onClick={() => ouvrir(x)}>
        <div class="ligne"><span class="cat">{CATS[x.cat] ?? x.cat}</span><span class="espace" /><span class="doux petit-texte">{x.date}</span></div>
        <b>{x.titre}</b>{x.choix && x.repondu === undefined && <span class="badge rouge" style={{ marginLeft: '6px' }}>à décider</span>}</div>)}
        {liste.length === 0 && <p class="doux" style={{ padding: '10px' }}>Aucun message.</p>}</div>
    </div>
    <div class="grille" style={{ alignContent: 'start' }}>
      {cur ? <div class="bloc"><div class="ligne"><span class="cat doux">{CATS[cur.cat] ?? cur.cat}</span><span class="espace" /><span class="doux">{cur.date}</span></div><h2 style={{ marginTop: '4px' }}>{cur.titre}</h2><p class="pre">{cur.texte}</p>
        {cur.choix && cur.repondu === undefined && <div class="choix">{cur.choix.map((c: any, i: number) => <button onClick={() => agir({ type: 'repondre', id: cur.id, choix: i })}><b>{c.t}</b>{c.info && <small>{c.info}</small>}</button>)}{cur.expire !== undefined && <small class="doux">Sans réponse d'ici {Math.max(0, cur.expire - b.semaine)} semaine(s), la dernière option s'applique.</small>}</div>}
        {cur.choix && cur.repondu !== undefined && <p class="doux">Votre décision : {cur.choix[cur.repondu]?.t}</p>}
        {cur.cat === 'resultats' && <button onClick={() => aller('historique')}>Voir le détail dans l'historique</button>}
        {cur.cat === 'campagne' && <button onClick={() => aller('campagne')}>Ouvrir l'écran Campagne</button>}
        {cur.cat === 'medias' && b.debat && !b.debat.fini && <button class="principal" onClick={() => aller('medias')}>Jouer l'entretien</button>}
        {cur.action?.type === 'victoire' && <button onClick={() => aller('pantheon')}>Voir le Panthéon</button>}
      </div> : <div class="bloc doux">Sélectionnez un message.</div>}
      {b.mode === 'carriere' && b.moi && <Bloc titre="Votre semaine">
        <div class="ligne" style={{ marginBottom: '6px' }}><Avatar nom={b.moi.nom} parti={b.moi.parti} /><div><a onClick={() => ouvrirFiche(b.moi.id)}><b>{b.moi.nom}</b></a><div class="doux petit-texte">{RANGS[b.moi.rang]}, {b.moi.zone}{b.moi.mandats.length ? ', ' + b.moi.mandats.join(', ') : ''}</div></div><span class="espace" /><div style={{ width: '130px' }}><span class="petit-texte doux">Forme {b.moi.forme}</span><Jauge v={b.moi.forme} /><span class="petit-texte doux">Moral {b.moi.moral}</span><Jauge v={b.moi.moral} /></div></div>
        <div class="cartes">{Object.keys(b.activites).map(k => <div class={`carte-choix ${b.moi.activite === k ? 'choisi' : ''}`} onClick={() => agir({ type: 'activite', valeur: k }, true)}><b>{b.activites[k].nom}</b><div class="doux petit-texte">{b.activites[k].desc}</div></div>)}</div>
      </Bloc>}
      <Bloc titre="Échéances"><table><tbody>{b.prochaines.map((x: any) => <tr><td>{x.nom}</td><td>{x.tour2 ? `second tour le ${x.date2}` : x.date}</td><td class="droite">{x.dans > 0 ? `dans ${x.dans} semaines` : x.tour2 ? 'entre-deux-tours' : 'cette semaine'}</td></tr>)}</tbody></table></Bloc>
    </div>
  </div>;
}

const REL: Record<string, string> = { ami: 'Amitié', rival: 'Rivalité', dette: 'Dette', mentor: 'Mentor', inimitie: 'Inimitié' };
export function FichePerso({ id }: { id: number }) {
  const m = useMagasin(); const p = useVue('perso', { id }); const b = m.base; if (!p) return <div>Chargement...</div>;
  const dr = b.droits; const groupes: [string, number, number][] = [['Technique', 0, 9], ['Mental', 9, 17], ['Social', 17, 21]];
  return <div>
    <div class="ligne" style={{ marginBottom: '10px' }}><Avatar nom={p.nom} parti={p.parti} taille={56} /><div><h1 style={{ margin: 0 }}>{p.nom}</h1><div class="doux">{p.age} ans, {p.zone} ({p.dept}). {p.profession}, formation : {p.formation}. {RANGS[p.rang]}</div><div class="ligne" style={{ marginTop: '3px' }}><Parti i={p.parti} long />{p.postes.map((x: string) => <span class="pastille" style={{ background: 'var(--fond3)', color: 'var(--texte)' }}>{x}</span>)}{p.statut !== 'actif' && <span class="pastille" style={{ background: 'var(--danger)' }}>{p.statut === 'ineligible' ? 'inéligible' : p.statut === 'mort' ? 'décédé' : 'retiré'}</span>}{p.affaire && <span class="pastille" style={{ background: 'var(--alerte)' }}>{p.affaire}</span>}{p.frondeur && <span class="pastille" style={{ background: 'var(--alerte)' }}>frondeur</span>}</div></div>
      <span class="espace" /><button onClick={() => maj({ fiche: -1 })}>Fermer</button></div>
    <div class="grille g3">
      {groupes.map(([nom, a, z]) => <Bloc titre={nom}>{p.attrsNom.slice(a, z).map((n: string, i: number) => <div class="ligne" style={{ justifyContent: 'space-between' }}><span>{n}</span><Attr v={p.attrs[a + i]} /></div>)}
        {nom === 'Social' && <div class="ligne" style={{ justifyContent: 'space-between' }}><span><Info t="De 0 à 100. Séparée des attributs : elle monte avec les mandats, les médias et les campagnes.">Notoriété</Info></span><b>{p.notoriete}</b></div>}
        {nom === 'Social' && <div style={{ marginTop: '8px' }}><span class="petit-texte doux">Moral {p.moral}</span><Jauge v={p.moral} /><span class="petit-texte doux">Forme {p.forme}</span><Jauge v={p.forme} /></div>}</Bloc>)}
    </div>
    <div class="grille g3" style={{ marginTop: '12px' }}>
      <Bloc titre="Traits">{p.traitsDetail.map((t: any) => <div style={{ marginBottom: '4px' }}><b>{t.nom}</b><div class="doux petit-texte">{t.description}</div></div>)}
        <h3 style={{ marginTop: '10px' }}>Rapport d'observation</h3>
        {p.observe ? <div class="petit-texte">Du {p.observe.date} (marge de {p.observe.marge} points)<br />Potentiel estimé : <b>{p.observe.pot}</b>/20<br />Fidélité réelle estimée : <b>{p.observe.fidelite}</b>/20<br />Risque d'affaire : <b>{p.observe.casserole < 0.08 ? 'faible' : p.observe.casserole < 0.25 ? 'modéré' : 'élevé'}</b></div> : <div class="doux petit-texte">Potentiel, fidélité réelle et casseroles éventuelles sont cachés. Un rapport d'observation en donne une estimation.</div>}
        {!p.estMoi && <button class="petit" style={{ marginTop: '6px' }} onClick={() => agir({ type: 'observer', cible: p.id })}>Demander un rapport (3 k€)</button>}</Bloc>
      <Bloc titre="Mandats et bilan">{p.mandatsDetail.length ? p.mandatsDetail.map((x: any) => <div>{x.type} {x.lieu && `(${x.lieu})`} <span class="doux petit-texte">depuis le {x.depuis}</span></div>) : <span class="doux">Aucun mandat.</span>}
        <div style={{ marginTop: '6px' }} class="petit-texte">Victoires : {p.victoires}, défaites : {p.defaites}</div>
        <h3 style={{ marginTop: '10px' }}>Relations</h3>{p.relations.length ? p.relations.map((r: any) => <div class="ligne" style={{ justifyContent: 'space-between' }}><a onClick={() => ouvrirFiche(r.id)}>{r.nom}</a><span class={r.type === 'ami' || r.type === 'mentor' ? 'ok' : r.type === 'dette' ? '' : 'alerte'}>{REL[r.type]}</span></div>) : <span class="doux">Aucune relation connue.</span>}</Bloc>
      <Bloc titre="Positions personnelles">{b.ref?.axes ? null : null}{p.axes.map((x: number, i: number) => <div class="ligne" style={{ justifyContent: 'space-between' }}><span class="petit-texte">{m.ref.axes[i].nom}</span><span><b>{x > 0 ? '+' : ''}{x}</b>{p.axesParti && <span class={`petit-texte ${Math.abs(x - p.axesParti[i]) >= 3 ? 'alerte' : 'doux'}`}> (parti {p.axesParti[i] > 0 ? '+' : ''}{p.axesParti[i]})</span>}</span></div>)}</Bloc>
    </div>
    <div class="grille g2" style={{ marginTop: '12px' }}>
      <Bloc titre="Carrière"><div class="defile" style={{ maxHeight: '180px' }}>{p.hist.length ? p.hist.slice().reverse().map((h: any) => <div><span class="doux petit-texte">{h.date}</span> {h.texte}</div>) : <span class="doux">Rien à signaler pour l'instant.</span>}</div>
        {p.citations.length > 0 && <><h3 style={{ marginTop: '8px' }}>Citations et moments marquants</h3>{p.citations.map((c: string) => <div class="petit-texte">{c}</div>)}</>}</Bloc>
      <Bloc titre="Actions">
        {p.mien && !p.estMoi && dr.tout && <div class="ligne" style={{ marginBottom: '6px' }}><select id="poste-sel">{['tresorier', 'porte_parole', 'organisation', 'elections', 'projet', 'jeunes'].map(k => <option value={k}>{({ tresorier: 'Trésorier', porte_parole: 'Porte-parole', organisation: 'Organisation', elections: 'Élections', projet: 'Projet', jeunes: 'Jeunes' } as any)[k]}</option>)}</select><button class="petit" onClick={() => agir({ type: 'nommer', perso: p.id, poste: (document.getElementById('poste-sel') as HTMLSelectElement).value })}>Nommer au bureau national</button></div>}
        {p.mien && !p.estMoi && (dr.tout || dr.mercato) && <div class="ligne" style={{ marginBottom: '6px' }}><select id="dept-sel">{m.ref.depts.map((x: any, i: number) => <option value={i} selected={x.code === p.deptCode}>{x.code} {x.nom}</option>)}</select><button class="petit" onClick={() => agir({ type: 'delegue', perso: p.id, dept: +(document.getElementById('dept-sel') as HTMLSelectElement).value })}>Nommer délégué départemental</button></div>}
        {p.mien && !p.estMoi && dr.tout && <div class="ligne" style={{ marginBottom: '6px' }}><button class="petit" onClick={() => agir({ type: 'sanction', perso: p.id, valeur: 'rappel' })}>Rappel à l'ordre</button><button class="petit" onClick={() => agir({ type: 'sanction', perso: p.id, valeur: 'suspension' })}>Suspendre</button><button class="petit danger" onClick={() => agir({ type: 'sanction', perso: p.id, valeur: 'exclusion' })}>Exclure (10 de capital)</button></div>}
        {p.mien && dr.tout && p.rang >= 3 && <button class="petit" onClick={() => agir({ type: 'candidatPres', perso: p.id })}>Désigner candidat à la présidentielle</button>}
        {!p.mien && p.statut === 'actif' && dr.mercato && <div><p class="petit-texte doux">Débauchage : coûte 8 de capital politique. La réussite dépend de sa fidélité réelle, de son ambition, de l'écart doctrinal et de l'état de son parti.</p><div class="ligne">{[['rien', 'Simple approche'], ['poste', 'Offrir un poste'], ['investiture', 'Offrir une investiture'], ['tete_de_liste', 'Offrir une tête de liste']].map(([k, n]) => <button class="petit" onClick={() => agir({ type: 'debaucher', cible: p.id, offre: k })}>{n}</button>)}</div></div>}
        {!p.mien && !dr.mercato && <span class="doux petit-texte">Le mercato est réservé à la direction du parti (secrétaire à l'organisation ou président).</span>}
        {p.estMoi && <span class="doux">C'est vous.</span>}
      </Bloc>
    </div>
  </div>;
}

export function Effectif() {
  const m = useMagasin(); const [parti, setParti] = useState<number>(m.base.parti); const [tous, setTous] = useState(false); const [filtre, setFiltre] = useState(''); const [groupe, setGroupe] = useState('general'); const [q, setQ] = useState('');
  const v = useVue('effectif', { parti, tous }); const rech = useVue('recherche', { q });
  const lignes: any[] = useMemo(() => (v?.persos ?? []).filter((p: any) => !filtre || (filtre === 'elus' ? p.mandats.length : filtre === 'direction' ? p.postes.length : filtre === 'jeunes' ? p.age < 35 : filtre === 'femmes' ? p.sexe === 'F' : true)), [v, filtre]);
  const base: Col<any>[] = [{ titre: 'Nom', val: p => p.nom, rendu: p => <span class="ligne" style={{ flexWrap: 'nowrap' }}><Avatar nom={p.nom} parti={p.parti} taille={20} /><NomPerso p={p} /></span> }, { titre: 'Âge', val: p => p.age, droite: true }, { titre: 'Dép.', val: p => p.deptCode }, { titre: 'Rang', val: p => p.rang, rendu: p => RANGS[p.rang] }];
  const cols: Col<any>[] = groupe === 'general' ? [...base, { titre: 'Postes et mandats', val: p => [...p.postes, ...p.mandats].join(', ') }, { titre: 'Notoriété', val: p => p.notoriete, droite: true }, { titre: 'Moral', val: p => p.moral, rendu: p => <Jauge v={p.moral} /> }, { titre: 'Forme', val: p => p.forme, rendu: p => <Jauge v={p.forme} /> }]
    : [...base.slice(0, 2), ...(v?.attrsNom ?? []).map((n: string, i: number) => ({ i, n })).filter((x: any) => groupe === 'technique' ? x.i < 9 : groupe === 'mental' ? x.i >= 9 && x.i < 17 : x.i >= 17).map((x: any) => ({ titre: x.n.replace('Organisation de campagne', 'Organisation').replace('Résistance à la pression', 'Résistance').replace('Dossiers techniques', 'Dossiers').replace('Réseaux sociaux', 'Réseaux soc.'), val: (p: any) => p.attrs[x.i], rendu: (p: any) => <Attr v={p.attrs[x.i]} />, droite: true } as Col<any>))];
  return <div>
    <div class="ligne" style={{ marginBottom: '10px' }}><h1 style={{ margin: 0 }}>Effectif</h1>
      <select value={parti} onChange={(ev: any) => setParti(+ev.target.value)}>{m.base.partis.filter((p: any) => p.actif).map((p: any) => <option value={p.idx}>{p.sigle} {p.idx === m.base.parti ? '(votre parti)' : ''}</option>)}</select>
      <select value={filtre} onChange={(ev: any) => setFiltre(ev.target.value)}><option value="">Tous</option><option value="elus">Élus</option><option value="direction">Direction et délégués</option><option value="jeunes">Moins de 35 ans</option><option value="femmes">Femmes</option></select>
      <label><input type="checkbox" checked={tous} onChange={(ev: any) => setTous(ev.target.checked)} /> Inclure les simples militants</label>
      <span class="espace" /><input type="text" placeholder="Chercher une personne (tous partis)" value={q} onInput={(ev: any) => setQ(ev.target.value)} /></div>
    {q.length >= 2 && rech && <Bloc titre="Résultats de la recherche">{rech.persos.length ? rech.persos.map((p: any) => <div class="ligne"><Parti i={p.parti} /><NomPerso p={p} /><span class="doux petit-texte">{[...p.postes, ...p.mandats].join(', ')}</span></div>) : <span class="doux">Personne.</span>}</Bloc>}
    <Onglets liste={[['general', 'Général'], ['technique', 'Technique'], ['mental', 'Mental'], ['social', 'Social']]} actif={groupe} choisir={setGroupe} />
    <div class="bloc" style={{ padding: 0 }}><div class="defile" style={{ maxHeight: '70vh' }}><Tableau lignes={lignes} cols={cols} clic={p => ouvrirFiche(p.id)} tri0={3} /></div></div>
    <p class="doux petit-texte">{lignes.length} personnes affichées sur {v?.total ?? 0}. Cliquez sur un en-tête pour trier.</p>
  </div>;
}

export function EcranParti() {
  const m = useMagasin(); const [parti, setParti] = useState<number>(m.base.parti); const v = useVue('parti', { parti }); const [onglet, setOnglet] = useState('direction'); const dr = m.base.droits;
  const [aff, setAff] = useState<{ dept: number; action: string; part: number }[] | null>(null);
  if (!v) return <div>Chargement...</div>; const terrain = aff ?? v.terrain; const total = terrain.reduce((s: number, t: any) => s + t.part, 0);
  const peut = (dept: number) => v.mien && (dr.terrain === 'tous' || (Array.isArray(dr.terrain) && dr.terrain.includes(dept)));
  const setT = (dept: number, action: string, part: number) => { const l = terrain.filter((t: any) => t.dept !== dept); if (part > 0) l.push({ dept, action, part }); setAff(l); };
  const colsFed: Col<any>[] = [{ titre: 'Département', val: f => f.code, rendu: f => `${f.code} ${f.nom}` }, { titre: 'Adhérents', val: f => f.adherents, droite: true, rendu: f => nb(f.adherents) }, { titre: 'Délégué', val: f => f.delegue?.nom ?? '', rendu: f => <NomPerso p={f.delegue} /> },
    { titre: 'Org.', val: f => f.delegue?.attrs[8] ?? 0, rendu: f => f.delegue ? <Attr v={f.delegue.attrs[8]} /> : '', info: 'Organisation de campagne du délégué', droite: true }, { titre: 'Terrain', val: f => f.delegue?.attrs[4] ?? 0, rendu: f => f.delegue ? <Attr v={f.delegue.attrs[4]} /> : '', droite: true },
    { titre: 'Action de terrain', val: f => terrain.find((t: any) => t.dept === f.dept)?.part ?? 0, rendu: f => { const t = terrain.find((x: any) => x.dept === f.dept); if (!peut(f.dept)) return t ? `${v.actionsTerrain[t.action].nom} (${Math.round(t.part * 100)} %)` : ''; return <span class="ligne" style={{ flexWrap: 'nowrap' }} onClick={(ev: any) => ev.stopPropagation()}><select value={t?.action ?? ''} onChange={(ev: any) => setT(f.dept, ev.target.value, ev.target.value ? (t?.part || 0.05) : 0)}><option value="">Aucune</option>{Object.keys(v.actionsTerrain).map(k => <option value={k}>{v.actionsTerrain[k].nom}</option>)}</select>{t && <input type="number" min="1" max="100" style={{ width: '56px' }} value={Math.round(t.part * 100)} onInput={(ev: any) => setT(f.dept, t.action, Math.max(0, Math.min(100, +ev.target.value || 0)) / 100)} />}{t && '%'}</span>; } }];
  return <div>
    <div class="ligne" style={{ marginBottom: '10px' }}><h1 style={{ margin: 0 }}>{v.nom}</h1><Parti i={v.idx} /><span class="doux">Stratégie : {({ local: 'conquête locale', presidentielle: 'coup présidentiel', union: 'union', isolement: 'isolement' } as any)[v.strategie]}, style {v.style}</span><span class="espace" />
      <select value={parti} onChange={(ev: any) => { setParti(+ev.target.value); setAff(null); }}>{m.base.partis.filter((p: any) => p.actif).map((p: any) => <option value={p.idx}>{p.sigle}{p.idx === m.base.parti ? ' (votre parti)' : ''}</option>)}</select></div>
    <div class="grille g3" style={{ marginBottom: '12px' }}>
      <Bloc titre="Forces"><div class="ligne" style={{ justifyContent: 'space-between' }}><span>Adhérents</span><b>{nb(v.res.adherents)}</b></div><div class="ligne" style={{ justifyContent: 'space-between' }}><span>Militants actifs</span><b>{nb(v.res.militants)}</b></div><div class="ligne" style={{ justifyContent: 'space-between' }}><span>Mouvement jeunes</span><b>{v.jeunes} jeunes talents suivis</b></div><div class="ligne" style={{ justifyContent: 'space-between' }}><span><Info t="La fatigue monte quand trop de militants sont engagés sur le terrain. Elle réduit l'efficacité des actions.">Fatigue militante</Info></span><b>{v.res.fatigue}</b></div>{v.res.unite !== null && <div class="ligne" style={{ justifyContent: 'space-between' }}><span>Unité</span><b>{v.res.unite}</b></div>}<div class="ligne" style={{ justifyContent: 'space-between' }}><span>Prochain congrès</span><b>{v.congres}</b></div></Bloc>
      <Bloc titre="Élus"><div class="ligne" style={{ justifyContent: 'space-between' }}><span>Députés (groupe parlementaire)</span><b>{v.elus.deputes}</b></div><div class="ligne" style={{ justifyContent: 'space-between' }}><span>Sénateurs</span><b>{v.elus.senateurs}</b></div><div class="ligne" style={{ justifyContent: 'space-between' }}><span>Députés européens</span><b>{v.elus.eurodeputes}</b></div><div class="ligne" style={{ justifyContent: 'space-between' }}><span>Mairies (villes et secteurs simulés)</span><b>{v.elus.mairies}</b></div><div class="ligne" style={{ justifyContent: 'space-between' }}><span>Départements</span><b>{v.elus.depts}</b></div><div class="ligne" style={{ justifyContent: 'space-between' }}><span>Régions</span><b>{v.elus.regions}</b></div></Bloc>
      <Bloc titre="Relations avec les autres partis"><div class="defile" style={{ maxHeight: '150px' }}>{v.relations.map((r: any) => <div class="ligne" style={{ justifyContent: 'space-between' }}><Parti i={r.parti} /><span style={{ width: '90px' }}><Jauge v={r.valeur + 100} max={200} /></span><b class={r.valeur >= 35 ? 'ok' : r.valeur <= -30 ? 'danger-t' : ''} style={{ width: '30px', textAlign: 'right' }}>{r.valeur}</b></div>)}</div>
        {v.accords.length > 0 && <div style={{ marginTop: '6px' }}>{v.accords.map((a: any) => <div class="ligne petit-texte">Accord ({a.type}) : {a.partis.map((p: number) => <Parti i={p} />)}{v.mien && dr.alliances && <button class="petit danger" onClick={() => agir({ type: 'rompreAccord', id: a.id })}>Rompre</button>}</div>)}</div>}</Bloc>
    </div>
    <Onglets liste={[['direction', 'Organigramme'], ['federations', 'Fédérations et terrain'], ['courants', 'Courants']]} actif={onglet} choisir={setOnglet} />
    {onglet === 'direction' && <div class="grille g2"><Bloc titre="Direction nationale">
      <div class="ligne" style={{ marginBottom: '8px' }}>{v.chef && <Avatar nom={v.chef.nom} parti={v.idx} taille={44} />}<div><div class="doux petit-texte">Président du parti</div><b><NomPerso p={v.chef} /></b></div></div>
      <table><tbody>{v.bureau.map((x: any) => <tr><td class="doux" style={{ textTransform: 'capitalize' }}>{x.lib}</td><td><NomPerso p={x.perso} /></td><td class="droite">{x.perso && <span class="doux petit-texte">notoriété {x.perso.notoriete}</span>}</td></tr>)}</tbody></table>
      <p class="doux petit-texte" style={{ marginTop: '8px' }}>Le bureau national réunit ces responsables. Le conseil national rassemble les délégués départementaux et les parlementaires. Pour nommer quelqu'un, ouvrez sa fiche.</p></Bloc>
      <Bloc titre="Ligne et programme">{v.axes.map((x: number, i: number) => <div class="ligne" style={{ justifyContent: 'space-between' }}><span class="petit-texte">{m.ref.axes[i].nom}</span><span style={{ width: '120px' }}><Jauge v={x + 5} max={10} couleur={couleurParti(v.idx)} /></span><b style={{ width: '24px', textAlign: 'right' }}>{x > 0 ? '+' : ''}{x}</b></div>)}<p class="petit-texte doux" style={{ marginTop: '6px' }}>{v.propositions.length} propositions phares au programme.</p></Bloc></div>}
    {onglet === 'federations' && <div>
      {v.mien && <div class="ligne" style={{ marginBottom: '8px' }}><span>Militants engagés sur le terrain : <b class={total > 1 ? 'danger-t' : ''}>{Math.round(total * 100)} %</b></span><span class="doux petit-texte">Chaque action renforce l'implantation et la mobilisation dans le département. Trop d'engagement fatigue les militants.</span><span class="espace" />{aff && <button class="principal" onClick={async () => { if (await agir({ type: 'terrain', affectations: aff })) setAff(null); }}>Enregistrer les affectations</button>}</div>}
      <div class="bloc" style={{ padding: 0 }}><div class="defile"><Tableau lignes={v.feds} cols={colsFed} tri0={1} max={120} /></div></div></div>}
    {onglet === 'courants' && <div class="grille g2">{v.courants.length ? v.courants.map((c: any) => <Bloc titre={c.nom}><div>Chef de file : <a onClick={() => ouvrirFiche(c.chef)}>{c.chefNom}</a></div><div>Poids : <b>{Math.round(c.poids * 100)} %</b> des cadres. Veut déplacer la ligne sur l'axe {c.axeNom} ({c.sens > 0 ? 'vers +5' : 'vers -5'}).</div>{c.humeur !== null && <div style={{ marginTop: '6px' }}><span class="petit-texte doux">Humeur {c.humeur}</span><Jauge v={c.humeur} /></div>}</Bloc>) : <div class="bloc doux">Pas de courant organisé pour le moment. Les courants se forment quand des cadres s'écartent nettement de la ligne.</div>}
      <Bloc titre="Comment ça marche"><p class="petit-texte">Les courants naissent des positions personnelles des cadres. Un courant mécontent fait baisser l'unité. Au congrès, tous les trois ans environ, ils présentent des motions. Sous 16 d'unité, la scission menace. <BarreH parts={v.courants.map((c: any, i: number) => ({ parti: v.idx, v: Math.round(c.poids * 100) + i * 0 }))} total={100} /></p></Bloc></div>}
  </div>;
}
