// Télécharge les logos des partis depuis Wikimedia Commons, en ne gardant que les fichiers sous licence libre
// ou du domaine public. Lancé par le workflow « Logos des partis » sur un serveur GitHub.
// Sortie : scripts/data/logos-candidats/<PARTI>_<n>.<ext> et candidats.json (titre, licence, auteur, page).
import fs from 'node:fs';
const SORTIE = 'scripts/data/logos-candidats'; fs.mkdirSync(SORTIE, { recursive: true });
const API = 'https://commons.wikimedia.org/w/api.php'; const UA = { 'User-Agent': 'MandatPolitiqueManager/1.0 (https://github.com/pcouveFRV/Mandat-; jeu personnel)' };
const PARTIS = {
  LO: [['Lutte ouvrière logo', 'Logo Lutte ouvrière'], /lutte.?ouvri/i],
  LFI: [['La France insoumise logo', 'Logo LFI', 'France insoumise phi'], /insoumise|lfi/i],
  PCF: [['Parti communiste français logo', 'Logo PCF'], /pcf|communiste fran/i],
  PS: [['Parti socialiste (France) logo', 'Logo PS France 2023', 'Logo du Parti socialiste France', 'Parti socialiste France poing et rose'], /parti.?socialiste|\bps\b/i],
  ECO: [['Les Écologistes logo', 'Europe Écologie Les Verts logo', 'Logo EELV'], /cologistes|eelv|cologie.les.verts/i],
  PP: [['Place publique', 'Logo Place publique', 'Place publique Glucksmann'], /place.?publique/i],
  RE: [['Renaissance parti logo', 'Logo Renaissance RE parti France'], /renaissance/i],
  MDM: [['MoDem logo', 'Mouvement démocrate logo'], /modem|mouvement.d.mocrate/i],
  HOR: [['Horizons parti logo', 'Logo Horizons Édouard Philippe'], /horizons/i],
  UDI: [['Union des démocrates et indépendants logo', 'Logo UDI'], /\budi\b|d.mocrates.et.ind/i],
  LR: [['Les Républicains logo', 'Logo Les Républicains France'], /r.publicains/i],
  UDR: [['Union des droites pour la République logo', 'Logo UDR Ciotti'], /\budr\b|union.des.droites/i],
  RN: [['Rassemblement national logo', 'Logo Rassemblement National flamme'], /rassemblement.?national|\brn\b/i],
  REC: [['Reconquête logo parti', 'Logo Reconquête Zemmour'], /reconqu/i],
  DLF: [['Debout la France logo', 'Logo DLF'], /debout.la.france|\bdlf\b/i],
};
const LIBRE = /public domain|^pd|cc0|cc[ -]by|domaine public/i;
const appel = async (params) => { const u = API + '?' + new URLSearchParams({ format: 'json', origin: '*', ...params }); const r = await fetch(u, { headers: UA }); if (!r.ok) throw new Error(`${r.status} ${u}`); return r.json(); };
const texte = (x) => String(x?.value ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);
const bilan = {};
for (const [id, [requetes, motif]] of Object.entries(PARTIS)) {
  const vus = new Set(); const retenus = []; bilan[id] = { retenus, ecartes: [] };
  for (const q of requetes) {
    let o; try { o = await appel({ action: 'query', generator: 'search', gsrsearch: `${q} filetype:bitmap|drawing`, gsrnamespace: '6', gsrlimit: '12', prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: '320' }); } catch (e) { console.log(id, 'erreur', String(e)); continue; }
    const pages = Object.values(o?.query?.pages ?? {}).sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
    for (const p of pages) {
      if (vus.has(p.title)) continue; vus.add(p.title); const ii = p.imageinfo?.[0]; if (!ii) continue; const m = ii.extmetadata ?? {};
      const licence = texte(m.LicenseShortName) || texte(m.UsageTerms); const fiche = { titre: p.title, licence, auteur: texte(m.Artist), page: ii.descriptionurl, mime: ii.mime };
      if (!motif.test(p.title) || (id !== 'PP' && !/logo|embl|symbol/i.test(p.title)) || /belgi|unifi|suisse|wallon|luxemb|s.n.gal|jeunes|groupe/i.test(p.title)) continue;
      if (!/svg|png/.test(ii.mime)) continue;
      if (!LIBRE.test(licence)) { bilan[id].ecartes.push(fiche); continue; }
      if (retenus.length >= 8) continue;
      const ext = ii.mime.includes('svg') ? 'svg' : 'png'; const url = ext === 'svg' ? ii.url : (ii.thumburl ?? ii.url);
      try { const r = await fetch(url, { headers: UA }); if (!r.ok) throw new Error(String(r.status)); const buf = Buffer.from(await r.arrayBuffer()); if (buf.length > 600000) { bilan[id].ecartes.push({ ...fiche, raison: 'trop lourd' }); continue; } const nom = `${id}_${retenus.length + 1}.${ext}`; fs.writeFileSync(`${SORTIE}/${nom}`, buf); retenus.push({ ...fiche, fichier: nom, octets: buf.length }); } catch (e) { console.log(id, 'téléchargement impossible', p.title, String(e)); }
      await new Promise(r => setTimeout(r, 300));
    }
  }
  console.log(id, retenus.length, 'retenus,', bilan[id].ecartes.length, 'écartés (licence)');
}
fs.writeFileSync(`${SORTIE}/candidats.json`, JSON.stringify(bilan, null, 1));
