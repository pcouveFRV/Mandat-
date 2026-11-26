// Tour de jeu : une semaine. L'ordre d'exécution des systèmes est documenté dans docs/MOTEUR.md.
// Chaque système est une fonction déterministe de (état, données, générateur aléatoire, contexte) : il ne lit et n'écrit rien d'autre
// que l'état de jeu et la liste des messages. Pour la performance, le tour travaille sur l'état en place (pas de copie à chaque système).
import { tourExecutif } from './systems/executif';
import { tourAgora } from './systems/agora';
import type { Donnees, Etat, Ctx, Message } from './types';
import { Rng } from './rng';
import { mois, annee, SEMAINE_FIN } from './calendrier';
import { tourEvenements } from './systems/evenements';
import { tourMedias } from './systems/medias';
import { tourPartis, recalculerCourants } from './systems/partis';
import { tourCampagnes, controleComptes } from './systems/campagnes';
import { tourIA } from './systems/ia';
import { tourDoctrine } from './systems/doctrine';
import { tourScrutins } from './systems/scrutins';
import { tourFinances } from './systems/finances';
import { progressionMensuelle, cycleAnnuel } from './systems/personnages';
import { tourMandats } from './systems/mandats';
import { tourJustice } from './systems/justice';
import { tourSondages } from './systems/sondages';
import { tourCarriere } from './systems/carriere';
import { tourVictoire } from './victoire';

export function tour(e: Etat, d: Donnees): Message[] {
  const ctx: Ctx = { d, messages: [] }; if (e.joueur.fin && e.joueur.fin.type !== 'fin' && false) return []; if (e.semaine >= SEMAINE_FIN + 1) return [];
  const rng = new Rng(e.rng); e.semaine++; e.soiree = null;
  const nouveauMois = mois(e.semaine) !== mois(e.semaine - 1); const nouvelleAnnee = annee(e.semaine) !== annee(e.semaine - 1);
  tourEvenements(e, d, rng, ctx);   // 1. actualité, chocs sur les priorités, réactions
  tourMedias(e, d, rng, ctx);       // 2. invitations, passages médias
  tourAgora(e, d, rng, ctx);        // 2 bis. réseau social : tendances, publications, abonnés
  tourPartis(e, d, rng, ctx);       // 3. ressources des partis, terrain, congrès, scissions
  tourCampagnes(e, d, rng, ctx);    // 4. ouverture des campagnes, dépenses, parrainages
  tourIA(e, d, rng, ctx);           // 5. décisions des partis IA
  tourDoctrine(e);                  // 6. doctrine (mémoire des mouvements récents)
  tourScrutins(e, d, rng, ctx);     // 7. premiers et seconds tours
  // Les fidélités héritées de 2024 s'érodent : au fil des ans, c'est ce que les partis font en jeu qui compte.
  if (nouveauMois) { const px = e.prox; for (let i = 0; i < px.length; i++) px[i] *= px[i] > 0 ? 0.995 : 0.998; }
  if (nouveauMois) { tourFinances(e, d, rng, ctx); progressionMensuelle(e, d, rng); tourMandats(e, d, rng, ctx); if (mois(e.semaine) % 3 === 0) for (const P of e.partis) if (P.actif) recalculerCourants(e, d, P); } // 8. tour mensuel
  if (nouvelleAnnee) cycleAnnuel(e, d, rng, ctx); // 9. tour annuel : retraits, nouveaux talents
  tourExecutif(e, d, rng, ctx);     // 9 bis. réformes, censure, référendum
  tourJustice(e, d, rng, ctx); controleComptes(e, d, rng, ctx); // 10. affaires, comptes de campagne
  tourSondages(e, d, rng, ctx);     // 11. intentions de vote et sondages
  tourCarriere(e, d, rng, ctx);     // 12. mode Carrière
  tourVictoire(e, d, ctx);          // 13. victoire, défaite, fin de partie
  e.rng = rng.s; return ctx.messages;
}
