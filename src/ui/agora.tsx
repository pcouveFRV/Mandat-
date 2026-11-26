// Agora : réseau social du jeu. Fil, publication, réactions à l'actualité, tendances, classement des comptes.
import { useState } from 'preact/hooks';
import { useMagasin, useVue, agir, nb, Parti, Logo, Avatar, Bloc, Courbes, couleurParti, ouvrirFiche, toast } from './composants';
import { proposer, nomTon, assistantActif, Proposition } from './assistant';

const court = (x: number) => x >= 1e6 ? `${(x / 1e6).toFixed(1).replace('.', ',')} M` : x >= 10000 ? `${Math.round(x / 1000)} k` : nb(x);
const il_y_a = (s: number, maintenant: number) => { const k = maintenant - s; return k <= 0 ? 'cette semaine' : k === 1 ? 'la semaine dernière' : `il y a ${k} semaines`; };

function Publication({ p, semaine }: { p: any; semaine: number }) {
  const c = p.parti >= 0 ? couleurParti(p.parti) : '#6e6e73';
  return <div class="post">
    <div class="tete">
      {p.genre === 'parti' ? <Logo i={p.parti} taille={34} /> : p.genre === 'elu' ? <Avatar nom={p.compte} parti={p.parti} /> : <span class="logo" style={{ width: '34px', height: '34px', background: p.genre === 'media' ? '#1d1d1f' : '#8e8e93', fontSize: '12px', borderRadius: '50%' }}>{p.genre === 'media' ? 'TV' : '@'}</span>}
      <div style={{ minWidth: 0 }}><b>{p.perso >= 0 ? <a onClick={() => ouvrirFiche(p.perso)} style={{ color: 'inherit' }}>{p.compte}</a> : p.compte}</b> {p.parti >= 0 && p.genre === 'elu' && <Parti i={p.parti} />}{p.moi && <span class="etiquette" style={{ marginLeft: '6px' }}>vous</span>}
        <small>{p.genre === 'media' ? 'Média' : p.genre === 'citoyen' ? 'Compte citoyen' : p.genre === 'parti' ? 'Compte officiel' : 'Compte personnel'}, {il_y_a(p.s, semaine)}</small></div>
      <span class="espace" />{p.etat === 'buzz' && <span class="etiquette buzz">En tendance</span>}{p.etat === 'polemique' && <span class="etiquette mauvais">Polémique</span>}
    </div>
    <div class="corps">{p.texte}</div>
    {(p.format === 'image' || p.format === 'video' || p.format === 'direct') && p.genre !== 'citoyen' && <div class={`visuel ${p.format === 'video' ? 'video' : ''}`} style={{ background: `linear-gradient(135deg, ${c}, #1d1d1f)` }}>{p.format === 'direct' ? 'EN DIRECT' : p.format === 'video' ? '' : p.sujet}</div>}
    <div class="pied"><span><b>{court(p.vues)}</b> vues</span><span><b>{court(p.likes)}</b> j'aime</span><span><b>{court(p.partages)}</b> partages</span><span><b>{court(p.comm)}</b> commentaires</span></div>
  </div>;
}

