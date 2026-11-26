// Écrans : finances, doctrine, médias, historique.
import { useState } from 'preact/hooks';
import { useMagasin, useVue, agir, aller, Parti, Jauge, Info, Bloc, Onglets, Courbes, euro, nb, pc, couleurParti, Hemicycle, Legende, NomPerso, Champ, maj } from './composants';

const FLUX: [string, string, string][] = [['cotisations', 'Cotisations', 'Adhérents x cotisation annuelle / 12.'], ['dons', 'Dons', 'Selon le nombre d\'adhérents, la notoriété et la dynamique. Plus élevés en période de campagne.'], ['public', 'Financement public', 'Première fraction : 1,64 € par voix au premier tour des législatives (si 1 % des voix dans au moins 50 circonscriptions). Seconde fraction : 37 400 € par parlementaire. Versé par douzièmes.'], ['elus', 'Reversements d\'élus', 'Contribution des parlementaires, maires et conseillers.'], ['permanents', 'Permanents', '4 200 € par permanent et par mois.'], ['locaux', 'Locaux', 'Siège et fédérations dotées d\'un délégué.'], ['com', 'Communication', 'Budget mensuel de communication : entretient la notoriété.'], ['formation', 'Formation', 'Budget mensuel de formation : accélère la progression des cadres.'], ['prets', 'Remboursement des prêts', 'Mensualités des emprunts en cours.']];

