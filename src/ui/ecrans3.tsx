// Écrans : campagne (calendrier, alliances, investitures, budget, entre-deux-tours), mandat, soirée électorale, Panthéon.
import { useEffect, useState } from 'preact/hooks';
import { useMagasin, useVue, agir, aller, maj, ouvrirFiche, Parti, Jauge, Info, Bloc, Onglets, Tableau, Col, euro, nb, pc, couleurParti, Hemicycle, Legende, NomPerso, Attr } from './composants';
import { CarteFrance } from './carte';

const SCRUTINS = ['legislatives', 'municipales', 'regionales', 'europeennes'];
export function Campagne() {
  const m = useMagasin(); const b = m.base; const dr = b.droits; const [onglet, setOnglet] = useState(b.entreDeux.length ? 'entredeux' : 'calendrier'); const [scr, setScr] = useState('legislatives'); const [partiAcc, setPartiAcc] = useState(-1); const [deptM, setDeptM] = useState(0);
  const v = useVue('campagne', onglet === 'investitures' ? { scrutin: scr } : {}); if (!v) return <div>Chargement...</div>;
  const c = v.campagne; const pr = v.presidentielle; const autres = b.partis.filter((p: any) => p.actif && p.idx !== b.parti);
  const colsInv: Col<any>[] = [{ titre: 'Lieu', val: u => u.nom }, { titre: 'Dép.', val: u => u.dept }, { titre: 'Sortant', val: u => u.sortant?.nom ?? '', rendu: u => u.sortant ? <span>{u.sortant.nom} <Parti i={u.sortant.parti} /></span> : '' }, { titre: 'Votre potentiel', val: u => u.force, rendu: u => pc(u.force), droite: true, info: 'Estimation de votre score seul, avec la marge d\'erreur d\'un sondage local.' },
    { titre: 'Votre candidat', val: u => u.candidat?.nom ?? '', rendu: u => u.candidat ? <span><a onClick={() => ouvrirFiche(u.candidat.id)}>{u.candidat.nom}</a> <span class="doux petit-texte">{u.candidat.sexe === 'F' ? 'F' : 'H'}{u.candidat.investi ? '' : ' (sortant)'}</span></span> : <span class="doux">Candidat local sans notoriété</span> }, { titre: 'Qualité', val: u => u.candidat?.qualite ?? -99, rendu: u => u.candidat ? (u.candidat.qualite > 0 ? '+' : '') + u.candidat.qualite : '', droite: true, info: 'Bonus électoral du candidat : terrain, charisme, ancrage, notoriété.' },
    { titre: '', val: () => 0, rendu: u => <span class="ligne" style={{ flexWrap: 'nowrap' }}>{u.suggestion >= 0 && <button class="petit" onClick={() => agir({ type: 'investir', scrutin: scr, uid: u.uid, perso: u.suggestion })}>Investir le meilleur profil</button>}{u.candidat?.investi && <button class="petit" onClick={() => agir({ type: 'investir', scrutin: scr, uid: u.uid, perso: -1 })}>Retirer</button>}</span> }];
  return <div>
    <h1>Campagne</h1>
    <Onglets liste={[['calendrier', 'Calendrier et alliances'], ['investitures', 'Investitures'], ['budget', 'Budget et meetings'], ['presidentielle', 'Présidentielle'], ['entredeux', `Entre-deux-tours${v.entreDeux.length ? ' (en cours)' : ''}`]]} actif={onglet} choisir={setOnglet} />
    {onglet === 'calendrier' && <div class="grille g21">
      <Bloc titre="Prochaines échéances"><table><thead><tr><th>Scrutin</th><th>Premier tour</th><th>Second tour</th><th>Votre ligne</th><th>Accords</th></tr></thead><tbody>{v.calendrier.map((x: any) => <tr><td><b>{x.nom}</b>{x.serie ? ` (série ${x.serie})` : ''}{x.ouverte && !x.fait1 && <span class="badge" style={{ marginLeft: '6px' }}>campagne</span>}</td><td>{x.date}{x.dans > 0 && <span class="doux petit-texte"> (dans {x.dans} sem.)</span>}</td><td>{x.date2}</td>
        <td>{x.type !== 'senatoriales' && x.type !== 'presidentielle' && <select value={x.politique} disabled={!dr.alliances} onChange={(ev: any) => agir({ type: 'politiqueAlliance', scrutin: x.type, valeur: ev.target.value }, true)}><option value="seul">Autonomie</option><option value="union">Union avec les partis proches</option><option value="partout">Autonomie, candidats partout</option></select>}</td>
        <td>{x.accords.map((a: any) => <span class="ligne" style={{ flexWrap: 'nowrap' }}>{a.partis.map((p: number) => <Parti i={p} />)}{a.mien && dr.alliances && <button class="petit danger" onClick={() => agir({ type: 'rompreAccord', id: a.id })}>Rompre</button>}</span>)}</td></tr>)}</tbody></table>
        <p class="doux petit-texte" style={{ marginTop: '8px' }}>Autonomie : vous présentez vos candidats là où vous pesez. Union : listes communes avec les partis dont la relation dépasse 35 (le mieux placé mène la liste). Un accord négocié fixe la répartition à l'avance. Un accord rapporte des sièges mais coûte en identité. Rompre un accord dégrade durablement les relations.</p></Bloc>
      <Bloc titre="Proposer un accord">{!dr.alliances && <p class="alerte petit-texte">Réservé au président du parti et au secrétaire aux élections.</p>}
        <div class="ligne"><select value={scr} onChange={(ev: any) => setScr(ev.target.value)}>{['legislatives', 'regionales', 'europeennes', 'presidentielle'].map(s => <option value={s}>{({ legislatives: 'Législatives', regionales: 'Régionales', europeennes: 'Européennes', presidentielle: 'Présidentielle (soutien à votre candidat)' } as any)[s]}</option>)}</select>
          <select value={partiAcc} onChange={(ev: any) => setPartiAcc(+ev.target.value)}><option value={-1}>Choisir un parti</option>{autres.map((p: any) => <option value={p.idx}>{p.sigle}</option>)}</select>
          <button disabled={!dr.alliances || partiAcc < 0} onClick={() => agir({ type: 'proposerAccord', scrutin: scr, parti: partiAcc })}>Proposer (5 de capital)</button></div>
        <p class="doux petit-texte" style={{ marginTop: '6px' }}>La réponse dépend de la relation entre vos partis, de l'écart doctrinal, de leur stratégie et de votre réputation (trahisons passées).</p>
        {b.mode === 'carriere' && <><h3 style={{ marginTop: '12px' }}>Votre investiture</h3><p class="petit-texte">Votre estime dans le parti : <b>{v.estime}</b>. Plus elle est haute, plus la commission d'investiture vous suit.</p>
          <div class="choix" style={{ marginTop: 0 }}>{[['municipales', 'tete', 'Tête de liste aux municipales (votre ville)'], ['municipales', 'liste', 'Une place sur la liste municipale'], ['departementales', 'tete', 'Candidat aux départementales (votre canton)'], ['legislatives', 'tete', 'Candidat aux législatives (votre circonscription)'], ['regionales', 'liste', 'Une place éligible aux régionales'], ['regionales', 'tete', 'Tête de liste régionale'], ['europeennes', 'liste', 'Une place éligible aux européennes']].map(([s, p, n]) => <button onClick={() => agir({ type: 'demanderInvestiture', scrutin: s, place: p })}>{n}</button>)}</div></>}
      </Bloc>
    </div>}
    {onglet === 'investitures' && <div>
      <div class="ligne" style={{ marginBottom: '8px' }}><select value={scr} onChange={(ev: any) => setScr(ev.target.value)}>{SCRUTINS.map(s => <option value={s}>{({ legislatives: 'Législatives', municipales: 'Municipales (villes de plus de 30 000 habitants et vos mairies)', regionales: 'Régionales', europeennes: 'Européennes' } as any)[s]}</option>)}</select>
        {v.investitures && <><span>Parité : <b class={Math.abs(v.investitures.femmes - v.investitures.hommes) > (v.investitures.femmes + v.investitures.hommes) * 0.1 ? 'alerte' : 'ok'}>{v.investitures.femmes} femmes, {v.investitures.hommes} hommes</b></span><Info t="Aux législatives, un écart entre le nombre de candidates et de candidats réduit la première fraction du financement public (150 % de l'écart).">Règle de parité</Info></>}
        <span class="espace" /><button class="principal" disabled={!dr.investitures} onClick={() => agir({ type: 'investirAuto', scrutin: scr })}>Suggestions automatiques</button></div>
      {!dr.investitures && <p class="alerte petit-texte">Les investitures sont décidées par la direction du parti (président, secrétaire aux élections). Un délégué départemental décide des investitures locales de son département.</p>}
      <p class="doux petit-texte">Les sortants de votre parti sont reconduits par défaut. Sans investiture, un candidat local sans notoriété porte vos couleurs. Investir quelqu'un à la place d'un sortant crée un conflit : le sortant perd le moral. Un candidat venu d'un autre département est un parachuté.</p>
      <div class="bloc" style={{ padding: 0 }}><div class="defile" style={{ maxHeight: '64vh' }}>{v.investitures ? <Tableau lignes={v.investitures.unites} cols={colsInv} tri0={3} max={600} /> : <p style={{ padding: '10px' }}>Chargement...</p>}</div></div>
    </div>}
    {onglet === 'budget' && <div class="grille g2">
      <Bloc titre={c ? `Budget : ${c.nom}` : 'Budget de campagne'}>{c ? <>
        <div class="ligne" style={{ justifyContent: 'space-between' }}><span>Budget total</span><b class={c.total > c.plafond ? 'danger-t' : ''}>{euro(c.total)}</b></div>
        <input type="range" min="0" max={Math.round(c.plafond * 1.2)} step={Math.max(1000, Math.round(c.plafond / 200))} value={c.total} disabled={!dr.finances} style={{ width: '100%' }} onChange={(ev: any) => agir({ type: 'budgetCampagne', total: +ev.target.value }, true)} />
        <div class="ligne petit-texte" style={{ justifyContent: 'space-between' }}><span>Déjà dépensé : {euro(c.depense)}</span><span><Info t="Au-delà du plafond légal, le compte de campagne est rejeté : pas de remboursement et risque d'inéligibilité.">Plafond légal</Info> : {euro(c.plafond)}</span><span>Trésorerie : {euro(v.tresorerie)}</span></div>
        <h3 style={{ marginTop: '10px' }}>Répartition</h3>{[['meetings', 'Meetings', 'Mobilisation forte, surtout dans les départements ciblés.'], ['affichage', 'Affichage', 'Notoriété et implantation.'], ['tracts', 'Tracts', 'Mobilisation et implantation.'], ['numerique', 'Numérique', 'Viralité, électorat jeune.'], ['sondages', 'Sondages', 'Études d\'opinion internes.']].map(([k, n, info]) => <div class="ligne"><span style={{ width: '90px' }}><Info t={info}>{n}</Info></span><input type="range" min="0" max="100" value={Math.round(c[k] * 100)} disabled={!dr.finances} onChange={(ev: any) => agir({ type: 'budgetCampagne', [k]: +ev.target.value / 100 }, true)} /><b>{Math.round(c[k] * 100)} %</b></div>)}
        <h3 style={{ marginTop: '10px' }}>Départements ciblés ({c.cibles.length}/15)</h3><div class="ligne"><select id="cible-sel">{v.depts.map((x: any) => <option value={x.idx}>{x.code} {x.nom}</option>)}</select><button class="petit" disabled={!dr.finances} onClick={() => { const i = +(document.getElementById('cible-sel') as HTMLSelectElement).value; if (!c.cibles.includes(i)) agir({ type: 'budgetCampagne', cibles: [...c.cibles, i] }, true); }}>Ajouter</button><button class="petit" disabled={!dr.finances} onClick={() => agir({ type: 'budgetCampagne', cibles: [] }, true)}>Tout retirer</button></div>
        <div class="petit-texte">{c.cibles.map((i: number) => v.depts.find((x: any) => x.idx === i)?.nom).join(', ')}</div></> : <p class="doux">Aucune campagne ouverte. Le budget se règle à l'ouverture de chaque campagne, de 6 à 12 semaines avant le scrutin.</p>}</Bloc>
      <Bloc titre="Agenda des meetings"><p class="petit-texte doux">Un meeting par semaine. Il mobilise fortement le département, renforce la dynamique et fatigue l'orateur. Coût : 35 k€ et plus selon la population.</p>
        <div class="ligne"><select value={deptM} onChange={(ev: any) => setDeptM(+ev.target.value)}>{v.depts.map((x: any) => <option value={x.idx}>{x.code} {x.nom}</option>)}</select><button class="principal" onClick={() => agir({ type: 'meeting', dept: deptM })}>Tenir un meeting</button></div>
        <div style={{ height: '330px', marginTop: '8px' }}><CarteFrance couche="implantation" clic={(code: string) => { const x = v.depts.find((y: any) => y.code === code); if (x) setDeptM(x.idx); }} choisi={v.depts.find((x: any) => x.idx === deptM)?.code} /></div>
        <p class="doux petit-texte">La carte montre votre mobilisation et votre implantation acquises. Cliquez sur un département pour le choisir.</p></Bloc>
    </div>}
    {onglet === 'presidentielle' && <div class="grille g2">
      <Bloc titre="Votre candidat"><p>{pr.candidat ? <b><NomPerso p={pr.candidat} /></b> : <span class="doux">Aucun candidat désigné.</span>}</p>
        <div class="ligne" style={{ justifyContent: 'space-between' }}><span><Info t="Il faut 500 parrainages d'élus (maires, parlementaires, conseillers départementaux et régionaux) validés cinq semaines avant le premier tour.">Parrainages</Info></span><b class={pr.parrainages >= 500 ? 'ok' : ''}>{pr.parrainages} / 500</b></div><Jauge v={pr.parrainages} max={500} />
        <p class="petit-texte doux" style={{ marginTop: '4px' }}>Vivier d'élus favorables : {nb(pr.vivier)}. Il dépend de vos élus, des maires ruraux proches de vous et de votre crédibilité.</p>
        <div class="ligne"><span>Effort de démarchage des maires</span><input type="range" min="0" max="100" value={Math.round(pr.effort * 100)} disabled={!dr.tout} onChange={(ev: any) => agir({ type: 'effortParrainages', valeur: +ev.target.value / 100 }, true)} /><b>{Math.round(pr.effort * 100)} %</b></div><p class="petit-texte doux">Un effort élevé accélère la collecte mais fatigue les militants.</p>
        {pr.soutiens.length > 0 && <p>Partis qui soutiennent votre candidat : {pr.soutiens.map((p: number) => <Parti i={p} />)}</p>}
        <h3 style={{ marginTop: '10px' }}>Désignation</h3>{!dr.tout && <p class="alerte petit-texte">Réservé au président du parti.</p>}
        <table><tbody>{pr.figures.map((f: any) => <tr><td><NomPerso p={f} /></td><td class="droite doux petit-texte">notoriété {f.notoriete}</td><td class="droite"><Attr v={f.charisme} /></td><td><button class="petit" disabled={!dr.tout} onClick={() => agir({ type: 'candidatPres', perso: f.id })}>Désigner</button></td></tr>)}</tbody></table>
        <div class="ligne" style={{ marginTop: '6px' }}><button disabled={!dr.tout || !pr.figures.length} onClick={() => agir({ type: 'candidatPres', perso: pr.figures[0].id, primaire: true })}>Organiser une primaire (150 k€)</button><button disabled={!dr.tout} onClick={() => agir({ type: 'candidatPres', perso: -1 })}>Ne pas présenter de candidat</button></div></Bloc>
      <Bloc titre="Les autres candidats">{pr.autres.length ? <table><tbody>{pr.autres.sort((x: any, y: any) => y.parrainages - x.parrainages).map((a: any) => <tr><td><Parti i={a.parti} /></td><td><NomPerso p={a} /></td><td class="droite">{a.parrainages} parrainages</td></tr>)}</tbody></table> : <p class="doux">Les candidats se déclarent environ neuf mois avant le scrutin.</p>}
        <h3 style={{ marginTop: '10px' }}>Consigne de vote au second tour</h3><p class="petit-texte doux">Si votre candidat est éliminé, votre consigne oriente une partie de vos électeurs.</p>
        <select value={v.consigne ?? -1} disabled={!dr.tout} onChange={(ev: any) => agir({ type: 'consigne', valeur: +ev.target.value }, true)}><option value={-1}>Pas de consigne (selon les affinités)</option><option value={-2}>Ni l'un ni l'autre</option>{autres.map((p: any) => <option value={p.idx}>Appeler à voter {p.sigle}</option>)}</select></Bloc>
    </div>}
    {onglet === 'entredeux' && <div>{v.entreDeux.length === 0 && <div class="bloc doux">Pas d'entre-deux-tours en cours. Cet écran s'active après chaque premier tour : désistements aux législatives et départementales, fusions de listes aux municipales et régionales, consigne de vote.</div>}
      {v.entreDeux.map((ed: any) => <div class="bloc" style={{ marginBottom: '12px' }}><div class="ligne"><h2 style={{ margin: 0 }}>{ed.nom} : second tour le {ed.date2}</h2><span class="espace" /><span class="doux">{ed.total} lieux où vous êtes concerné</span></div>
        {!dr.investitures && <p class="alerte petit-texte">Les désistements et fusions sont décidés par la direction du parti.</p>}
        {ed.type === 'presidentielle' ? <p>{b.grandDebat ? <button class="principal" onClick={() => aller('medias')}>Aller au grand débat</button> : 'La consigne de vote se règle dans l\'onglet Présidentielle.'}</p> :
          <div class="defile" style={{ maxHeight: '60vh' }}><table><thead><tr><th>Lieu</th><th>Votre score</th><th>Rang</th><th>Candidats ou listes</th><th>Décision</th></tr></thead><tbody>{ed.unites.map((u: any) => <tr><td><b>{u.nom}</b></td><td>{pc(u.part)}</td><td>{u.rang}e</td>
            <td class="petit-texte">{u.lignes.map((l: any) => <span style={{ marginRight: '8px', opacity: l.maintenu ? 1 : 0.5 }}><Parti i={l.parti} /> {pc(l.pct)}</span>)}</td>
            <td>{u.liste ? <select value={u.fusion} disabled={!dr.investitures} onChange={(ev: any) => agir({ type: 'fusion', scrutin: ed.type, uid: u.uid, cible: +ev.target.value })}><option value={-1}>{u.maintenu ? 'Maintien de la liste' : 'Pas de fusion (liste éliminée)'}</option>{u.lignes.filter((l: any) => l.maintenu && l.i !== u.moi).map((l: any) => <option value={l.i}>Fusionner avec {b.partis[l.parti].sigle}</option>)}</select>
              : <label><input type="checkbox" checked={u.desiste} disabled={!dr.investitures} onChange={(ev: any) => agir({ type: 'desister', scrutin: ed.type, uid: u.uid, on: ev.target.checked }, true)} /> Se désister</label>}</td></tr>)}</tbody></table></div>}
      </div>)}</div>}
  </div>;
}

export function Mandat() {
  const v = useVue('mandat'); const inst = useVue('institutions'); const m = useMagasin(); const b = m.base; const [adj, setAdj] = useState(-1); const [del, setDel] = useState('Finances');
  if (!v || !inst) return <div>Chargement...</div>; const M = v.mairie, C = v.conseil;
  return <div>
    <h1>Exercice du mandat</h1>
    {v.mandats.length > 0 && <p>Vos mandats : {v.mandats.map((x: any) => `${x.type}${x.lieu ? ' (' + x.lieu + ')' : ''}`).join(', ')}</p>}
    {!M && !C && !v.estDepute && !v.presidence && <div class="bloc doux">Vous n'exercez aucun mandat exécutif ou parlementaire pour le moment. Cet écran s'active quand vous dirigez une mairie, un département, une région, quand vous siégez à l'Assemblée ou quand votre camp tient l'Élysée.</div>}
    <div class="grille g2">
      {M && <Bloc titre={`Mairie de ${M.ville}`}>
        <div class="ligne" style={{ justifyContent: 'space-between' }}><span><Info t="Le bilan pèse lourd sur votre réélection. Il monte avec les projets, de bons adjoints et un climat apaisé au conseil.">Bilan</Info></span><b>{M.bilan}/100</b></div><Jauge v={M.bilan} />
        <div class="ligne" style={{ justifyContent: 'space-between', marginTop: '6px' }}><span>Budget d'investissement disponible</span><b>{euro(M.budget)}</b></div>
        <div class="ligne"><span><Info t="Plus d'impôts, c'est plus de recettes chaque mois mais un bilan qui baisse.">Fiscalité locale</Info></span><input type="range" min="20" max="80" value={M.impots} onChange={(ev: any) => agir({ type: 'impots', niveau: +ev.target.value })} /><b>{M.impots}</b></div>
        <h3 style={{ marginTop: '8px' }}>Projets</h3><table><tbody>{M.projets.map((p: any, i: number) => <tr><td>{p.nom}</td><td style={{ width: '90px' }}><Jauge v={p.niveau} max={5} couleur="var(--accent)" /></td><td class="droite">{p.niveau < 5 ? euro(p.cout) : 'maximum'}</td><td><button class="petit" disabled={p.niveau >= 5 || M.budget < p.cout} onClick={() => agir({ type: 'projet', cat: i })}>Lancer</button></td></tr>)}</tbody></table>
        <h3 style={{ marginTop: '8px' }}>Adjoints et délégations</h3>{M.adjoints.map((a: any) => <div class="ligne petit-texte" style={{ justifyContent: 'space-between' }}><a onClick={() => ouvrirFiche(a.perso)}>{a.nom}</a><span>{a.delegation} (gestion {a.gestion})</span></div>)}
        <div class="ligne" style={{ marginTop: '4px' }}><select value={adj} onChange={(ev: any) => setAdj(+ev.target.value)}><option value={-1}>Choisir un élu de votre majorité</option>{M.equipe.map((p: any) => <option value={p.id}>{p.nom} (gestion {p.attrs[6]}, dossiers {p.attrs[5]})</option>)}</select><select value={del} onChange={(ev: any) => setDel(ev.target.value)}>{v.delegations.map((x: string) => <option>{x}</option>)}</select><button class="petit" onClick={() => agir({ type: 'adjoint', perso: adj, delegation: del })}>{M.equipe.length ? 'Nommer' : 'Constituer l\'équipe'}</button></div>
        <h3 style={{ marginTop: '8px' }}>Conseil municipal</h3><Legende sieges={M.sieges} />
        <div class="ligne" style={{ marginTop: '6px' }}><span style={{ flex: 1 }}><span class="petit-texte doux">Relations avec l'opposition {M.opposition}</span><Jauge v={M.opposition} /></span><button class="petit" onClick={() => agir({ type: 'dialoguer', cible: 'opposition' })}>Recevoir l'opposition</button></div>
        <div class="ligne" style={{ marginTop: '4px' }}><span style={{ flex: 1 }}><span class="petit-texte doux">Poids dans l'intercommunalité {M.interco}</span><Jauge v={M.interco} /></span><button class="petit" onClick={() => agir({ type: 'dialoguer', cible: 'interco' })}>Négocier à l'intercommunalité</button></div>
      </Bloc>}
      {C && <Bloc titre={`${C.type === 'dept' ? 'Conseil départemental' : 'Conseil régional'} : ${C.nom}`}>
        <div class="ligne" style={{ justifyContent: 'space-between' }}><span>Bilan</span><b>{C.bilan}/100</b></div><Jauge v={C.bilan} /><div class="ligne" style={{ justifyContent: 'space-between', marginTop: '6px' }}><span>Budget disponible</span><b>{euro(C.budget)}</b></div>
        <h3 style={{ marginTop: '8px' }}>Grandes compétences</h3><table><tbody>{C.projets.map((p: any, i: number) => <tr><td>{p.nom}</td><td style={{ width: '90px' }}><Jauge v={p.niveau} max={5} couleur="var(--accent)" /></td><td class="droite">{p.niveau < 5 ? euro(p.cout) : 'maximum'}</td><td><button class="petit" disabled={p.niveau >= 5 || C.budget < p.cout} onClick={() => agir({ type: 'projetConseil', cat: i })}>Lancer</button></td></tr>)}</tbody></table><h3 style={{ marginTop: '8px' }}>Assemblée</h3><Legende sieges={C.sieges} /></Bloc>}
      {v.estDepute && <Bloc titre="Assemblée nationale">
        <p class="petit-texte">{b.mode === 'parti' ? `Votre groupe : ${v.deputes} députés.` : 'Vous siégez à l\'Assemblée.'} {v.majorite ? 'Vous êtes dans la majorité : vos textes ont de bonnes chances.' : 'Vous êtes dans l\'opposition : vos textes passent rarement, mais ils pèsent dans le débat.'} Une initiative par semaine. Initiatives menées : {v.activite}.</p>
        <div class="choix" style={{ marginTop: 0 }}>{Object.keys(v.actionsParlement).map(k => <button onClick={() => agir({ type: 'parlement', valeur: k })}><b>{v.actionsParlement[k].nom}</b><small>{v.actionsParlement[k].desc} Coût : {v.actionsParlement[k].forme} de forme{v.actionsParlement[k].capital ? `, ${v.actionsParlement[k].capital} de capital politique` : ''}.</small></button>)}</div>
        <div style={{ marginTop: '8px' }}><Hemicycle sieges={inst.assemblee} taille={260} /></div></Bloc>}
      {v.presidence && <Bloc titre="Présidence de la République"><div class="grand">{v.presidence.popularite} %</div><p class="doux">de popularité. À l'Élysée depuis le {v.presidence.depuis}.</p><Jauge v={v.presidence.popularite} />
        <p style={{ marginTop: '8px' }}>Les grandes réformes arrivent sous forme de décisions dans la boîte de réception. Vos choix jouent sur la popularité, qui pèse sur les élections suivantes de votre camp. Décisions de référendum prises : {v.presidence.reformes}.</p><p class="doux petit-texte">Mode Président simplifié. La composition du gouvernement, le 49.3 et la dissolution arriveront dans une version ultérieure.</p></Bloc>}
    </div>
  </div>;
}

// Soirée électorale animée : estimations à 20 h, résultats qui tombent lieu par lieu, carte qui se colore, réactions.
export function Soiree() {
  const s = useVue('soiree'); const m = useMagasin(); const [t, setT] = useState(0); const b = m.base;
  useEffect(() => { const i = setInterval(() => setT(x => x + 1), 450); return () => clearInterval(i); }, []);
  if (!s) return null;
  const phase = t < 6 ? 0 : t < 12 ? 1 : 2; const lieux: any[] = s.lieux ?? []; const nL = Math.min(lieux.length, Math.max(0, Math.round((t - 12) * Math.max(1, lieux.length / 40)))); const fini = t >= 12 + 42;
  const lignes: any[] = phase === 0 ? [] : (fini ? s.final : s.estimation); const max = Math.max(1, ...lignes.map((l: any) => l.pct));
  const ids = Object.keys(s.carte.couleurs); const nC = fini ? ids.length : Math.round(ids.length * Math.min(1, Math.max(0, (t - 12) / 40))); const coul: Record<string, number> = {}; ids.slice(0, nC).forEach(k => coul[k] = s.carte.couleurs[k]);
  return <div class="voile"><div class="modale" style={{ width: 'min(1180px, 97vw)' }}>
    <div class="ligne"><h1 style={{ margin: 0 }}>{s.titre}</h1><span class="espace" />{!fini && <button onClick={() => setT(999)}>Passer</button>}<button class="principal" onClick={() => maj({ soiree: false })}>Fermer</button></div>
    {phase === 0 && <div class="centre" style={{ padding: '60px 0' }}><div class="doux">Les bureaux de vote ferment dans les grandes villes.</div><div class="grand" style={{ fontSize: '54px' }}>19:59:{String(54 + t).padStart(2, '0')}</div></div>}
    {phase > 0 && <div class="grille g2" style={{ marginTop: '10px' }}>
      <div>
        <h3>{fini ? 'Résultats définitifs' : 'Estimation de 20 heures'} : participation {pc(s.participation * 100)}</h3>
        {lignes.slice(0, 12).map((l: any) => <div class="soiree-ligne"><span>{l.nom} {l.partis.slice(0, 3).map((p: number) => <Parti i={p} />)}</span><div><div class="soiree-barre" style={{ width: `${phase === 1 && t < 8 ? 0 : 100 * l.pct / max}%`, background: couleurParti(l.partis[0]) }} /></div><b class="droite">{pc(l.pct)}</b><span class="droite">{fini && l.sieges !== undefined ? <b>{l.sieges}</b> : ''}{fini && l.elu ? <b class="ok">élu</b> : ''}{fini && l.qualifie ? <span class="ok">2e tour</span> : ''}</span></div>)}
        {fini && s.sieges && s.type === 'legislatives' && <div style={{ marginTop: '10px' }}><Hemicycle sieges={s.sieges} /><Legende sieges={s.sieges} /></div>}
        {fini && s.explication && <div class="bloc" style={{ marginTop: '10px' }}><h3>Pourquoi ce résultat</h3><p class="pre petit-texte">{s.explication}</p></div>}
        {fini && <div style={{ marginTop: '10px' }}><h3>Réactions</h3>{s.reactions.map((r: any) => <p class="petit-texte"><Parti i={r.parti} /> <b>{r.perso}</b> : « {r.texte} »</p>)}</div>}
      </div>
      <div>
        {ids.length > 0 && s.carte.niveau !== 'circo' && <div style={{ height: '340px' }}><CarteFrance couleurs={coul} niveau={s.carte.niveau} /></div>}
        {lieux.length > 0 && <div><h3 style={{ marginTop: '8px' }}>Les résultats tombent ({fini ? lieux.length : nL}/{lieux.length})</h3><div class="defile" style={{ maxHeight: s.carte.niveau === 'circo' ? '520px' : '230px' }}><table><tbody>{lieux.slice(0, fini ? lieux.length : nL).reverse().slice(0, 140).map((l: any) => <tr><td><b>{l.lieu}</b></td><td class="petit-texte">{l.lignes.slice(0, 3).map((x: any) => <span style={{ marginRight: '8px' }}><Parti i={x.partis[0]} /> {pc(x.pct)}{x.elu ? ' élu' : ''}</span>)}</td></tr>)}</tbody></table></div></div>}
      </div>
    </div>}
    <div style={{ display: 'none' }}>{b.date}</div>
  </div></div>;
}

export function Pantheon() {
  const p = useVue('pantheon'); const m = useMagasin(); if (!p) return <div>Chargement...</div>;
  const coul: Record<string, number> = {}; for (const k of Object.keys(p.carte)) if (p.carte[k] > 0) coul[k] = m.base.parti;
  return <div style={{ maxWidth: '980px', margin: '0 auto' }}>
    <div class="bloc">
      <h1 style={{ fontSize: '28px', marginBottom: '2px' }}>{p.titre}</h1><div class="doux">{p.sousTitre}. Période : {p.periode}.</div>
      {p.fin && <p style={{ marginTop: '8px' }}><b>{p.fin.titre}.</b> {p.fin.texte}</p>}
      <div class="grille g21" style={{ marginTop: '12px' }}>
        <div>
          <h3>Score</h3><div class="grand">{p.score} points</div>
          <h3 style={{ marginTop: '10px' }}>Victoires</h3>{m.base.victoires.map((v: any) => <div class={v.acquis ? 'ok' : 'doux'}>{v.acquis ? 'Obtenue' : 'Non obtenue'} : <b>{v.nom}</b> ({v.points} points). <span class="petit-texte">{v.desc}</span></div>)}
          <p class="petit-texte doux">Années au premier plan : {String(m.base.premierPlan).replace('.', ',')}. Hégémonie culturelle : {m.base.culture}/100.</p>
          <h3 style={{ marginTop: '10px' }}>Records</h3>{p.records.map((r: string) => <div>{r}</div>)}<div>Accords rompus et changements de camp : {p.trahisons}</div>
          {p.mandatsActuels.length > 0 && <><h3 style={{ marginTop: '10px' }}>Mandats en cours</h3><div>{p.mandatsActuels.join(', ')}</div></>}
        </div>
        <div><h3>Carte des victoires</h3><div style={{ height: '260px' }}><CarteFrance couleurs={coul} niveau="dept" /></div><p class="petit-texte doux">Départements où votre camp détient au moins un siège ou une ville.</p></div>
      </div>
      {p.mandats.length > 0 && <><h3 style={{ marginTop: '12px' }}>Parcours</h3><div class="defile" style={{ maxHeight: '220px' }}>{p.mandats.map((x: any) => <div><span class="doux petit-texte">{x.date}</span> {x.texte}</div>)}</div></>}
      {p.citations.length > 0 && <><h3 style={{ marginTop: '12px' }}>Citations et moments marquants</h3>{p.citations.map((c: string) => <div class="petit-texte">{c}</div>)}</>}
      <h3 style={{ marginTop: '12px' }}>Élections traversées</h3><div class="defile" style={{ maxHeight: '260px' }}><table><tbody>{p.elections.map((x: any) => <tr><td><b>{x.titre}</b></td><td class="petit-texte" style={{ whiteSpace: 'normal' }}>{x.resume}</td><td class="droite">{x.joueur !== undefined ? x.joueur : ''}</td></tr>)}</tbody></table></div>
    </div>
    <div style={{ display: 'none' }}>{nb(0)}{String(Onglets.length)}{String(Tableau.length)}</div>
  </div>;
}
