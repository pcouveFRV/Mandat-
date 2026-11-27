// Agora : réseau social du jeu. Fil, publication, réactions à l'actualité, tendances, classement des comptes.
import { useState } from 'preact/hooks';
import { useMagasin, useVue, agir, aller, nb, Parti, Logo, Avatar, Bloc, Courbes, couleurParti, ouvrirFiche, toast } from './composants';
import { Visage, Portrait } from './parcours';
import { proposer, nomTon, assistantActif, Proposition, proposerReponse, reactionsAbonnes } from './assistant';
import * as moteur from './moteur';

const court = (x: number) => x >= 1e6 ? `${(x / 1e6).toFixed(1).replace('.', ',')} M` : x >= 10000 ? `${Math.round(x / 1000)} k` : nb(x);
const il_y_a = (s: number, maintenant: number) => { const k = maintenant - s; return k <= 0 ? 'cette semaine' : k === 1 ? 'la semaine dernière' : `il y a ${k} semaines`; };

const TONS_REP: [string, string][] = [['pedagogue', 'Posé'], ['offensif', 'Offensif'], ['humour', 'Humour'], ['emotion', 'Émotion']];
function Compte({ p, taille = 34 }: { p: any; taille?: number }) {
  return p.genre === 'parti' ? <Logo i={p.parti} taille={taille} /> : p.genre === 'elu' ? (p.reel ? <Avatar nom={p.compte} parti={p.parti} taille={taille} /> : <Visage nom={p.compte} couleur={p.parti >= 0 ? couleurParti(p.parti) : undefined} taille={taille} />) : <span class="logo" style={{ width: `${taille}px`, height: `${taille}px`, background: p.genre === 'media' ? '#1d1d1f' : '#8e8e93', fontSize: '12px', borderRadius: '50%' }}>{p.genre === 'media' ? 'TV' : '@'}</span>;
}
function Publication({ p, semaine, ouvrir, profil, compact, ligne }: { p: any; semaine: number; ouvrir?: (id: number) => void; profil?: (p: any) => void; compact?: boolean; ligne?: string }) {
  const c = p.parti >= 0 ? couleurParti(p.parti) : '#6e6e73'; const [rep, setRep] = useState(false); const [ton, setTon] = useState('pedagogue'); const [texte, setTexte] = useState(''); const [attente, setAttente] = useState(false); const [reac, setReac] = useState<string[] | null>(null); const b0 = useMagasin().base;
  const suggerer = async () => { setAttente(true); try { const P = b0.partis[b0.parti]; setTexte(await proposerReponse({ cible: p.texte, sujet: p.sujet, parti: P.nom, ligne: ligne ?? '', ton, adverse: p.parti >= 0 && p.parti !== b0.parti })); } catch (err: any) { toast(String(err?.message ?? err), false); } setAttente(false); };
  const lireReactions = async () => { setAttente(true); try { const r = await reactionsAbonnes({ texte: p.texte, sujet: p.sujet, etat: p.etat }); if (r.length) setReac(r); } catch (err: any) { toast(String(err?.message ?? err), false); } setAttente(false); };
  const repondre = async () => { const ok = await agir({ type: 'agoraRepondre', id: p.id, ton, texte }); if (ok) { setRep(false); setTexte(''); } };
  const politique = p.genre === 'elu' || p.genre === 'parti';
  return <div class={`post ${compact ? 'compact' : ''}`}>
    {p.parentDe && <div class="doux petit-texte" style={{ marginBottom: '4px' }}>En réponse à <a onClick={() => ouvrir?.(p.parentDe.id)}>{p.parentDe.compte}</a></div>}
    <div class="tete">
      <span style={{ cursor: politique ? 'pointer' : 'default' }} onClick={() => politique && profil?.(p)}><Compte p={p} /></span>
      <div style={{ minWidth: 0 }}><b>{politique ? <a onClick={() => profil?.(p)} style={{ color: 'inherit' }}>{p.compte}</a> : p.compte}</b> {p.parti >= 0 && p.genre === 'elu' && <Parti i={p.parti} />}{p.moi && <span class="etiquette" style={{ marginLeft: '6px' }}>vous</span>}
        <small>{p.genre === 'media' ? 'Média' : p.genre === 'citoyen' ? 'Compte citoyen' : p.genre === 'parti' ? 'Compte officiel' : 'Compte personnel'}, {il_y_a(p.s, semaine)}</small></div>
      <span class="espace" />{p.etat === 'buzz' && <span class="etiquette buzz">En tendance</span>}{p.etat === 'polemique' && <span class="etiquette mauvais">Polémique</span>}
    </div>
    <div class="corps" style={{ cursor: ouvrir ? 'pointer' : 'default' }} onClick={() => ouvrir?.(p.id)}>{p.texte}</div>
    {!compact && (p.format === 'image' || p.format === 'video' || p.format === 'direct') && p.genre !== 'citoyen' && <div class={`visuel ${p.format === 'video' ? 'video' : ''}`} style={{ background: `linear-gradient(135deg, ${c}, #1d1d1f)` }}>{p.format === 'direct' ? 'EN DIRECT' : p.format === 'video' ? '' : p.sujet}</div>}
    {p.commentaires && !compact && <div style={{ marginTop: '8px', borderTop: '1px solid var(--bord)', paddingTop: '6px' }}>{(reac ? reac.map((t, i) => ({ qui: p.commentaires[i % p.commentaires.length]?.qui ?? 'abonné', t })) : p.commentaires).map((c: any) => <div class="petit-texte" style={{ padding: '2px 0' }}><b>{c.qui}</b> <span class="doux">{c.t}</span></div>)}{assistantActif() && !reac && <a class="petit-texte" onClick={() => !attente && lireReactions()}>{attente ? 'Lecture...' : 'Lire d\'autres réactions'}</a>}</div>}
    <div class="pied actions">
      <a class="act" title="Répondre" onClick={() => setRep(!rep)}>Répondre{p.reponses > 0 ? ` (${p.reponses})` : ''}</a>
      {!p.moi && <a class={`act ${p.repost ? 'fait' : ''}`} title="Republier auprès de vos abonnés" onClick={() => !p.repost && agir({ type: 'agoraReposter', id: p.id })}>{p.repost ? 'Republié' : 'Republier'} <b>{court(p.partages)}</b></a>}
      {p.moi && <span><b>{court(p.partages)}</b> partages</span>}
      <a class={`act ${p.aime ? 'fait' : ''}`} title="J'aime" onClick={() => agir({ type: 'agoraAimer', id: p.id }, true)}>{p.aime ? 'Aimé' : 'J\'aime'} <b>{court(p.likes)}</b></a>
      <span class="espace" /><span><b>{court(p.vues)}</b> vues</span>
    </div>
    {rep && <div style={{ marginTop: '8px', borderTop: '1px solid var(--bord)', paddingTop: '8px' }}>
      <textarea rows={2} maxLength={280} placeholder="Votre réponse (facultatif). Vide : texte proposé selon le ton." value={texte} onInput={(ev: any) => setTexte(ev.target.value)} style={{ width: '100%' }} />
      <div class="ligne" style={{ marginTop: '6px' }}><select aria-label="Ton de la réponse" value={ton} onChange={(ev: any) => setTon(ev.target.value)}>{TONS_REP.map(([k, n]) => <option value={k}>{n}</option>)}</select>{assistantActif() && <button disabled={attente} onClick={suggerer}>{attente ? 'Rédaction...' : 'Proposer'}</button>}<span class="doux petit-texte" style={{ flex: 1 }}>{p.parti >= 0 && politique ? 'Répondre à un adversaire peut lancer un échange : plus de vues, plus de risque.' : 'Une réponse compte comme une publication de la semaine.'}</span><button class="principal" onClick={repondre}>Répondre</button></div>
    </div>}
  </div>;
}

