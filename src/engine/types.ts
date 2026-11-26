// Types du moteur. Tout l'état de jeu (Etat) est sérialisable en JSON.

export const NB_AXES = 10;
export const NB_THEMES = 15;
export const ATTRS = ['eloquence', 'debat', 'medias', 'reseaux', 'terrain', 'dossiers', 'gestion', 'negociation', 'organisation',
  'ambition', 'loyaute', 'sangfroid', 'discipline', 'courage', 'opportunisme', 'rancune', 'resistance',
  'energie', 'charisme', 'reseau', 'ancrage'] as const;
export const ATTRS_NOM = ['Éloquence', 'Débat', 'Médias', 'Réseaux sociaux', 'Terrain', 'Dossiers techniques', 'Gestion', 'Négociation', 'Organisation de campagne',
  'Ambition', 'Loyauté', 'Sang-froid', 'Discipline', 'Courage', 'Opportunisme', 'Rancune', 'Résistance à la pression',
  'Énergie', 'Charisme', 'Réseau', 'Ancrage local'];
export const A = { eloquence: 0, debat: 1, medias: 2, reseaux: 3, terrain: 4, dossiers: 5, gestion: 6, negociation: 7, organisation: 8, ambition: 9, loyaute: 10, sangfroid: 11, discipline: 12, courage: 13, opportunisme: 14, rancune: 15, resistance: 16, energie: 17, charisme: 18, reseau: 19, ancrage: 20 } as const;
export const NB_ATTRS = 21;

// ---------- Données statiques (chargées depuis public/data) ----------
export interface DonPartis { id: string; sigle: string; nom: string; couleur: string; axes: number[]; tresorerie: number; adherents: number; notoriete: number; credibilite: number; unite: number; strategie: string; style: string; famille: string; notabilite: number; dette: number }
export interface DonSegment { id: string; nom: string; axes: number[]; priorites: number[]; abstention: number; volatilite: number; etiquettes: string[] }
export interface DonProposition { id: string; nom: string; axe: string; pole: number; positionRequise: number; theme: string; coutCapital: number; credibiliteRequise: number; attire: string[]; repousse: string[] }
export interface DonChoix { t: string; axe?: string; sens?: number; eff?: Record<string, number>; opinion?: Record<string, number> }
export interface DonEvenement { id: string; titre: string; texte: string; cat: string; portee: string; poids: number; cond: Record<string, any>; themes: Record<string, number>; duree: number; choix: DonChoix[] }
export interface DonMedia { id: string; nom: string; type: string; audience: number; orientation: number; ton: number; cibles: string[]; regions: string[] | null }
export interface DonTrait { id: string; nom: string; description: string; mods: Record<string, number> }
export interface DonCirco { id: string; dept: string; num: number; nom: string; nomCourt: string; inscrits: number; exprimes: number; t1: Record<string, number>; candidats: { nom: string; prenom: string; sexe: string; nuance: string; voix: number; pct: number }[]; t2: { nom: string; nuance: string; voix: number; pct: number }[]; elu: { nom: string; prenom: string; sexe: string; nuance: string; pct: number; tour: number } | null; lon: number; lat: number }
export interface DonDept { code: string; nom: string; region: string; pop: number; cantons: number; senateurs: number; serie: number }
export interface DonRegion { code: string; nom: string; depts: string[] }
export interface DonPersonnalite { nom: string; prenom: string; sexe: string; naissance: number | null; parti: string; rang: number; roles: string[]; attributs?: Record<string, number> }
export interface Zone { idx: number; id: string; nom: string; type: number; dept: string; deptIdx: number; regIdx: number; pop: number; inscrits: number; terr: number; lon: number; lat: number; circos: [number, number][]; ville: string | null; nbCommunes: number; cantons: number }

