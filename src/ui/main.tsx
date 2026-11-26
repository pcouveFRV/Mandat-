// Point d'entrée de l'interface : cadre général, navigation, barre du haut, avance du temps.
import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import './style.css';
import * as moteur from './moteur';
import * as stockage from './stockage';
import { useMagasin, maj, lireMagasin, toast, aller, agir, euro, nb, Info, Parti, Logo, accentParti } from './composants';
import { Agora } from './agora';
import { Accueil } from './accueil';
import { Inbox, FichePerso, Effectif, EcranParti } from './ecrans1';
import { Finances, Doctrine, Medias, Historique } from './ecrans2';
import { Campagne, Mandat, Soiree, Pantheon } from './ecrans3';
import { EcranCarte } from './carte';

const GROUPES: [string, [string, string][]][] = [['Bureau', [['inbox', 'Boîte de réception'], ['agora', 'Agora'], ['medias', 'Médias']]], ['Organisation', [['effectif', 'Effectif'], ['parti', 'Parti'], ['finances', 'Finances'], ['doctrine', 'Doctrine']]], ['Élections', [['carte', 'Carte'], ['campagne', 'Campagne'], ['mandat', 'Mandat'], ['historique', 'Historique']]]];
const TUTO: [string, string, string][] = [
  ['inbox', 'La boîte de réception', 'Tout passe par ici : messages de vos cadres, sondages, invitations, décisions à prendre. Les messages qui attendent une réponse sont signalés en rouge.'],
  ['inbox', 'Le temps', 'Le bouton Continuer, en haut à droite, fait avancer d\'une semaine. La flèche à côté permet d\'aller jusqu\'au prochain message important ou jusqu\'à la prochaine élection.'],
  ['carte', 'La carte', 'Choisissez une couche (résultats, intentions de vote, implantation, sociologie, priorités), cliquez sur un département pour zoomer jusqu\'aux communes et aux secteurs.'],
  ['parti', 'Le parti', 'Direction, fédérations, courants, terrain. Les militants s\'affectent par département et par type d\'action. Un délégué compétent fait grandir sa fédération.'],
  ['finances', 'Les finances', 'Cotisations, dons, financement public et reversements d\'élus paient les permanents, les locaux et les campagnes. Une trésorerie négative six mois de suite, c\'est la faillite.'],
  ['doctrine', 'La doctrine', 'Dix axes de -5 à +5. Bouger coûte de la crédibilité. Les propositions phares se débloquent selon votre position et attirent ou repoussent des électorats.'],
  ['campagne', 'Les campagnes', 'Calendrier, alliances, investitures, budget, meetings, parrainages. Avant chaque scrutin, c\'est ici que tout se joue. Entre les deux tours, vous décidez des désistements et des fusions.'],
  ['agora', 'Agora', 'Le réseau social du jeu. Publiez un message, un visuel, une vidéo ou un direct, sur vos thèmes ou en réaction à l\'actualité. Réagir à chaud rapporte plus et expose davantage. Vos abonnés montent avec les publications réussies.'],
  ['medias', 'Les médias', 'Interviews et débats se jouent en répliques : attaquer, esquiver, sortir un chiffre, jouer l\'émotion, contre-attaquer. Le bon choix dépend de la question et des attributs de celui qui parle.'],
  ['inbox', 'À vous de jouer', 'Avancez de quelques semaines, répondez aux messages, et gardez un oeil sur la date de la prochaine élection. Quand votre camp gouverne, l\'écran Mandat ouvre les réformes, le 49.3, le référendum et la dissolution. Le guide complet est dans docs/JOUER.md. Bonne partie.'],
];
const INFO_RES: Record<string, string> = {
  tresorerie: 'Argent en caisse. Recettes : cotisations, dons, financement public, reversements d\'élus. Dépenses : permanents, locaux, communication, campagnes.',
  militants: 'Adhérents réellement actifs. Leur nombre suit les adhérents, la dynamique et l\'unité. Ils servent aux actions de terrain.',
  capital: 'Capital politique : monte avec les victoires, les bons passages médias et les crises bien gérées. Sert à imposer des décisions (doctrine, propositions, exclusions, accords).',
  credibilite: 'Dépend de la cohérence doctrinale, de la compétence de vos cadres et du bilan de vos élus. Elle plafonne votre score électoral et facilite les ralliements.',
  notoriete: 'Visibilité du parti. Monte avec les médias, les réseaux, la communication et le nombre d\'élus.',
  unite: 'Cohésion interne. Baisse avec les courants mécontents, une croissance trop rapide ou des changements de ligne. Trop basse, elle mène à la scission.',
  dynamique: 'Élan du moment, de -50 à +50. Suit la tendance des sondages et les résultats. Elle joue sur les adhésions, les dons et le vote.',
};

