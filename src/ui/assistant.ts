// Assistant d'écriture. Facultatif : s'il est branché sur un serveur de modèle (API compatible OpenAI, par exemple Ollama),
// il rédige des propositions de publications et fait parler les personnages générés. Sans serveur, des textes écrits
// à l'avance prennent le relais. L'assistant écrit, le moteur du jeu décide des effets.
export interface ConfigIA { mode: 'aucun' | 'local' | 'serveur' | 'claude'; url: string; modele: string; cle: string; cleClaude: string; modeleClaude: string }
export const MODELE_CLAUDE = 'claude-haiku-5-5';
const CLE = 'mandat-assistant';
export function lireConfig(): ConfigIA { try { const o = JSON.parse(localStorage.getItem(CLE) || '{}'); return { mode: o.mode || (o.url && o.modele ? 'serveur' : 'aucun'), url: o.url || '', modele: o.modele || '', cle: o.cle || '', cleClaude: o.cleClaude || '', modeleClaude: o.modeleClaude || MODELE_CLAUDE }; } catch { return { mode: 'aucun', url: '', modele: '', cle: '', cleClaude: '', modeleClaude: MODELE_CLAUDE }; } }
export function ecrireConfig(c: ConfigIA) { try { localStorage.setItem(CLE, JSON.stringify(c)); } catch { /* stockage indisponible */ } }
export const assistantActif = () => { const c = lireConfig(); return c.mode === 'local' ? !!moteurLocal : c.mode === 'claude' ? !!c.cleClaude : c.mode === 'serveur' && !!c.url && !!c.modele; };
// Compteur d'usage de l'API Claude, gardé dans le navigateur : nombre d'appels et de jetons, pour suivre la dépense.
const CLE_USAGE = 'mandat-assistant-usage';
export function lireUsage(): { appels: number; entree: number; sortie: number } { try { const o = JSON.parse(localStorage.getItem(CLE_USAGE) || '{}'); return { appels: +o.appels || 0, entree: +o.entree || 0, sortie: +o.sortie || 0 }; } catch { return { appels: 0, entree: 0, sortie: 0 }; } }
export function remettreUsage() { try { localStorage.removeItem(CLE_USAGE); } catch { /* stockage indisponible */ } }
function compter(entree: number, sortie: number) { const u = lireUsage(); try { localStorage.setItem(CLE_USAGE, JSON.stringify({ appels: u.appels + 1, entree: u.entree + entree, sortie: u.sortie + sortie })); } catch { /* stockage indisponible */ } }

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
  if (c.mode === 'claude') { // API Claude appelée directement depuis le navigateur. La clé reste dans le stockage local de ce navigateur.
    if (!c.cleClaude) throw new Error('Clé API Claude manquante. Collez-la dans le menu.'); const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 45000);
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json', 'x-api-key': c.cleClaude, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: c.modeleClaude || MODELE_CLAUDE, max_tokens: max, system: systeme, messages: [{ role: 'user', content: utilisateur }] }) });
      if (!r.ok) { let detail = ''; try { detail = (await r.json())?.error?.message ?? ''; } catch { /* pas de détail */ } throw new Error(r.status === 401 ? 'Clé API refusée.' : r.status === 404 ? `Modèle inconnu : ${c.modeleClaude}.` : r.status === 429 ? 'Limite atteinte, réessayez dans un instant.' : r.status === 400 && /credit/i.test(detail) ? 'Crédit épuisé sur le compte API.' : `Claude répond ${r.status}. ${detail}`.trim()); }
      const j = await r.json(); const txt = (j?.content ?? []).filter((b: any) => b?.type === 'text').map((b: any) => b.text).join('').trim(); compter(+j?.usage?.input_tokens || 0, +j?.usage?.output_tokens || 0); if (!txt) throw new Error('Réponse vide.'); return txt;
    } finally { clearTimeout(t); }
  }
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

// Développe un article de l'actualité simulée. Le modèle reçoit les faits du jeu et ne doit rien y ajouter sur des personnes réelles.
export async function developper(titre: string, chapo: string, corps: string): Promise<string> {
  const t = await demander(`${REGLES}\nTu es journaliste dans un jeu de simulation politique. Tu rédiges un article court, sobre et factuel, en français, à partir des seuls éléments fournis. Tu n'inventes aucun nom de personne et tu ne cites aucune personnalité réelle.`, `Titre : ${titre}\nChapô : ${chapo}\nÉléments : ${corps}\n\nRédige l'article en 110 à 150 mots, en trois paragraphes, sans titre, sans liste.`, 420);
  return t.replace(/^\s*["«]|["»]\s*$/g, '').slice(0, 1400);
}

