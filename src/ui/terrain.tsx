// Terrain : quartiers, équipe de militants, campagne locale, incidents et mini-jeux.
import { useState } from 'preact/hooks';
import { useMagasin, useVue, agir, nb, Bloc, Jauge, toast, moteurAction } from './composants';
import { discuter, assistantActif } from './assistant';

const SCRUTINS: Record<string, string> = { municipales: 'municipales', departementales: 'départementales', regionales: 'régionales', legislatives: 'législatives', europeennes: 'européennes', senatoriales: 'sénatoriales', presidentielle: 'présidentielle' };
const couleurNiveau = (v: number) => v >= 60 ? 'var(--ok)' : v >= 30 ? 'var(--accent-t)' : 'var(--alerte)';

function Porte({ J, themes }: { J: any; themes: string[] }) {
  const p = J.portes[Math.min(J.i, J.portes.length - 1)]; const dernier = J.i > 0 ? J.portes[J.i - 1] : null;
  return <div>
    <div class="ligne" style={{ marginBottom: '8px' }}>{J.portes.map((x: any, i: number) => <span class="petit-texte" style={{ padding: '2px 10px', borderRadius: '980px', background: i === J.i && !J.fini ? 'var(--accent)' : 'var(--fond3)', color: i === J.i && !J.fini ? '#fff' : 'var(--doux)' }}>Porte {i + 1}</span>)}</div>
    {dernier && <p class="doux">{dernier.resultat}</p>}
    {!J.fini && <div>
      <p><b>{p.qui}.</b> Il a l'air {p.humeur}. Sur le palier, une conversation vous laisse penser que son sujet du moment est : <b>{p.indice.toLowerCase()}</b>. Rien de sûr.</p>
      <p class="doux petit-texte">De quoi lui parlez-vous ?</p>
      <div class="choix">{p.options.map((o: number) => <button onClick={() => agir({ type: 'jeuChoix', choix: o }, true)}>{themes[o]}</button>)}<button onClick={() => agir({ type: 'jeuChoix', choix: -1 }, true)}>L'écouter, sans chercher à convaincre<small>Sans risque, petit gain</small></button></div>
    </div>}
  </div>;
}
function Tractage({ J }: { J: any }) {
  return <div>
    <p>Trois créneaux pour l'équipe cette semaine. Choisissez où et quand distribuer. Il en reste {J.restants}.</p>
    <table><thead><tr><th>Lieu</th><th>Affluence</th><th>Public attendu</th><th></th></tr></thead><tbody>{J.spots.map((s: any, i: number) => <tr class={s.choisi ? 'choisi' : ''}><td>{s.nom}</td><td>{'●'.repeat(s.affluence)}<span class="doux">{'●'.repeat(5 - s.affluence)}</span></td><td>{s.public}</td><td class="droite">{s.choisi ? <span class="doux">choisi</span> : <button class="petit" disabled={J.restants <= 0} onClick={() => agir({ type: 'jeuChoix', choix: i })}>Y aller</button>}</td></tr>)}</tbody></table>
  </div>;
}
function Depouillement({ b }: { b: any }) {
  const [vus, setVus] = useState(b.annonce ? b.bureaux.length : 0); const tot = b.bureaux.length; const visibles = b.bureaux.slice(0, vus); const enTete = visibles.filter((x: any) => x.enTete).length;
  const moy = visibles.length ? visibles.reduce((s: number, x: any) => s + x.score, 0) / visibles.length : 0;
  return <Bloc titre={`Soir de vote : ${SCRUTINS[b.type] ?? b.type}`}>
    <p>Les bureaux de votre secteur remontent un par un. Vous pouvez prendre la parole à tout moment : plus tôt vous parlez, plus on vous écoute, à condition de ne pas vous tromper.</p>
    <div class="ligne" style={{ gap: '20px', margin: '8px 0' }}><div><div class="grand">{vus}/{tot}</div><div class="doux petit-texte">bureaux dépouillés</div></div><div><div class="grand">{vus ? String(Math.round(moy * 10) / 10).replace('.', ',') : '-'} %</div><div class="doux petit-texte">moyenne provisoire (départ de campagne : {String(b.ref).replace('.', ',')} %)</div></div><div><div class="grand">{enTete}/{vus}</div><div class="doux petit-texte">bureaux où vous êtes en tête</div></div></div>
    <div class="defile" style={{ maxHeight: '220px' }}><table><tbody>{visibles.map((x: any) => <tr><td>{x.nom}</td><td class="droite"><b>{String(x.score).replace('.', ',')} %</b></td><td class={x.enTete ? 'ok' : 'doux'}>{x.enTete ? 'en tête' : 'devancé'}</td></tr>)}</tbody></table></div>
    {!b.annonce && <div class="ligne" style={{ marginTop: '10px' }}><button class="principal" disabled={vus >= tot} onClick={() => setVus(vus + 1)}>Bureau suivant</button><button disabled={vus === 0} onClick={() => agir({ type: 'equipeAnnonce', vus, enTete: true })}>Annoncer : nous sommes en tête</button><button disabled={vus === 0} onClick={() => agir({ type: 'equipeAnnonce', vus, enTete: false })}>Annoncer : nous ne sommes pas en tête</button><span class="espace" /><button class="petit" onClick={() => agir({ type: 'equipeBilanVu' }, true)}>Ne rien dire</button></div>}
    {b.annonce && <div style={{ marginTop: '10px' }}><p class={b.annonce.juste ? 'ok' : 'danger-t'}><b>{b.annonce.juste ? 'Vous aviez vu juste.' : 'Vous vous êtes trompé.'}</b> Résultat final dans le secteur : {String(b.score).replace('.', ',')} %, {b.rang === 1 ? 'en tête' : `${b.rang}e position`}.</p><button onClick={() => agir({ type: 'equipeBilanVu' }, true)}>Fermer</button></div>}
  </Bloc>;
}