export function Finances() {
  const v = useVue('finances'); const m = useMagasin(); const dr = m.base.droits; const [pret, setPret] = useState(500000);
  if (!v) return <div>Chargement...</div>;
  return <div>
    <h1>Finances</h1>
    <div class="grille g3" style={{ marginBottom: '12px' }}>
      <Bloc titre="Trésorerie"><div class={`grand ${v.tresorerie < 0 ? 'danger-t' : ''}`}>{euro(v.tresorerie)}</div><div class={v.net >= 0 ? 'ok' : 'danger-t'}>{v.net >= 0 ? '+' : ''}{euro(v.net)} par mois hors campagnes</div><div class="doux petit-texte" style={{ marginTop: '4px' }}>Capacité d'emprunt : {euro(v.capacite)}</div></Bloc>
      <Bloc titre="Financement public annuel"><div class="grand">{euro(v.financementPublic)}</div><div class="petit-texte doux">{nb(v.voixLeg)} voix aux législatives, {v.parlementaires} parlementaires.{v.pariteRetenue > 0 && <span class="alerte"> Retenue pour non-respect de la parité des candidatures : {euro(v.pariteRetenue)}.</span>}</div></Bloc>
      <Bloc titre="Prévision à 12 mois"><Courbes series={[{ nom: 'Trésorerie', couleur: 'var(--accent)', points: v.prevision.map((y: number, i: number) => [i, y]) }]} hauteur={90} min0={false} /></Bloc>
    </div>
    <div class="grille g2">
      <Bloc titre="Flux mensuels"><table><tbody>{FLUX.map(([k, n, info]) => <tr><td><Info t={info}>{n}</Info></td><td class={`droite ${v.flux[k] >= 0 ? 'ok' : ''}`}>{v.flux[k] > 0 ? '+' : ''}{euro(v.flux[k])}</td></tr>)}
        <tr><td><b>Solde mensuel</b></td><td class={`droite ${v.net >= 0 ? 'ok' : 'danger-t'}`}><b>{euro(v.net)}</b></td></tr>
        {(v.dernier.campagnePrec ?? 0) !== 0 && <tr><td>Dépenses de campagne le mois dernier</td><td class="droite">{euro(v.dernier.campagnePrec)}</td></tr>}{(v.dernier.remboursementPrec ?? 0) !== 0 && <tr><td>Remboursements de l'État le mois dernier</td><td class="droite ok">+{euro(v.dernier.remboursementPrec)}</td></tr>}</tbody></table></Bloc>
      <Bloc titre="Réglages">{!dr.finances && <p class="alerte petit-texte">Seul le trésorier ou le président du parti peut modifier ces réglages.</p>}
        <Champ lib="Cotisation annuelle" info="Une cotisation plus élevée rapporte plus par adhérent, mais une hausse fait partir une partie des adhérents."><input type="range" min="5" max="120" value={v.cotisation} disabled={!dr.finances} onChange={(ev: any) => agir({ type: 'finances', cotisation: +ev.target.value }, true)} /> <b>{v.cotisation} €</b></Champ>
        <Champ lib="Permanents" info="Les permanents font tourner le parti. Ils coûtent 4 200 € par mois chacun."><input type="number" min="0" max="400" value={v.permanents} disabled={!dr.finances} style={{ width: '70px' }} onChange={(ev: any) => agir({ type: 'finances', permanents: +ev.target.value }, true)} /></Champ>
        <Champ lib="Communication (par mois)"><input type="range" min="0" max="400000" step="5000" value={v.budgetCom} disabled={!dr.finances} onChange={(ev: any) => agir({ type: 'finances', budgetCom: +ev.target.value }, true)} /> <b>{euro(v.budgetCom)}</b></Champ>
        <Champ lib="Formation (par mois)"><input type="range" min="0" max="150000" step="5000" value={v.budgetFormation} disabled={!dr.finances} onChange={(ev: any) => agir({ type: 'finances', budgetFormation: +ev.target.value }, true)} /> <b>{euro(v.budgetFormation)}</b></Champ>
        <h3 style={{ marginTop: '10px' }}>Crédit bancaire</h3><div class="ligne"><input type="number" step="50000" min="50000" value={pret} style={{ width: '110px' }} onInput={(ev: any) => setPret(+ev.target.value || 0)} /> €<button disabled={!dr.finances} onClick={() => agir({ type: 'emprunter', montant: pret, mois: 60 })}>Emprunter sur 5 ans</button></div>
        <p class="doux petit-texte">L'accès au crédit dépend du financement public, du nombre d'adhérents, de la crédibilité et de la dynamique.</p>
        {v.prets.map((p: any) => <div class="petit-texte">Prêt de {euro(p.montant)} : reste {euro(p.restant)}, {euro(p.mensualite)} par mois pendant {p.fin} mois</div>)}</Bloc>
      <Bloc titre="Historique de trésorerie"><Courbes series={[{ nom: 'Trésorerie', couleur: 'var(--ok)', points: v.hist.map((y: number, i: number) => [i, y]) }]} min0={false} /></Bloc>
      <Bloc titre="Comptes de campagne"><p class="doux petit-texte">Chaque campagne a un plafond légal. Le compte est contrôlé six mois après le scrutin. En cas de rejet : pas de remboursement, et risque d'inéligibilité.</p>
        <table><thead><tr><th>Scrutin</th><th class="droite">Dépenses</th><th class="droite">Plafond</th><th>Statut</th><th class="droite">Remboursé</th></tr></thead><tbody>{v.comptes.slice().reverse().map((c: any) => <tr><td>{c.nom}</td><td class={`droite ${c.depenses > c.plafond ? 'danger-t' : ''}`}>{euro(c.depenses)}</td><td class="droite">{euro(c.plafond)}</td><td class={c.statut === 'rejete' ? 'danger-t' : c.statut === 'valide' ? 'ok' : ''}>{({ en_cours: 'En cours', depose: 'Déposé, en attente de contrôle', valide: 'Validé', rejete: 'Rejeté' } as any)[c.statut]}</td><td class="droite">{c.rembourse ? euro(c.rembourse) : ''}</td></tr>)}</tbody></table></Bloc>
    </div>
  </div>;
}

export function Doctrine() {
  const v = useVue('doctrine'); const m = useMagasin(); const dr = m.base.droits; const [axe, setAxe] = useState('tous'); const [filtre, setFiltre] = useState('dispo');
  if (!v) return <div>Chargement...</div>;
  const props = v.propositions.filter((p: any) => (axe === 'tous' || p.axe === axe) && (filtre === 'toutes' || (filtre === 'dispo' ? p.etat.ok : filtre === 'programme' ? p.etat.adoptee : true)));
  return <div>
    <div class="ligne" style={{ marginBottom: '10px' }}><h1 style={{ margin: 0 }}>Doctrine</h1><span class="espace" /><span>Capital politique <b>{v.capital}</b></span><span>Crédibilité <b>{v.credibilite}</b></span><span><Info t="Vous gagnez 10 points chaque fois qu'un autre parti reprend une de vos propositions. À 100 points : victoire culturelle.">Hégémonie culturelle</Info> <b>{v.culture}</b>/100</span></div>
    {!dr.doctrine && <p class="alerte">La ligne du parti se décide à la direction (président ou secrétaire au projet). Vous pouvez la consulter.</p>}
    <div class="grille g21">
      <Bloc titre="Les dix axes">
        <p class="doux petit-texte">Chaque axe va de -5 à +5. Bouger d'un cran coûte {v.axes[0].cout.capital} de capital politique et {String(v.axes[0].cout.credibilite).replace('.', ',')} de crédibilité. Le coût monte si vous bougez souvent (mouvements récents : {String(v.mouvements).replace('.', ',')}). Les cadres en désaccord peuvent partir.</p>
        {v.axes.map((a: any, i: number) => <div style={{ marginBottom: '10px' }}>
          <div class="ligne"><b>{a.nom}</b><span class="espace" /><button class="petit" disabled={!dr.doctrine || a.pos <= -5} onClick={() => agir({ type: 'bougerAxe', axe: i, delta: -1 })}>-1</button><b style={{ width: '26px', textAlign: 'center' }}>{a.pos > 0 ? '+' : ''}{a.pos}</b><button class="petit" disabled={!dr.doctrine || a.pos >= 5} onClick={() => agir({ type: 'bougerAxe', axe: i, delta: 1 })}>+1</button></div>
          <svg viewBox="0 0 440 26" style={{ width: '100%', height: '26px' }}><line x1="20" x2="420" y1="13" y2="13" stroke="var(--bord)" stroke-width="2" />{Array.from({ length: 11 }, (_, k) => <line x1={20 + k * 40} x2={20 + k * 40} y1="9" y2="17" stroke="var(--bord)" />)}
            {a.autres.map((o: any, k: number) => <circle cx={20 + (o.pos + 5) * 40 + ((k % 5) - 2) * 3} cy={7 + (k % 3) * 6} r="3.5" fill={couleurParti(o.parti)} opacity="0.85"><title>{m.base.partis[o.parti].sigle} : {o.pos}</title></circle>)}
            <rect x={20 + (a.pos + 5) * 40 - 5} y="3" width="10" height="20" rx="2" fill={couleurParti(m.base.parti)} stroke="#fff" stroke-width="1.5"><title>Votre parti : {a.pos}</title></rect></svg>
          <div class="ligne petit-texte doux" style={{ justifyContent: 'space-between' }}><span>{a.poleMoins}</span><span>{a.polePlus}</span></div></div>)}
      </Bloc>
      <Bloc titre="Priorités de l'opinion"><p class="doux petit-texte">L'actualité fait monter ou descendre les thèmes. Plus un thème compte, plus votre position sur les axes liés pèse dans le vote.</p>{v.priorites.map((p: any) => <div class="ligne" style={{ justifyContent: 'space-between' }}><span>{p.nom}</span><span style={{ width: '110px' }}><Jauge v={p.v} max={6} couleur="var(--accent)" /></span></div>)}</Bloc>
    </div>
    <div class="bloc" style={{ marginTop: '12px' }}>
      <div class="ligne" style={{ marginBottom: '8px' }}><h3 style={{ margin: 0 }}>Propositions phares</h3><span class="espace" /><select value={filtre} onChange={(ev: any) => setFiltre(ev.target.value)}><option value="dispo">Disponibles</option><option value="programme">À votre programme</option><option value="toutes">Toutes</option></select><select value={axe} onChange={(ev: any) => setAxe(ev.target.value)}><option value="tous">Tous les axes</option>{v.axes.map((a: any) => <option value={a.id}>{a.nom}</option>)}</select></div>
      <div class="defile"><table><thead><tr><th>Proposition</th><th>Axe</th><th>Thème</th><th>Attire</th><th>Repousse</th><th>Déjà portée par</th><th class="droite">Coût</th><th></th></tr></thead><tbody>
        {props.map((p: any) => <tr><td><b>{p.nom}</b></td><td>{p.axeNom} ({p.pole > 0 ? '+' : '-'}{p.positionRequise})</td><td>{p.themeNom}</td><td class="ok petit-texte">{p.attire.join(', ')}</td><td class="danger-t petit-texte">{p.repousse.join(', ')}</td><td>{p.chez.map((q: number) => <Parti i={q} />)}</td><td class="droite">{p.coutCapital}</td>
          <td>{p.etat.adoptee ? <span class="ok">Au programme</span> : p.etat.ok ? <button class="petit principal" disabled={!dr.doctrine} onClick={() => agir({ type: 'adopter', id: p.id })}>Adopter</button> : <span class="doux petit-texte">{p.etat.raison}</span>}</td></tr>)}
        {props.length === 0 && <tr><td colSpan={8} class="doux">Aucune proposition dans ce filtre.</td></tr>}</tbody></table></div>
    </div>
  </div>;
}

export function Medias() {
  const v = useVue('medias'); const m = useMagasin(); const b = m.base; const dr = b.droits; const [onglet, setOnglet] = useState('direct');
  if (!v) return <div>Chargement...</div>; const D = v.debat; const actifs = b.partis.filter((p: any) => p.actif);
  const dernier = v.hist[v.hist.length - 1]; const top = dernier ? actifs.slice().sort((x: any, y: any) => (dernier.v[y.idx] ?? 0) - (dernier.v[x.idx] ?? 0)).slice(0, 9) : [];
  return <div>
    <h1>Médias et opinion</h1>
    <Onglets liste={[['direct', D && !D.fini ? 'Entretien en cours' : 'Plateaux'], ['sondages', 'Sondages'], ['paysage', 'Paysage médiatique']]} actif={onglet} choisir={setOnglet} />
    {onglet === 'direct' && <div class="grille g21">
      <div class="grille" style={{ alignContent: 'start' }}>
        {b.grandDebat && !D && <Bloc titre="Grand débat de l'entre-deux-tours"><p>Votre candidat est au second tour. Le débat télévisé peut déplacer jusqu'à quatre points. Huit échanges, face à votre adversaire.</p><button class="principal" onClick={() => agir({ type: 'grandDebat' })}>Entrer sur le plateau</button></Bloc>}
        {D ? <Bloc titre={D.type === 'grand_debat' ? 'Grand débat présidentiel' : D.type === 'debat' ? `Débat : ${D.mediaNom}` : `Entretien : ${D.mediaNom}`}>
          <div class="ligne" style={{ marginBottom: '8px' }}><b>{D.persoNom}</b><span class="grand">{D.score.toFixed(1).replace('.', ',')}</span>{D.adversaire >= 0 && <><span class="doux">contre</span><span class="grand">{D.scoreAdv.toFixed(1).replace('.', ',')}</span><b>{D.advNom}</b><Parti i={D.advParti} /></>}<span class="espace" /><span class="doux">Question {Math.min(D.tour + 1, D.questions.length)}/{D.questions.length}</span></div>
          {!D.fini && <><p style={{ fontSize: '16px' }}>« {D.questions[D.tour].texte} »</p><div class="choix">{v.reponses.map((r: any, i: number) => <button onClick={() => agir({ type: 'debat', rep: i })}><b>{r.nom}</b><small>{r.desc} Attribut sollicité : {r.attr}.</small></button>)}</div></>}
          {D.fini && <div><p class="ok">Terminé.</p><button class="principal" onClick={() => agir({ type: 'fermerDebat' }, true)}>Quitter le plateau</button></div>}
          {D.journal.length > 0 && <div style={{ marginTop: '10px' }}><h3>Déroulé</h3>{D.journal.slice().reverse().map((l: string) => <p class="petit-texte">{l}</p>)}</div>}
        </Bloc> : !b.grandDebat && <Bloc titre="Plateaux"><p class="doux">Aucun entretien en cours. Les invitations arrivent dans la boîte de réception, plus souvent quand le parti est connu ou fait l'actualité.</p>{v.porteParole && <p>Porte-parole : <NomPerso p={v.porteParole} /> (médias {v.porteParole.attrs[2]}, débat {v.porteParole.attrs[1]}, éloquence {v.porteParole.attrs[0]})</p>}</Bloc>}
      </div>
      <Bloc titre="Réseaux sociaux">
        <div class="ligne" style={{ justifyContent: 'space-between' }}><span><Info t="Jauge de viralité : monte avec les publications réussies et les campagnes numériques, retombe vite. Elle nourrit la notoriété et touche surtout les jeunes.">Viralité</Info></span><b>{String(v.viralite).replace('.', ',')}</b></div><Jauge v={v.viralite} max={20} couleur="var(--accent)" />
        <div class="ligne" style={{ justifyContent: 'space-between', marginTop: '6px' }}><span><Info t="Les gaffes laissent des traces : elles pèsent sur la crédibilité pendant des mois.">Passif de gaffes</Info></span><b class={v.gaffes > 2 ? 'danger-t' : ''}>{String(v.gaffes).replace('.', ',')}</b></div>
        <p class="doux petit-texte" style={{ marginTop: '10px' }}>Les publications se font désormais sur Agora, le réseau social du jeu.</p><button onClick={() => aller('agora')}>Ouvrir Agora</button>
      </Bloc>
    </div>}
    {onglet === 'sondages' && <div class="grille g21">
      <Bloc titre="Intentions de vote aux législatives (sondages publiés)"><Courbes series={top.map((p: any) => ({ nom: p.sigle, couleur: p.couleur, points: v.hist.map((h: any) => [h.s, h.v[p.idx] ?? 0]) }))} hauteur={260} unite=" %" /><div class="ligne petit-texte">{top.map((p: any) => <span><Parti i={p.idx} /> {pc(dernier.v[p.idx] ?? 0)}</span>)}</div>
        <div class="ligne" style={{ marginTop: '10px' }}><button onClick={() => agir({ type: 'commanderSondage', dept: -1 })}>Commander un sondage national (28 k€)</button><button onClick={() => agir({ type: 'commanderSondage', pres: true })}>Sondage présidentielle (32 k€)</button><select id="sond-dept">{m.ref.depts.map((x: any, i: number) => <option value={i}>{x.code} {x.nom}</option>)}</select><button onClick={() => agir({ type: 'commanderSondage', dept: +(document.getElementById('sond-dept') as HTMLSelectElement).value })}>Sondage départemental (9 k€)</button></div><p class="doux petit-texte">Les sondages publics ont une marge d'erreur et parfois un biais selon l'institut. Un sondage commandé est plus précis. Le résultat s'affiche dans la boîte de réception.</p></Bloc>
      <Bloc titre="Dernières publications"><div class="defile">{v.sondages.map((s: any) => <div style={{ marginBottom: '8px' }}><b>{s.institut}</b> <span class="doux petit-texte">{s.date}, {s.type === 'presidentielle' ? 'présidentielle' : 'législatives'}{s.zone ? ', ' + s.zone : ''}{s.commande ? ', confidentiel' : ''}, marge {String(s.marge).replace('.', ',')}</span><div class="petit-texte">{actifs.filter((p: any) => s.scores[p.idx] >= 2).sort((x: any, y: any) => s.scores[y.idx] - s.scores[x.idx]).slice(0, 8).map((p: any) => `${p.sigle} ${String(s.scores[p.idx]).replace('.', ',')}`).join(', ')}</div></div>)}</div></Bloc>
    </div>}
    {onglet === 'paysage' && <div class="bloc" style={{ padding: 0 }}><div class="defile" style={{ maxHeight: '72vh' }}><table><thead><tr><th>Média</th><th>Type</th><th class="droite">Audience</th><th>Orientation</th><th>Ton</th><th>Publics touchés</th></tr></thead><tbody>{v.medias.map((x: any) => <tr><td><b>{x.nom}</b></td><td>{({ tele: 'Télévision', radio: 'Radio', presse: 'Presse', web: 'Web' } as any)[x.type]}{x.regions ? ' régionale' : ''}</td><td class="droite">{nb(x.audience * 1000)}</td><td><span style={{ display: 'inline-block', width: '90px' }}><Jauge v={x.orientation + 2} max={4} couleur="var(--doux)" /></span> <span class="doux petit-texte">{x.orientation < -0.7 ? 'à gauche' : x.orientation > 0.7 ? 'à droite' : 'centrale'}</span></td><td>{['Institutionnel', 'Vif', 'Polémique'][x.ton]}</td><td class="petit-texte">{x.cibles.join(', ')}</td></tr>)}</tbody></table></div></div>}
  </div>;
}

export function Historique() {
  const v = useVue('historique'); const inst = useVue('institutions'); const m = useMagasin(); const [onglet, setOnglet] = useState('institutions'); const [sel, setSel] = useState(0);
  if (!v || !inst) return <div>Chargement...</div>; const a = v.archives[sel];
  const TYPES: Record<string, string> = { presidentielle: '#e74c3c', legislatives: '#3498db', municipales: '#2ecc71', europeennes: '#f1c40f', regionales: '#9b59b6', departementales: '#e67e22', senatoriales: '#95a5a6' };
  return <div>
    <h1>Historique et archives</h1>
    <Onglets liste={[['institutions', 'Rapport de forces'], ['elections', 'Élections'], ['journal', 'Journal'], ['abstention', 'Abstention']]} actif={onglet} choisir={setOnglet} />
    {onglet === 'institutions' && <div class="grille g2">
      <Bloc titre="Assemblée nationale (577 sièges)"><Hemicycle sieges={inst.assemblee} /><Legende sieges={inst.assemblee} /><p class="petit-texte doux" style={{ marginTop: '6px' }}>Gouvernement : {inst.gouvernement.coalition.map((p: number) => <Parti i={p} />)} {inst.gouvernement.pmNom && `Premier ministre : ${inst.gouvernement.pmNom}`}</p></Bloc>
      <Bloc titre="Sénat (348 sièges)"><Hemicycle sieges={inst.senat} /><Legende sieges={inst.senat} /></Bloc>
      <Bloc titre="Exécutif">{inst.president && <p>Président de la République : <NomPerso p={{ id: inst.president.id, nom: inst.president.nom }} /> <Parti i={inst.president.parti} />, depuis le {inst.president.depuis}. Popularité : {inst.president.popularite} %.</p>}<h3>Parlement européen (81 sièges français)</h3><Legende sieges={inst.europe} /></Bloc>
      <Bloc titre="Pouvoir local"><h3>Villes de plus de 30 000 habitants</h3><Legende sieges={inst.grandesVilles} /><h3 style={{ marginTop: '8px' }}>Toutes les villes simulées</h3><Legende sieges={inst.mairies} /><h3 style={{ marginTop: '8px' }}>Départements</h3><Legende sieges={inst.depts} /><h3 style={{ marginTop: '8px' }}>Régions</h3>{inst.regionsDetail.map((r: any) => <div class="ligne petit-texte" style={{ justifyContent: 'space-between' }}><span>{r.nom}</span><span><NomPerso p={{ id: r.id, nom: r.president }} /> <Parti i={r.parti} /></span></div>)}</Bloc>
    </div>}
    {onglet === 'elections' && <div class="grille g12">
      <div class="bloc" style={{ padding: 0 }}><div class="defile" style={{ maxHeight: '72vh' }}>{v.archives.map((x: any, i: number) => <div class={`msg ${i === sel ? 'choisi' : ''}`} onClick={() => setSel(i)}><b>{x.titre}</b><div class="doux petit-texte">{x.date}</div></div>)}{v.archives.length === 0 && <p class="doux" style={{ padding: '10px' }}>Aucune élection pour l'instant.</p>}</div></div>
      {a ? <Bloc titre={a.titre}><p>{a.resume}. Participation : {pc(a.participation * 100)}.</p>
        {a.sieges && a.type === 'legislatives' && <><Hemicycle sieges={a.sieges} /><Legende sieges={a.sieges} /></>}
        <table style={{ marginTop: '8px' }}><thead><tr><th>Liste ou candidat</th><th></th><th class="droite">Voix</th><th class="droite">%</th>{a.national.some((l: any) => l.sieges !== undefined) && <th class="droite">{a.type === 'municipales' ? 'Villes' : a.type === 'departementales' ? 'Départements' : a.type === 'regionales' ? 'Régions' : 'Sièges'}</th>}</tr></thead><tbody>{a.national.slice(0, 16).map((l: any) => <tr><td>{l.nom}{l.elu && <b class="ok"> élu</b>}{l.qualifie && <span class="ok"> qualifié</span>}</td><td>{l.partis.map((p: number) => <Parti i={p} />)}</td><td class="droite">{nb(l.voix)}</td><td class="droite">{pc(l.pct)}</td>{l.sieges !== undefined && <td class="droite"><b>{l.sieges}</b></td>}</tr>)}</tbody></table>
        {a.explicationJoueur && <><h3 style={{ marginTop: '10px' }}>Pourquoi ce résultat</h3><p class="pre">{a.explicationJoueur}</p></>}</Bloc> : <div class="bloc doux">Sélectionnez une élection.</div>}
    </div>}
    {onglet === 'journal' && <Bloc titre="Journal politique"><div class="defile" style={{ maxHeight: '72vh' }}>{v.journal.map((x: any) => <div><span class="doux petit-texte">{x.date}</span> {x.t}</div>)}</div></Bloc>}
    {onglet === 'abstention' && <Bloc titre="Abstention par scrutin (%)"><Courbes series={Object.keys(TYPES).map(t => ({ nom: t, couleur: TYPES[t], points: v.abstention.filter((x: any) => x.type === t).map((x: any) => [x.s, x.v] as [number, number]) })).filter(s => s.points.length > 1)} hauteur={280} unite=" %" /><div class="ligne petit-texte">{Object.keys(TYPES).map(t => <span><span class="pastille" style={{ background: TYPES[t] }}>{t}</span></span>)}</div><table style={{ marginTop: '8px' }}><tbody>{v.abstention.slice().reverse().slice(0, 30).map((x: any) => <tr><td>{x.type}</td><td class="droite">{pc(x.v)}</td></tr>)}</tbody></table></Bloc>}
    <div style={{ display: 'none' }}>{String(maj.length)}{String(aller.length)}</div>
  </div>;
}