// Fil de discussion : la publication, ce à quoi elle répond et ses réponses.
function Fil({ id, fermer, ouvrir, profil }: { id: number; fermer: () => void; ouvrir: (id: number) => void; profil: (p: any) => void }) {
  const v = useVue('agoraFil', { id });
  return <div class="voile" onClick={fermer}><div class="modale" style={{ width: 'min(680px, 94vw)' }} onClick={(ev: any) => ev.stopPropagation()}>
    <div class="ligne" style={{ marginBottom: '10px' }}><h2 style={{ margin: 0 }}>Fil de discussion</h2><span class="espace" /><button onClick={fermer}>Fermer</button></div>
    {!v ? <p class="doux">Chargement...</p> : !v.post ? <p class="doux">Cette publication n'est plus disponible.</p> : <>
      {v.parents.map((x: any) => <Publication p={x} semaine={v.semaine} ouvrir={ouvrir} profil={profil} compact />)}
      <Publication p={v.post} semaine={v.semaine} profil={profil} />
      {v.reponses.length > 0 && <h3 style={{ margin: '14px 0 8px' }}>{v.reponses.length} réponse{v.reponses.length > 1 ? 's' : ''}</h3>}
      {v.reponses.map((x: any) => <Publication p={x} semaine={v.semaine} ouvrir={ouvrir} profil={profil} compact />)}
    </>}
  </div></div>;
}
// Profil d'un compte politique.
function ProfilCompte({ cible, fermer, ouvrir }: { cible: any; fermer: () => void; ouvrir: (id: number) => void }) {
  const v = useVue('agoraProfil', { perso: cible.perso, parti: cible.parti }); const m = useMagasin();
  return <div class="voile" onClick={fermer}><div class="modale" style={{ width: 'min(680px, 94vw)' }} onClick={(ev: any) => ev.stopPropagation()}>
    {!v ? <p class="doux">Chargement...</p> : !v.existe ? <p class="doux">Compte introuvable.</p> : <>
      <div style={{ height: '70px', borderRadius: '12px', background: `linear-gradient(120deg, ${v.parti >= 0 ? couleurParti(v.parti) : '#8e8e93'}, #1d1d1f)` }} />
      <div class="ligne" style={{ marginTop: '-26px', padding: '0 12px', alignItems: 'flex-end' }}><span style={{ border: '3px solid var(--fond2)', borderRadius: '26%', display: 'inline-flex' }}><Compte p={{ genre: v.genre, parti: v.parti, compte: v.nom, reel: v.reel }} taille={72} /></span><span class="espace" />
        {v.perso >= 0 && !v.estMoi && m.base.mode === 'carriere' && <button class={v.suivi ? '' : 'principal'} onClick={() => agir({ type: 'suivre', id: v.perso }, true)}>{v.suivi ? 'Suivi' : 'Suivre'}</button>}{v.perso >= 0 && <button onClick={() => { fermer(); ouvrirFiche(v.perso); }}>Fiche</button>}<button onClick={fermer}>Fermer</button></div>
      <h2 style={{ margin: '8px 0 2px' }}>{v.nom} {v.parti >= 0 && v.genre === 'elu' && <Parti i={v.parti} />}</h2>
      <p style={{ margin: '0 0 4px' }}>{v.bio}</p><p class="doux" style={{ margin: '0 0 12px' }}><b style={{ color: 'var(--texte)' }}>{nb(v.abonnes)}</b> abonnés{v.reel ? ' · personne réelle : le jeu ne lui prête aucun propos' : ''}</p>
      {v.posts.length === 0 && <p class="doux">Aucune publication récente.</p>}
      {v.posts.map((x: any) => <Publication p={x} semaine={v.semaine} ouvrir={(id) => { fermer(); ouvrir(id); }} compact />)}
    </>}
  </div></div>;
}

