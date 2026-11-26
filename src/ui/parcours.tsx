// Mon parcours (fiche du joueur, entraînement, métier, ambition, réputation, investiture, journal) et Carnet (contacts, suivis).
import { useEffect, useState } from 'preact/hooks';
import { useMagasin, useVue, agir, nb, Bloc, Jauge, Parti, toast, moteurAction, ouvrirFiche, RANGS } from './composants';
import { discuter, assistantActif } from './assistant';

// Portrait dessiné à composer : formes simples, sans ressemblance avec personne.
// Avatar du personnage : un visage dessiné (style Notionists, bibliothèque DiceBear embarquée dans public/vendor) tiré du nom.
// Une personne réelle garde ses initiales : un visage tiré au hasard ne lui ressemblerait pas.
let moduleAvatars: Promise<any> | null = null; const cacheAvatars = new Map<string, string>();
const chargerAvatars = () => moduleAvatars ?? (moduleAvatars = import(/* @vite-ignore */ new URL('./vendor/avatars.js', document.baseURI).href).catch(() => null));
export function Portrait({ p, taille = 64 }: { p?: number[]; taille?: number }) {
  const b = useMagasin().base; const nom: string = b?.moi?.nom ?? ''; const c = b?.partis?.[b.parti]?.couleur ?? '#8e8e93'; const reel = !!b?.moi?.reel; const cle = `${nom}#${p?.[0] ?? 0}`;
  const [svg, setSvg] = useState<string>(cacheAvatars.get(cle) ?? '');
  useEffect(() => { if (reel || !nom) return; const dispo = cacheAvatars.get(cle); if (dispo) { setSvg(dispo); return; } let vivant = true; chargerAvatars().then(m => { if (!m) return; const s = m.avatar(cle); cacheAvatars.set(cle, s); if (vivant) setSvg(s); }); return () => { vivant = false; }; }, [cle, reel]);
  const cadre = { width: `${taille}px`, height: `${taille}px`, borderRadius: '26%', flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' };
  if (!reel && svg) return <span aria-label="Avatar" style={{ ...cadre, background: `color-mix(in srgb, ${c} 16%, #fff)` }} dangerouslySetInnerHTML={{ __html: svg }} />;
  const ini = nom.split(/[\s-]+/).filter(Boolean).map(x => x[0]).slice(0, 2).join('').toUpperCase();
  return <span aria-label="Avatar" style={{ ...cadre, background: `linear-gradient(145deg, ${c}, color-mix(in srgb, ${c} 68%, #000))`, color: '#fff', fontWeight: 600, fontSize: `${Math.round(taille * 0.38)}px`, letterSpacing: '.02em' }}>{ini}</span>;
}
const SCRUTINS: Record<string, string> = { municipales: 'Municipales', departementales: 'Départementales', legislatives: 'Législatives', regionales: 'Régionales', europeennes: 'Européennes' };
const ROLES: Record<string, string> = { mentor: 'Mentor', allie: 'Allié', rival: 'Rival', journaliste: 'Journaliste', cadre: 'Cadre du parti' };
const sem = (n: number) => `${n} semaine${n > 1 ? 's' : ''}`;

function Investiture({ v }: { v: any }) {
  const D = v.dossier; const [place, setPlace] = useState('tete'); const [sur, setSur] = useState('');
  if (!D) return <Bloc titre="Investitures">
    {v.echeances.length === 0 && <p class="doux">Aucune investiture ouverte pour l'instant. Elles s'ouvrent environ un an avant chaque scrutin et se ferment six semaines avant.</p>}
    {v.echeances.length > 0 && <><p>Se déclarer, c'est ouvrir un dossier : vous aurez quelques semaines pour réunir des soutiens avant de passer devant la commission.</p>
      <div class="ligne" style={{ marginBottom: '8px' }}><label><input type="radio" checked={place === 'tete'} onChange={() => setPlace('tete')} /> Viser la tête (candidat ou tête de liste)</label><label><input type="radio" checked={place === 'liste'} onChange={() => setPlace('liste')} /> Viser une place sur la liste</label></div>
      <table><tbody>{v.echeances.map((x: any) => <tr><td><b>{SCRUTINS[x.type]}</b></td><td class="doux">premier tour le {x.date}, dans {sem(x.dans)}</td><td class="droite">{x.investi ? <span class="ok">investi</span> : <button class="petit principal" onClick={() => agir({ type: 'invDeclarer', scrutin: x.type, place })}>Me déclarer</button>}</td></tr>)}</tbody></table></>}
  </Bloc>;
  const O = D.oral;
  return <Bloc titre={`Investiture : ${D.lib}`}>
    {D.verdict ? <div><p class={D.issue === 'investi' ? 'ok' : D.issue === 'suppleant' ? '' : 'danger-t'}><b>{D.issue === 'investi' ? 'Vous êtes investi.' : D.issue === 'suppleant' ? 'Vous êtes suppléant.' : 'Vous êtes écarté.'}</b></p><p>{D.verdict}</p><button onClick={() => agir({ type: 'invFermer' }, true)}>Refermer le dossier</button></div>
      : O ? <div><div class="ligne" style={{ marginBottom: '8px' }}>{Array.from({ length: D.nbQuestions }).map((_, i) => <span class="petit-texte" style={{ padding: '2px 10px', borderRadius: '980px', background: i === O.i ? 'var(--accent)' : 'var(--fond3)', color: i === O.i ? '#fff' : 'var(--doux)' }}>Question {i + 1}</span>)}</div>
        {O.journal.slice(-1).map((t: string) => <p class="doux">{t}</p>)}
        {v.dossier.question && <><p><b>{v.dossier.question.t}</b></p><div class="choix">{v.dossier.question.options.map((o: any, i: number) => <button onClick={() => agir({ type: 'invRepondre', choix: i }, true)}>{o.t}<small>Mise sur : {v.attrs[o.attr].nom.toLowerCase()} ({v.attrs[o.attr].v}){o.dif > 0.12 ? ', audacieux' : o.dif < 0 ? ', prudent' : ''}</small></button>)}</div></>}</div>
      : <div>
        <div class="ligne" style={{ gap: '24px', alignItems: 'flex-start' }}><div><div class="grand">{D.soutiens}</div><div class="doux petit-texte">soutiens réunis</div></div><div><div class="grand">{D.dans > 0 ? `${D.dans} sem.` : 'Cette semaine'}</div><div class="doux petit-texte">avant la commission</div></div>
          <div style={{ flex: 1, minWidth: '220px' }}><span class="doux petit-texte">Les autres candidats</span>{D.rivaux.map((r: any) => <div class="ligne" style={{ flexWrap: 'nowrap' }}><span style={{ width: '190px' }}>{r.nom}<div class="doux petit-texte">{r.profil}</div></span><div style={{ flex: 1 }}><Jauge v={r.score} couleur="var(--doux)" /></div></div>)}</div></div>
        <h3 style={{ marginTop: '12px' }}>Faire campagne dans le parti</h3><p class="doux petit-texte">Deux démarches par semaine au plus. Vos rivaux travaillent aussi.</p>
        <div class="choix">{Object.keys(D.actions).map(k => <button disabled={D.fait[k] === v.semaine} onClick={() => agir({ type: 'invAgir', quoi: k })}>{D.actions[k].nom}{D.fait[k] === v.semaine ? ' (fait cette semaine)' : ''}<small>{D.actions[k].desc} Mise sur : {v.attrs[D.actions[k].attr].nom.toLowerCase()} ({v.attrs[D.actions[k].attr].v}).</small></button>)}</div>
        <h3 style={{ marginTop: '12px' }}>Demander un appui</h3><div class="ligne">{v.contacts.filter((c: any) => c.role !== 'allie').map((c: any) => <button class="petit" disabled={D.fait['c' + c.id] !== undefined} onClick={() => agir({ type: 'invSoutien', contact: c.id })}>{c.prenom} {c.nom} ({ROLES[c.role].toLowerCase()})</button>)}</div>
        <h3 style={{ marginTop: '12px' }}>Promettre</h3><p class="doux petit-texte">Une promesse rapporte beaucoup tout de suite. On vous la rappellera un jour.</p>
        <div class="ligne">{Object.keys(D.promessesPossibles).map(k => <button class="petit" disabled={D.promesses.includes(k)} onClick={() => { if (sur === k) { setSur(''); agir({ type: 'invPromettre', quoi: k }); } else setSur(k); }}>{sur === k ? 'Confirmer la promesse' : `${D.promessesPossibles[k].nom} (+${D.promessesPossibles[k].gain})`}</button>)}</div>
        <div class="ligne" style={{ marginTop: '14px' }}><button class="principal" disabled={D.dans > 0} onClick={() => agir({ type: 'invOral' }, true)}>{D.dans > 0 ? `Oral devant la commission dans ${sem(D.dans)}` : 'Passer devant la commission'}</button></div>
      </div>}
  </Bloc>;
}

export function Profil() {
  useMagasin(); const v = useVue('parcours'); const [edit, setEdit] = useState(false); const [bio, setBio] = useState<string | null>(null); const [slogan, setSlogan] = useState<string | null>(null);
  if (!v) return <div>Chargement...</div>; if (!v.carriere) return <div><h1>Mon parcours</h1><p class="doux">Cet écran existe en mode Carrière.</p></div>;
  const P = v.portrait as number[]; const bascule = (i: number) => { const sel = v.attrs.filter((a: any) => a.choisi).map((a: any) => a.i); const n = sel.includes(i) ? sel.filter((x: number) => x !== i) : [...sel, i].slice(-3); if (n.length) agir({ type: 'profilEntrainement', attrs: n }, true); };
  return <div>
    <div class="ligne" style={{ gap: '16px', marginBottom: '14px' }}><Portrait p={P} taille={84} /><div><h1 style={{ margin: 0 }}>{v.nom}</h1><div class="doux">{v.age} ans, {RANGS[v.rang]}, {v.lieu} <Parti i={v.parti} /></div>{v.slogan && <div style={{ marginTop: '4px' }}><i>« {v.slogan} »</i></div>}{v.mandats.length > 0 && <div class="doux petit-texte">{v.mandats.join(', ')}</div>}</div><span class="espace" /><button onClick={() => { setEdit(!edit); setBio(v.bio); setSlogan(v.slogan); }}>{edit ? 'Fermer' : 'Modifier ma fiche'}</button></div>
    <div class="grille" style={{ gap: '14px' }}>
      {edit && <Bloc titre="Ma fiche">
        {!v.reel && <div class="ligne" style={{ marginBottom: '10px' }}><button onClick={() => { const n = P.slice(); n[0] = (n[0] + 1) % 100; agir({ type: 'profilPortrait', portrait: n }, true); }}>Changer de visage</button><span class="doux petit-texte">Cent visages possibles pour votre nom.</span></div>}
        <div class="grille" style={{ gap: '6px', }}><input type="text" aria-label="Slogan" maxLength={80} placeholder="Votre slogan personnel (80 caractères)" value={slogan ?? ''} onInput={(ev: any) => setSlogan(ev.target.value)} />
          <textarea aria-label="Biographie" rows={3} maxLength={400} placeholder="Votre biographie : d'où vous venez, ce que vous faites, pourquoi vous vous engagez (400 caractères)" value={bio ?? ''} onInput={(ev: any) => setBio(ev.target.value)} />
          <div class="ligne"><span class="doux">Votre style :</span><select aria-label="Style" value={v.style} onChange={(ev: any) => agir({ type: 'profilTexte', bio: bio ?? v.bio, slogan: slogan ?? v.slogan, style: ev.target.value }, true)}><option value="pedagogue">Pédagogue</option><option value="offensif">Offensif</option><option value="humour">Décalé</option><option value="emotion">Proche des gens</option><option value="coulisses">Coulisses</option></select><span class="espace" /><button class="principal" onClick={() => agir({ type: 'profilTexte', bio, slogan, style: v.style })}>Enregistrer</button></div></div>
      </Bloc>}
      {!edit && v.bio && <Bloc titre="Biographie"><p class="pre">{v.bio}</p></Bloc>}
      <div class="grille g2">
        <Bloc titre="Mon ambition">
          <select aria-label="Ambition" value={v.ambition} onChange={(ev: any) => agir({ type: 'profilAmbition', ambition: ev.target.value })}>{v.ambitions.map((a: any) => <option value={a.id}>{a.nom}</option>)}</select>
          <div style={{ marginTop: '10px' }}>{v.etapes.map((x: any, i: number) => { const courant = !x.fait && (i === 0 || v.etapes[i - 1].fait); return <div class="ligne" style={{ padding: '5px 0' }}><span style={{ width: '20px', height: '20px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, background: x.fait ? 'var(--ok)' : courant ? 'var(--accent)' : 'var(--fond3)', color: x.fait || courant ? '#fff' : 'var(--doux)' }}>{i + 1}</span><span class={x.fait ? 'doux' : ''} style={{ fontWeight: courant ? 600 : 400 }}>{x.nom}{x.fait ? ' (fait)' : courant ? ' (en cours)' : ''}</span></div>; })}</div>
        </Bloc>
        <Bloc titre="Ce qu'on dit de vous">{v.reputation.map((r: any) => <div style={{ padding: '6px 0', borderBottom: '1px solid var(--bord)' }}><div class="ligne" style={{ flexWrap: 'nowrap' }}><b style={{ width: '150px' }}>{r.qui}</b><div style={{ flex: 1 }}><Jauge v={r.v} /></div><span style={{ width: '80px' }} class="droite">{r.niveau}</span></div><div class="doux petit-texte">{r.raisons.join(', ')}.</div></div>)}</Bloc>
      </div>
      <Investiture v={v} />
      <div class="grille g2">
        <Bloc titre="Ce que je travaille"><p class="doux petit-texte">Trois attributs au plus. Ils progressent un peu plus vite, selon votre forme et votre disponibilité. Potentiel : {v.pot}.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 14px' }}>{v.attrs.filter((a: any) => a.entrainable).map((a: any) => <label class="ligne" style={{ flexWrap: 'nowrap' }}><input type="checkbox" checked={a.choisi} onChange={() => bascule(a.i)} /><span style={{ flex: 1 }}>{a.nom}</span><span class={`attr ${a.v >= 15 ? 'a4' : a.v >= 11 ? 'a3' : a.v >= 7 ? 'a2' : 'a1'}`}>{a.v}</span></label>)}</div></Bloc>
        <Bloc titre="Ma vie hors politique">
          <div class="ligne" style={{ gap: '20px' }}><div><div class="grand" style={{ color: v.argent < 0 ? 'var(--danger)' : undefined }}>{nb(v.argent)} €</div><div class="doux petit-texte">sur votre compte</div></div><div class="petit-texte">Revenus : <b>{nb(v.revenu)} €</b> par semaine{v.indemnites > 0 ? `, dont ${nb(v.indemnites)} € d'indemnités d'élu` : ''}<br />Dépenses courantes : {nb(v.depenses)} € par semaine</div></div>
          <div class="choix">{Object.keys(v.metiers).map(k => <button disabled={v.metier === k} onClick={() => agir({ type: 'profilMetier', metier: k })}>{v.metiers[k].nom}{v.metier === k ? ' (actuel)' : ''}<small>{v.metiers[k].desc} {v.metiers[k].revenu} € par semaine.</small></button>)}</div>
          <div class="ligne" style={{ marginTop: '8px', gap: '18px' }}><span style={{ width: '120px' }}>Forme<Jauge v={v.forme} /></span><span style={{ width: '120px' }}>Moral<Jauge v={v.moral} /></span><span class="doux petit-texte">Notoriété {v.notoriete}, estime du parti {v.estime}</span></div>
        </Bloc>
      </div>
      <div class="grille g2">
        <Bloc titre="Journal de carrière">{v.journal.length === 0 && <p class="doux">Tout reste à écrire.</p>}<div class="defile" style={{ maxHeight: '260px' }}>{v.journal.map((h: any) => <div class="ligne" style={{ padding: '4px 0', borderBottom: '1px solid var(--bord)', flexWrap: 'nowrap', alignItems: 'flex-start' }}><span class="doux petit-texte" style={{ width: '74px', flex: 'none' }}>il y a {Math.max(0, v.semaine - h.s)} sem.</span><span>{h.t}</span></div>)}</div></Bloc>
        <Bloc titre="Mes promesses">{v.promesses.length === 0 && <p class="doux">Vous n'avez rien promis à personne.</p>}{v.promesses.map((x: any) => <div class="ligne" style={{ padding: '4px 0', borderBottom: '1px solid var(--bord)' }}><span style={{ flex: 1 }}>{x.t}</span><span class={x.regle === 'tenue' ? 'ok' : x.regle === 'dedit' ? 'danger-t' : 'doux'}>{x.regle === 'tenue' ? 'tenue' : x.regle === 'dedit' ? 'reniée' : 'en cours'}</span></div>)}</Bloc>
      </div>
    </div>
  </div>;
}

function Echange({ c, v, fermer }: { c: any; v: any; fermer: () => void }) {
  const [fil, setFil] = useState<{ moi: boolean; t: string }[]>([]); const [txt, setTxt] = useState(''); const [attente, setAttente] = useState(false);
  const sujet = async (k: string, q: string) => { const r = await moteurAction({ type: 'contactParler', id: c.id, sujet: k }); if (r.ok === false) { toast(r.texte, false); return; } setFil(f => [...f, { moi: true, t: q }, { moi: false, t: r.texte }]); };
  const libre = async () => { const q = txt.trim(); if (!q) return; setTxt(''); setAttente(true); setFil(f => [...f, { moi: true, t: q }]);
    try { const rep = await discuter({ nom: `${c.prenom} ${c.nom}`, age: c.age, caractere: c.caractere, etat: `${ROLES[c.role]} du joueur. ${c.qui}. Relation : ${Math.round(c.relation)} sur 100`, lieu: v.lieu, parti: v.sigle, historique: fil, message: q }); setFil(f => [...f, { moi: false, t: rep }]); moteurAction({ type: 'contactParler', id: c.id, sujet: 'libre' }); }
    catch (err: any) { toast(`Assistant injoignable (${err?.message ?? 'erreur'}).`, false); } setAttente(false); };
  return <div class="voile" onClick={fermer}><div class="modale" style={{ width: 'min(640px, 94vw)' }} onClick={(ev: any) => ev.stopPropagation()}>
    <div class="ligne"><h2 style={{ margin: 0 }}>{c.prenom} {c.nom}</h2><span class="doux">{ROLES[c.role]}, {c.age} ans, {c.caractere}</span><span class="espace" /><button onClick={fermer}>Fermer</button></div>
    <p class="doux petit-texte">{c.qui}.</p>
    <div style={{ minHeight: '110px', margin: '10px 0', display: 'grid', gap: '8px' }}>{fil.length === 0 && <p class="doux">Une rencontre par semaine. De quoi parlez-vous ?</p>}{fil.map(h => <div style={{ justifySelf: h.moi ? 'end' : 'start', maxWidth: '85%', padding: '8px 12px', borderRadius: '14px', background: h.moi ? 'var(--accent)' : 'var(--fond3)', color: h.moi ? '#fff' : 'var(--texte)' }}>{h.t}</div>)}{attente && <div class="doux">{c.prenom} écrit...</div>}</div>
    <div class="ligne"><button onClick={() => sujet('nouvelles', 'Comment vas-tu ?')}>Prendre des nouvelles</button><button onClick={() => sujet('conseil', 'Tu ferais quoi, à ma place ?')}>Demander conseil</button><button onClick={() => sujet('rumeur', 'Qu\'est-ce qui se dit en ce moment ?')}>Ce qui se dit</button><button onClick={() => sujet('service', 'J\'aurais besoin d\'un coup de main.')}>Demander un service</button>{c.dette < 0 && <button onClick={() => sujet('rendre', 'Je te dois un service. Dis-moi.')}>Rendre un service</button>}</div>
    {assistantActif() && <div class="ligne" style={{ marginTop: '10px' }}><input type="text" style={{ flex: 1 }} maxLength={300} placeholder="Écrire librement..." value={txt} onInput={(ev: any) => setTxt(ev.target.value)} onKeyDown={(ev: any) => { if (ev.key === 'Enter') libre(); }} /><button class="principal" disabled={attente} onClick={libre}>Envoyer</button></div>}
  </div></div>;
}
export function Carnet() {
  useMagasin(); const v = useVue('parcours'); const [ouvert, setOuvert] = useState(-1);
  if (!v) return <div>Chargement...</div>; if (!v.carriere) return <div><h1>Carnet</h1><p class="doux">Cet écran existe en mode Carrière.</p></div>; const c0 = v.contacts.find((c: any) => c.id === ouvert);
  return <div>{c0 && <Echange c={c0} v={v} fermer={() => setOuvert(-1)} />}
    <h1>Carnet</h1>
    <div class="grille g2">
      <Bloc titre="Mes contacts"><p class="doux petit-texte">Une relation qu'on n'entretient pas s'use. Un service demandé se rend.</p>
        {v.contacts.map((c: any) => <div class="ligne" style={{ padding: '8px 0', borderBottom: '1px solid var(--bord)', flexWrap: 'nowrap' }}><span class="avatar" style={{ width: '34px', height: '34px', borderRadius: '50%', background: c.role === 'rival' ? 'var(--danger)' : c.role === 'journaliste' ? '#6e6e73' : 'var(--accent)', fontSize: '12px' }}>{c.prenom[0]}{c.nom[0]}</span>
          <div style={{ flex: 1, minWidth: 0 }}><b>{c.prenom} {c.nom}</b> <span class="doux">{ROLES[c.role]}</span><div class="doux petit-texte" style={{ whiteSpace: 'normal' }}>{c.qui}.{c.dette < 0 ? ` Vous lui devez ${-c.dette} service${c.dette < -1 ? 's' : ''}.` : c.dette > 0 ? ' Il vous doit un service.' : ''}</div><div style={{ maxWidth: '220px', marginTop: '3px' }}><Jauge v={c.relation} couleur={c.relation >= 55 ? 'var(--ok)' : c.relation >= 35 ? 'var(--accent-t)' : 'var(--alerte)'} /></div></div>
          <button class="petit" disabled={c.vu} onClick={() => setOuvert(c.id)}>{c.vu ? 'Vu cette semaine' : 'Voir'}</button></div>)}</Bloc>
      <Bloc titre="Personnes suivies"><p class="doux petit-texte">Ouvrez la fiche de n'importe quel personnage et cliquez sur Suivre. Vous serez prévenu de ses promotions, de ses mandats et de ses changements de parti. Douze au plus.</p>
        {v.suivis.length === 0 && <p class="doux">Vous ne suivez personne.</p>}
        {v.suivis.map((q: any) => <div class="ligne" style={{ padding: '6px 0', borderBottom: '1px solid var(--bord)' }}><a onClick={() => ouvrirFiche(q.id)}><b>{q.nom}</b></a> <Parti i={q.parti} /><span class="doux petit-texte">{RANGS[q.rang]}{q.mandats.length ? ', ' + q.mandats.join(', ') : ''}</span><span class="espace" /><button class="petit" onClick={() => agir({ type: 'suivre', id: q.id })}>Ne plus suivre</button></div>)}</Bloc>
    </div>
  </div>;
}
