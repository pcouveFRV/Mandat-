// Simulation automatique : joue des parties complètes jusqu'en 2050 avec uniquement des IA et écrit docs/EQUILIBRAGE.md.
// Usage : npx tsx scripts/equilibrage.ts            (20 parties, puis rapport)
//         npx tsx scripts/equilibrage.ts --debut 1 --n 10 --sortie a.json   (lot partiel, pour lancer plusieurs processus)
//         npx tsx scripts/equilibrage.ts --rapport a.json b.json            (fusionne des lots et écrit le rapport)
import { chargerDonneesNode } from '../src/data/chargementNode';
import { creerPartie } from '../src/engine/creation';
import { tour } from '../src/engine/tour';
import { SEMAINE_FIN, annee } from '../src/engine/calendrier';
import { score } from '../src/engine/victoire';
declare const process: any;
// @ts-ignore (module Node, absent des types du navigateur)
const fs = await import('node:fs');
const arg = (k: string, d: string) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };

interface Partie { graine: number; parti: string; presidents: { an: number; parti: string; nom: string; pct: number }[]; legislatives: { an: number; premier: string; sieges: number; majorite: string }[]; municipales: { an: number; premier: string; villes: number }[]; scissions: number; faillites: number; tresoMin: number; tresoMax: number; tresoMed: number; abst: Record<string, number[]>; uniteMin: number; credMin: number; credMax: number; intFin: Record<string, number>; intMax: number; score: number; msTour: number; msMax: number; persos: number; adhMax: number; partisActifs: number }

