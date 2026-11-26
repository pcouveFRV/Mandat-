// Assistant d'écriture. Facultatif : s'il est branché sur un serveur de modèle (API compatible OpenAI, par exemple Ollama),
// il rédige des propositions de publications et fait parler les personnages générés. Sans serveur, des textes écrits
// à l'avance prennent le relais. L'assistant écrit, le moteur du jeu décide des effets.
export interface ConfigIA { mode: 'aucun' | 'local' | 'serveur'; url: string; modele: string; cle: string }
const CLE = 'mandat-assistant';
export function lireConfig(): ConfigIA { try { const o = JSON.parse(localStorage.getItem(CLE) || '{}'); return { mode: o.mode || (o.url && o.modele ? 'serveur' : 'aucun'), url: o.url || '', modele: o.modele || '', cle: o.cle || '' }; } catch { return { mode: 'aucun', url: '', modele: '', cle: '' }; } }
export function ecrireConfig(c: ConfigIA) { try { localStorage.setItem(CLE, JSON.stringify(c)); } catch { /* stockage indisponible */ } }
export const assistantActif = () => { const c = lireConfig(); return c.mode === 'local' ? !!moteurLocal : c.mode === 'serveur' && !!c.url && !!c.modele; };

const REGLES = 'Tu écris en français simple et direct, sans emoji, sans mot-dièse, sans tiret cadratin. Tu ne cites aucun nom de personne réelle. Tu n\'attribues aucun propos, aucune accusation et aucun fait à une personne réelle. Tu restes sur les idées et les politiques publiques.';

// ---------- Assistant local : un petit modèle ouvert qui tourne dans le navigateur (WebGPU), sans serveur et sans frais. ----------
// La bibliothèque WebLLM et le modèle sont téléchargés à la demande, une seule fois, puis gardés en cache par le navigateur.
let moteurLocal: any = null; let chargement: Promise<string> | null = null; export let modeleLocal = '';
export const localPossible = () => typeof navigator !== 'undefined' && !!(navigator as any).gpu;
export const localCharge = () => !!moteurLocal;
const PREFERES = [/^Qwen2\.5-1\.5B-Instruct-q4f16/, /^Llama-3\.2-1B-Instruct-q4f16/, /^gemma-2-2b-it-q4f16/, /^Qwen2\.5-0\.5B-Instruct-q4f16/, /^Llama-3\.2-1B-Instruct/, /^SmolLM2-1\.7B-Instruct-q4f16/];
export function chargerLocal(progres: (t: string) => void): Promise<string> {
  if (moteurLocal) return Promise.resolve(modeleLocal);
  return chargement ??= (async () => {
    if (!localPossible()) throw new Error('Ce navigateur ne propose pas WebGPU. Essayez Chrome ou Edge récents sur ordinateur.');
    const adresse = 'https://esm.run/@mlc-ai/web-llm'; const lib: any = await import(/* @vite-ignore */ adresse);
    const liste: string[] = (lib.prebuiltAppConfig?.model_list ?? []).map((m: any) => m.model_id); let choix = '';
    for (const r of PREFERES) { const c = liste.find(id => r.test(id)); if (c) { choix = c; break; } }
    if (!choix) { const petits = (lib.prebuiltAppConfig?.model_list ?? []).filter((m: any) => /instruct|-it-|chat/i.test(m.model_id) && m.vram_required_MB && m.vram_required_MB < 2500).sort((a: any, b: any) => a.vram_required_MB - b.vram_required_MB); choix = petits[Math.floor(petits.length / 2)]?.model_id ?? ''; }
    if (!choix) throw new Error('Aucun petit modèle disponible dans la bibliothèque.');
    progres(`Modèle choisi : ${choix}`); moteurLocal = await lib.CreateMLCEngine(choix, { initProgressCallback: (p: any) => progres(String(p?.text ?? '')) }); modeleLocal = choix; return choix;
  })().catch(err => { chargement = null; throw err; });
}

