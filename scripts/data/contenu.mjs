// Génère les fichiers de contenu du jeu (partis, segments, doctrine, traits, médias, noms, événements).
// Usage : node scripts/data/contenu.mjs
// Les fichiers produits sont lisibles et modifiables à la main. Attention : relancer ce script écrase les modifications manuelles
// de ces fichiers (sauf personnalites.json, qui n'est jamais écrasé s'il existe déjà : passer --tout pour forcer).
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
const OUT = 'public/data'; mkdirSync(OUT, { recursive: true });
const ecrire = (f, o) => { writeFileSync(`${OUT}/${f}`, JSON.stringify(o, null, 1)); console.log(f); };

// ---------- Doctrine ----------
const AXES = [
  ['economie', 'Économie', 'Économie dirigée, redistribution', 'Économie libérale, baisse des impôts'],
  ['immigration', 'Immigration', 'Ouverture et régularisations', 'Fermeté et réduction des flux'],
  ['europe', 'Europe', 'Souveraineté nationale', 'Intégration européenne'],
  ['securite', 'Sécurité et justice', 'Prévention et libertés', 'Ordre et fermeté pénale'],
  ['ecologie', 'Écologie', 'Priorité à la production', 'Transition écologique rapide'],
  ['societe', 'Questions de société', 'Conservatisme', 'Progressisme'],
  ['institutions', 'Institutions', 'Ve République et exécutif fort', 'Nouvelle République et démocratie directe'],
  ['social', 'Protection sociale', 'Responsabilité individuelle, baisse des dépenses', 'Protection sociale étendue'],
  ['etranger', 'Politique étrangère', 'Non-alignement', 'Alliance atlantique et soutien à l\'Ukraine'],
  ['decentralisation', 'Décentralisation', 'État central fort', 'Pouvoir aux territoires'],
];
const THEMES = ['pouvoir_achat', 'securite', 'immigration', 'sante', 'ecole', 'emploi', 'ecologie', 'retraites', 'logement', 'services_publics', 'europe', 'identite', 'dette', 'transports', 'agriculture'];
const THEMES_NOM = ['Pouvoir d\'achat', 'Sécurité', 'Immigration', 'Santé', 'École', 'Emploi', 'Écologie', 'Retraites', 'Logement', 'Services publics', 'Europe', 'Identité', 'Dette', 'Transports', 'Agriculture'];
// Poids de chaque axe dans chaque thème (lignes = thèmes, colonnes = axes).
const THEME_AXES = [
  [3, 0, 0, 0, 0, 0, 0, 2, 0, 0], [0, 1, 0, 4, 0, 0, 0, 0, 0, 0], [0, 4, 1, 1, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0, 0, 3, 0, 1], [1, 0, 0, 0, 0, 2, 0, 1, 0, 1],
  [3, 0, 1, 0, 1, 0, 0, 1, 0, 0], [1, 0, 0, 0, 4, 0, 0, 0, 0, 0], [2, 0, 0, 0, 0, 0, 0, 3, 0, 0], [2, 0, 0, 0, 1, 0, 0, 2, 0, 1], [1, 0, 0, 0, 0, 0, 0, 3, 0, 2],
  [0, 0, 4, 0, 0, 0, 0, 0, 1, 0], [0, 2, 1, 0, 0, 3, 0, 0, 0, 0], [4, 0, 0, 0, 0, 0, 0, 2, 0, 0], [0, 0, 0, 0, 2, 0, 0, 1, 0, 3], [1, 0, 2, 0, 3, 0, 0, 0, 0, 0],
];
// Propositions : [nom, axe, pôle (-1 ou +1), position requise (valeur absolue), thème principal, coût en capital politique, crédibilité requise, étiquettes attirées, étiquettes repoussées]
const P = [
  ['Blocage des prix des produits de base', 0, -1, 2, 0, 10, 20, ['populaire', 'precaires'], ['independants', 'aise']],
  ['Hausse du SMIC à 1 600 euros net', 0, -1, 3, 0, 15, 30, ['populaire', 'jeunes'], ['independants']],
  ['Rétablissement de l\'impôt sur la fortune', 0, -1, 2, 12, 10, 25, ['populaire', 'public'], ['aise']],
  ['Taxe sur les superprofits', 0, -1, 1, 12, 8, 20, ['populaire', 'moyen'], ['aise']],
  ['Nationalisation des autoroutes', 0, -1, 4, 13, 20, 40, ['populaire', 'rural'], ['aise', 'independants']],
  ['Planification industrielle', 0, -1, 3, 5, 15, 45, ['populaire', 'public'], ['independants']],
  ['Baisse massive des impôts de production', 0, 1, 2, 5, 10, 30, ['independants', 'aise'], ['public']],
  ['Suppression des droits de succession', 0, 1, 3, 0, 15, 25, ['aise', 'retraites', 'independants'], ['populaire']],
  ['Défiscalisation des heures supplémentaires', 0, 1, 1, 0, 8, 20, ['actifs', 'populaire'], []],
  ['Réduction de 100 000 postes de fonctionnaires', 0, 1, 4, 12, 20, 40, ['independants', 'aise'], ['public', 'rural']],
  ['Règle d\'or budgétaire', 0, 1, 2, 12, 12, 45, ['aise', 'retraites'], ['precaires']],
  ['Simplification des normes pour les entreprises', 0, 1, 1, 5, 6, 20, ['independants', 'agri'], []],
  ['Régularisation des travailleurs sans papiers', 1, -1, 3, 2, 15, 30, ['diplomes', 'jeunes'], ['populaire', 'rural']],
  ['Accueil digne et droit d\'asile renforcé', 1, -1, 2, 2, 10, 25, ['diplomes'], ['populaire']],
  ['Droit de vote des étrangers aux élections locales', 1, -1, 4, 11, 20, 35, ['jeunes', 'diplomes'], ['retraites', 'rural']],
  ['Quotas annuels d\'immigration votés au Parlement', 1, 1, 2, 2, 10, 25, ['retraites', 'moyen'], ['diplomes']],
  ['Expulsion systématique des délinquants étrangers', 1, 1, 3, 2, 12, 25, ['populaire', 'retraites'], ['diplomes']],
  ['Référendum sur l\'immigration', 1, 1, 4, 2, 20, 35, ['populaire', 'rural'], ['diplomes', 'jeunes']],
  ['Suppression du droit du sol', 1, 1, 5, 11, 25, 40, ['populaire'], ['jeunes', 'diplomes']],
  ['Priorité nationale pour le logement social', 1, 1, 4, 8, 18, 30, ['populaire', 'precaires'], ['diplomes']],
  ['Sortie des traités de libre-échange', 2, -1, 2, 14, 10, 25, ['agri', 'populaire'], ['aise']],
  ['Primauté du droit national sur le droit européen', 2, -1, 3, 10, 15, 35, ['populaire', 'rural'], ['diplomes']],
  ['Baisse de la contribution française au budget européen', 2, -1, 2, 12, 10, 25, ['retraites', 'rural'], ['diplomes']],
  ['Défense européenne commune', 2, 1, 3, 10, 15, 40, ['diplomes', 'aise'], ['populaire']],
  ['Grand emprunt européen pour l\'industrie', 2, 1, 2, 5, 12, 35, ['diplomes', 'moyen'], []],
  ['Élection directe d\'un président de l\'Union', 2, 1, 5, 10, 25, 45, ['diplomes'], ['rural', 'populaire']],
  ['Police de proximité dans chaque quartier', 3, -1, 1, 1, 8, 20, ['urbain', 'moyen'], []],
  ['Peines alternatives à la prison', 3, -1, 3, 1, 12, 30, ['diplomes', 'jeunes'], ['retraites']],
  ['Légalisation encadrée du cannabis', 3, -1, 3, 1, 15, 30, ['jeunes', 'diplomes'], ['retraites', 'rural']],
  ['Récépissé de contrôle d\'identité', 3, -1, 4, 1, 15, 30, ['jeunes', 'precaires'], ['retraites']],
  ['Peines planchers pour les récidivistes', 3, 1, 2, 1, 10, 25, ['retraites', 'populaire'], ['diplomes']],
  ['Construction de 20 000 places de prison', 3, 1, 3, 1, 12, 30, ['retraites', 'rural'], ['jeunes']],
  ['Présomption de légitime défense pour les forces de l\'ordre', 3, 1, 4, 1, 18, 30, ['retraites', 'populaire'], ['jeunes', 'diplomes']],
  ['Majorité pénale à 16 ans', 3, 1, 4, 1, 15, 25, ['retraites'], ['jeunes']],
  ['Relance du nucléaire', 4, -1, 1, 6, 8, 30, ['actifs', 'aise'], ['jeunes']],
  ['Moratoire sur les éoliennes', 4, -1, 3, 6, 12, 25, ['rural', 'retraites'], ['jeunes', 'diplomes']],
  ['Fin des zones à faibles émissions', 4, -1, 2, 13, 10, 20, ['populaire', 'rural'], ['urbain', 'diplomes']],
  ['Baisse des taxes sur les carburants', 4, -1, 2, 0, 10, 20, ['rural', 'populaire'], ['diplomes']],
  ['Rénovation thermique de 700 000 logements par an', 4, 1, 2, 8, 12, 35, ['moyen', 'jeunes'], []],
  ['Sortie des pesticides en dix ans', 4, 1, 3, 14, 15, 30, ['diplomes', 'jeunes'], ['agri']],
  ['Interdiction des vols intérieurs courts', 4, 1, 4, 13, 15, 30, ['jeunes', 'diplomes'], ['aise', 'independants']],
  ['Règle verte dans la Constitution', 4, 1, 5, 6, 25, 40, ['jeunes', 'diplomes'], ['agri', 'independants']],
  ['Train à un euro pour les jeunes', 4, 1, 1, 13, 8, 20, ['jeunes'], []],
  ['Uniforme à l\'école', 5, -1, 2, 4, 8, 20, ['retraites', 'rural'], ['jeunes']],
  ['Service national obligatoire', 5, -1, 3, 11, 15, 30, ['retraites'], ['jeunes']],
  ['Politique nataliste et prime de naissance', 5, -1, 2, 11, 12, 25, ['rural', 'moyen'], []],
  ['Aide active à mourir', 5, 1, 2, 3, 10, 30, ['diplomes', 'retraites'], []],
  ['Congé parental égal pour les deux parents', 5, 1, 2, 5, 10, 25, ['jeunes', 'actifs'], []],
  ['Plan national contre les discriminations', 5, 1, 3, 11, 12, 25, ['jeunes', 'urbain'], ['rural']],
  ['Référendum d\'initiative citoyenne', 6, 1, 2, 9, 12, 25, ['populaire', 'jeunes'], ['aise']],
  ['Assemblée constituante pour une VIe République', 6, 1, 5, 9, 30, 40, ['jeunes', 'populaire'], ['retraites', 'aise']],
  ['Proportionnelle intégrale aux législatives', 6, 1, 3, 9, 15, 30, ['jeunes', 'diplomes'], []],
  ['Septennat non renouvelable', 6, -1, 2, 9, 10, 30, ['retraites'], []],
  ['Réduction du nombre de parlementaires', 6, -1, 2, 12, 10, 20, ['populaire', 'retraites'], []],
  ['Retraite à 60 ans', 7, 1, 4, 7, 20, 35, ['populaire', 'actifs'], ['aise', 'independants']],
  ['Allocation d\'autonomie pour les jeunes', 7, 1, 3, 0, 15, 30, ['jeunes', 'precaires'], ['retraites']],
  ['Cent pour cent Sécu', 7, 1, 3, 3, 15, 35, ['populaire', 'retraites'], ['independants']],
  ['Recrutement de 100 000 soignants', 7, 1, 2, 3, 12, 30, ['retraites', 'public', 'rural'], []],
  ['Retraite à 65 ans', 7, -1, 3, 7, 20, 40, ['aise', 'independants'], ['populaire', 'actifs']],
  ['Conditionner le RSA à une activité', 7, -1, 2, 5, 10, 25, ['retraites', 'independants'], ['precaires']],
  ['Capitalisation pour les retraites', 7, -1, 4, 7, 20, 40, ['aise', 'jeunes'], ['populaire', 'retraites']],
  ['Sortie du commandement intégré de l\'OTAN', 8, -1, 4, 10, 20, 35, ['populaire'], ['diplomes', 'aise']],
  ['Conférence de paix et cessez-le-feu en Ukraine', 8, -1, 2, 10, 10, 25, ['populaire', 'rural'], ['diplomes']],
  ['Budget de la défense à 3 % du PIB', 8, 1, 2, 12, 12, 35, ['retraites', 'aise'], ['jeunes']],
  ['Livraisons d\'armes renforcées à l\'Ukraine', 8, 1, 3, 10, 12, 30, ['diplomes'], ['populaire']],
  ['Suppression des agences régionales de santé', 9, 1, 2, 3, 10, 25, ['rural', 'retraites'], []],
  ['Autonomie fiscale des régions', 9, 1, 3, 9, 15, 35, ['rural', 'independants'], []],
  ['Statut d\'autonomie pour la Corse et les outre-mer', 9, 1, 4, 11, 18, 30, ['rural'], ['retraites']],
  ['Retour des services publics dans chaque canton', 9, -1, 1, 9, 10, 30, ['rural', 'retraites', 'public'], []],
  ['Suppression d\'un échelon territorial', 9, -1, 3, 12, 15, 35, ['aise', 'urbain'], ['rural']],
];
const propositions = P.map((p, i) => ({ id: 'p' + String(i + 1).padStart(2, '0'), nom: p[0], axe: AXES[p[1]][0], pole: p[2], positionRequise: p[3], theme: THEMES[p[4]], coutCapital: p[5], credibiliteRequise: p[6], attire: p[7], repousse: p[8] }));
ecrire('doctrine.json', {
  _doc: 'axes : -5 = premier pôle, +5 = second pôle. themeAxes : poids de chaque axe pour chaque thème. propositions : débloquées quand la position du parti sur l\'axe atteint positionRequise du côté du pôle.',
  axes: AXES.map(a => ({ id: a[0], nom: a[1], poleMoins: a[2], polePlus: a[3] })), themes: THEMES.map((t, i) => ({ id: t, nom: THEMES_NOM[i], axes: THEME_AXES[i] })), propositions,
});