export interface Donnees {
  partis: DonPartis[]; nuances: Record<string, Record<string, number>>;
  segments: DonSegment[]; axes: { id: string; nom: string; poleMoins: string; polePlus: string }[]; themes: { id: string; nom: string; axes: number[] }[];
  propositions: DonProposition[]; evenements: DonEvenement[]; medias: DonMedia[]; traits: DonTrait[];
  noms: { prenoms: Record<string, string[][]>; noms: Record<string, string[]> };
  personnalites: DonPersonnalite[]; mairesImposes: { zone: string; parti: string }[]; affiliations: Record<string, string[]>;
  zones: Zone[]; socio: number[]; circos: DonCirco[]; depts: DonDept[]; regions: DonRegion[];
  // index dérivés
  idxParti: Record<string, number>; idxDept: Record<string, number>; idxRegion: Record<string, number>; idxCirco: Record<string, number>; idxZone: Record<string, number>;
  zonesParDept: number[][]; zonesParCirco: [number, number][][]; villes: Ville[]; idxVille: Record<string, number>;
  traitsParId: Record<string, DonTrait>;
}
// Une ville simulée pour les municipales : commune de plus de 10 000 habitants, ville PLM entière (V75, V69, V13) ou secteur PLM.
export interface Ville { idx: number; id: string; nom: string; zones: number[]; pop: number; sieges: number; prime: number; plm: 0 | 1 | 2; mere: number; dept: string; deptIdx: number }