// Discussion avec un militant : trois sujets écrits, et la discussion libre si un assistant est branché.
function Discussion({ m, v, fermer }: { m: any; v: any; fermer: () => void }) {
  const [fil, setFil] = useState<{ moi: boolean; t: string }[]>([]); const [txt, setTxt] = useState(''); const [attente, setAttente] = useState(false);
  const sujet = async (k: string, q: string) => { const r = await moteurAction({ type: 'equipeParler', id: m.id, sujet: k }); if (r.ok === false) { toast(r.texte, false); return; } setFil(f => [...f, { moi: true, t: q }, { moi: false, t: r.texte }]); };
  const libre = async () => { const q = txt.trim(); if (!q) return; setTxt(''); setAttente(true); setFil(f => [...f, { moi: true, t: q }]);
    try { const rep = await discuter({ nom: `${m.prenom} ${m.nom}`, age: m.age, caractere: m.caractere, etat: `motivation ${m.motiv} sur 100, fatigue ${m.fatigue} sur 100, mission : ${v.actions[m.action]?.nom}${m.quartier >= 0 ? ' à ' + v.quartiers[m.quartier].nom : ''}`, lieu: v.lieu, parti: v.parti, historique: fil, message: q }); setFil(f => [...f, { moi: false, t: rep }]); moteurAction({ type: 'equipeParler', id: m.id, sujet: 'libre' }); }
    catch (err: any) { toast(`Assistant injoignable (${err?.message ?? 'erreur'}).`, false); } setAttente(false); };
  return <div class="voile" onClick={fermer}><div class="modale" style={{ width: 'min(640px, 94vw)' }} onClick={(ev: any) => ev.stopPropagation()}>
    <div class="ligne"><h2 style={{ margin: 0 }}>{m.prenom} {m.nom}</h2><span class="doux">{m.age} ans, {m.caractere}</span><span class="espace" /><button onClick={fermer}>Fermer</button></div>
    <div style={{ minHeight: '120px', margin: '12px 0', display: 'grid', gap: '8px' }}>{fil.length === 0 && <p class="doux">De quoi voulez-vous parler ?</p>}{fil.map(h => <div style={{ justifySelf: h.moi ? 'end' : 'start', maxWidth: '85%', padding: '8px 12px', borderRadius: '14px', background: h.moi ? 'var(--accent)' : 'var(--fond3)', color: h.moi ? '#fff' : 'var(--texte)' }}>{h.t}</div>)}{attente && <div class="doux">{m.prenom} écrit...</div>}</div>
    <div class="ligne"><button onClick={() => sujet('nouvelles', 'Comment ça va, toi ?')}>Prendre des nouvelles</button><button onClick={() => sujet('quartier', 'Qu\'est-ce qu\'on te dit, sur le terrain ?')}>Ce qui se dit dans le quartier</button><button onClick={() => sujet('effort', 'J\'ai besoin de toi ce week-end.')}>Demander un effort</button></div>
    {assistantActif() ? <div class="ligne" style={{ marginTop: '10px' }}><input type="text" style={{ flex: 1 }} maxLength={300} placeholder="Écrire librement..." value={txt} onInput={(ev: any) => setTxt(ev.target.value)} onKeyDown={(ev: any) => { if (ev.key === 'Enter') libre(); }} /><button class="principal" disabled={attente} onClick={libre}>Envoyer</button></div>
      : <p class="doux petit-texte" style={{ marginTop: '10px' }}>La discussion libre demande un assistant d'écriture (menu du jeu). Sans lui, trois sujets sont proposés, une fois par semaine et par personne.</p>}
  </div></div>;
}

export function Terrain() {
  useMagasin(); const v = useVue('equipe'); const [q, setQ] = useState(0); const [former, setFormer] = useState<Record<number, number>>({}); const [parle, setParle] = useState<number>(-1);
  if (!v) return <div>Chargement...</div>; const J = v.jeu; const c = v.campagne;
  const aff = (m: any, action: string, quartier: number) => agir({ type: 'equipeAffecter', id: m.id, action, quartier: quartier < 0 ? 0 : quartier, cible: former[m.id] ?? 0 }, true);
  const mp = v.membres.find((m: any) => m.id === parle);
  return <div>
    {mp && <Discussion m={mp} v={v} fermer={() => setParle(-1)} />}
    <h1>Terrain</h1>
    <p class="doux" style={{ marginTop: '-8px' }}>{v.lieu}. {v.dirige ? 'Vous dirigez l\'équipe.' : 'Vous êtes militant de la section. Le responsable organise l\'équipe, vous choisissez vos sorties.'}</p>
    <div class="grille" style={{ gap: '14px' }}>
      {v.bilan && <Depouillement b={v.bilan} />}
      {c && <Bloc titre={`Campagne des ${SCRUTINS[c.type] ?? c.type}`}>
        <div class="ligne" style={{ gap: '24px', alignItems: 'flex-start' }}><div><div class="grand">J-{c.dans * 7}</div><div class="doux petit-texte">premier tour le {c.date}</div></div><div style={{ minWidth: '160px' }}><b>Élan : {c.elan}</b><Jauge v={Math.min(100, c.elan * 3)} /><div class="doux petit-texte">Il retombe chaque semaine. Les temps forts le relancent.</div></div><div class="doux petit-texte">Score du parti dans le secteur<br />au départ de la campagne : <b style={{ color: 'var(--texte)' }}>{String(c.ref).replace('.', ',')} %</b></div></div>
        {v.dirige && <div class="ligne" style={{ marginTop: '10px' }}>{Object.keys(v.tempsForts).map(k => { const T = v.tempsForts[k]; const fait = c.temps[k]; const ouvert = c.dans <= T.fenetre[0] && c.dans >= T.fenetre[1]; return <button disabled={fait || !ouvert} title={T.desc} onClick={() => agir({ type: 'equipeTemps', quoi: k })}>{T.nom}{fait ? ' (fait)' : ouvert ? ` (${T.prix} €, ${T.besoin} militants)` : ` (entre ${T.fenetre[0]} et ${T.fenetre[1]} sem. avant)`}</button>; })}</div>}
      </Bloc>}
      {v.incident && v.dirige && <Bloc titre={`À régler : ${v.incident.titre}`}><p>{v.incident.texte}</p><div class="choix">{v.incident.choix.map((x: any, i: number) => <button onClick={() => agir({ type: 'equipeIncident', choix: i })}>{x.t}</button>)}</div></Bloc>}
      <div class="grille g21">
        <Bloc titre="Sortir cette semaine">
          {!J && <div><p>Une sortie de chaque type par semaine. Vous y allez vous-même : le résultat dépend de vos choix.</p>
            <div class="ligne"><select aria-label="Quartier" value={q} onChange={(ev: any) => setQ(+ev.target.value)}>{v.quartiers.map((x: any) => <option value={x.i}>{x.nom}</option>)}</select>
              <button class="principal" disabled={v.jeux.porte} onClick={() => agir({ type: 'jeuDemarrer', jeu: 'porte', quartier: q }, true)}>Porte-à-porte{v.jeux.porte ? ' (fait)' : ''}</button>
              <button disabled={v.jeux.tractage} onClick={() => agir({ type: 'jeuDemarrer', jeu: 'tractage', quartier: q }, true)}>Tractage{v.jeux.tractage ? ' (fait)' : ''}</button></div>
            <p class="doux petit-texte" style={{ marginTop: '6px' }}>{v.quartiers[q].profil}. Accueil pour votre parti : {v.quartiers[q].accueil > 20 ? 'favorable' : v.quartiers[q].accueil > -20 ? 'partagé' : 'difficile'}.</p></div>}
          {J && <div><h2>{J.type === 'porte' ? 'Porte-à-porte' : 'Tractage'}, {v.quartiers[J.quartier].nom}</h2>{J.type === 'porte' ? <Porte J={J} themes={v.themes} /> : <Tractage J={J} />}{J.fini && <div style={{ marginTop: '10px' }}><p><b>{J.bilan}</b></p><button class="principal" onClick={() => agir({ type: 'jeuFermer' }, true)}>Rentrer</button></div>}</div>}
        </Bloc>
        <Bloc titre="Section">
          <table><tbody><tr><td>Caisse</td><td class="droite"><b>{nb(v.caisse)} €</b></td></tr><tr><td>Tracts</td><td class="droite">{nb(v.tracts)}</td></tr><tr><td>Affiches</td><td class="droite">{nb(v.affiches)}</td></tr><tr><td>Militants</td><td class="droite">{v.membres.length}{v.dirige ? ` / ${v.plafond}` : ''}</td></tr></tbody></table>
          {v.commandes.map((k: any) => <div class="doux petit-texte">En commande : {nb(k.qte)} {k.quoi}, dans {k.dans} semaine{k.dans > 1 ? 's' : ''}</div>)}
          {v.dirige && <div class="ligne" style={{ marginTop: '8px' }}>{Object.keys(v.materiel).map(k => <button class="petit" onClick={() => agir({ type: 'equipeCommander', quoi: k })}>{v.materiel[k].nom} ({v.materiel[k].prix} €)</button>)}<button class="petit" onClick={() => agir({ type: 'equipeConvivial' })}>Apéritif de section (80 €)</button></div>}
        </Bloc>
      </div>
      <Bloc titre="Quartiers">
        <table><thead><tr><th>Quartier</th><th>Profil</th><th>Accueil</th><th style={{ width: '180px' }}>Ancrage</th><th class="droite">Contacts</th><th class="droite">Militants</th></tr></thead>
          <tbody>{v.quartiers.map((x: any) => <tr><td><b>{x.nom}</b></td><td class="doux" style={{ whiteSpace: 'normal' }}>{x.profil}</td><td class={x.accueil > 20 ? 'ok' : x.accueil > -20 ? '' : 'alerte'}>{x.accueil > 20 ? 'favorable' : x.accueil > -20 ? 'partagé' : 'difficile'}</td><td><div class="ligne" style={{ flexWrap: 'nowrap' }}><div style={{ flex: 1 }}><Jauge v={x.ancrage} couleur={couleurNiveau(x.ancrage)} /></div><span style={{ width: '26px' }} class="droite">{x.ancrage}</span></div></td><td class="droite">{nb(x.contacts)}</td><td class="droite">{x.effectif}</td></tr>)}</tbody></table>
      </Bloc>
      <Bloc titre={v.dirige ? 'Votre équipe' : 'Les militants de la section'}>
        {v.dirige && <div class="ligne" style={{ marginBottom: '8px' }}><label class="ligne"><input type="checkbox" checked={v.auto} onChange={(ev: any) => agir({ type: 'equipeAuto', valeur: ev.target.checked })} /> Laisser mon bras droit répartir l'équipe chaque semaine</label><span class="espace" /><button class="petit" onClick={() => agir({ type: 'equipeRepartir' })}>Répartir maintenant</button></div>}
        <div class="defile"><table><thead><tr><th>Nom</th><th>Âge</th>{v.comps.map((k: string) => <th class="droite">{k}</th>)}<th>Dispo</th><th style={{ width: '90px' }}>Motivation</th><th style={{ width: '90px' }}>Fatigue</th><th>Mission</th><th></th></tr></thead>
          <tbody>{v.membres.map((m: any) => <tr>
            <td><b>{m.prenom} {m.nom}</b>{m.lieutenant && <span class="badge" style={{ marginLeft: '6px' }}>bras droit</span>}<div class="doux petit-texte">{m.caractere}, depuis {m.anciennete} sem.</div></td><td>{m.age}</td>
            {m.comp.map((k: number) => <td class="droite"><span class={`attr ${k >= 15 ? 'a4' : k >= 11 ? 'a3' : k >= 7 ? 'a2' : 'a1'}`}>{k}</span></td>)}
            <td>{m.dispo} demi-j.</td><td><Jauge v={m.motiv} couleur={couleurNiveau(m.motiv)} /></td><td><Jauge v={m.fatigue} couleur={m.fatigue > 70 ? 'var(--danger)' : 'var(--doux)'} /></td>
            <td>{v.dirige ? <span class="ligne" style={{ flexWrap: 'nowrap' }}><select aria-label="Mission" value={m.action} onChange={(ev: any) => aff(m, ev.target.value, m.quartier)}>{Object.keys(v.actions).map(k => <option value={k}>{v.actions[k].nom}</option>)}</select>
              {m.action === 'formation' ? <select aria-label="Compétence" value={former[m.id] ?? m.cible ?? 0} onChange={(ev: any) => { setFormer({ ...former, [m.id]: +ev.target.value }); agir({ type: 'equipeAffecter', id: m.id, action: 'formation', quartier: 0, cible: +ev.target.value }, true); }}>{v.comps.map((k: string, i: number) => <option value={i}>{k}</option>)}</select>
                : m.action !== 'repos' && <select aria-label="Quartier" value={m.quartier} onChange={(ev: any) => aff(m, m.action, +ev.target.value)}>{v.quartiers.map((x: any) => <option value={x.i}>{x.nom}</option>)}</select>}</span>
              : <span>{v.actions[m.action]?.nom}{m.quartier >= 0 ? `, ${v.quartiers[m.quartier].nom}` : ''}</span>}</td>
            {!v.dirige && <td class="droite"><button class="petit" onClick={() => setParle(m.id)}>Parler</button></td>}
            {v.dirige && <td class="droite"><button class="petit" onClick={() => setParle(m.id)}>Parler</button> <button class="petit" onClick={() => agir({ type: 'equipeLieutenant', id: m.id })}>{m.lieutenant ? 'Retirer' : 'Bras droit'}</button> <button class="petit danger" onClick={() => agir({ type: 'equipeEcarter', id: m.id })}>Écarter</button></td>}
          </tr>)}</tbody></table></div>
      </Bloc>
      <div class="grille g2">
        {v.dirige && <Bloc titre="Ils veulent vous rejoindre">{v.candidats.length === 0 && <p class="doux">Personne cette semaine. Les contacts pris sur le terrain et les temps forts amènent du monde.</p>}
          {v.candidats.map((k: any) => <div class="ligne" style={{ padding: '6px 0', borderBottom: '1px solid var(--bord)' }}><div><b>{k.prenom} {k.nom}</b>, {k.age} ans<div class="doux petit-texte">{k.caractere}. {v.comps.map((n: string, i: number) => `${n} ${k.comp[i]}`).join(', ')}. {k.dispo} demi-journée{k.dispo > 1 ? 's' : ''} par semaine.</div></div><span class="espace" /><button class="petit principal" onClick={() => agir({ type: 'equipeRecruter', id: k.id })}>Accueillir</button><button class="petit" onClick={() => agir({ type: 'equipeRefuser', id: k.id }, true)}>Décliner</button></div>)}</Bloc>}
        <Bloc titre="Journal de la section">{v.journal.length === 0 && <p class="doux">Rien à signaler.</p>}{v.journal.map((t: string) => <div class="petit-texte" style={{ padding: '4px 0', borderBottom: '1px solid var(--bord)' }}>{t}</div>)}</Bloc>
      </div>
    </div>
  </div>;
}