// ---------- Partis ----------
// [id, sigle, nom, couleur, axes x10, trésorerie (euros), adhérents, notoriété, crédibilité, unité, stratégie, style, famille, notabilité locale (0-1), dette]
const PARTIS = [
  ['LO', 'LO', 'Lutte ouvrière', '#8b0000', [-5, -5, -3, -4, 1, 3, 5, 5, -4, 0], 1.5e6, 7000, 30, 35, 90, 'isolement', 'prudent', 'extreme_gauche', 0.1, 0],
  ['LFI', 'LFI', 'La France insoumise', '#cc2443', [-4, -4, -2, -3, 4, 4, 5, 5, -3, 0], 9e6, 60000, 85, 45, 70, 'presidentielle', 'offensif', 'gauche', 0.25, 2e6],
  ['PCF', 'PCF', 'Parti communiste français', '#dd0000', [-4, -2, -3, -1, 1, 2, 3, 5, -3, -1], 4e6, 40000, 60, 50, 75, 'local', 'prudent', 'gauche', 0.75, 1e6],
  ['PS', 'PS', 'Parti socialiste', '#e75480', [-2, -2, 3, -1, 3, 3, 1, 3, 3, 2], 7e6, 40000, 80, 55, 55, 'union', 'prudent', 'gauche', 0.95, 3e6],
  ['ECO', 'LÉ', 'Les Écologistes', '#2e9c47', [-2, -4, 4, -3, 5, 5, 3, 4, 2, 4], 3e6, 15000, 70, 45, 55, 'local', 'opportuniste', 'gauche', 0.5, 2e6],
  ['PP', 'PP', 'Place publique', '#f08a24', [-1, -2, 5, 0, 3, 3, 1, 3, 5, 1], 1.2e6, 12000, 55, 55, 80, 'presidentielle', 'prudent', 'gauche', 0.15, 0],
  ['DVG', 'DVG', 'Divers gauche', '#f4a6b7', [-2, -1, 2, 0, 2, 2, 0, 3, 2, 2], 0.8e6, 8000, 40, 55, 50, 'local', 'prudent', 'gauche', 1.0, 0],
  ['REG', 'RÉG', 'Régionalistes', '#c9a227', [-1, -1, 2, 0, 2, 1, 2, 2, 1, 5], 0.5e6, 6000, 30, 50, 60, 'local', 'prudent', 'centre', 0.6, 0],
  ['RE', 'RE', 'Renaissance', '#f5b800', [2, 1, 4, 2, 1, 2, -1, 0, 4, 0], 20e6, 12000, 90, 45, 55, 'presidentielle', 'opportuniste', 'centre', 0.35, 4e6],
  ['MDM', 'MoDem', 'Mouvement démocrate', '#f58220', [1, 0, 4, 1, 1, 1, 2, 1, 3, 2], 5e6, 10000, 65, 55, 75, 'union', 'prudent', 'centre', 0.5, 0],
  ['HOR', 'HOR', 'Horizons', '#0aa3d9', [3, 2, 3, 3, 0, 1, -2, -1, 3, 2], 4e6, 25000, 65, 60, 80, 'presidentielle', 'prudent', 'centre', 0.55, 0],
  ['DVC', 'DVC', 'Divers centre', '#f7d774', [1, 0, 3, 1, 1, 1, 0, 0, 3, 2], 0.6e6, 5000, 35, 55, 50, 'local', 'prudent', 'centre', 0.9, 0],
  ['UDI', 'UDI', 'Union des démocrates et indépendants', '#6f8fd6', [2, 1, 4, 2, 1, 0, 0, 0, 3, 3], 1.5e6, 8000, 45, 55, 70, 'union', 'prudent', 'droite', 0.7, 0],
  ['LR', 'LR', 'Les Républicains', '#0b5fb0', [3, 4, 1, 4, -1, -2, -3, -2, 2, 2], 6e6, 100000, 80, 55, 55, 'local', 'prudent', 'droite', 1.0, 8e6],
  ['DVD', 'DVD', 'Divers droite', '#7fb2e5', [2, 3, 1, 3, -1, -2, -2, -1, 2, 2], 0.8e6, 8000, 40, 55, 50, 'local', 'prudent', 'droite', 1.0, 0],
  ['UDR', 'UDR', 'Union des droites pour la République', '#1d3f8f', [4, 5, -2, 5, -2, -3, -2, -3, -1, 0], 1.5e6, 12000, 50, 45, 80, 'union', 'offensif', 'droite_nationale', 0.2, 0],
  ['RN', 'RN', 'Rassemblement national', '#0d2a5c', [0, 5, -3, 5, -3, -2, 1, 1, -2, -2], 8e6, 100000, 92, 50, 80, 'presidentielle', 'offensif', 'droite_nationale', 0.3, 15e6],
  ['REC', 'REC', 'Reconquête', '#3b2f2f', [4, 5, -3, 5, -4, -5, -3, -3, -2, -1], 2e6, 50000, 65, 35, 65, 'presidentielle', 'offensif', 'droite_nationale', 0.08, 0],
  ['DLF', 'DLF', 'Debout la France', '#5b6fa8', [0, 4, -5, 4, -2, -3, 2, 0, -4, -1], 0.4e6, 6000, 40, 35, 80, 'isolement', 'prudent', 'droite_nationale', 0.1, 0],
];
ecrire('partis.json', {
  _doc: 'axes dans l\'ordre de doctrine.json (-5 à +5). tresorerie et dette en euros. notabilite : poids des notables locaux aux élections municipales et départementales (0 à 1). strategie : local, presidentielle, union, isolement. style : prudent, offensif, opportuniste.',
  partis: PARTIS.map(p => ({ id: p[0], sigle: p[1], nom: p[2], couleur: p[3], axes: p[4], tresorerie: p[5], adherents: p[6], notoriete: p[7], credibilite: p[8], unite: p[9], strategie: p[10], style: p[11], famille: p[12], notabilite: p[13], dette: p[14] })),
  // Correspondance entre les nuances du ministère de l'Intérieur (législatives 2024) et les partis du jeu : parts de la nuance attribuées à chaque parti.
  nuances: { EXG: { LO: 1 }, COM: { PCF: 1 }, FI: { LFI: 1 }, SOC: { PS: 1 }, UG: { LFI: 0.31, PS: 0.31, PP: 0.13, ECO: 0.17, PCF: 0.08 }, RDG: { DVG: 1 }, DVG: { DVG: 1 }, ECO: { ECO: 1 }, VEC: { ECO: 1 }, DIV: { DVC: 0.6, REG: 0.1, DVG: 0.15, DVD: 0.15 }, REG: { REG: 1 }, ENS: { RE: 0.62, MDM: 0.2, HOR: 0.18 }, HOR: { HOR: 0.7, RE: 0.2, MDM: 0.1 }, DVC: { DVC: 1 }, UDI: { UDI: 1 }, LR: { LR: 1 }, DVD: { DVD: 1 }, DSV: { DLF: 1 }, UXD: { UDR: 0.35, RN: 0.65 }, RN: { RN: 0.93, UDR: 0.07 }, REC: { REC: 1 }, EXD: { REC: 1 } },
});