// ---------- Usages étendus (surtout utiles avec un modèle fort, comme Claude) ----------
// Une réponse à une publication du réseau, dans le ton demandé.
export async function proposerReponse(o: { cible: string; sujet: string; parti: string; ligne: string; ton: string; adverse: boolean }): Promise<string> {
  const t = await demander(`${REGLES} Tu rédiges une réponse courte sur un réseau social, dans un jeu de gestion politique. Moins de 240 caractères, une seule réponse, sans guillemets.`, `Je suis du parti ${o.parti}. Ligne du parti : ${o.ligne || 'non précisée'}.\nSujet : ${o.sujet}.\nPublication à laquelle je réponds${o.adverse ? ' (un adversaire politique)' : ''} : ${o.cible}\nTon voulu : ${nomTon(o.ton)}.\nÉcris seulement ma réponse. Réponds sur le fond, sans attaque personnelle.`, 160);
  return t.replace(/^["«\s]+|["»\s]+$/g, '').slice(0, 280);
}
// Le mot du directeur de campagne : une lecture de la situation à partir des chiffres du jeu.
export async function conseiller(contexte: string): Promise<string> {
  return (await demander(`${REGLES} Tu es le directeur de campagne du joueur dans un jeu de gestion politique. Tu lis sa situation et tu lui dis quoi faire cette semaine. Tu tutoies. Trois priorités au plus, classées, chacune en une phrase qui commence par un verbe, puis une phrase sur le risque principal. Pas de liste à puces, pas de titre. Tu ne cites aucune personne. Tu t'appuies seulement sur les éléments fournis et sur les écrans du jeu : Terrain, Agora, Carnet, Annuaire des élus, Actualité, Mon parcours.`, contexte, 300)).slice(0, 1100);
}
// Biographie et slogan du personnage du joueur (personnage de fiction uniquement).
export async function proposerBio(o: { prenom: string; age: number; lieu: string; parti: string; rang: string; metier: string; style: string }): Promise<{ bio: string; slogan: string }> {
  const t = await demander(`${REGLES} Tu écris la présentation d'un personnage de fiction dans un jeu de gestion politique.`, `Personnage : ${o.prenom}, ${o.age} ans, ${o.metier || 'actif'}, ${o.rang} du parti ${o.parti} à ${o.lieu}. Style : ${o.style}.\nÉcris deux lignes avec ces préfixes exacts :\nSLOGAN: un slogan personnel de moins de 70 caractères\nBIO: une biographie à la première personne de moins de 380 caractères (d'où je viens, ce que je fais, pourquoi je m'engage)\nN'écris rien d'autre.`, 260);
  const lire = (p: string) => { const m = new RegExp(`${p}\\s*:\\s*([\\s\\S]+?)(?=\\n[A-Z]+\\s*:|$)`, 'i').exec(t); return m ? m[1].trim().replace(/^["«\s]+|["»\s]+$/g, '') : ''; };
  return { bio: lire('BIO').slice(0, 400), slogan: lire('SLOGAN').slice(0, 80) };
}
// Réactions d'abonnés sous une publication du joueur : comptes anonymes de fiction.
export async function reactionsAbonnes(o: { texte: string; sujet: string; etat: string }): Promise<string[]> {
  const t = await demander(`${REGLES} Tu écris des commentaires d'anonymes sous une publication politique, dans un jeu. Chaque commentaire fait moins de 110 caractères, langage courant, sans insulte.`, `Publication : ${o.texte}\nSujet : ${o.sujet}. Accueil : ${o.etat === 'polemique' ? 'la publication est moquée' : o.etat === 'buzz' ? 'la publication plaît beaucoup' : 'accueil partagé'}.\nÉcris quatre commentaires variés (un soutien, une critique, une question concrète, une remarque de terrain), un par ligne, sans numéro ni tiret.`, 220);
  return t.split('\n').map(x => x.replace(/^[\s\-•\d.)]+/, '').replace(/^["«\s]+|["»\s]+$/g, '').trim()).filter(x => x.length > 8).slice(0, 4).map(x => x.slice(0, 140));
}