async function jouer(debut: number, n: number): Promise<Partie[]> {
  const d = await chargerDonneesNode(); const ids = d.partis.filter(p => !p.id.startsWith('NP')).map(p => p.id); const out: Partie[] = [];
  for (let g = debut; g < debut + n; g++) {
    const parti = ids[g % ids.length]; const e = creerPartie(d, { scenario: g % 2 ? 'route2027' : 'municipales2026', mode: 'parti', parti, graine: g * 7919 }); e.options.auto = true;
    const t0 = Date.now(); let nT = 0, msMax = 0, uniteMin = 100, credMin = 100, credMax = 0, intMax = 0, adhMax = 0;
    while (e.semaine < SEMAINE_FIN) { const t = Date.now(); tour(e, d); const dt = Date.now() - t; if (dt > msMax) msMax = dt; nT++; e.joueur.fin = undefined; e.inbox.length = Math.min(e.inbox.length, 50);
      if (nT % 13 === 0) for (const P of e.partis) { if (!P.actif) continue; if (P.unite < uniteMin) uniteMin = P.unite; if (P.credibilite < credMin) credMin = P.credibilite; if (P.credibilite > credMax) credMax = P.credibilite; if ((e.intentions[P.idx] ?? 0) > intMax) intMax = e.intentions[P.idx]; if (P.adherents > adhMax) adhMax = P.adherents; for (const k of ['tresorerie', 'adherents', 'credibilite', 'notoriete', 'unite', 'capital'] as const) if (!Number.isFinite(P[k])) throw new Error(`Valeur non finie : ${P.sigle}.${k} (graine ${g})`); } }
    const tr = e.partis.filter(P => P.actif).map(P => P.tresorerie).sort((a, b) => a - b); const abst: Record<string, number[]> = {}; for (const a of e.abstentionHist) (abst[a.type] ??= []).push(a.v);
    out.push({ graine: g, parti, presidents: e.archives.filter(a => a.type === 'presidentielle' && a.tour === 2).map(a => ({ an: annee(a.s), parti: e.partis[a.national[0].partis[0]].id, nom: a.national[0].nom, pct: a.national[0].pct })),
      legislatives: e.archives.filter(a => a.type === 'legislatives' && a.tour === 2).map(a => ({ an: annee(a.s), premier: a.national[0].nom, sieges: a.national[0].sieges ?? 0, majorite: /absolue \(/.test(a.resume) ? 'absolue' : /coalition/.test(a.resume) ? 'coalition' : 'minoritaire' })),
      municipales: e.archives.filter(a => a.type === 'municipales' && a.tour === 2).map(a => ({ an: annee(a.s), premier: a.national[0].nom, villes: a.national[0].sieges ?? 0 })),
      scissions: e.partis.reduce((s, P) => s + (P.scoreIA.scissions ?? 0), 0), faillites: e.partis.reduce((s, P) => s + (P.scoreIA.faillites ?? 0), 0), tresoMin: tr[0], tresoMax: tr[tr.length - 1], tresoMed: tr[tr.length >> 1], abst, uniteMin, credMin, credMax,
      intFin: Object.fromEntries(e.partis.filter(P => P.actif).map(P => [P.id, Math.round(1000 * e.intentions[P.idx]) / 10])), intMax, score: score(e, d), msTour: (Date.now() - t0) / nT, msMax, persos: e.persos.length, adhMax, partisActifs: e.partis.filter(P => P.actif).length });
    console.log(`partie ${g} (${parti}) : ${nT} tours, ${Math.round((Date.now() - t0) / 1000)} s, présidents ${out[out.length - 1].presidents.map(p => p.parti).join(' ')}`);
  }
  return out;
}
function rapport(l: Partie[]) {
  const compte = (xs: string[]) => { const c: Record<string, number> = {}; for (const x of xs) c[x] = (c[x] ?? 0) + 1; return Object.entries(c).sort((a, b) => b[1] - a[1]); };
  const pres = compte(l.flatMap(p => p.presidents.map(x => x.parti))); const nbPres = l.reduce((s, p) => s + p.presidents.length, 0); const leg = compte(l.flatMap(p => p.legislatives.map(x => x.premier))); const maj = compte(l.flatMap(p => p.legislatives.map(x => x.majorite))); const mun = compte(l.flatMap(p => p.municipales.map(x => x.premier)));
  const altern = l.map(p => p.presidents.filter((x, i) => i > 0 && x.parti !== p.presidents[i - 1].parti).length); const moy = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1); const med = (xs: number[]) => xs.slice().sort((a, b) => a - b)[xs.length >> 1]; const r1 = (x: number) => Math.round(x * 10) / 10; const M = (x: number) => `${(x / 1e6).toFixed(1).replace('.', ',')} M€`;
  const types = ['presidentielle', 'legislatives', 'municipales', 'europeennes', 'regionales', 'departementales'];
  const partis = Object.keys(l[0].intFin); const sc = l.map(p => p.score).sort((a, b) => a - b);
  let md = `# Rapport d'équilibrage\n\nProduit par \`scripts/equilibrage.ts\` : ${l.length} parties complètes jusqu'en 2050, jouées uniquement par les IA (le parti du joueur est lui aussi piloté par l'IA). Graines ${l[0].graine} à ${l[l.length - 1].graine}, scénarios « Après les municipales 2026 » et « La route de 2027 » en alternance.\n\n`;
  md += `## Qui gagne quoi\n\n### Présidentielle (${nbPres} scrutins)\n\n| Parti | Victoires | Part |\n|---|---|---|\n${pres.map(([k, v]) => `| ${k} | ${v} | ${Math.round(100 * v / nbPres)} % |`).join('\n')}\n\n`;
  md += `Alternances à l'Élysée par partie (changement de parti entre deux présidentielles) : moyenne ${r1(moy(altern))}, minimum ${Math.min(...altern)}, maximum ${Math.max(...altern)}. Nombre de partis différents ayant gagné au moins une présidentielle : ${pres.length}.\n\n`;
  md += `### Législatives : premier groupe à l'Assemblée\n\n| Parti | Fois premier groupe |\n|---|---|\n${leg.map(([k, v]) => `| ${k} | ${v} |`).join('\n')}\n\nType de majorité : ${maj.map(([k, v]) => `${k} ${v}`).join(', ')}.\n\n`;
  md += `### Municipales : parti qui dirige le plus de villes simulées\n\n${mun.map(([k, v]) => `${k} ${v} fois`).join(', ')}.\n\n`;
  md += `## Parties une par une\n\n| Graine | Présidents élus | Premiers groupes aux législatives |\n|---|---|---|\n${l.map(p => `| ${p.graine} | ${p.presidents.map(x => `${x.an} ${x.parti} (${String(x.pct).replace('.', ',')} %)`).join(', ')} | ${p.legislatives.map(x => `${x.an} ${x.premier} ${x.sieges}`).join(', ')} |`).join('\n')}\n\n`;
  md += `## Intentions de vote en 2050 (moyenne, minimum, maximum sur les parties)\n\n| Parti | Moyenne | Min | Max |\n|---|---|---|---|\n${partis.map(k => { const xs = l.map(p => p.intFin[k] ?? 0); return `| ${k} | ${r1(moy(xs))} % | ${r1(Math.min(...xs))} % | ${r1(Math.max(...xs))} % |`; }).join('\n')}\n\nPlus haut niveau d'intentions atteint par un parti, toutes parties confondues : ${r1(100 * Math.max(...l.map(p => p.intMax)))} %.\n\n`;
  md += `## Stabilité\n\n- Scissions : ${l.reduce((s, p) => s + p.scissions, 0)} au total, ${r1(moy(l.map(p => p.scissions)))} par partie en moyenne (maximum ${Math.max(...l.map(p => p.scissions))}).\n- Plans de sauvetage après une quasi-faillite : ${l.reduce((s, p) => s + p.faillites, 0)} au total, ${r1(moy(l.map(p => p.faillites)))} par partie.\n- Trésoreries en 2050 : la plus basse ${M(Math.min(...l.map(p => p.tresoMin)))}, médiane des médianes ${M(med(l.map(p => p.tresoMed)))}, la plus haute ${M(Math.max(...l.map(p => p.tresoMax)))}.\n- Plus grand nombre d'adhérents atteint par un parti : ${Math.round(Math.max(...l.map(p => p.adhMax))).toLocaleString('fr-FR')}.\n- Unité : minimum observé ${r1(Math.min(...l.map(p => p.uniteMin)))}. Crédibilité : de ${r1(Math.min(...l.map(p => p.credMin)))} à ${r1(Math.max(...l.map(p => p.credMax)))}. Aucune valeur non finie.\n- Partis actifs en 2050 : de ${Math.min(...l.map(p => p.partisActifs))} à ${Math.max(...l.map(p => p.partisActifs))} (19 au départ, 2 partis de réserve pour les scissions et les fondations).\n\n`;
  md += `## Abstention\n\n| Scrutin | Premier scrutin simulé | Dernier scrutin simulé | Moyenne |\n|---|---|---|---|\n${types.map(t => { const a = l.map(p => p.abst[t] ?? []).filter(x => x.length); if (!a.length) return ''; return `| ${t} | ${r1(moy(a.map(x => x[0])))} % | ${r1(moy(a.map(x => x[x.length - 1])))} % | ${r1(moy(a.flat()))} % |`; }).filter(Boolean).join('\n')}\n\n`;
  md += `## Scores\n\nScore final du parti « joueur » piloté par l'IA : minimum ${sc[0]}, médiane ${sc[sc.length >> 1]}, maximum ${sc[sc.length - 1]}.\n\n| Graine | Parti | Score |\n|---|---|---|\n${l.map(p => `| ${p.graine} | ${p.parti} | ${p.score} |`).join('\n')}\n\n`;
  md += `## Performance\n\n- Durée moyenne d'une semaine simulée : ${r1(moy(l.map(p => p.msTour)))} ms (objectif : moins de 200 ms).\n- Semaine la plus lente (soir d'élection) : ${Math.max(...l.map(p => p.msMax))} ms.\n- Une année d'avance rapide : environ ${r1(moy(l.map(p => p.msTour)) * 52 / 1000)} s (objectif : moins de 15 s).\n- Personnages en fin de partie : ${Math.round(moy(l.map(p => p.persos)))} en moyenne.\n\nMesures prises sur la machine de construction (2 coeurs), moteur seul, hors interface.\n`;
  fs.writeFileSync('docs/EQUILIBRAGE.md', md); console.log('docs/EQUILIBRAGE.md écrit');
}
const iR = process.argv.indexOf('--rapport');
if (iR >= 0) rapport(process.argv.slice(iR + 1).flatMap((f: string) => JSON.parse(fs.readFileSync(f, 'utf8'))));
else { const l = await jouer(+arg('debut', '1'), +arg('n', '20')); const s = arg('sortie', ''); if (s) fs.writeFileSync(s, JSON.stringify(l)); else rapport(l); }