function BarreHaut() {
  const m = useMagasin(); const b = m.base; const [ouvert, setOuvert] = useState(false); const [n, setN] = useState(4); const r = b.res;
  const bloque = b.aRepondre > 0; const fini = !!b.fin && b.fin.type !== 'fin' || b.fini;
  const go = (k: number, arret: string) => { setOuvert(false); if (m.occupe) return; maj({ occupe: 'Simulation en cours' }); moteur.avancer(k, arret); };
  return <div class="haut">
    <span class="date">{b.date}</span>
    <div class="res">
      {r && <>
        <span class="r"><small><Info t={INFO_RES.tresorerie}>Trésorerie</Info></small><b class={r.tresorerie < 0 ? 'danger-t' : ''}>{euro(r.tresorerie)}</b></span>
        <span class="r opt1"><small><Info t={INFO_RES.militants}>Militants</Info></small><b>{nb(r.militants)}</b></span>
        <span class="r opt2"><small><Info t={INFO_RES.capital}>Capital</Info></small><b>{r.capital}</b></span>
        <span class="r opt1"><small><Info t={INFO_RES.credibilite}>Crédibilité</Info></small><b>{r.credibilite}</b></span>
        <span class="r opt2"><small><Info t={INFO_RES.notoriete}>Notoriété</Info></small><b>{r.notoriete}</b></span>
        <span class="r opt2"><small><Info t={INFO_RES.unite}>Unité</Info></small><b class={r.unite < 30 ? 'danger-t' : ''}>{r.unite}</b></span>
        <span class="r opt1"><small><Info t={INFO_RES.dynamique}>Dynamique</Info></small><b class={r.dynamique > 5 ? 'ok' : r.dynamique < -5 ? 'danger-t' : ''}>{r.dynamique > 0 ? '+' : ''}{r.dynamique}</b></span>
      </>}
      {b.mode === 'carriere' && b.moi && <span class="r"><small><Info t="Votre poids dans le parti. Il monte avec le militantisme, le réseau et les mandats. Il décide des promotions et des investitures.">Estime</Info></small><b>{b.moi.estime}</b></span>}
      {b.prochaines[0] && <span class="r"><small>Prochaine échéance</small><b>{b.prochaines[0].nom.replace('Élections ', '').replace('Élection ', '')} {b.prochaines[0].tour2 ? '(2e tour)' : ''} : {b.prochaines[0].dans > 0 ? `${b.prochaines[0].dans} sem.` : 'cette semaine'}</b></span>}
    </div>
    <button onClick={() => maj({ menuJeu: true })}>Menu</button>
    <span style={{ position: 'relative', display: 'flex' }}>
      <button class="principal" disabled={!!m.occupe || fini} title={bloque ? 'Des messages attendent une réponse : sans réponse, la décision par défaut sera appliquée.' : ''} onClick={() => go(1, 'semaines')}>{m.occupe ? m.occupe : 'Continuer'}</button>
      {m.occupe ? <button onClick={() => moteur.arreter()}>Stop</button> : <button class="principal" disabled={fini} onClick={() => setOuvert(!ouvert)} aria-label="Choisir la vitesse d'avance" style={{ marginLeft: '4px', padding: '6px 11px' }}>▾</button>}
      {ouvert && <div class="deroulant">
        <div class="choix" style={{ marginTop: 0 }}>
          <button onClick={() => go(1, 'semaines')}>Une semaine</button>
          <button onClick={() => go(4, 'semaines')}>Un mois (4 semaines)</button>
          <button onClick={() => go(13, 'semaines')}>Un trimestre (13 semaines)</button>
          <button onClick={() => go(520, 'message')}>Jusqu'au prochain message important</button>
          <button onClick={() => go(520, 'echeance')}>Jusqu'à la veille de la prochaine élection</button>
          <div class="ligne"><button onClick={() => go(n, 'semaines')}>Avancer de</button><input type="number" min="1" max="520" value={n} style={{ width: '64px' }} onInput={(ev: any) => setN(Math.max(1, +ev.target.value || 1))} /> semaines</div>
          <small class="doux">L'avance s'arrête toujours quand une décision vous attend ou qu'une soirée électorale commence.</small>
        </div></div>}
    </span>
  </div>;
}

