// Chargement des données depuis le disque (tests, scripts de calibrage et d'équilibrage).
import { assembler, FICHIERS } from '../engine/donnees';
import type { Donnees } from '../engine/types';
declare const process: any;
export async function chargerDonneesNode(dossier = 'public/data'): Promise<Donnees> {
  // @ts-ignore (module Node, absent des types du navigateur)
  const fs = await import('node:fs'); const brut: Record<string, any> = {};
  for (const f of FICHIERS) brut[f] = JSON.parse(fs.readFileSync(`${dossier}/${f}.json`, 'utf8'));
  return assembler(brut);
}