// ---------- Segments ----------
// [id, nom, axes idéaux x10, priorités x15 (ordre des thèmes), abstention de base, volatilité, étiquettes]
const SEG = [
  ['etudiants', 'Étudiants', [-2, -3, 3, -2, 4, 4, 3, 3, 1, 1], [3, 1, 1, 2, 4, 3, 5, 0, 4, 2, 2, 1, 0, 2, 0], 0.55, 0.5, ['jeunes', 'diplomes', 'urbain']],
  ['jeunes_precaires', 'Jeunes précaires 18-34', [-3, -1, -1, -1, 2, 3, 3, 4, -1, 0], [5, 2, 2, 2, 1, 5, 2, 0, 4, 2, 0, 1, 0, 2, 0], 0.65, 0.6, ['jeunes', 'precaires', 'populaire']],
  ['jeunes_cadres', 'Jeunes cadres 25-34', [1, -2, 4, 0, 3, 4, 1, 1, 3, 1], [3, 1, 1, 2, 2, 3, 4, 1, 4, 1, 3, 0, 1, 3, 0], 0.4, 0.5, ['jeunes', 'diplomes', 'aise', 'urbain']],
  ['ouvriers_actifs', 'Ouvriers 25-49', [-2, 3, -3, 3, -2, -1, 3, 3, -3, 0], [5, 3, 4, 2, 1, 4, 0, 2, 2, 2, 0, 2, 0, 2, 0], 0.5, 0.45, ['actifs', 'populaire']],
  ['ouvriers_seniors', 'Ouvriers 50-64', [-2, 3, -3, 4, -2, -2, 2, 4, -3, 0], [5, 3, 4, 3, 0, 3, 0, 5, 1, 2, 0, 2, 0, 1, 0], 0.42, 0.35, ['actifs', 'populaire']],
  ['employes_actifs', 'Employés 25-49', [-1, 2, -1, 2, 0, 1, 2, 3, -1, 0], [5, 3, 3, 3, 3, 3, 1, 1, 3, 3, 0, 1, 0, 2, 0], 0.48, 0.5, ['actifs', 'populaire', 'moyen']],
  ['employes_seniors', 'Employés 50-64', [-1, 2, -1, 3, 0, 0, 1, 3, -1, 0], [4, 3, 3, 4, 1, 2, 1, 5, 1, 3, 0, 2, 1, 1, 0], 0.38, 0.35, ['actifs', 'moyen']],
  ['interm_actifs', 'Professions intermédiaires 25-49', [0, 0, 2, 1, 2, 2, 1, 2, 1, 1], [4, 2, 2, 3, 4, 3, 3, 1, 3, 3, 1, 1, 1, 3, 0], 0.38, 0.5, ['actifs', 'moyen']],
  ['interm_seniors', 'Professions intermédiaires 50-64', [0, 1, 2, 2, 1, 1, 0, 2, 2, 1], [3, 3, 2, 4, 2, 2, 2, 5, 1, 3, 1, 1, 2, 2, 0], 0.3, 0.35, ['actifs', 'moyen']],
  ['cadres_actifs', 'Cadres 35-49', [2, 0, 4, 1, 2, 3, 0, 0, 3, 1], [2, 2, 1, 2, 4, 3, 3, 1, 2, 1, 3, 0, 3, 3, 0], 0.28, 0.4, ['actifs', 'diplomes', 'aise']],
  ['cadres_seniors', 'Cadres 50-64', [3, 1, 4, 2, 1, 1, -1, -1, 3, 1], [2, 3, 2, 2, 2, 2, 2, 4, 1, 1, 3, 1, 4, 1, 0], 0.22, 0.3, ['actifs', 'diplomes', 'aise']],
  ['independants', 'Artisans, commerçants, chefs d\'entreprise', [4, 3, 0, 4, -2, -1, -1, -2, 0, 2], [4, 4, 3, 2, 1, 4, 0, 2, 1, 0, 1, 2, 4, 2, 0], 0.35, 0.4, ['actifs', 'independants']],
  ['agriculteurs', 'Agriculteurs', [2, 3, -2, 3, -4, -3, 0, 0, -1, 3], [4, 2, 2, 2, 1, 1, 2, 3, 0, 3, 3, 3, 1, 1, 5], 0.3, 0.35, ['actifs', 'agri', 'rural', 'independants']],
  ['sans_emploi', 'Sans emploi', [-3, 2, -2, 1, 0, 0, 3, 5, -2, 0], [5, 2, 3, 3, 1, 5, 0, 1, 4, 3, 0, 1, 0, 2, 0], 0.68, 0.6, ['precaires', 'populaire']],
  ['retraites_modestes', 'Retraités modestes', [-1, 3, -2, 4, -1, -3, 0, 4, -2, 0], [5, 4, 4, 5, 0, 0, 0, 5, 1, 4, 0, 3, 1, 1, 1], 0.3, 0.25, ['retraites', 'populaire']],
  ['retraites_moyens', 'Retraités des classes moyennes', [1, 2, 2, 3, 0, -2, -2, 2, 2, 1], [3, 4, 3, 5, 1, 0, 1, 5, 0, 3, 2, 2, 3, 1, 1], 0.2, 0.2, ['retraites', 'moyen']],
  ['retraites_aises', 'Retraités aisés', [3, 3, 3, 4, -1, -2, -3, -1, 3, 1], [1, 4, 3, 4, 1, 0, 1, 4, 0, 1, 3, 3, 5, 0, 1], 0.15, 0.2, ['retraites', 'aise']],
  ['fonctionnaires', 'Agents publics et enseignants', [-2, -2, 2, -1, 3, 3, 2, 4, 1, 1], [4, 1, 1, 4, 5, 2, 3, 3, 2, 5, 1, 0, 0, 2, 0], 0.3, 0.35, ['actifs', 'public', 'moyen', 'diplomes']],
  ['jeunes_populaires', 'Jeunes ouvriers et employés 18-24', [-1, 3, -2, 2, -1, 0, 3, 3, -3, 0], [5, 3, 3, 1, 1, 5, 1, 0, 3, 1, 0, 2, 0, 3, 0], 0.68, 0.65, ['jeunes', 'populaire']],
  ['inactifs', 'Autres inactifs', [-1, 1, 0, 2, 0, 0, 1, 3, 0, 0], [4, 3, 3, 4, 2, 2, 1, 2, 2, 3, 0, 2, 1, 1, 0], 0.55, 0.45, ['precaires']],
];
ecrire('segments.json', {
  _doc: 'axes : position idéale du groupe sur chaque axe de doctrine. priorites : poids de chaque thème (ordre de doctrine.json). abstention : part de base qui ne vote pas à une législative. volatilite : sensibilité à l\'actualité et aux campagnes. Substitution : profils construits à partir des grandes enquêtes d\'opinion connues, pas de données INSEE.',
  segments: SEG.map(s => ({ id: s[0], nom: s[1], axes: s[2], priorites: s[3], abstention: s[4], volatilite: s[5], etiquettes: s[6] })),
});