async function demander(systeme: string, utilisateur: string, max = 400): Promise<string> {
  const c = lireConfig(); const messages = [{ role: 'system', content: systeme }, { role: 'user', content: utilisateur }];
  if (c.mode === 'local') { if (!moteurLocal) throw new Error('Assistant local non chargé. Activez-le dans le menu.'); const r = await moteurLocal.chat.completions.create({ messages, temperature: 0.8, max_tokens: max }); const txt = r?.choices?.[0]?.message?.content; if (typeof txt !== 'string' || !txt.trim()) throw new Error('Réponse vide.'); return txt.trim(); }
  if (c.mode !== 'serveur' || !c.url || !c.modele) throw new Error('Assistant non configuré.');
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 45000);
  try {
    const r = await fetch(c.url.replace(/\/+$/, '') + '/v1/chat/completions', { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', ...(c.cle ? { Authorization: `Bearer ${c.cle}` } : {}) }, body: JSON.stringify({ model: c.modele, temperature: 0.8, max_tokens: max, messages }) });
    if (!r.ok) throw new Error(`Le serveur répond ${r.status}.`); const j = await r.json(); const txt = j?.choices?.[0]?.message?.content; if (typeof txt !== 'string' || !txt.trim()) throw new Error('Réponse vide.'); return txt.trim();
  } finally { clearTimeout(t); }
}
export async function tester(): Promise<string> { const t = await demander(REGLES, 'Réponds par une seule phrase courte pour confirmer que tu fonctionnes.', 60); return t.slice(0, 200); }

export interface Proposition { ton: string; texte: string; source: 'assistant' | 'jeu' }
const NOMS: Record<string, string> = { pedagogue: 'Posé', offensif: 'Offensif', emotion: 'Proche des gens' };
export const nomTon = (t: string) => NOMS[t] ?? t;
// Trois propositions de publication, une par ton. Revient aux textes du jeu si le serveur ne répond pas.
export async function proposer(o: { sujet: string; parti: string; ligne: string; auteur: string; aChaud: boolean; repli: { ton: string; texte: string }[] }): Promise<{ propositions: Proposition[]; erreur?: string }> {
  const locales = (): Proposition[] => o.repli.map(x => ({ ...x, source: 'jeu' as const }));
  if (!assistantActif()) return { propositions: locales() };
  try {
    const txt = await demander(`${REGLES} Tu rédiges des publications pour un réseau social dans un jeu de gestion politique. Chaque publication fait moins de 260 caractères.`, `Auteur : ${o.auteur}, du parti ${o.parti}. Ligne du parti : ${o.ligne}.\nExemples du ton attendu, à ne pas recopier : ${o.repli.map(x => x.texte).join(' / ')}\nSujet${o.aChaud ? ' (réaction à chaud, le jour même)' : ''} : ${o.sujet}.\nRédige trois publications, une par ligne, dans cet ordre et avec ces préfixes exacts :\nPOSE: ton posé et pédagogue\nOFFENSIF: ton offensif\nPROCHE: ton proche des gens, témoignage\nN'écris rien d'autre.`);
    const lire = (prefixe: string) => { const m = new RegExp(`${prefixe}\\s*:\\s*(.+)`, 'i').exec(txt); return m ? m[1].trim().replace(/^["«\s]+|["»\s]+$/g, '').slice(0, 280) : ''; };
    const p = [['pedagogue', lire('POSE')], ['offensif', lire('OFFENSIF')], ['emotion', lire('PROCHE')]].filter(x => x[1]).map(([ton, texte]) => ({ ton, texte, source: 'assistant' as const }));
    if (p.length < 2) return { propositions: locales(), erreur: 'Réponse de l\'assistant illisible. Textes du jeu utilisés.' };
    return { propositions: p };
  } catch (err: any) { return { propositions: locales(), erreur: `Assistant injoignable (${err?.message ?? 'erreur'}). Textes du jeu utilisés.` }; }
}

// Discussion libre avec un personnage généré. Jamais avec une personne réelle.
export async function discuter(o: { nom: string; age: number; caractere: string; etat: string; lieu: string; parti: string; historique: { moi: boolean; t: string }[]; message: string }): Promise<string> {
  const sys = `${REGLES} Tu joues ${o.nom}, ${o.age} ans, militant bénévole du parti ${o.parti} à ${o.lieu}, personnage de fiction dans un jeu. Caractère : ${o.caractere}. État du moment : ${o.etat}. Tu parles à ton responsable de section. Réponds en deux ou trois phrases, à la première personne, sur le ton d'une vraie conversation. Tu ne décides de rien pour lui et tu ne promets rien que tu ne pourrais tenir.`;
  const fil = o.historique.slice(-6).map(h => `${h.moi ? 'Responsable' : o.nom} : ${h.t}`).join('\n');
  return (await demander(sys, `${fil ? fil + '\n' : ''}Responsable : ${o.message}\n${o.nom} :`, 220)).slice(0, 600);
}
