// Client du Web Worker : appels asynchrones au moteur.
declare const __LOCAL_WORKER__: string | undefined;
type Ecoute = (m: any) => void;
let w: Worker; let seq = 1; const attente = new Map<number, { ok: (x: any) => void; ko: (e: any) => void }>(); const ecoutes = new Set<Ecoute>();

export function demarrer(): Promise<any> {
  // Vite reconnaît cette forme et empaquette le worker. La construction locale (bun) fournit le chemin par une constante.
  w = typeof __LOCAL_WORKER__ !== 'undefined' ? new Worker(__LOCAL_WORKER__, { type: 'module' }) : new Worker(new URL('../worker/worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = ev => { const m = ev.data; if (m.id && attente.has(m.id)) { const a = attente.get(m.id)!; attente.delete(m.id); if (m.t === 'erreur') a.ko(new Error(m.texte)); else a.ok(m); } for (const f of ecoutes) f(m); };
  w.onerror = ev => { for (const f of ecoutes) f({ t: 'erreur', texte: ev.message }); };
  return appel({ t: 'init', base: new URL('./data/', document.baseURI).href });
}
function appel(m: any): Promise<any> { return new Promise((ok, ko) => { const id = seq++; attente.set(id, { ok, ko }); w.postMessage({ ...m, id }); }); }
export const ecouter = (f: Ecoute) => { ecoutes.add(f); return () => { ecoutes.delete(f); }; };
export const nouvelle = (opts: any) => appel({ t: 'nouvelle', opts });
export const charger = (etat: any) => appel({ t: 'charger', etat });
export const avancer = (n: number, arret: string) => w.postMessage({ t: 'avancer', n, arret });
export const arreter = () => w.postMessage({ t: 'stop' });
export const action = (a: any): Promise<{ retour: { ok: boolean; texte: string }; base: any }> => appel({ t: 'action', action: a });
export const vue = (nom: string, params?: any): Promise<any> => appel({ t: 'vue', nom, params }).then(m => m.data);
export const etatComplet = (): Promise<any> => appel({ t: 'sauver' }).then(m => m.data);