// ---------- Traits ----------
// mods : bonus sur l'attribut effectif selon le contexte. Contextes : tv, debat, terrain, dossiers, interne, campagne, reseaux, negociation, gestion.
// Autres clés : gaffe (multiplicateur de risque), loyaute (bonus de fidélité réelle), progression (multiplicateur), local (bonus quand il est sur ses terres), ailleurs (malus hors de ses terres), unite (effet sur l'unité s'il est cadre), ego (exigences), usure (multiplicateur de fatigue).
const TRAITS = [
  ['bete_tele', 'Bête de télé', 'Excellent sur les plateaux.', { tv: 3, debat: 1 }], ['homme_dossiers', 'Homme ou femme de dossiers', 'Maîtrise les sujets techniques.', { dossiers: 3, tv: -1 }],
  ['notable', 'Notable indéboulonnable', 'Très difficile à battre chez lui.', { local: 4, ailleurs: -2 }], ['franc_tireur', 'Franc-tireur', 'Dit ce qu\'il pense, quitte à gêner.', { tv: 1, gaffe: 1.5, loyaute: -3, unite: -1 }],
  ['fidele', 'Fidèle lieutenant', 'Ne trahit pas.', { loyaute: 5, interne: 1 }], ['ambitieux', 'Ambitieux pressé', 'Veut tout, tout de suite.', { progression: 1.25, loyaute: -3, ego: 2 }],
  ['gaffeur', 'Gaffeur', 'Un micro ouvert est un risque.', { gaffe: 2.5, tv: -1 }], ['bosseur', 'Bosseur de l\'ombre', 'Abat un travail énorme sans bruit.', { dossiers: 2, gestion: 2, tv: -2, usure: 0.7 }],
  ['tribun', 'Tribun', 'Soulève les salles.', { campagne: 3, debat: 1 }], ['technocrate', 'Technocrate', 'Compétent mais froid.', { dossiers: 2, gestion: 2, terrain: -2 }],
  ['enfant_pays', 'Enfant du pays', 'Connaît chaque rue.', { local: 3, terrain: 1 }], ['parachute', 'Parachuté', 'Sans attaches locales.', { ailleurs: 2, local: -2 }],
  ['rassembleur', 'Rassembleur', 'Apaise les conflits.', { interne: 3, negociation: 2, unite: 2 }], ['clivant', 'Clivant', 'Mobilise autant qu\'il braque.', { campagne: 2, reseaux: 2, negociation: -3, unite: -1 }],
  ['heritier', 'Héritier', 'Un nom et un réseau.', { reseauDepart: 4, ego: 1 }], ['self_made', 'Parti de rien', 'S\'est fait seul.', { progression: 1.15, terrain: 1 }],
  ['stratege', 'Stratège', 'Voit trois coups à l\'avance.', { negociation: 2, interne: 2 }], ['debatteur', 'Débatteur redoutable', 'Rarement mis en difficulté.', { debat: 3 }],
  ['as_reseaux', 'As des réseaux sociaux', 'Chaque vidéo tourne.', { reseaux: 4 }], ['homme_appareil', 'Homme ou femme d\'appareil', 'Tient les fédérations.', { interne: 3, tv: -1 }],
  ['infatigable', 'Infatigable', 'Ne s\'arrête jamais.', { usure: 0.5, terrain: 1 }], ['fragile', 'Santé fragile', 'S\'épuise vite.', { usure: 1.6 }],
  ['orgueilleux', 'Orgueilleux', 'Supporte mal l\'ombre.', { ego: 3, loyaute: -1 }], ['discret', 'Discret', 'Fuit la lumière.', { tv: -2, gaffe: 0.5, loyaute: 1 }],
  ['negociateur', 'Négociateur né', 'Obtient toujours quelque chose.', { negociation: 4 }], ['gestionnaire', 'Bon gestionnaire', 'Les comptes sont tenus.', { gestion: 4 }],
  ['populaire', 'Proche des gens', 'À l\'aise sur les marchés.', { terrain: 3 }], ['intellectuel', 'Intellectuel', 'Pense le fond.', { dossiers: 2, debat: 1, terrain: -1 }],
  ['rancunier', 'Rancunier', 'N\'oublie rien.', { loyaute: -1, negociation: -1 }], ['opportuniste', 'Girouette', 'Suit le vent.', { loyaute: -4, negociation: 1 }],
  ['mentor', 'Formateur', 'Fait grandir les jeunes.', { mentorat: 2 }], ['sang_froid', 'Nerfs d\'acier', 'Imperturbable en crise.', { debat: 1, gaffe: 0.6 }],
  ['idealiste', 'Idéaliste', 'Ne transige pas sur les idées.', { loyaute: 1, negociation: -2, campagne: 1 }], ['pragmatique', 'Pragmatique', 'Préfère un accord à une défaite.', { negociation: 2, gestion: 1 }],
];
ecrire('traits.json', { _doc: 'mods : effets mécaniques, voir docs/MOTEUR.md.', traits: TRAITS.map(t => ({ id: t[0], nom: t[1], description: t[2], mods: t[3] })) });