function MenuJeu() {
  const m = useMagasin(); const [quitter, setQuitter] = useState(false); const [nom, setNom] = useState(m.nomPartie || 'Ma partie'); const [fiches, setFiches] = useState<stockage.Fiche[]>([]); const [clair, setClair] = useState(document.documentElement.classList.contains('sombre'));
  useEffect(() => { stockage.lister().then(setFiches).catch(() => { }); }, []);
  const resume = () => `${m.base.date}, ${m.base.partis[m.base.parti]?.sigle ?? ''}, ${m.base.mode === 'carriere' ? 'Carrière' : 'Parti'}`;
  const sauver = async () => { const e = await moteur.etatComplet(); await stockage.sauver(nom, resume(), e); maj({ nomPartie: nom }); toast('Partie sauvegardée.'); setFiches(await stockage.lister()); };
  const chargerF = async (n: string) => { const f = await stockage.lire(n); if (!f) return; const r = await moteur.charger(f.etat); maj({ base: r.base, tick: m.tick + 1, menuJeu: false, nomPartie: n, ecran: 'inbox' }); toast('Partie chargée.'); };
  return <div class="voile" onClick={() => maj({ menuJeu: false })}><div class="modale" style={{ width: 'min(560px, 94vw)' }} onClick={(ev: any) => ev.stopPropagation()}>
    <h2>Menu</h2>
    <h3>Sauvegarder</h3><div class="ligne"><input type="text" value={nom} onInput={(ev: any) => setNom(ev.target.value)} /><button class="principal" onClick={sauver}>Sauvegarder</button><button onClick={async () => stockage.exporter(nom, await moteur.etatComplet())}>Exporter un fichier .mandat</button></div>
    <h3 style={{ marginTop: '14px' }}>Charger</h3>
    {fiches.length === 0 && <p class="doux">Aucune sauvegarde.</p>}
    {fiches.map(f => <div class="ligne" style={{ padding: '3px 0' }}><b>{f.nom}</b><span class="doux">{f.resume}</span><span class="espace" /><button class="petit" onClick={() => chargerF(f.nom)}>Charger</button><button class="petit danger" onClick={async () => { await stockage.supprimer(f.nom); setFiches(await stockage.lister()); }}>Supprimer</button></div>)}
    <div class="ligne" style={{ marginTop: '6px' }}><label class="doux">Importer un fichier .mandat : <input type="file" accept=".mandat,application/json" onChange={async (ev: any) => { const f = ev.target.files[0]; if (!f) return; try { const e = await stockage.importer(f); const r = await moteur.charger(e); maj({ base: r.base, tick: m.tick + 1, menuJeu: false, ecran: 'inbox' }); toast('Partie importée.'); } catch (err: any) { toast(String(err.message ?? err), false); } }} /></label></div>
    <h3 style={{ marginTop: '14px' }}>Options</h3>
    <div class="ligne"><label><input type="checkbox" checked={clair} onChange={(ev: any) => { const v = ev.target.checked; setClair(v); document.documentElement.classList.toggle('sombre', v); try { localStorage.setItem('mandat-theme', v ? 'sombre' : 'clair'); } catch { /* stockage indisponible */ } maj({ theme: v ? 'sombre' : 'clair' }); }} /> Thème sombre</label>
      {m.base.tutoriel >= 0 ? <button class="petit" onClick={() => agir({ type: 'tutoriel', etape: -1 }, true)}>Désactiver le tutoriel</button> : <button class="petit" onClick={() => agir({ type: 'tutoriel', etape: 0 }, true)}>Relancer le tutoriel</button>}</div>
    <p class="doux petit-texte" style={{ marginTop: '6px' }}>Graine de la partie : {m.base.graine}. Une même graine et les mêmes choix donnent la même partie.</p>
    <div class="ligne" style={{ marginTop: '14px' }}><button onClick={() => maj({ menuJeu: false })}>Reprendre</button><span class="espace" /><button class="danger" onClick={() => { if (quitter) maj({ phase: 'menu', menuJeu: false, base: null }); else setQuitter(true); }}>{quitter ? 'Confirmer : quitter sans sauvegarder' : "Nouvelle partie ou retour à l'accueil"}</button></div>
  </div></div>;
}

