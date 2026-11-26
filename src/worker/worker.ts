// Web Worker : fait tourner le moteur hors du fil d'interface pour que l'avance rapide reste fluide.
import { assembler, FICHIERS } from '../engine/donnees';
import type { Donnees, Etat } from '../engine/types';
import { creerPartie, OptPartie } from '../engine/creation';
import { tour } from '../engine/tour';
import { appliquer } from '../engine/actions';
import { vue } from '../engine/vues';
import { semaineDe, SEMAINE_FIN } from '../engine/calendrier';

let d: Donnees | null = null; let e: Etat | null = null; let stop = false;
const post = (m: any) => (self as any).postMessage(m);

async function charger(base: string) {
  const brut: Record<string, any> = {}; let n = 0;
  await Promise.all(FICHIERS.map(async f => { const r = await fetch(`${base}${f}.json`); if (!r.ok) throw new Error(`Fichier de données introuvable : ${f}.json`); brut[f] = await r.json(); post({ t: 'progression', texte: `Chargement des données (${++n}/${FICHIERS.length})` }); }));
  d = assembler(brut);
}
// Avance le temps. arret : 'semaines' (n tours), 'echeance' (jusqu'au prochain vote), 'message' (jusqu'au prochain message important).
async function avancer(n: number, arret: string) {
  if (!e || !d) return; stop = false; let fait = 0; let raison = '';
  while (fait < n && !stop) {
    if (e.semaine >= SEMAINE_FIN || (e.joueur.fin && e.joueur.fin.type !== 'fin')) { raison = 'fin'; break; }
    if (e.debat && !e.debat.fini) { raison = 'debat'; break; }
    const msgs = tour(e, d); fait++;
    if (e.joueur.fin) { raison = 'fin'; break; }
    if (e.soiree) { raison = 'soiree'; break; }
    if (msgs.some(m => m.choix && m.repondu === undefined)) { raison = 'decision'; break; }
    if (arret === 'message' && msgs.some(m => m.important)) { raison = 'message'; break; }
    if (arret === 'echeance' && e.calendrier.some(x => !x.fait1 && x.s1 === e!.semaine + 1)) { raison = 'veille'; break; }
    if (fait % 4 === 0) { post({ t: 'progression', texte: vue(e, d, 'base').date, base: fait % 8 === 0 ? vue(e, d, 'base') : undefined }); await new Promise(r => setTimeout(r, 0)); }
  }
  post({ t: 'etat', base: vue(e, d, 'base'), raison, tours: fait });
}

self.onmessage = async (ev: MessageEvent) => {
  const m = ev.data;
  try {
    switch (m.t) {
      case 'init': await charger(m.base); post({ t: 'pret', id: m.id, partis: d!.partis.filter(p => !p.id.startsWith('NP')), villes: d!.zones.filter(z => z.type === 0 || z.type === 2).map(z => ({ id: z.id, nom: z.nom, pop: z.pop, dept: z.dept })), traits: d!.traits, axes: d!.axes, depts: d!.depts.map(x => ({ code: x.code, nom: x.nom, region: x.region })), regions: d!.regions }); break;
      case 'nouvelle': {
        const o: OptPartie = m.opts; post({ t: 'progression', texte: 'Calibrage sur les résultats réels' }); e = creerPartie(d!, o);
        if (o.scenario === 'monde_apres') { // simulation rapide de 2027, sans intervention du joueur
          e.options.auto = true; const cible = semaineDe(2027, 7, 5); while (e.semaine < cible) { tour(e, d!); if (e.semaine % 4 === 0) { post({ t: 'progression', texte: `Simulation de 2027 : ${vue(e, d!, 'base').date}` }); await new Promise(r => setTimeout(r, 0)); } }
          e.options.auto = false; e.soiree = null; e.joueur.fin = undefined; for (const x of e.inbox) { x.lu = true; if (x.choix && x.repondu === undefined) x.repondu = x.choix.length - 1; } e.debut = e.semaine; if (e.joueur.mode === 'parti') e.joueur.perso = e.partis[e.joueur.parti].chef;
        }
        post({ t: 'etat', id: m.id, base: vue(e, d!, 'base'), raison: 'nouvelle' }); break;
      }
      case 'charger': e = m.etat; post({ t: 'etat', id: m.id, base: vue(e!, d!, 'base'), raison: 'charge' }); break;
      case 'avancer': await avancer(m.n ?? 1, m.arret ?? 'semaines'); break;
      case 'stop': stop = true; break;
      case 'action': { const r = appliquer(e!, d!, m.action); post({ t: 'reponse', id: m.id, retour: r.retour, base: vue(e!, d!, 'base') }); break; }
      case 'vue': post({ t: 'reponse', id: m.id, data: vue(e!, d!, m.nom, m.params) }); break;
      case 'sauver': post({ t: 'reponse', id: m.id, data: e }); break;
    }
  } catch (err: any) { post({ t: 'erreur', id: m.id, texte: String(err?.message ?? err), pile: String(err?.stack ?? '') }); }
};