// ---------- Médias (inspirés des vrais, noms fictifs) ----------
// [id, nom, type, audience (milliers), orientation (-2 gauche à +2 droite), ton (0 institutionnel à 2 polémique), étiquettes touchées, région ou null]
const MEDIAS = [
  ['une20h', 'Le 20 heures de la Une', 'tele', 5200, 0.3, 0, ['retraites', 'populaire', 'moyen'], null], ['deux20h', 'Le Journal de la Deux', 'tele', 4300, -0.2, 0, ['retraites', 'moyen', 'public'], null],
  ['infocontinu', 'Info Continu TV', 'tele', 900, 0.2, 1, ['actifs', 'retraites'], null], ['canaldebat', 'Canal Débat', 'tele', 800, 1.6, 2, ['retraites', 'populaire', 'independants'], null],
  ['chaineinfo', 'La Chaîne Info', 'tele', 500, 0.4, 1, ['aise', 'retraites'], null], ['publicinfo', 'Service Public Info', 'tele', 300, -0.5, 0, ['diplomes', 'public'], null],
  ['politiquedimanche', 'Politique Dimanche', 'tele', 1500, 0, 0, ['diplomes', 'retraites'], null], ['quotidien_tv', 'Le Talk du Soir', 'tele', 1800, -0.8, 2, ['jeunes', 'diplomes', 'urbain'], null],
  ['intermatin', 'La Matinale Inter', 'radio', 4200, -0.9, 0, ['diplomes', 'public', 'moyen'], null], ['rtn', 'RTN Matin', 'radio', 3400, 0.4, 1, ['populaire', 'actifs', 'retraites'], null],
  ['europeun', 'Radio Europe', 'radio', 1300, 1.5, 2, ['retraites', 'independants'], null], ['radiomc', 'RMC Info', 'radio', 2100, 0.5, 2, ['populaire', 'actifs'], null],
  ['icimatin', 'Ici Matin (réseau local)', 'radio', 2500, -0.2, 0, ['retraites', 'rural'], null],
  ['lesoir', 'Le Quotidien du Soir', 'presse', 480, -0.7, 0, ['diplomes', 'aise'], null], ['lematinal', 'Le Matinal', 'presse', 350, 1.2, 0, ['aise', 'retraites'], null],
  ['liberte', 'Liberté', 'presse', 100, -1.6, 1, ['diplomes', 'urbain'], null], ['leparigot', 'Le Francilien', 'presse', 280, 0.1, 0, ['populaire', 'moyen'], null],
  ['lhumain', 'L\'Humain', 'presse', 35, -2, 1, ['populaire', 'public'], null], ['leseco', 'Les Marchés', 'presse', 140, 1.3, 0, ['aise', 'independants'], null],
  ['mediaparts', 'Enquêtes en ligne', 'web', 250, -1.5, 2, ['diplomes', 'public'], null], ['valeurs', 'Convictions', 'presse', 100, 2, 2, ['retraites', 'independants'], null],
  ['pointhebdo', 'Le Repère', 'presse', 290, 1, 0, ['aise', 'diplomes'], null], ['nouvelhebdo', 'Le Nouvel Hebdo', 'presse', 200, -1, 0, ['diplomes'], null],
  ['streamjeunes', 'Le Stream Politique', 'web', 600, -0.5, 2, ['jeunes'], null], ['brutal', 'Format Court', 'web', 1500, -0.6, 1, ['jeunes', 'urbain'], null],
  ['ouest', 'Ouest Quotidien', 'presse', 620, -0.1, 0, ['retraites', 'rural', 'moyen'], ['53', '52', '28']], ['provence', 'Le Provençal', 'presse', 70, 0.1, 0, ['retraites', 'populaire'], ['93']],
  ['sudouest', 'Sud-Ouest Matin', 'presse', 200, -0.2, 0, ['retraites', 'rural'], ['75']], ['voixnord', 'La Voix des Hauts', 'presse', 180, 0, 0, ['populaire', 'retraites'], ['32']],
  ['progres', 'Le Progrès du Rhône', 'presse', 150, 0.1, 0, ['retraites', 'moyen'], ['84']], ['depeche', 'La Dépêche d\'Occitanie', 'presse', 120, -0.6, 0, ['retraites', 'rural'], ['76']],
  ['dna', 'Les Nouvelles de l\'Est', 'presse', 190, 0.2, 0, ['retraites', 'moyen'], ['44']], ['nicematin', 'Riviera Matin', 'presse', 60, 0.6, 0, ['retraites', 'aise'], ['93']],
  ['telegramme', 'Le Télégraphe breton', 'presse', 170, -0.2, 0, ['retraites', 'rural'], ['53']], ['bienpublic', 'Le Journal du Centre-Est', 'presse', 110, 0, 0, ['retraites', 'rural'], ['27', '24']],
  ['parisnormandie', 'Seine Normandie', 'presse', 40, 0, 0, ['retraites', 'populaire'], ['28']], ['corsematin', 'Corse Quotidien', 'presse', 30, 0, 0, ['retraites'], ['94']],
  ['trois_regions', 'La Trois Régions', 'tele', 2200, -0.1, 0, ['retraites', 'rural'], null], ['outremer1', 'Outre-mer Première', 'tele', 350, 0, 0, ['populaire'], ['01', '02', '03', '04', '06']],
];
ecrire('medias.json', { _doc: 'Médias fictifs inspirés du paysage français. orientation : -2 (gauche) à +2 (droite). ton : 0 institutionnel, 1 vif, 2 polémique. audience en milliers. regions : codes de région INSEE ou null pour un média national.', medias: MEDIAS.map(m => ({ id: m[0], nom: m[1], type: m[2], audience: m[3], orientation: m[4], ton: m[5], cibles: m[6], regions: m[7] })) });

