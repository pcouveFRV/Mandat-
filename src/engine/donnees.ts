// Assemble les données statiques à partir des fichiers JSON bruts et calcule les index.
import type { Donnees, Zone, Ville } from './types';

export const FICHIERS = ['partis', 'segments', 'doctrine', 'evenements', 'medias', 'traits', 'noms', 'personnalites', 'zones', 'socio', 'circos', 'depts', 'regions'] as const;

// Partis de réserve : activés quand le joueur fonde un parti ou lors d'une scission majeure.
const RESERVE = [
  { id: 'NP1', sigle: 'NP', nom: 'Nouveau parti', couleur: '#9b59b6' },
  { id: 'NP2', sigle: 'MVT', nom: 'Nouveau mouvement', couleur: '#16a085' },
];

export function siegesMunicipaux(pop: number): number {
  const T: [number, number][] = [[20000, 33], [30000, 35], [40000, 39], [50000, 43], [60000, 45], [80000, 49], [100000, 53], [150000, 55], [200000, 59], [250000, 61], [300000, 65]];
  for (const [p, s] of T) if (pop < p) return s; return 69;
}
export const SIEGES_REGION: Record<string, number> = { '11': 209, '84': 204, '75': 183, '76': 158, '32': 170, '44': 169, '93': 123, '52': 93, '53': 83, '28': 102, '27': 100, '24': 77, '94': 63, '01': 41, '02': 51, '03': 55, '04': 45, '06': 26 };

export function assembler(brut: Record<string, any>): Donnees {
  const partis = [...brut.partis.partis, ...RESERVE.map(r => ({ ...r, axes: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], tresorerie: 0, adherents: 0, notoriete: 0, credibilite: 40, unite: 80, strategie: 'presidentielle', style: 'offensif', famille: 'centre', notabilite: 0.1, dette: 0 }))];
  const depts = brut.depts; const regions = brut.regions; const circos = brut.circos;
  const idx = (l: any[], k: string) => Object.fromEntries(l.map((x, i) => [x[k], i]));
  const idxParti = idx(partis, 'id'), idxDept = idx(depts, 'code'), idxRegion = idx(regions, 'code'), idxCirco = idx(circos, 'id');
  const zones: Zone[] = brut.zones.zones.map((z: any[], i: number) => ({ idx: i, id: z[0], nom: z[1], type: z[2], dept: z[3], deptIdx: idxDept[z[3]] ?? 0, regIdx: idxRegion[depts[idxDept[z[3]] ?? 0].region] ?? 0, pop: z[4], inscrits: z[5], terr: z[6], lon: z[7], lat: z[8], circos: z[9], ville: z[10], nbCommunes: z[11], cantons: z[12] }));
  const idxZone = idx(zones, 'id');
  const zonesParDept: number[][] = depts.map(() => []); const zonesParCirco: [number, number][][] = circos.map(() => []);
  for (const z of zones) { zonesParDept[z.deptIdx].push(z.idx); for (const [c, f] of z.circos) zonesParCirco[c].push([z.idx, f / 100]); }
  // Villes
  const villes: Ville[] = []; const meres: Record<string, number> = {};
  const PLM: Record<string, [string, number]> = { Paris: ['V75', 163], Lyon: ['V69', 73], Marseille: ['V13', 111] };
  for (const nom of Object.keys(PLM)) { const zs = zones.filter(z => z.ville === nom); if (!zs.length) continue; meres[nom] = villes.length; villes.push({ idx: villes.length, id: PLM[nom][0], nom, zones: zs.map(z => z.idx), pop: zs.reduce((a, z) => a + z.pop, 0), sieges: PLM[nom][1], prime: 0.25, plm: 1, mere: -1, dept: zs[0].dept, deptIdx: zs[0].deptIdx }); }
  for (const z of zones) {
    if (z.type === 0) villes.push({ idx: villes.length, id: z.id, nom: z.nom, zones: [z.idx], pop: z.pop, sieges: siegesMunicipaux(z.pop), prime: 0.5, plm: 0, mere: -1, dept: z.dept, deptIdx: z.deptIdx });
    else if (z.type === 2) villes.push({ idx: villes.length, id: z.id, nom: z.nom, zones: [z.idx], pop: z.pop, sieges: Math.max(13, Math.round(z.pop / 5500)), prime: 0.5, plm: 2, mere: meres[z.ville!], dept: z.dept, deptIdx: z.deptIdx });
  }
  return {
    partis, nuances: brut.partis.nuances, segments: brut.segments.segments, axes: brut.doctrine.axes, themes: brut.doctrine.themes, propositions: brut.doctrine.propositions,
    evenements: brut.evenements.evenements, medias: brut.medias.medias, traits: brut.traits.traits, noms: brut.noms, personnalites: brut.personnalites.personnalites, mairesImposes: brut.personnalites.maires ?? [], affiliations: brut.personnalites.affiliations ?? {},
    zones, socio: brut.socio.poids, circos, depts, regions, idxParti, idxDept, idxRegion, idxCirco, idxZone, zonesParDept, zonesParCirco, villes, idxVille: idx(villes, 'id'),
    traitsParId: Object.fromEntries(brut.traits.traits.map((t: any) => [t.id, t])),
  };
}