function Tutoriel() {
  const m = useMagasin(); const i = m.base.tutoriel; const ouvert = i >= 0 && i < TUTO.length && (m.base.acces ?? []).includes(TUTO[i][0]);
  useEffect(() => { if (i >= 0 && i < TUTO.length && !ouvert) agir({ type: 'tutoriel', etape: i + 1 >= TUTO.length ? -1 : i + 1 }, true); else if (ouvert && m.ecran !== TUTO[i][0]) aller(TUTO[i][0]); }, [i, ouvert]);
  if (!ouvert) return null; const [, titre, texte] = TUTO[i];
  return <div class="tuto"><h3>Tutoriel {i + 1}/{TUTO.length}</h3><b>{titre}</b><p style={{ marginTop: '6px' }}>{texte}</p><div class="ligne"><button class="petit" onClick={() => agir({ type: 'tutoriel', etape: -1 }, true)}>Désactiver</button><span class="espace" />{i > 0 && <button class="petit" onClick={() => agir({ type: 'tutoriel', etape: i - 1 }, true)}>Précédent</button>}<button class="petit principal" onClick={() => agir({ type: 'tutoriel', etape: i + 1 >= TUTO.length ? -1 : i + 1 }, true)}>{i + 1 >= TUTO.length ? 'Terminer' : 'Suivant'}</button></div></div>;
}

