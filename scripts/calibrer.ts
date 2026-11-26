// Calibrage : ajuste les proximités initiales pour que le moteur reproduise le premier tour des législatives 2024, puis affiche l'écart.
// Le calibrage est refait à chaque création de partie (moins d'une seconde) : ce script sert à le contrôler après une modification des données.
// Usage : npx tsx scripts/calibrer.ts [graine]
import { chargerDonneesNode } from '../src/data/chargementNode';
import { creerPartie } from '../src/engine/creation';
import { ecartCalibrage } from '../src/engine/systems/electorat';
declare const process: any;
const d = await chargerDonneesNode(); const t = Date.now();
const e = creerPartie(d, { scenario: 'route2027', mode: 'parti', parti: 'PS', graine: +(process.argv[2] ?? 1) });
const r = ecartCalibrage(e, d);
console.log(`Partie créée et calibrée en ${Date.now() - t} ms`);
console.log(`Écart moyen par circonscription et par bloc : ${r.moyen.toFixed(2)} points. 90 % des écarts sous ${r.p90.toFixed(2)} points. Écart maximal : ${r.max.toFixed(1)} points.`);
console.log('National (premier tour 2024) :'); for (const b of r.national) console.log(`  ${b.bloc.padEnd(18)} réel ${String(b.reel).padStart(5)} %   simulé ${String(b.simule).padStart(5)} %`);
console.log('Circonscriptions les moins bien reproduites :', r.pires.map(p => `${p.circo} (${p.ecart})`).join(', '));
console.log('Intentions de départ :', e.partis.filter(p => p.actif).map(p => `${p.sigle} ${(e.intentions[p.idx] * 100).toFixed(1)}`).join(', '));
