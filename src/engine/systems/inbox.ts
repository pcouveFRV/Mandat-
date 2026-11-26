// Boîte de réception : création des messages adressés au joueur.
import type { Etat, Ctx, Message } from '../types';

export function message(e: Etat, ctx: Ctx | null, cat: string, titre: string, texte: string, important = false, extra: Partial<Message> = {}): Message {
  const m: Message = { id: e.prochainMsg++, s: e.semaine, cat, titre, texte, lu: false, important, ...extra };
  e.inbox.push(m); if (ctx) ctx.messages.push(m);
  if (e.inbox.length > 500) { const i = e.inbox.findIndex(x => x.lu && !(x.choix && x.repondu === undefined)); e.inbox.splice(i >= 0 ? i : 0, 1); }
  return m;
}
export function journal(e: Etat, t: string) { e.journal.push({ s: e.semaine, t }); if (e.journal.length > 400) e.journal.shift(); }