// ---------- Noms ----------
ecrire('noms.json', {
  _doc: 'Prénoms par sexe et génération (naissance avant 1965, 1965-1989, après 1989). Noms de famille nationaux et par région (code INSEE de région).',
  prenoms: {
    M: [['Jean', 'Michel', 'Bernard', 'Alain', 'Gérard', 'Jacques', 'Daniel', 'Patrick', 'Christian', 'Philippe', 'Dominique', 'Jean-Pierre', 'Jean-Claude', 'François', 'Marc', 'Yves', 'Serge', 'Guy', 'Hervé', 'Denis'], ['Stéphane', 'Christophe', 'Laurent', 'Nicolas', 'Sébastien', 'David', 'Frédéric', 'Olivier', 'Julien', 'Thierry', 'Éric', 'Pascal', 'Guillaume', 'Jérôme', 'Franck', 'Fabrice', 'Vincent', 'Arnaud', 'Cédric', 'Mathieu', 'Karim', 'Mehdi', 'Ludovic', 'Benoît', 'Romain'], ['Thomas', 'Maxime', 'Alexandre', 'Antoine', 'Kévin', 'Lucas', 'Hugo', 'Théo', 'Quentin', 'Clément', 'Nathan', 'Louis', 'Paul', 'Baptiste', 'Adrien', 'Florian', 'Bastien', 'Enzo', 'Yanis', 'Rayan', 'Mathis', 'Léo', 'Victor', 'Arthur', 'Samuel', 'Dylan', 'Sofiane', 'Pierre']],
    F: [['Marie', 'Monique', 'Nicole', 'Françoise', 'Catherine', 'Martine', 'Christine', 'Jacqueline', 'Annie', 'Michèle', 'Danielle', 'Chantal', 'Brigitte', 'Sylvie', 'Geneviève', 'Josiane', 'Évelyne', 'Claudine', 'Odile', 'Colette'], ['Nathalie', 'Isabelle', 'Valérie', 'Sandrine', 'Stéphanie', 'Véronique', 'Céline', 'Sophie', 'Karine', 'Laurence', 'Christelle', 'Virginie', 'Corinne', 'Aurélie', 'Émilie', 'Delphine', 'Florence', 'Caroline', 'Agnès', 'Nadia', 'Samia', 'Laetitia', 'Hélène', 'Anne', 'Béatrice'], ['Camille', 'Léa', 'Manon', 'Chloé', 'Emma', 'Julie', 'Pauline', 'Marine', 'Laura', 'Sarah', 'Clara', 'Mathilde', 'Lucie', 'Anaïs', 'Océane', 'Inès', 'Jade', 'Louise', 'Juliette', 'Margaux', 'Charlotte', 'Élise', 'Yasmine', 'Lina', 'Justine', 'Morgane', 'Éléonore', 'Alice']],
  },
  noms: {
    national: ['Martin', 'Bernard', 'Thomas', 'Petit', 'Robert', 'Richard', 'Durand', 'Dubois', 'Moreau', 'Laurent', 'Simon', 'Michel', 'Lefebvre', 'Leroy', 'Roux', 'David', 'Bertrand', 'Morel', 'Fournier', 'Girard', 'Bonnet', 'Dupont', 'Lambert', 'Fontaine', 'Rousseau', 'Vincent', 'Muller', 'Lefèvre', 'Faure', 'André', 'Mercier', 'Blanc', 'Guérin', 'Boyer', 'Garnier', 'Chevalier', 'François', 'Legrand', 'Gauthier', 'Garcia', 'Perrin', 'Robin', 'Clément', 'Morin', 'Nicolas', 'Henry', 'Roussel', 'Mathieu', 'Gautier', 'Masson', 'Marchand', 'Duval', 'Denis', 'Dumont', 'Marie', 'Lemaire', 'Noël', 'Meyer', 'Dufour', 'Meunier', 'Brun', 'Blanchard', 'Giraud', 'Joly', 'Rivière', 'Lucas', 'Brunet', 'Gaillard', 'Barbier', 'Arnaud', 'Martinez', 'Gérard', 'Roche', 'Renard', 'Schmitt', 'Roy', 'Leroux', 'Colin', 'Vidal', 'Caron', 'Picard', 'Roger', 'Fabre', 'Aubert', 'Lemoine', 'Renaud', 'Dumas', 'Lacroix', 'Olivier', 'Philippe', 'Bourgeois', 'Pierre', 'Benoît', 'Rey', 'Leclerc', 'Payet', 'Rolland', 'Leclercq', 'Guillaume', 'Lecomte', 'Lopez', 'Jean', 'Dupuy', 'Guillot', 'Hubert', 'Berger', 'Carpentier', 'Sanchez', 'Dupuis', 'Moulin', 'Louis', 'Deschamps', 'Huet', 'Vasseur', 'Perez', 'Boucher', 'Fleury', 'Royer', 'Klein', 'Jacquet', 'Adam', 'Paris', 'Poirier', 'Marty', 'Aubry', 'Guyot', 'Carré', 'Charles', 'Renault', 'Charpentier', 'Ménard', 'Maillard', 'Baron', 'Bertin', 'Bailly', 'Hervé', 'Schneider', 'Fernandez', 'Le Gall', 'Collet', 'Léger', 'Bouvier', 'Julien', 'Prévost', 'Millet', 'Perrot', 'Daniel', 'Le Roux', 'Cousin', 'Germain', 'Breton', 'Besson', 'Langlois', 'Rémy', 'Le Goff', 'Pelletier', 'Lévêque', 'Perrier', 'Leblanc', 'Barré', 'Lebrun', 'Marchal', 'Weber', 'Mallet', 'Hamon', 'Boulanger', 'Jacob', 'Monnier', 'Michaud', 'Rodriguez', 'Guichard', 'Gillet', 'Étienne', 'Grondin', 'Poulain', 'Tessier', 'Chevallier', 'Collin', 'Chauvin', 'Da Silva', 'Bouchet', 'Gay', 'Lemaître', 'Bénard', 'Maréchal', 'Humbert', 'Reynaud', 'Antoine', 'Hoarau', 'Perret', 'Barthélemy', 'Cordier', 'Pichon', 'Lejeune', 'Gilbert', 'Lamy', 'Delaunay', 'Pasquier', 'Carlier', 'Laporte', 'Benali', 'Haddad', 'Diallo', 'Traoré', 'Nguyen', 'Cohen', 'Belkacem', 'Mansouri', 'Bouzid', 'Diop', 'Camara', 'Ferreira', 'Pereira', 'Dos Santos', 'Rossi', 'Russo'],
    '53': ['Le Gall', 'Le Goff', 'Le Roux', 'Guéguen', 'Kerbrat', 'Le Bihan', 'Morvan', 'Tanguy', 'Le Guen', 'Quéré', 'Riou', 'Le Corre', 'Jézéquel', 'Hamon', 'Le Borgne', 'Guillou', 'Prigent', 'Cadiou', 'Madec', 'Le Floch'],
    '44': ['Muller', 'Schmitt', 'Meyer', 'Schneider', 'Klein', 'Weber', 'Fischer', 'Wagner', 'Zimmermann', 'Kieffer', 'Wolff', 'Hoffmann', 'Becker', 'Keller', 'Lang', 'Jung', 'Schwartz', 'Thiébaut', 'Colin', 'Gérard'],
    '32': ['Lefebvre', 'Leroy', 'Dubois', 'Delattre', 'Lemaire', 'Dupont', 'Carpentier', 'Vasseur', 'Leclercq', 'Delannoy', 'Wallart', 'Vandenberghe', 'Dewaele', 'Caron', 'Fournier', 'Bailleul', 'Hennion', 'Flament', 'Duhamel', 'Poulain'],
    '94': ['Colonna', 'Casanova', 'Luciani', 'Paoli', 'Mattei', 'Santoni', 'Giacomoni', 'Leca', 'Orsini', 'Poli', 'Rossi', 'Susini', 'Filippi', 'Albertini', 'Pietri', 'Marcangeli', 'Ceccaldi', 'Mariani'],
    '93': ['Blanc', 'Roux', 'Giraud', 'Michel', 'Martin', 'Fabre', 'Reynaud', 'Arnaud', 'Vidal', 'Imbert', 'Aubert', 'Rey', 'Pons', 'Garcin', 'Isnard', 'Gautier', 'Ricard', 'Bonnet', 'Masse', 'Roman', 'Garcia', 'Lopez', 'Martinez', 'Rossi', 'Mattei'],
    '76': ['Garcia', 'Martinez', 'Lopez', 'Sanchez', 'Perez', 'Vidal', 'Fabre', 'Durand', 'Bonnet', 'Marty', 'Lacombe', 'Delmas', 'Cazes', 'Bousquet', 'Pujol', 'Rouquette', 'Maury', 'Calvet', 'Roques', 'Combes'],
    '75': ['Dupuy', 'Lafon', 'Lacoste', 'Labat', 'Dubourg', 'Etcheverry', 'Lassalle', 'Darrieux', 'Dupouy', 'Bordes', 'Laborde', 'Castaing', 'Dubos', 'Moreau', 'Boutin', 'Faure', 'Lagarde', 'Duprat', 'Larrieu', 'Daguerre'],
    '84': ['Perrin', 'Favre', 'Blanc', 'Faure', 'Chevalier', 'Girard', 'Roux', 'Giraud', 'Perret', 'Mollard', 'Chapuis', 'Jacquet', 'Vial', 'Rey', 'Brun', 'Charvet', 'Tissot', 'Ducros', 'Chabert', 'Bouvier'],
    '11': ['Martin', 'Petit', 'Durand', 'Moreau', 'Simon', 'Laurent', 'Michel', 'Garcia', 'Traoré', 'Diallo', 'Cohen', 'Nguyen', 'Benali', 'Da Silva', 'Lévy', 'Camara', 'Haddad', 'Ferreira', 'Sissoko', 'Benhamou'],
    om: ['Payet', 'Hoarau', 'Grondin', 'Boyer', 'Fontaine', 'Rivière', 'Lebon', 'Dijoux', 'Joseph', 'Jean-Baptiste', 'Marie-Louise', 'Charles', 'Césaire', 'Lurel', 'Nilor', 'Ali', 'Saïd', 'Tetuanui', 'Brotherson', 'Wamytan'],
  },
});