export function Agora() {
  const m = useMagasin(); const b = m.base; const v = useVue('agora');
  const [format, setFormat] = useState('texte'); const [ton, setTon] = useState('pedagogue'); const [cible, setCible] = useState(''); const [texte, setTexte] = useState(''); const [voix, setVoix] = useState(-1); const [filtre, setFiltre] = useState('pourtoi'); const [fil, setFil] = useState(-1); const [profil, setProfil] = useState<any>(null); const [props, setProps] = useState<Proposition[]>([]); const [attente, setAttente] = useState(false); const [nbDemandes, setNbDemandes] = useState(0);
  if (!v) return <div>Chargement...</div>;
  const dr = b.droits; const peut = v.carriere || dr.medias; const cibleEff = cible && (cible.startsWith('axe:') || (cible.startsWith('reaction:') ? v.reactions.some((r: any) => `reaction:${r.id}` === cible) : v.tendances.some((t: any) => `tendance:${t.i}` === cible))) ? cible : v.reactions[0] ? `reaction:${v.reactions[0].id}` : v.tendances[0] ? `tendance:${v.tendances[0].i}` : 'axe:0';
  const publier = async () => { const ok = await agir({ type: 'agoraPublier', format, ton, cible: cibleEff, texte, voix }); if (ok) { setTexte(''); setProps([]); } };
  const libelleCible = () => { const [t, id] = cibleEff.split(':'); return t === 'reaction' ? v.reactions.find((r: any) => r.id === +id)?.titre : t === 'tendance' ? v.tendances.find((x: any) => x.i === +id)?.sujet : v.axes[+id]?.nom; };
  const demanderProps = async () => { setAttente(true); const P = b.partis[b.parti]; const r = await proposer({ sujet: libelleCible() ?? '', parti: P.nom, ligne: v.ligne ?? '', auteur: v.carriere && b.moi ? b.moi.nom : 'le compte officiel du parti', aChaud: cibleEff.startsWith('reaction:'), repli: await moteur.vue('brouillons', { cible: cibleEff, n: v.faits + nbDemandes }) }); setNbDemandes(nbDemandes + 1); setAttente(false); setProps(r.propositions); if (r.erreur) toast(r.erreur, false); };
  const racines = v.posts.filter((p: any) => !p.parentDe || p.moi);
  const posts = filtre === 'pourtoi' ? racines.slice().sort((x: any, y: any) => y.score - x.score).slice(0, 30) : filtre === 'abos' ? racines.filter((p: any) => p.suivi || p.moi) : filtre === 'tout' ? v.posts : [];
  const voirNotifs = () => { setFiltre('notifs'); if (v.nonLus) agir({ type: 'agoraLireNotifs' }, true); };
  const reste = Math.max(0, v.max - v.faits);
  return <div>
    {fil >= 0 && <Fil id={fil} fermer={() => setFil(-1)} ouvrir={setFil} profil={(p: any) => { setFil(-1); setProfil(p); }} />}
    {profil && <ProfilCompte cible={profil} fermer={() => setProfil(null)} ouvrir={setFil} />}
    <h1>Agora</h1>
    <div class="agora">
      <div>
        <div class="post" style={{ marginBottom: '14px' }}>
          <div class="tete">{v.carriere && b.moi ? <Avatar nom={b.moi.nom} parti={b.parti} /> : <Logo i={b.parti} taille={34} />}<div><b>{v.carriere && b.moi ? b.moi.nom : b.partis[b.parti].nom}</b><small>{nb(v.carriere ? v.abonnesMoi : v.abonnesParti)} abonnés, {v.rang}e compte politique sur {v.nbComptes}</small></div></div>
          {!peut && <p class="alerte petit-texte">Le compte du parti est tenu par la direction et le porte-parole.</p>}
          <textarea rows={2} maxLength={280} placeholder="Votre message (facultatif, 280 caractères). Vide : texte proposé selon le ton." value={texte} onInput={(ev: any) => setTexte(ev.target.value)} style={{ width: '100%', resize: 'vertical' }} />
          <div class="ligne" style={{ marginTop: '8px' }}>
            <select aria-label="Sujet" value={cibleEff} onChange={(ev: any) => setCible(ev.target.value)}>
              {v.reactions.length > 0 && <optgroup label="Réagir à l'actualité">{v.reactions.map((r: any) => <option value={`reaction:${r.id}`}>{r.titre}{r.frais ? ' (à chaud)' : ''}</option>)}</optgroup>}
              {v.tendances.length > 0 && <optgroup label="Tendances">{v.tendances.map((t: any) => <option value={`tendance:${t.i}`}>{t.sujet}</option>)}</optgroup>}
              <optgroup label="Vos thèmes">{v.axes.map((a: any) => <option value={`axe:${a.i}`}>{a.nom}</option>)}</optgroup>
            </select>
            <select aria-label="Format" value={format} onChange={(ev: any) => setFormat(ev.target.value)}>{Object.keys(v.formats).map(k => <option value={k}>{v.formats[k].nom}</option>)}</select>
            <select aria-label="Ton" value={ton} onChange={(ev: any) => setTon(ev.target.value)}>{Object.keys(v.tons).map(k => <option value={k}>{v.tons[k].nom}</option>)}</select>
            {!v.carriere && v.voix.length > 0 && <select aria-label="Compte" value={voix} onChange={(ev: any) => setVoix(+ev.target.value)}><option value={-1}>Compte du parti</option>{v.voix.map((x: any) => <option value={x.id}>{x.nom} ({court(x.abonnes)})</option>)}</select>}
            <span class="espace" /><button disabled={!peut || attente} onClick={demanderProps}>{attente ? 'Rédaction...' : 'Proposer trois versions'}</button><button class="principal" disabled={!peut} onClick={publier}>Publier</button>
          </div>
          {props.length > 0 && <div class="choix">{props.map(p => <button onClick={() => { setTexte(p.texte); if (v.tons[p.ton]) setTon(p.ton); }}><small>{nomTon(p.ton)}{p.source === 'assistant' ? ', rédigé par l\'assistant' : ''}</small>{p.texte}</button>)}<span class="doux petit-texte">Cliquez sur une version pour la reprendre, puis retouchez-la. {assistantActif() ? '' : 'Redemandez pour d\'autres versions. Un assistant d\'écriture peut être activé dans le menu.'}</span></div>}
          <p class="doux petit-texte" style={{ margin: '8px 0 0' }}>{v.formats[format].desc} {v.tons[ton].desc} {reste > 0 ? `Encore ${reste} publication${reste > 1 ? 's' : ''} utile${reste > 1 ? 's' : ''} cette semaine : chaque publication de plus porte moins.` : 'Vous avez beaucoup publié cette semaine : la suivante portera très peu.'}</p>
          {!v.carriere && <label class="ligne petit-texte" style={{ marginTop: '6px' }}><input type="checkbox" checked={v.delegue} disabled={!dr.medias} onChange={(ev: any) => agir({ type: 'agoraDeleguer', valeur: ev.target.checked })} /> Laisser l'équipe numérique publier à ma place (prudent, moins d'éclat)</label>}
        </div>
        <div class="onglets">{[['pourtoi', 'Pour toi'], ['abos', 'Abonnements'], ['tout', 'Tout']].map(([k, n]) => <a class={filtre === k ? 'actif' : ''} onClick={() => setFiltre(k)}>{n}</a>)}<a class={filtre === 'notifs' ? 'actif' : ''} onClick={voirNotifs}>Notifications{v.nonLus > 0 && <span class="badge" style={{ marginLeft: '6px' }}>{v.nonLus}</span>}</a><a class={filtre === 'messages' ? 'actif' : ''} onClick={() => setFiltre('messages')}>Messages</a><a class={filtre === 'profil' ? 'actif' : ''} onClick={() => setFiltre('profil')}>Mon profil</a></div>
        {['pourtoi', 'abos', 'tout'].includes(filtre) && <>{posts.length === 0 && <p class="doux">{filtre === 'abos' ? 'Rien pour l\'instant. Suivez des comptes depuis leur profil ou depuis l\'annuaire.' : 'Rien à afficher pour l\'instant. Avancez d\'une semaine.'}</p>}{posts.map((p: any) => <Publication key={p.id} p={p} semaine={v.semaine} ouvrir={setFil} profil={setProfil} ligne={v.ligne} />)}</>}
        {filtre === 'notifs' && <div class="post">{v.notifs.length === 0 && <p class="doux">Aucune notification.</p>}{v.notifs.map((n: any) => <div class="ligne" style={{ padding: '8px 0', borderBottom: '1px solid var(--bord)', cursor: n.post ? 'pointer' : 'default', flexWrap: 'nowrap' }} onClick={() => n.post && setFil(n.post)}><span style={{ width: '8px', height: '8px', borderRadius: '50%', flex: 'none', background: n.type === 'polemique' ? 'var(--danger)' : n.type === 'mention' || n.type === 'reponse' ? 'var(--alerte)' : 'var(--accent)' }} /><span style={{ flex: 1 }}>{n.t}</span><span class="doux petit-texte">{il_y_a(n.s, v.semaine)}</span></div>)}</div>}
        {filtre === 'messages' && <div class="post">{!v.carriere ? <p class="doux">Les messages privés passent par votre carnet, en mode Carrière.</p> : v.contacts.length === 0 ? <p class="doux">Votre carnet est vide. Prenez contact avec un élu depuis l'annuaire.</p> : <>{v.contacts.map((c: any) => <div class="ligne" style={{ padding: '8px 0', borderBottom: '1px solid var(--bord)', flexWrap: 'nowrap' }}><div style={{ flex: 1, minWidth: 0 }}><b>{c.nom}</b><div class="doux petit-texte">{c.qui}</div></div><span class="doux petit-texte">{c.parle < 0 ? 'jamais écrit' : c.parle === 0 ? 'cette semaine' : `il y a ${c.parle} sem.`}</span><button class="petit" onClick={() => aller('contacts')}>Écrire</button></div>)}<p class="doux petit-texte" style={{ marginTop: '8px' }}>Un échange par personne et par semaine. Il se poursuit dans votre carnet.</p></>}</div>}
        {filtre === 'profil' && <><div class="post"><div class="ligne" style={{ gap: '14px' }}>{v.carriere && b.moi ? <Portrait p={b.portrait} taille={64} /> : <Logo i={b.parti} taille={64} />}<div><b style={{ fontSize: '17px' }}>{v.carriere && b.moi ? b.moi.nom : b.partis[b.parti].nom}</b><div class="doux">{nb(v.carriere ? v.abonnesMoi : v.abonnesParti)} abonnés · {v.rang}e compte politique sur {v.nbComptes}</div></div></div>
          <div class="ligne" style={{ marginTop: '10px', gap: '22px' }}><span><b>{v.stats.n}</b> <span class="doux">publications récentes</span></span><span><b>{court(v.stats.vues)}</b> <span class="doux">vues cumulées</span></span><span><b>{v.stats.buzz}</b> <span class="doux">en tendance</span></span><span><b>{v.stats.polemiques}</b> <span class="doux">polémiques</span></span></div></div>
          {v.mesPosts.length === 0 && <p class="doux" style={{ marginTop: '10px' }}>Vous n'avez encore rien publié.</p>}{v.mesPosts.map((p: any) => <Publication key={p.id} p={p} semaine={v.semaine} ouvrir={setFil} profil={setProfil} ligne={v.ligne} />)}</>}
      </div>
      <div class="grille" style={{ alignContent: 'start' }}>
        {v.reactions.length > 0 && <Bloc titre="À chaud">{v.reactions.map((r: any) => <div class="tendance"><span>{r.titre}</span><a onClick={() => setCible(`reaction:${r.id}`)}>{r.frais ? 'Réagir maintenant' : 'Réagir'}</a></div>)}<p class="doux petit-texte" style={{ marginTop: '6px' }}>Réagir la semaine même rapporte plus, avec un risque de faux pas plus élevé.</p></Bloc>}
        <Bloc titre="Tendances">{v.tendances.length === 0 && <span class="doux">Semaine calme.</span>}{v.tendances.map((t: any) => <div class="tendance"><a onClick={() => setCible(`tendance:${t.i}`)}>{t.sujet}</a><span class="doux petit-texte">{t.reste} sem.</span></div>)}</Bloc>
        <Bloc titre="Comptes politiques les plus suivis"><table><tbody>{v.classement.map((c: any, i: number) => <tr class="clic" onClick={() => setProfil({ perso: c.perso, parti: c.parti })}><td class="doux">{i + 1}</td><td style={{ whiteSpace: 'normal' }}>{c.nom} {c.perso >= 0 && <Parti i={c.parti} />}</td><td class="droite"><b>{court(c.abonnes)}</b></td></tr>)}</tbody></table></Bloc>
        {v.hist.length > 1 && <Bloc titre="Vos abonnés"><Courbes series={[{ nom: 'Abonnés', couleur: 'var(--accent-t)', points: v.hist.map((h: any) => [h.s, v.carriere ? h.moi : h.parti]) }]} hauteur={130} min0={false} /></Bloc>}
      </div>
    </div>
  </div>;
}