export function Agora() {
  const m = useMagasin(); const b = m.base; const v = useVue('agora');
  const [format, setFormat] = useState('texte'); const [ton, setTon] = useState('pedagogue'); const [cible, setCible] = useState(''); const [texte, setTexte] = useState(''); const [voix, setVoix] = useState(-1); const [filtre, setFiltre] = useState('tout'); const [props, setProps] = useState<Proposition[]>([]); const [attente, setAttente] = useState(false);
  if (!v) return <div>Chargement...</div>;
  const dr = b.droits; const peut = v.carriere || dr.medias; const cibleEff = cible && (cible.startsWith('axe:') || (cible.startsWith('reaction:') ? v.reactions.some((r: any) => `reaction:${r.id}` === cible) : v.tendances.some((t: any) => `tendance:${t.i}` === cible))) ? cible : v.reactions[0] ? `reaction:${v.reactions[0].id}` : v.tendances[0] ? `tendance:${v.tendances[0].i}` : 'axe:0';
  const publier = async () => { const ok = await agir({ type: 'agoraPublier', format, ton, cible: cibleEff, texte, voix }); if (ok) { setTexte(''); setProps([]); } };
  const libelleCible = () => { const [t, id] = cibleEff.split(':'); return t === 'reaction' ? v.reactions.find((r: any) => r.id === +id)?.titre : t === 'tendance' ? v.tendances.find((x: any) => x.i === +id)?.sujet : v.axes[+id]?.nom; };
  const demanderProps = async () => { setAttente(true); const P = b.partis[b.parti]; const r = await proposer({ sujet: libelleCible() ?? '', parti: P.nom, ligne: v.ligne ?? '', auteur: v.carriere && b.moi ? b.moi.nom : 'le compte officiel du parti', aChaud: cibleEff.startsWith('reaction:'), graine: v.semaine + v.faits }); setAttente(false); setProps(r.propositions); if (r.erreur) toast(r.erreur, false); };
  const posts = v.posts.filter((p: any) => filtre === 'tout' || (filtre === 'moi' ? p.parti === b.parti : filtre === 'politique' ? p.genre === 'elu' || p.genre === 'parti' : p.genre === filtre));
  const reste = Math.max(0, v.max - v.faits);
  return <div>
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
          {props.length > 0 && <div class="choix">{props.map(p => <button onClick={() => { setTexte(p.texte); if (v.tons[p.ton]) setTon(p.ton); }}><small>{nomTon(p.ton)}{p.source === 'assistant' ? ', rédigé par l\'assistant' : ''}</small>{p.texte}</button>)}<span class="doux petit-texte">Cliquez sur une version pour la reprendre, puis retouchez-la. {assistantActif() ? '' : 'Branchez un assistant d\'écriture dans le menu pour des propositions rédigées sur mesure.'}</span></div>}
          <p class="doux petit-texte" style={{ margin: '8px 0 0' }}>{v.formats[format].desc} {v.tons[ton].desc} {reste > 0 ? `Encore ${reste} publication${reste > 1 ? 's' : ''} utile${reste > 1 ? 's' : ''} cette semaine : chaque publication de plus porte moins.` : 'Vous avez beaucoup publié cette semaine : la suivante portera très peu.'}</p>
          {!v.carriere && <label class="ligne petit-texte" style={{ marginTop: '6px' }}><input type="checkbox" checked={v.delegue} disabled={!dr.medias} onChange={(ev: any) => agir({ type: 'agoraDeleguer', valeur: ev.target.checked })} /> Laisser l'équipe numérique publier à ma place (prudent, moins d'éclat)</label>}
        </div>
        <div class="onglets">{[['tout', 'Fil'], ['politique', 'Politiques'], ['moi', 'Mon parti'], ['media', 'Médias'], ['citoyen', 'Citoyens']].map(([k, n]) => <a class={filtre === k ? 'actif' : ''} onClick={() => setFiltre(k)}>{n}</a>)}</div>
        {posts.length === 0 && <p class="doux">Rien à afficher pour l'instant. Avancez d'une semaine.</p>}
        {posts.map((p: any) => <Publication p={p} semaine={v.semaine} />)}
      </div>
      <div class="grille" style={{ alignContent: 'start' }}>
        {v.reactions.length > 0 && <Bloc titre="À chaud">{v.reactions.map((r: any) => <div class="tendance"><span>{r.titre}</span><a onClick={() => setCible(`reaction:${r.id}`)}>{r.frais ? 'Réagir maintenant' : 'Réagir'}</a></div>)}<p class="doux petit-texte" style={{ marginTop: '6px' }}>Réagir la semaine même rapporte plus, avec un risque de faux pas plus élevé.</p></Bloc>}
        <Bloc titre="Tendances">{v.tendances.length === 0 && <span class="doux">Semaine calme.</span>}{v.tendances.map((t: any) => <div class="tendance"><a onClick={() => setCible(`tendance:${t.i}`)}>{t.sujet}</a><span class="doux petit-texte">{t.reste} sem.</span></div>)}</Bloc>
        <Bloc titre="Comptes politiques les plus suivis"><table><tbody>{v.classement.map((c: any, i: number) => <tr class={c.perso >= 0 ? 'clic' : ''} onClick={() => c.perso >= 0 && ouvrirFiche(c.perso)}><td class="doux">{i + 1}</td><td style={{ whiteSpace: 'normal' }}>{c.nom} {c.perso >= 0 && <Parti i={c.parti} />}</td><td class="droite"><b>{court(c.abonnes)}</b></td></tr>)}</tbody></table></Bloc>
        {v.hist.length > 1 && <Bloc titre="Vos abonnés"><Courbes series={[{ nom: 'Abonnés', couleur: 'var(--accent-t)', points: v.hist.map((h: any) => [h.s, v.carriere ? h.moi : h.parti]) }]} hauteur={130} min0={false} /></Bloc>}
      </div>
    </div>
  </div>;
}
