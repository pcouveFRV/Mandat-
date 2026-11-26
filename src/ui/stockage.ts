// Sauvegardes dans IndexedDB, export et import de fichiers .mandat.
const BASE = 'mandat', MAGASIN = 'parties';
function ouvrir(): Promise<IDBDatabase> { return new Promise((ok, ko) => { const r = indexedDB.open(BASE, 1); r.onupgradeneeded = () => { r.result.createObjectStore(MAGASIN, { keyPath: 'nom' }); }; r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }); }
function tx<T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> { return ouvrir().then(db => new Promise<T>((ok, ko) => { const t = db.transaction(MAGASIN, mode); const r = f(t.objectStore(MAGASIN)); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); })); }
export interface Fiche { nom: string; date: string; resume: string; etat?: any }
export const sauver = (nom: string, resume: string, etat: any) => tx('readwrite', s => s.put({ nom, date: new Date().toISOString(), resume, etat }));
export const lire = (nom: string): Promise<Fiche | undefined> => tx('readonly', s => s.get(nom));
export const supprimer = (nom: string) => tx('readwrite', s => s.delete(nom));
export async function lister(): Promise<Fiche[]> { const l: Fiche[] = await tx('readonly', s => s.getAll()); return l.map(x => ({ nom: x.nom, date: x.date, resume: x.resume })).sort((a, b) => b.date.localeCompare(a.date)); }
export function exporter(nom: string, etat: any) { const b = new Blob([JSON.stringify({ format: 'mandat', version: 3, etat })], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${nom.replace(/[^\p{L}\p{N}_-]+/gu, '_')}.mandat`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
export function importer(fichier: File): Promise<any> { return fichier.text().then(t => { const o = JSON.parse(t); if (o.format !== 'mandat' || !o.etat) throw new Error('Ce fichier n\'est pas une sauvegarde MANDAT.'); return o.etat; }); }
