// Assistant d'écriture. Facultatif : s'il est branché sur un serveur de modèle (API compatible OpenAI, par exemple Ollama),
// il rédige des propositions de publications et fait parler les personnages générés. Sans serveur, des textes écrits
// à l'avance prennent le relais. L'assistant écrit, le moteur du jeu décide des effets.
export interface ConfigIA { url: string; modele: string; cle: string }
const CLE = 'mandat-assistant';
export function lireConfig(): ConfigIA { try { const o = JSON.parse(localStorage.getItem(CLE) || '{}'); return { url: o.url || '', modele: o.modele || '', cle: o.cle || '' }; } catch { return { url: '', modele: '', cle: '' }; } }
export function ecrireConfig(c: ConfigIA) { try { localStorage.setItem(CLE, JSON.stringify(c)); } catch { /* stockage indisponible */ } }
export const assistantActif = () => { const c = lireConfig(); return !!c.url && !!c.modele; };

const REGLES = 'Tu écris en français simple et direct, sans emoji, sans mot-dièse, sans tiret cadratin. Tu ne cites aucun nom de personne réelle. Tu n\'attribues aucun propos, aucune accusation et aucun fait à une personne réelle. Tu restes sur les idées et les politiques publiques.';
async function demander(systeme: string, utilisateur: string, max = 400): Promise<string> {
  const c = lireConfig(); if (!c.url || !c.modele) throw new Error('Assistant non configuré.');
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 45000);
  try {
    const r = await fetch(c.url.replace(/\/+$/, '') + '/v1/chat/completions', { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', ...(c.cle ? { Authorization: `Bearer ${c.cle}` } : {}) }, body: JSON.stringify({ model: c.modele, temperature: 0.8, max_tokens: max, messages: [{ role: 'system', content: systeme }, { role: 'user', content: utilisateur }] }) });
    if (!r.ok) throw new Error(`Le serveur répond ${r.status}.`); const j = await r.json(); const txt = j?.choices?.[0]?.message?.content; if (typeof txt !== 'string' || !txt.trim()) throw new Error('Réponse vide.'); return txt.trim();
  } finally { clearTimeout(t); }
}
export async function tester(): Promise<string> { const t = await demander(REGLES, 'Réponds par une seule phrase courte pour confirmer que tu fonctionnes.', 60); return t.slice(0, 200); }

export interface Proposition { ton: string; texte: string; source: 'assistant' | 'jeu' }
const GABARITS: Record<string, string[]> = {
  pedagogue: ['{sujet} : voici ce que nous proposons, et ce que cela change concrètement.', '{sujet}. Trois faits à garder en tête avant de se faire un avis.', 'On nous demande notre position sur ce sujet : {sujet}. La voici, sans détour.'],
  offensif: ['{sujet} : combien de temps encore avant que le gouvernement regarde la réalité en face ?', '{sujet}. Des années d\'alertes, aucune décision. Nous, nous avons un plan.', 'Assez de commentaires sur ce sujet : {sujet}. Il faut des actes, maintenant.'],
  emotion: ['{sujet}. Derrière ce titre, il y a des gens. Je les ai rencontrés cette semaine.', 'Ce matin, on m\'a parlé de ce sujet : {sujet}. Ce que j\'ai entendu ne s\'oublie pas.', '{sujet} : pensées pour celles et ceux qui le vivent. Nous serons à leurs côtés.'],
};
const NOMS: Record<string, string> = { pedagogue: 'Posé', offensif: 'Offensif', emotion: 'Proche des gens' };
export const nomTon = (t: string) => NOMS[t] ?? t;
function locales(sujet: string, graine: number): Proposition[] { return Object.keys(GABARITS).map((ton, k) => ({ ton, texte: GABARITS[ton][(graine + k) % GABARITS[ton].length].replace('{sujet}', sujet), source: 'jeu' as const })); }

// Trois propositions de publication, une par ton. Revient aux textes du jeu si le serveur ne répond pas.
export async function proposer(o: { sujet: string; parti: string; ligne: string; auteur: string; aChaud: boolean; graine: number }): Promise<{ propositions: Proposition[]; erreur?: string }> {
  if (!assistantActif()) return { propositions: locales(o.sujet, o.graine) };
  try {
    const txt = await demander(`${REGLES} Tu rédiges des publications pour un réseau social dans un jeu de gestion politique. Chaque publication fait moins de 260 caractères.`, `Auteur : ${o.auteur}, du parti ${o.parti}. Ligne du parti : ${o.ligne}.\nSujet${o.aChaud ? ' (réaction à chaud, le jour même)' : ''} : ${o.sujet}.\nRédige trois publications, une par ligne, dans cet ordre et avec ces préfixes exacts :\nPOSE: ton posé et pédagogue\nOFFENSIF: ton offensif\nPROCHE: ton proche des gens, témoignage\nN'écris rien d'autre.`);
    const lire = (prefixe: string) => { const m = new RegExp(`${prefixe}\\s*:\\s*(.+)`, 'i').exec(txt); return m ? m[1].trim().replace(/^["«\s]+|["»\s]+$/g, '').slice(0, 280) : ''; };
    const p = [['pedagogue', lire('POSE')], ['offensif', lire('OFFENSIF')], ['emotion', lire('PROCHE')]].filter(x => x[1]).map(([ton, texte]) => ({ ton, texte, source: 'assistant' as const }));
    if (p.length < 2) return { propositions: locales(o.sujet, o.graine), erreur: 'Réponse de l\'assistant illisible. Textes du jeu utilisés.' };
    return { propositions: p };
  } catch (err: any) { return { propositions: locales(o.sujet, o.graine), erreur: `Assistant injoignable (${err?.message ?? 'erreur'}). Textes du jeu utilisés.` }; }
}

// Discussion libre avec un personnage généré. Jamais avec une personne réelle.
export async function discuter(o: { nom: string; age: number; caractere: string; etat: string; lieu: string; parti: string; historique: { moi: boolean; t: string }[]; message: string }): Promise<string> {
  const sys = `${REGLES} Tu joues ${o.nom}, ${o.age} ans, militant bénévole du parti ${o.parti} à ${o.lieu}, personnage de fiction dans un jeu. Caractère : ${o.caractere}. État du moment : ${o.etat}. Tu parles à ton responsable de section. Réponds en deux ou trois phrases, à la première personne, sur le ton d'une vraie conversation. Tu ne décides de rien pour lui et tu ne promets rien que tu ne pourrais tenir.`;
  const fil = o.historique.slice(-6).map(h => `${h.moi ? 'Responsable' : o.nom} : ${h.t}`).join('\n');
  return (await demander(sys, `${fil ? fil + '\n' : ''}Responsable : ${o.message}\n${o.nom} :`, 220)).slice(0, 600);
}