function Jeu() {
  const m = useMagasin(); const b = m.base;
  const E = m.ecran === 'inbox' ? <Inbox /> : m.ecran === 'carte' ? <EcranCarte /> : m.ecran === 'effectif' ? <Effectif /> : m.ecran === 'parti' ? <EcranParti /> : m.ecran === 'finances' ? <Finances /> : m.ecran === 'doctrine' ? <Doctrine /> : m.ecran === 'campagne' ? <Campagne /> : m.ecran === 'medias' ? <Medias /> : m.ecran === 'mandat' ? <Mandat /> : m.ecran === 'historique' ? <Historique /> : m.ecran === 'agora' ? <Agora /> : m.ecran === 'pantheon' ? <Pantheon /> : <Inbox />;
  const P = b.partis[b.parti]; const sombre = m.theme === 'sombre'; const acces: string[] = b.acces ?? [];
  useEffect(() => { const a = accentParti(P?.couleur ?? '#0066cc', sombre); const st = document.documentElement.style; st.setProperty('--accent', a.accent); st.setProperty('--accent-t', a.texte); st.setProperty('--accent-doux', a.doux); return () => { st.removeProperty('--accent'); st.removeProperty('--accent-t'); st.removeProperty('--accent-doux'); }; }, [P?.couleur, sombre]);
  return <div class="cadre">
    <nav class="menu">
      <div class="entete"><Logo i={b.parti} taille={38} /><div><b>{P?.nom}</b><small>{b.mode === 'carriere' && b.moi ? b.moi.nom : 'Direction du parti'}</small></div></div>
      {GROUPES.map(([g, tous]) => { const liste = tous.filter(([k]) => acces.includes(k)); return liste.length === 0 ? null : <>
        <div class="groupe">{g}</div>
        {liste.map(([k, n]) => <a class={m.ecran === k ? 'actif' : ''} onClick={() => { if (b.nouveaux.includes(k)) agir({ type: 'accesVu', ecran: k }, true); aller(k); }}>{n}{b.nouveaux.includes(k) && m.ecran !== k ? <span class="badge">nouveau</span> : null}{k === 'inbox' && b.aRepondre > 0 ? <span class="badge rouge">{b.aRepondre}</span> : k === 'inbox' && b.nonLus > 0 ? <span class="badge">{b.nonLus}</span> : k === 'campagne' && b.entreDeux.length > 0 ? <span class="badge rouge">2e tour</span> : k === 'medias' && (b.debat && !b.debat.fini || b.grandDebat) ? <span class="badge rouge">1</span> : k === 'agora' && b.agora?.aReagir > 0 ? <span class="badge">{b.agora.aReagir}</span> : null}</a>)}
      </>; })}
      {acces.includes('pantheon') && <><div class="groupe">Bilan</div>
      <a class={m.ecran === 'pantheon' ? 'actif' : ''} onClick={() => aller('pantheon')}>Panthéon</a></>}
      <div class="pied petit-texte doux">Score : <b style={{ color: 'var(--texte)' }}>{b.score}</b>{b.victoires.filter((v: any) => v.acquis).map((v: any) => <div class="ok">{v.nom}</div>)}
        {b.president && <div style={{ marginTop: '6px' }}>Président : {b.president.nom} <Parti i={b.president.parti} /><br />Popularité {b.president.popularite} %</div>}
        <div style={{ marginTop: '6px' }}>Chômage {String(b.eco.chomage).replace('.', ',')} %<br />Croissance {String(b.eco.croissance).replace('.', ',')} %</div></div>
    </nav>
    <BarreHaut />
    <main class="contenu">{E}</main>
    {m.fiche >= 0 && <div class="voile" onClick={() => maj({ fiche: -1 })}><div class="modale" onClick={(ev: any) => ev.stopPropagation()}><FichePerso id={m.fiche} /></div></div>}
    {m.soiree && <Soiree />}
    {m.menuJeu && <MenuJeu />}
    {b.fin && m.ecran !== 'pantheon' && !m.soiree && <div class="voile"><div class="modale" style={{ width: 'min(520px, 94vw)' }}><h2>{b.fin.titre}</h2><p>{b.fin.texte}</p><p>Score final : <b>{b.scoreFinal ?? b.score}</b></p><div class="ligne"><button class="principal" onClick={() => aller('pantheon')}>Voir le Panthéon</button><button onClick={() => maj({ phase: 'menu', base: null })}>Retour à l'accueil</button></div></div></div>}
    <Tutoriel />
  </div>;
}

function App() {
  const m = useMagasin();
  useEffect(() => {
    try { if (localStorage.getItem('mandat-theme') === 'sombre') { document.documentElement.classList.add('sombre'); maj({ theme: 'sombre' }); } } catch { /* stockage indisponible */ }
    const fin = moteur.ecouter(async msg => {
      const s = lireMagasin();
      if (msg.t === 'progression' && s.phase === 'jeu') maj({ occupe: msg.texte, ...(msg.base ? { base: msg.base } : {}) });
      if (msg.t === 'erreur') { maj({ occupe: '', erreur: msg.texte }); toast(`Erreur du moteur : ${msg.texte}`, false); }
      if (msg.t === 'etat' && !msg.id) {
        maj({ base: msg.base, tick: s.tick + 1, occupe: '', soiree: msg.base.soiree });
        if (msg.raison === 'decision') { aller('inbox'); toast('Une décision vous attend.'); } else if (msg.raison === 'debat') { aller('medias'); toast('Terminez d\'abord l\'entretien en cours.'); }
        // Sauvegarde automatique toutes les 8 semaines environ.
        if (msg.tours > 0 && msg.base.semaine % 8 < msg.tours) { try { await stockage.sauver('Sauvegarde automatique', `${msg.base.date}, ${msg.base.partis[msg.base.parti]?.sigle ?? ''}`, await moteur.etatComplet()); } catch { /* pas bloquant */ } }
      }
    });
    moteur.demarrer().then(ref => maj({ phase: 'menu', ref })).catch(err => maj({ erreur: String(err.message ?? err) }));
    return fin;
  }, []);
  return <>
    {m.phase === 'chargement' && <div class="accueil"><h1>MANDAT</h1><div class="sous">Politique Manager</div><p>{m.erreur ? `Erreur : ${m.erreur}` : (m.occupe || 'Chargement des données')}</p></div>}
    {m.phase === 'menu' && <Accueil />}
    {m.phase === 'jeu' && m.base && <Jeu />}
    {m.toast && <div class={`toast ${m.toast.ok ? '' : 'ko'}`} onClick={() => maj({ toast: null })}>{m.toast.texte}</div>}
  </>;
}
// Accès de diagnostic à l'état de l'interface (lecture seule), utile pour les essais automatisés.
(window as any).__mandat = { lire: lireMagasin };
render(<App />, document.getElementById('app')!);