// ---------- État dynamique ----------
export type Mode = 'carriere' | 'parti';
export interface Mandat { type: 'maire' | 'adjoint' | 'conseiller_municipal' | 'depute' | 'senateur' | 'eurodepute' | 'conseiller_dept' | 'president_dept' | 'conseiller_reg' | 'president_region' | 'president' | 'premier_ministre'; lieu: number; debut: number }
export interface Relation { t: 'ami' | 'rival' | 'dette' | 'mentor' | 'inimitie'; v: number }
export interface Perso {
  id: number; nom: string; prenom: string; sexe: 'M' | 'F'; naissance: number; parti: number; reel: boolean;
  dept: number; zone: number; attrs: number[]; notoriete: number;
  pot: number; casserole: number; fidelite: number; // cachés
  traits: string[]; axes: number[]; moral: number; forme: number;
  mandats: Mandat[]; postes: string[]; rel: Record<number, Relation>;
  hist: { s: number; t: string }[]; citations: string[];
  statut: 'actif' | 'retire' | 'mort' | 'ineligible'; formation: string; profession: string;
  rang: number; // 0 militant, 1 cadre local, 2 cadre départemental, 3 figure nationale, 4 premier plan
  ineligibleJusqua?: number; observe?: { s: number; pot: number; fidelite: number; casserole: number; marge: number };
  victoires: number; defaites: number;
  abonnes?: number; // compte Agora, créé à la première lecture
}
export interface Courant { nom: string; chef: number; poids: number; axe: number; sens: number; humeur: number }
export interface Pret { montant: number; restant: number; mensualite: number; fin: number }
export interface CompteCampagne { scrutin: string; semaine: number; depenses: number; plafond: number; statut: 'en_cours' | 'depose' | 'valide' | 'rejete'; rembourse: number; controle: number }
export interface Parti {
  idx: number; id: string; actif: boolean; nom: string; sigle: string; couleur: string; famille: string;
  tresorerie: number; adherents: number; militants: number; capital: number; credibilite: number; notoriete: number; unite: number;
  credibilite0: number; notoriete0: number; fatigue: number; viralite: number; dynamique: number;
  axes: number[]; axes0: number[]; propositions: string[]; culture: number;
  chef: number; bureau: Record<string, number>; adhDept: number[]; delegues: number[];
  courants: Courant[]; strategie: string; style: string; notabilite: number;
  prets: Pret[]; financementPublic: number; voixLeg: number; pariteRetenue: number; comptes: CompteCampagne[];
  fluxMois: Record<string, number>; histTreso: number[]; cotisation: number; permanents: number; budgetCom: number; budgetFormation: number;
  terrain: { dept: number; action: string; part: number }[];
  prochainCongres: number; gaffes: number; inegibiliteRisque: number;
  candidatPres: number; parrainages: number; campagne: BudgetCampagne | null;
  scoreIA: Record<string, number>;
}
export interface BudgetCampagne { scrutin: string; total: number; meetings: number; affichage: number; tracts: number; numerique: number; sondages: number; depense: number; cibles: number[] }
export interface Mairie { ville: number; maire: number; parti: number; sieges: number[]; coalition: number[]; bilan: number; budget: number; dette: number; projets: number[]; adjoints: { perso: number; delegation: string }[]; opposition: number; interco: number; impots: number; partsBassin?: number[] }
export interface Conseil { lieu: number; president: number; parti: number; sieges: number[]; coalition: number[]; bilan: number; budget: number; projets: number[] }
export interface Siege { perso: number; parti: number }
export interface Candidature { parti: number; perso: number; soutiens: number[]; qualite: number; sortant: boolean; sexe?: 'M' | 'F'; depense?: number }
export interface UniteT1 { cands: Candidature[]; t1: number[]; inscrits: number; votants: number; maintenus: number[]; fusions: Record<number, number>; elu: number; nom: string }
export interface EntreDeux { s2: number; unites: Record<string, UniteT1>; debatFait?: boolean; bonusDebat?: number[] }
export interface Echeance { type: Scrutin; s1: number; s2: number; serie?: number; fait1?: boolean; fait2?: boolean; designe?: boolean; negocie?: boolean }
export type Scrutin = 'municipales' | 'departementales' | 'regionales' | 'legislatives' | 'europeennes' | 'senatoriales' | 'presidentielle';
export interface Message { id: number; s: number; cat: string; titre: string; texte: string; lu: boolean; important: boolean; choix?: { t: string; info?: string }[]; action?: { type: string; data: any }; repondu?: number; expire?: number }
export interface Sondage { s: number; institut: string; type: string; scores: number[]; marge: number; commande?: boolean; zone?: string }
export interface Accord { id: number; type: Scrutin | 'majorite'; partis: number[]; debut: number; fin: number; repartition?: Record<number, number>; rompu?: boolean }
export interface Affaire { id: number; perso: number; parti: number; titre: string; etape: number; prochaine: number; gravite: number; soutenu: boolean | null; close: boolean }
export interface ChocTheme { theme: number; region: number; val: number; fin: number; debut: number }
export interface EvenementActif { ev: string; s: number; rival?: number; data?: any }
export interface ResultatLigne { nom: string; partis: number[]; perso: number; voix: number; pct: number; sieges?: number; elu?: boolean; qualifie?: boolean }
export interface ResultatLieu { lieu: string; id: string; inscrits: number; votants: number; lignes: ResultatLigne[]; explication?: string }
export interface Archive { s: number; type: Scrutin; tour: number; titre: string; national: ResultatLigne[]; participation: number; lieux?: ResultatLieu[]; sieges?: number[]; resume: string; explicationJoueur?: string }
export interface Soiree { type: Scrutin; tour: number; s: number; estimation: ResultatLigne[]; final: ResultatLigne[]; lieux: ResultatLieu[]; participation: number; reactions: { perso: string; parti: number; texte: string }[]; sieges?: number[]; titre: string; explication: string; carte: { niveau: 'dept' | 'circo' | 'region'; couleurs: Record<string, number> } }
export interface Debat { id: number; type: 'interview' | 'debat' | 'grand_debat'; media: string; perso: number; adversaire: number; questions: { theme: number; genre: string; texte: string }[]; tour: number; score: number; scoreAdv: number; journal: string[]; fini: boolean; enjeu: number }
export interface Joueur { mode: Mode; parti: number; perso: number; tutoriel: number; scoreFinal?: number; fin?: { type: string; titre: string; texte: string }; debutPremierPlan: number; trahisons: number; pointsVictoire: Record<string, number>; aQuitte: number; acces?: string[]; nouveaux?: string[] }
export interface Etat {
  version: number; graine: number; rng: number; scenario: string; semaine: number; debut: number;
  joueur: Joueur; partis: Parti[]; persos: Perso[];
  prox: number[]; impl: number[]; mob: number[]; opinion: number[]; // zones x partis, zones x partis, zones x partis, segments x partis
  chocs: ChocTheme[]; eco: { croissance: number; chomage: number; inflation: number };
  mairies: Mairie[]; partsBassin: number[]; conseilsDept: Conseil[]; conseilsReg: Conseil[];
  assemblee: Siege[]; senat: Siege[][]; europe: Siege[];
  presidence: { perso: number; parti: number; popularite: number; debut: number; budget: number; reformes: number; consecutifs?: number };
  gouvernement: { parti: number; coalition: number[]; pm: number };
  calendrier: Echeance[]; candidatures: Record<string, Record<string, Candidature[]>>; investitures: Record<string, Record<string, number>>; campagnesOuvertes: string[];
  relPartis: number[]; accords: Accord[]; affaires: Affaire[];
  inbox: Message[]; prochainMsg: number; archives: Archive[]; sondages: Sondage[]; soiree: Soiree | null; debat: Debat | null;
  evActifs: EvenementActif[]; evVus: Record<string, number>;
  histIntentions: { s: number; v: number[] }[]; intentions: number[]; abstentionHist: { s: number; type: string; v: number }[];
  journal: { s: number; t: string }[]; consignes: Record<number, number>; desistements: Record<string, string[]>;
  entreDeux: Record<string, EntreDeux>; politiqueAlliance: Record<string, string>;
  options: { vitesse: number; auto?: boolean; activite?: string };
  agora?: Agora; executif?: Executif; equipe?: Equipe;
}
export interface Militant { id: number; nom: string; prenom: string; sexe: 'M' | 'F'; age: number; comp: number[]; dispo: number; motiv: number; fatigue: number; depuis: number; quartier: number; action: string; caractere: string; lieutenant?: boolean; cible?: number; parle?: number; bonus?: number }
export interface Quartier { nom: string; profil: string; segs: string[]; poids: number; accueil: number; ancrage: number; contacts: number }
export interface Incident { id: string; titre: string; texte: string; choix: { t: string; effet: string }[]; quartier: number; m: number; n: number; expire: number }
export interface Equipe { zone: number; parti: number; membres: Militant[]; candidats: Militant[]; quartiers: Quartier[]; prochain: number; caisse: number; tracts: number; affiches: number; commandes: { quoi: string; qte: number; livraison: number }[]; campagne: { type: string; s1: number; maintenant: number; temps: Record<string, boolean>; elan: number; ref: number } | null; incident: Incident | null; journal: string[]; jeu: any; jeux: Record<string, boolean>; auto: boolean; convivial?: number; bilan: { type: string; s: number; score: number; ref: number; rang: number; bureaux: { nom: string; score: number; inscrits: number; enTete: boolean }[]; annonce: { vus: number; enTete: boolean; juste: boolean } | null; temps: number } | null }
export interface Reforme { id: number; axe: number; sens: number; nom: string; etape: number; debut: number; soutien: number; concertations?: number; derniere?: number; fin?: number; abandon?: boolean }
export interface Executif { reformes: Reforme[]; prochain: number; dernierRemaniement: number; dernierePM: number; derniereDissolution: number; dernierReferendum: number; referendum: { axe: number; sens: number; s: number; titre: string } | null; censures: number }
export interface Post { id: number; s: number; perso: number; parti: number; compte: string; genre: 'elu' | 'parti' | 'media' | 'citoyen'; format: string; ton: string; sujet: string; texte: string; vues: number; likes: number; partages: number; comm: number; etat: '' | 'buzz' | 'polemique'; moi?: boolean }
export interface Agora { posts: Post[]; prochain: number; tendances: { sujet: string; axe: number; force: number; fin: number }[]; abP: number[]; reactions: { id: number; titre: string; axe: number; s: number; expire: number }[]; delegue: boolean; semaineJoueur: number; nbJoueur: number; dernierTitre?: number; suites?: { titre: string; axe: number; s: number; episode: number }[]; suivis?: { titre: string; axe: number; s: number; episode: number; ton?: string; chaud?: boolean; lendemain?: boolean }[]; hist: { s: number; parti: number; moi: number }[] }
export interface Ctx { d: Donnees; messages: Message[] }
