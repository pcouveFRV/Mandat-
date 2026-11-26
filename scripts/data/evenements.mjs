// Génère public/data/evenements.json (plus de 200 événements).
// Usage : node scripts/data/evenements.mjs. Relancer écrase les modifications manuelles du fichier.
// Format d'un événement : voir docs/DATA.md.
import { writeFileSync } from 'node:fs';
const T = { pa: 'pouvoir_achat', se: 'securite', im: 'immigration', sa: 'sante', ec: 'ecole', em: 'emploi', eco: 'ecologie', re: 'retraites', lo: 'logement', sp: 'services_publics', eu: 'europe', id: 'identite', de: 'dette', tr: 'transports', ag: 'agriculture' };
const AX = ['economie', 'immigration', 'europe', 'securite', 'ecologie', 'societe', 'institutions', 'social', 'etranger', 'decentralisation'];
const ev = [];
const ch = (t, axe = -1, sens = 0, eff = {}, opinion = {}) => { const o = { t }; if (axe >= 0) { o.axe = AX[axe]; o.sens = sens; } if (Object.keys(eff).length) o.eff = eff; if (Object.keys(opinion).length) o.opinion = opinion; return o; };
function fam(pre, cat, portee, poids, cond, themes, duree, choix, variantes) {
  variantes.forEach((v, i) => { const th = {}; for (const [k, n] of (v[2] ?? themes)) th[T[k]] = n; ev.push({ id: `${pre}${String(i + 1).padStart(2, '0')}`, titre: v[0], texte: v[1], cat, portee, poids: v[4] ?? poids, cond: { ...cond, ...(v[3] ?? {}) }, themes: th, duree, choix: v[5] ?? choix }); });
}
const SILENCE = ch('Ne pas commenter', -1, 0, { notoriete: -1 });

fam('greve', 'social', 'nat', 3, {}, [['pa', 2], ['sp', 2]], 6, [
  ch('Soutenir le mouvement', 7, 1, { militants: 2 }, { populaire: 2, public: 2, independants: -2, aise: -1 }),
  ch('Dénoncer les blocages', 7, -1, {}, { independants: 2, retraites: 1, aise: 1, public: -2, populaire: -1 }),
  ch('Appeler au dialogue', -1, 0, { credibilite: 1 }), SILENCE,
], [
  ['Grève reconductible à la SNCF', 'Les cheminots cessent le travail à la veille des vacances. Les gares sont saturées.', [['tr', 3], ['sp', 2]]],
  ['Raffineries bloquées', 'Les stations-service se vident dans plusieurs régions. Les files s\'allongent.', [['pa', 3], ['em', 1]]],
  ['Les enseignants dans la rue', 'Une journée de grève très suivie dans les écoles, collèges et lycées.', [['ec', 3], ['sp', 2]]],
  ['L\'hôpital à bout', 'Les soignants manifestent devant les urgences. Plusieurs services ferment la nuit.', [['sa', 4], ['sp', 2]]],
  ['Les tracteurs sur les autoroutes', 'Les agriculteurs bloquent les grands axes et déversent du fumier devant les préfectures.', [['ag', 4], ['pa', 1]]],
  ['Opération escargot des routiers', 'Les transporteurs protestent contre le prix du gazole.', [['tr', 2], ['pa', 2]]],
  ['Poubelles non ramassées', 'La grève des éboueurs dure depuis dix jours dans plusieurs grandes villes.', [['sp', 3]]],
  ['Ciel fermé', 'Les contrôleurs aériens font grève. Des centaines de vols sont annulés.', [['tr', 3]]],
  ['Journée morte dans la fonction publique', 'Tous les syndicats appellent à la grève sur les salaires.', [['sp', 3], ['pa', 2]]],
  ['Taxis contre plateformes', 'Les taxis bloquent les aéroports pour protester contre la concurrence.', [['tr', 2], ['em', 2]]],
  ['Coupures ciblées dans l\'énergie', 'Les agents de l\'énergie baissent la production pour peser sur la réforme.', [['pa', 2], ['re', 2]]],
  ['Les ports à l\'arrêt', 'Les dockers bloquent les terminaux. Les conteneurs s\'accumulent.', [['em', 3]]],
]);

fam('eco', 'economie', 'nat', 3, {}, [['em', 2], ['pa', 2]], 8, [
  ch('Réclamer une intervention de l\'État', 0, -1, {}, { populaire: 2, precaires: 1, aise: -1 }),
  ch('Demander des baisses de charges', 0, 1, {}, { independants: 2, aise: 1, public: -1 }),
  ch('Publier une note chiffrée', -1, 0, { credibilite: 2, capital: -1 }), SILENCE,
], [
  ['Le chômage repart à la hausse', 'Les chiffres trimestriels sont mauvais. Les jeunes sont les premiers touchés.', [['em', 4]]],
  ['Les prix alimentaires flambent', 'Le panier moyen a pris 8 % en un an. Les associations d\'aide sont débordées.', [['pa', 4]]],
  ['Un grand groupe annonce un plan social', 'Plusieurs milliers de postes supprimés en France. Les salariés occupent les sites.', [['em', 4]]],
  ['La note de la France dégradée', 'Une agence abaisse la note souveraine. Les taux d\'emprunt montent.', [['de', 4]]],
  ['Croissance meilleure que prévu', 'L\'activité surprend à la hausse. Le gouvernement s\'en félicite.', [['em', 1], ['de', 1]]],
  ['Les taux immobiliers grimpent', 'Les primo-accédants renoncent à acheter. Le marché se grippe.', [['lo', 4]]],
  ['Le litre de carburant dépasse deux euros', 'La colère monte dans les zones rurales et périurbaines.', [['pa', 3], ['tr', 2]]],
  ['Crise du logement', 'Le nombre de permis de construire tombe au plus bas depuis trente ans.', [['lo', 4]]],
  ['Vague de faillites de petites entreprises', 'Les tribunaux de commerce croulent sous les dossiers.', [['em', 3]]],
  ['Record d\'exportations agricoles', 'Les vins et les céréales tirent le commerce extérieur.', [['ag', 2]]],
  ['Le déficit dérape', 'Le trou budgétaire sera plus profond que prévu. Bruxelles s\'inquiète.', [['de', 4], ['eu', 1]]],
  ['Les salaires décrochent', 'Une étude montre que les salaires réels ont baissé sur deux ans.', [['pa', 4]]],
  ['Une usine ferme ses portes', 'Le dernier grand employeur industriel du bassin annonce sa fermeture.', [['em', 4]], {}, 2],
  ['Les factures d\'électricité bondissent', 'La hausse des tarifs réglementés provoque un tollé.', [['pa', 4]]],
]);

fam('secu', 'securite', 'nat', 3, {}, [['se', 3]], 6, [
  ch('Exiger la fermeté', 3, 1, {}, { retraites: 2, populaire: 1, jeunes: -1, diplomes: -1 }),
  ch('Parler des causes et de la prévention', 3, -1, {}, { diplomes: 2, jeunes: 1, retraites: -2 }),
  ch('Appeler à l\'unité', -1, 0, { credibilite: 1 }), SILENCE,
], [
  ['Attentat déjoué', 'Les services ont arrêté un homme qui préparait une attaque dans une gare.', [['se', 4]]],
  ['Attentat dans une grande ville', 'Une attaque au couteau fait plusieurs victimes. Le pays est sous le choc.', [['se', 5], ['id', 2]], {}, 1],
  ['Nuits d\'émeutes', 'Des violences urbaines éclatent dans plusieurs quartiers après une intervention de police.', [['se', 5]], {}, 2],
  ['Fusillade liée au narcotrafic', 'Un règlement de comptes fait trois morts en pleine rue.', [['se', 4]]],
  ['Un maire agressé', 'Un élu local est frappé devant sa mairie. Les associations d\'élus alertent.', [['se', 3]]],
  ['Évasion spectaculaire', 'Un détenu s\'évade lors d\'un transfert. La chasse à l\'homme commence.', [['se', 3]]],
  ['Refus d\'obtempérer mortel', 'Un policier tire sur un conducteur. Deux versions s\'opposent.', [['se', 4]]],
  ['Cambriolages en série dans les campagnes', 'Les gendarmes sont débordés. Des habitants s\'organisent.', [['se', 3]]],
  ['Un hôpital paralysé par une cyberattaque', 'Les données des patients sont prises en otage.', [['se', 2], ['sa', 2]]],
  ['Violence dans un lycée', 'Un professeur est blessé par un élève. La communauté éducative est sous le choc.', [['se', 3], ['ec', 3]]],
  ['Rixe mortelle entre bandes', 'Un adolescent est tué lors d\'un affrontement entre jeunes de deux villes.', [['se', 4]]],
  ['Malaise dans la police', 'Les syndicats de policiers dénoncent le manque de moyens et de soutien.', [['se', 3], ['sp', 1]]],
  ['Trafic de drogue dans une ville moyenne', 'Un point de deal s\'installe en centre-ville. Les commerçants ferment.', [['se', 4]]],
]);

fam('immig', 'immigration', 'nat', 2, {}, [['im', 3]], 6, [
  ch('Demander plus de fermeté', 1, 1, {}, { populaire: 2, retraites: 1, diplomes: -2 }),
  ch('Défendre l\'accueil', 1, -1, {}, { diplomes: 2, jeunes: 1, populaire: -2 }),
  ch('Renvoyer à l\'Europe', 2, 1, { credibilite: 1 }), SILENCE,
], [
  ['Naufrage dans la Manche', 'Une embarcation chavire. Plusieurs morts.', [['im', 4]]],
  ['Un campement évacué', 'La préfecture démantèle un campement de plusieurs centaines de personnes.', [['im', 3]]],
  ['Les titres de séjour au plus haut', 'Les chiffres annuels sont publiés. Chacun y lit ce qu\'il veut.', [['im', 3]]],
  ['Une obligation de quitter le territoire non exécutée', 'Un fait divers relance le débat sur les expulsions.', [['im', 4], ['se', 2]]],
  ['Un village divisé sur un centre d\'accueil', 'L\'État veut ouvrir un centre pour demandeurs d\'asile dans une commune rurale.', [['im', 3], ['id', 2]]],
  ['Régularisations dans les métiers en tension', 'Les restaurateurs et le bâtiment demandent des papiers pour leurs salariés.', [['im', 3], ['em', 2]]],
  ['Les départements saturés par les mineurs isolés', 'Les conseils départementaux réclament l\'aide de l\'État.', [['im', 3], ['sp', 1]]],
  ['Accord européen sur l\'asile', 'Les Vingt-Sept s\'entendent sur une répartition des demandeurs.', [['im', 3], ['eu', 3]]],
]);

fam('climat', 'ecologie', 'nat', 3, {}, [['eco', 3]], 6, [
  ch('Réclamer une accélération de la transition', 4, 1, {}, { jeunes: 2, diplomes: 2, agri: -2, rural: -1 }),
  ch('Refuser l\'écologie punitive', 4, -1, {}, { rural: 2, populaire: 1, agri: 2, jeunes: -2 }),
  ch('Se rendre sur place', -1, 0, { notoriete: 2, credibilite: 1 }), SILENCE,
], [
  ['Canicule historique', 'Les 42 degrés sont dépassés dans le Sud. Les hôpitaux déclenchent leurs plans.', [['eco', 4], ['sa', 2]], { mois: [6, 7, 8] }],
  ['Inondations dévastatrices', 'Des villages entiers sont sous l\'eau. Des milliers d\'évacués.', [['eco', 4]], {}, 3],
  ['Incendies géants', 'Des milliers d\'hectares partent en fumée. Les campings sont évacués.', [['eco', 4], ['se', 1]], { mois: [7, 8, 9] }],
  ['Restrictions d\'eau', 'La sécheresse impose des coupures. Agriculteurs et communes se disputent la ressource.', [['eco', 3], ['ag', 3]], { mois: [5, 6, 7, 8, 9] }],
  ['Tempête sur l\'Ouest', 'Des vents à 170 km/h. Un million de foyers sans électricité.', [['eco', 3]], { mois: [10, 11, 12, 1, 2] }],
  ['Le littoral recule', 'Des immeubles du front de mer doivent être évacués.', [['eco', 3], ['lo', 2]]],
  ['Pic de pollution', 'La circulation différenciée est décrétée dans les grandes villes.', [['eco', 3], ['tr', 2], ['sa', 1]]],
  ['Un projet d\'autoroute contesté', 'Des opposants occupent le chantier. Les élus locaux soutiennent le projet.', [['eco', 3], ['tr', 3]]],
  ['Bataille autour d\'une retenue d\'eau', 'Une manifestation interdite dégénère autour d\'une réserve agricole.', [['eco', 3], ['ag', 3], ['se', 1]]],
  ['Rapport alarmant sur le climat', 'Les scientifiques annoncent un réchauffement plus rapide que prévu en France.', [['eco', 4]]],
  ['La grêle détruit les vignes', 'En une heure, la récolte de l\'année est perdue dans plusieurs appellations.', [['ag', 4], ['eco', 2]], { mois: [4, 5, 6] }],
  ['Feu vert pour de nouveaux réacteurs', 'Le chantier des nouveaux réacteurs nucléaires est lancé.', [['eco', 3], ['em', 2]]],
  ['Une nappe phréatique polluée', 'L\'eau du robinet est interdite à la consommation dans un département.', [['eco', 3], ['sa', 3]]],
]);

fam('monde', 'international', 'nat', 2, {}, [['eu', 2]], 6, [
  ch('Défendre une réponse européenne', 2, 1, {}, { diplomes: 2, aise: 1, populaire: -1 }),
  ch('Défendre l\'indépendance de la France', 2, -1, {}, { populaire: 2, rural: 1, diplomes: -1 }),
  ch('Soutenir la position du gouvernement', -1, 0, { credibilite: 1, militants: -1 }), SILENCE,
], [
  ['Sommet européen sous tension', 'Les dirigeants se déchirent sur le budget commun.', [['eu', 4], ['de', 1]]],
  ['Escalade en Ukraine', 'Une offensive majeure relance la question de l\'aide militaire.', [['eu', 3]], {}, 2, [ch('Renforcer l\'aide à l\'Ukraine', 8, 1, {}, { diplomes: 2, populaire: -1 }), ch('Appeler à la négociation', 8, -1, {}, { populaire: 2, diplomes: -1 }), ch('Rester prudent', -1, 0, { credibilite: 1 }), SILENCE]],
  ['Embrasement au Proche-Orient', 'Le conflit s\'étend. Des manifestations ont lieu dans les grandes villes.', [['id', 2], ['se', 2]], {}, 2, [ch('Appeler à un cessez-le-feu immédiat', 8, -1, {}, { jeunes: 2, retraites: -1 }), ch('Rappeler les alliances de la France', 8, 1, {}, { retraites: 1, jeunes: -2 }), ch('Appeler au calme en France', -1, 0, { credibilite: 1 }), SILENCE]],
  ['Élection américaine', 'Le résultat change la donne pour l\'Europe.', [['eu', 3]], { mois: [11] }],
  ['Washington taxe les produits européens', 'Vins, avions et luxe sont visés par de nouveaux droits de douane.', [['em', 3], ['eu', 3], ['ag', 2]]],
  ['Afflux en Méditerranée', 'Les arrivées par la mer doublent en un mois.', [['im', 4], ['eu', 2]]],
  ['Un nouvel État aux portes de l\'Union', 'Bruxelles ouvre les négociations d\'adhésion.', [['eu', 4]]],
  ['Tempête sur l\'euro', 'Les marchés attaquent la dette de plusieurs pays du Sud.', [['de', 4], ['eu', 3]]],
  ['Coup d\'État au Sahel', 'Les ressortissants français sont évacués.', [['id', 1], ['se', 1]]],
  ['Tension en mer de Chine', 'Les chaînes d\'approvisionnement sont menacées.', [['em', 2], ['pa', 2]]],
  ['Accord de libre-échange avec l\'Amérique du Sud', 'Les éleveurs dénoncent une concurrence déloyale.', [['ag', 4], ['eu', 3]]],
  ['Alerte sanitaire mondiale', 'Un nouveau virus inquiète. Les stocks de masques sont vérifiés.', [['sa', 4]], {}, 1],
]);

fam('soc', 'societe', 'nat', 2, {}, [['id', 2]], 6, [
  ch('Défendre une évolution', 5, 1, {}, { jeunes: 2, diplomes: 1, retraites: -1, rural: -1 }),
  ch('Défendre la prudence', 5, -1, {}, { retraites: 2, rural: 1, jeunes: -2 }),
  ch('Laisser la liberté de vote', -1, 0, { unite: 1 }), SILENCE,
], [
  ['Le débat sur la fin de vie revient', 'Le texte arrive au Parlement. Les consciences sont partagées.', [['sa', 3]]],
  ['Polémique sur la laïcité à l\'école', 'Un incident dans un collège enflamme les plateaux.', [['id', 4], ['ec', 3]]],
  ['Réforme du baccalauréat', 'Le ministère change encore les règles. Les lycéens bloquent.', [['ec', 4]]],
  ['Les déserts médicaux s\'étendent', 'Six millions de Français n\'ont plus de médecin traitant.', [['sa', 5], ['sp', 2]], {}, 3, [ch('Réguler l\'installation des médecins', 7, 1, {}, { rural: 3, retraites: 2 }), ch('Miser sur l\'incitation', 7, -1, {}, { aise: 1, rural: -1 }), ch('Proposer des centres de santé publics', 9, 1, { credibilite: 1 }, { rural: 2 }), SILENCE]],
  ['Urgences fermées la nuit', 'Faute de personnel, plusieurs hôpitaux ferment leurs urgences.', [['sa', 5]]],
  ['La natalité au plus bas', 'Le nombre de naissances n\'a jamais été aussi faible depuis 1945.', [['re', 2], ['id', 2]]],
  ['Mobilisation contre les violences faites aux femmes', 'Des dizaines de milliers de personnes défilent.', [['se', 2]]],
  ['L\'intelligence artificielle menace des emplois', 'Un grand groupe remplace un service entier par des logiciels.', [['em', 4]]],
  ['Réseaux sociaux interdits aux moins de 15 ans', 'Le projet divise parents, plateformes et élus.', [['ec', 2]]],
  ['Le niveau des élèves inquiète', 'Les évaluations internationales classent la France en bas du tableau.', [['ec', 5]]],
]);

fam('sport', 'sport', 'nat', 2, {}, [], 2, [
  ch('Saluer la performance', -1, 0, { notoriete: 1 }), ch('En faire un message politique', -1, 0, { notoriete: 3, credibilite: -2 }, { jeunes: -1 }), ch('Rester discret', -1, 0, {}),
], [
  ['Pluie de médailles', 'Les athlètes français brillent aux Jeux.', [], { mois: [7, 8] }],
  ['Les Bleus champions', 'La France gagne la compétition. Les Champs-Élysées sont noirs de monde.', [], { mois: [6, 7] }],
  ['Élimination des Bleus', 'La sélection sort dès le premier tour. La polémique enfle.', [], { mois: [6, 7] }],
  ['Le Tour traverse le pays', 'Des millions de spectateurs au bord des routes.', [], { mois: [7] }],
  ['Un grand festival annulé', 'Les organisateurs dénoncent la baisse des subventions.', [['sp', 1]]],
  ['Un monument en flammes', 'Un joyau du patrimoine est gravement endommagé. L\'émotion est nationale.', [['id', 3]]],
  ['Un prix Nobel pour la France', 'Une chercheuse française est récompensée.', [['ec', 1]]],
  ['Le XV de France au sommet', 'Grand Chelem dans le Tournoi.', [], { mois: [3] }],
]);

fam('inst', 'institutions', 'nat', 2, {}, [['sp', 1]], 5, [
  ch('Dénoncer un passage en force', 6, 1, {}, { populaire: 2, jeunes: 1, aise: -1 }),
  ch('Défendre la stabilité', 6, -1, {}, { retraites: 2, aise: 1, jeunes: -1 }),
  ch('Proposer un compromis', -1, 0, { credibilite: 2, militants: -1 }), SILENCE,
], [
  ['Le gouvernement utilise le 49.3', 'Le texte est adopté sans vote. L\'opposition dépose une motion.', [['re', 1]]],
  ['Motion de censure', 'Le vote sera serré. Chaque voix compte.', []],
  ['Rumeur de dissolution', 'L\'Élysée laisse filtrer l\'hypothèse. Les états-majors s\'agitent.', []],
  ['Un référendum annoncé', 'Le président veut consulter les Français.', []],
  ['Remaniement', 'Le gouvernement est largement renouvelé.', []],
  ['Débat sur la proportionnelle', 'La réforme du mode de scrutin revient sur la table.', []],
  ['Un ministre démissionne', 'Mis en cause, il quitte le gouvernement pour se défendre.', []],
  ['Le Conseil constitutionnel censure une loi', 'Plusieurs articles phares sont annulés.', []],
]);

fam('rival', 'rival', 'nat', 2, { rival: true }, [], 4, [
  ch('Attaquer frontalement', -1, 0, { notoriete: 2, relationRival: -15 }), ch('Rester en retrait', -1, 0, { credibilite: 1 }), ch('Tendre la main à ses électeurs', -1, 0, { capital: -2, voleRival: 1, relationRival: -8 }),
], [
  ['Scandale chez {rival}', 'Un élu local de {rival} est mis en cause dans une affaire de marchés publics.'],
  ['Guerre des chefs chez {rival}', 'Deux dirigeants de {rival} s\'affrontent par médias interposés.'],
  ['Fuite de documents chez {rival}', 'Des notes internes de {rival} sont publiées dans la presse.'],
  ['Démissions en série chez {rival}', 'Plusieurs cadres locaux de {rival} claquent la porte.'],
  ['{rival} en difficulté financière', 'Le trésorier de {rival} lance un appel aux dons.'],
  ['Une vidéo embarrassante pour {rival}', 'Les propos d\'un candidat de {rival} font polémique.'],
  ['{rival} change de ligne', 'Un virage doctrinal déroute une partie de ses électeurs.'],
  ['Congrès houleux chez {rival}', 'Le vote des militants de {rival} est contesté.'],
]);

const INT = (a, b, c, d) => [a, b, [], {}, undefined, [c, d, ch('Temporiser', -1, 0, {})]];
fam('parti', 'interne', 'parti', 3, {}, [], 0, [], [
  INT('Fuite dans la presse', 'Le compte rendu du dernier bureau national est publié mot pour mot.', ch('Chercher le responsable', -1, 0, { unite: -3, capital: 2 }), ch('Minimiser', -1, 0, { credibilite: -1 })),
  INT('Un cadre critique la ligne', 'Dans une interview, un de vos cadres prend ses distances avec la direction.', ch('Rappel à l\'ordre', -1, 0, { unite: -2, capital: 1, cadreMoral: -10 }), ch('Ouvrir le débat', -1, 0, { unite: 2, capital: -2 })),
  INT('Une fédération en crise', 'Le délégué départemental est contesté par la moitié de ses sections.', ch('Mettre la fédération sous tutelle', -1, 0, { capital: -4, unite: -1, militants: -1 }), ch('Organiser un vote local', -1, 0, { unite: 1, argent: -15000 })),
  INT('Afflux d\'adhésions', 'Après une séquence favorable, les demandes d\'adhésion affluent.', ch('Ouvrir grand les portes', -1, 0, { militants: 6, unite: -2 }), ch('Former avant d\'intégrer', -1, 0, { militants: 3, argent: -30000 })),
  INT('Le trésorier alerte', 'Les dépenses courantes dépassent les recettes depuis trois mois.', ch('Plan d\'économies', -1, 0, { argent: 80000, militants: -2, unite: -1 }), ch('Appel aux dons', -1, 0, { argent: 40000, credibilite: -1 })),
  INT('Polémique au mouvement jeunes', 'Une soirée du mouvement jeunes dérape. Des images circulent.', ch('Sanctionner', -1, 0, { credibilite: 1, militants: -1 }, { jeunes: -1 }), ch('Défendre les jeunes', -1, 0, { credibilite: -2 }, { jeunes: 1 })),
  INT('Un ralliement surprise', 'Un élu local d\'un autre parti veut vous rejoindre.', ch('L\'accueillir en fanfare', -1, 0, { notoriete: 2, unite: -1, ralliement: 1 }), ch('L\'accueillir discrètement', -1, 0, { ralliement: 1 })),
  INT('Démission collective', 'Une section entière annonce son départ.', ch('Tenter de les retenir', -1, 0, { capital: -3, unite: 1 }), ch('Tourner la page', -1, 0, { militants: -3 })),
  INT('Université d\'été', 'Le rendez-vous annuel approche. Quel format ?', ch('Grand rassemblement', -1, 0, { argent: -120000, militants: 4, notoriete: 2, unite: 2 }), ch('Format réduit', -1, 0, { argent: -30000, unite: 1 }), { mois: [8, 9] }),
  INT('Un don embarrassant', 'Un gros donateur au profil sulfureux veut vous soutenir.', ch('Accepter', -1, 0, { argent: 7500, risqueAffaire: 1 }), ch('Refuser', -1, 0, { credibilite: 1 })),
  INT('Message malheureux d\'un cadre', 'Un de vos responsables locaux publie un message qui fait scandale.', ch('Exclure', -1, 0, { credibilite: 2, unite: -2 }), ch('Demander des excuses', -1, 0, { credibilite: -1 })),
  INT('Pétition de militants', 'Des centaines de militants demandent plus de démocratie interne.', ch('Accepter une consultation', -1, 0, { unite: 3, capital: -3 }), ch('Refuser', -1, 0, { unite: -3, capital: 1 })),
  INT('Permanence vandalisée', 'Un de vos locaux a été dégradé dans la nuit.', ch('Porter plainte et médiatiser', -1, 0, { notoriete: 1, militants: 1 }), ch('Porter plainte sans bruit', -1, 0, {})),
  INT('Fichier des adhérents piraté', 'Des données personnelles de vos adhérents circulent.', ch('Tout dire tout de suite', -1, 0, { credibilite: 1, militants: -1, argent: -40000 }), ch('Gérer en interne', -1, 0, { risqueAffaire: 1 })),
  INT('Deux barons se déchirent', 'Deux figures locales se disputent le leadership d\'une région.', ch('Arbitrer', -1, 0, { capital: -3, unite: 1 }), ch('Laisser faire', -1, 0, { unite: -3 })),
  INT('Proposition d\'alliance locale', 'Un parti voisin propose une liste commune dans plusieurs villes.', ch('Accepter', -1, 0, { unite: -1, credibilite: 1, capital: 2 }), ch('Refuser', -1, 0, { unite: 1 })),
  INT('Un journaliste en immersion', 'Un reporter veut suivre votre équipe pendant un mois.', ch('Accepter', -1, 0, { notoriete: 3, risqueGaffe: 1 }), ch('Refuser', -1, 0, {})),
  INT('Le livre d\'un ancien', 'Un ancien cadre publie un livre à charge.', ch('Répondre point par point', -1, 0, { notoriete: 1, credibilite: -1 }), ch('Ignorer', -1, 0, { unite: -1 })),
  INT('Conflit d\'investiture', 'Deux candidats revendiquent la même circonscription.', ch('Trancher pour le mieux implanté', -1, 0, { capital: -2 }), ch('Organiser un vote des militants', -1, 0, { unite: 1, argent: -8000 })),
  INT('Formation des cadres', 'L\'école de formation propose un plan ambitieux.', ch('Financer le plan', -1, 0, { argent: -150000, formation: 1, unite: 1 }), ch('Reporter', -1, 0, {})),
  INT('Les élus rechignent à reverser', 'Plusieurs élus ne versent plus leur contribution au parti.', ch('Exiger les versements', -1, 0, { argent: 60000, unite: -2 }), ch('Fermer les yeux', -1, 0, { capital: -1 })),
  INT('Nouvelle identité visuelle', 'L\'agence propose de changer le logo et les couleurs de campagne.', ch('Valider', -1, 0, { argent: -90000, notoriete: 2 }), ch('Garder l\'existant', -1, 0, {})),
]);

const LOC = (a, b, th, c1, c2) => [a, b, th, {}, undefined, [c1, c2, ch('Reporter la décision', -1, 0, { bilan: -1 })]];
fam('maire', 'mandat', 'mandat', 3, { role: 'maire' }, [], 0, [], [
  LOC('L\'usine du coin ferme', 'Deux cents emplois sont menacés dans votre commune.', [['em', 3]], ch('Monter au créneau à Paris', -1, 0, { bilan: 2, notoriete: 2, forme: -5 }), ch('Préparer la reconversion du site', -1, 0, { bilan: 3, budget: -400000 })),
  LOC('Le projet de tramway divise', 'Les commerçants craignent les travaux. Les usagers l\'attendent.', [['tr', 3]], ch('Lancer le chantier', 4, 1, { bilan: 3, budget: -2000000 }, { independants: -2, jeunes: 2 }), ch('Organiser une consultation', -1, 0, { bilan: 1 })),
  LOC('Une classe menacée de fermeture', 'L\'académie veut supprimer une classe dans une école de quartier.', [['ec', 3]], ch('Mobiliser avec les parents', -1, 0, { bilan: 2, notoriete: 1 }), ch('Négocier avec le rectorat', -1, 0, { bilan: 1, credibilite: 1 })),
  LOC('Incivilités dans un quartier', 'Les habitants se plaignent de rodéos et de tapage.', [['se', 3]], ch('Renforcer la police municipale', 3, 1, { bilan: 2, budget: -300000 }), ch('Financer des médiateurs', 3, -1, { bilan: 2, budget: -150000 })),
  LOC('La rivière déborde', 'Des caves et des commerces sont inondés.', [['eco', 2]], ch('Aide d\'urgence de la commune', -1, 0, { bilan: 3, budget: -250000 }), ch('Attendre l\'état de catastrophe naturelle', -1, 0, { bilan: -2 })),
  LOC('Le club de foot au bord du dépôt de bilan', 'Le club historique de la ville demande une subvention exceptionnelle.', [], ch('Sauver le club', -1, 0, { bilan: 2, budget: -200000 }, { populaire: 2 }), ch('Refuser', -1, 0, { bilan: -1, credibilite: 1 })),
  LOC('La piscine est vétuste', 'Le bassin fuit. La remise aux normes coûte cher.', [['sp', 2]], ch('Rénover', -1, 0, { bilan: 3, budget: -1500000 }), ch('Fermer et mutualiser avec la ville voisine', 9, 1, { bilan: -1, budget: 100000 })),
  LOC('Grève à la cantine', 'Les agents de restauration scolaire cessent le travail.', [['sp', 2]], ch('Céder sur les primes', 7, 1, { bilan: 1, budget: -120000 }), ch('Tenir bon', 7, -1, { bilan: -1, credibilite: 1 })),
  LOC('Dépôts sauvages', 'Les décharges illégales se multiplient aux abords de la ville.', [['eco', 2]], ch('Brigade verte et amendes', 3, 1, { bilan: 2, budget: -80000 }), ch('Campagne de sensibilisation', -1, 0, { bilan: 1, budget: -20000 })),
  LOC('Un promoteur veut construire', 'Un projet de trois cents logements est proposé sur une friche.', [['lo', 3]], ch('Accorder le permis', 0, 1, { bilan: 1, budget: 300000 }, { jeunes: 1, retraites: -1 }), ch('Exiger plus de logements sociaux', 0, -1, { bilan: 1 }, { precaires: 2, aise: -1 })),
  LOC('Demande de vidéoprotection', 'Des riverains réclament des caméras.', [['se', 2]], ch('Installer des caméras', 3, 1, { bilan: 2, budget: -200000 }), ch('Refuser', 3, -1, { bilan: -1 }, { diplomes: 1 })),
  LOC('Le festival de l\'été', 'L\'association organisatrice demande un soutien renforcé.', [], ch('Doubler la subvention', -1, 0, { bilan: 2, budget: -100000 }, { jeunes: 2 }), ch('Maintenir le montant', -1, 0, {})),
  LOC('Plus de médecin', 'Le dernier généraliste du quartier part à la retraite.', [['sa', 4]], ch('Créer un centre de santé municipal', 7, 1, { bilan: 4, budget: -500000 }), ch('Offrir un local à un libéral', -1, 0, { bilan: 2, budget: -60000 })),
  LOC('Le centre-ville se vide', 'Les rideaux baissent les uns après les autres.', [['em', 2]], ch('Préempter et installer des commerces', 0, -1, { bilan: 3, budget: -600000 }), ch('Baisser les taxes locales des commerçants', 0, 1, { bilan: 2, budget: -200000 }, { independants: 2 })),
  LOC('Un bâtiment squatté', 'Un immeuble municipal vide est occupé.', [['lo', 2], ['se', 1]], ch('Demander l\'expulsion', 3, 1, { bilan: 1 }), ch('Négocier un relogement', 7, 1, { bilan: 1, budget: -80000 })),
  LOC('Pétition sur le stationnement', 'La hausse des tarifs passe mal.', [['tr', 2]], ch('Reculer', -1, 0, { bilan: 1, budget: -150000, credibilite: -1 }), ch('Maintenir', 4, 1, { bilan: -1, budget: 100000 })),
  LOC('Visite ministérielle', 'Un ministre vient inaugurer un équipement dans votre ville.', [], ch('L\'accueillir chaleureusement', -1, 0, { notoriete: 2, bilan: 1 }), ch('Garder ses distances', -1, 0, { militants: 1 })),
  LOC('Fusion intercommunale', 'Le préfet propose de fusionner votre intercommunalité avec la voisine.', [], ch('Accepter', 9, -1, { budget: 200000, bilan: -1 }), ch('Refuser', 9, 1, { bilan: 1 })),
  LOC('Budget participatif', 'Des habitants demandent à décider d\'une partie des investissements.', [], ch('Le créer', 6, 1, { bilan: 2, budget: -150000 }), ch('Décliner', 6, -1, {})),
  LOC('Une école à reconstruire', 'Le groupe scolaire date des années 1960 et prend l\'eau.', [['ec', 3]], ch('Reconstruire', -1, 0, { bilan: 4, budget: -3000000 }), ch('Réparer au minimum', -1, 0, { bilan: 1, budget: -300000 })),
  LOC('Canicule et écoles surchauffées', 'Les parents réclament des travaux avant l\'été prochain.', [['ec', 2], ['eco', 2]], ch('Plan de végétalisation des cours', 4, 1, { bilan: 3, budget: -700000 }), ch('Acheter des ventilateurs', -1, 0, { bilan: 1, budget: -40000 })),
]);

fam('coll', 'mandat', 'mandat', 3, { role: 'president_local' }, [], 0, [], [
  LOC('Collèges vétustes', 'Trois établissements ont besoin de travaux lourds.', [['ec', 3]], ch('Plan de rénovation', -1, 0, { bilan: 3, budget: -8000000 }), ch('Étaler sur dix ans', -1, 0, { bilan: 1, budget: -2000000 })),
  LOC('Le coût du RSA explose', 'Les dépenses sociales pèsent sur le budget.', [['de', 2]], ch('Renforcer les contrôles', 7, -1, { bilan: 1, budget: 3000000 }), ch('Investir dans l\'insertion', 7, 1, { bilan: 2, budget: -3000000 })),
  LOC('Routes dégradées', 'Les nids-de-poule se multiplient sur le réseau.', [['tr', 3]], ch('Plan routes', -1, 0, { bilan: 3, budget: -6000000 }, { rural: 2 }), ch('Parer au plus pressé', -1, 0, { bilan: 1, budget: -1000000 })),
  LOC('Lycées saturés', 'Les effectifs débordent dans plusieurs bassins.', [['ec', 3]], ch('Construire un nouvel établissement', -1, 0, { bilan: 4, budget: -15000000 }), ch('Installer des préfabriqués', -1, 0, { bilan: -1, budget: -1000000 })),
  LOC('Trains régionaux en retard', 'Les usagers sont excédés par les suppressions de trains.', [['tr', 4]], ch('Ouvrir à la concurrence', 0, 1, { bilan: 2 }), ch('Commander de nouvelles rames', 0, -1, { bilan: 3, budget: -20000000 })),
  LOC('Aides aux entreprises', 'Une entreprise demande une aide pour ne pas délocaliser.', [['em', 3]], ch('Accorder l\'aide', 0, -1, { bilan: 2, budget: -4000000 }), ch('Refuser le chantage', 0, 1, { bilan: -1, credibilite: 1 })),
  LOC('La fibre n\'arrive pas', 'Les zones rurales attendent toujours le très haut débit.', [['sp', 3]], ch('Financer le raccordement', -1, 0, { bilan: 3, budget: -5000000 }, { rural: 3 }), ch('Attendre les opérateurs', -1, 0, { bilan: -2 })),
  LOC('Les pompiers manquent de moyens', 'Le service d\'incendie demande une rallonge.', [['se', 2]], ch('Augmenter la dotation', -1, 0, { bilan: 2, budget: -2500000 }), ch('Refuser', -1, 0, { bilan: -2 })),
  LOC('Soutien aux agriculteurs', 'Après une mauvaise année, la profession demande une aide.', [['ag', 4]], ch('Fonds d\'urgence', -1, 0, { bilan: 2, budget: -3000000 }, { agri: 3 }), ch('Renvoyer vers l\'État', -1, 0, { bilan: -1 })),
  LOC('Un grand projet d\'équipement', 'Un projet de parc de loisirs promet des emplois mais consomme des terres.', [['em', 2], ['eco', 2]], ch('Soutenir', 4, -1, { bilan: 2 }, { independants: 1 }), ch('S\'opposer', 4, 1, { bilan: 1 }, { jeunes: 1 })),
]);

fam('depute', 'mandat', 'mandat', 3, { role: 'depute' }, [], 0, [], [
  LOC('Un amendement transpartisan', 'Des collègues d\'autres groupes vous proposent de cosigner un amendement.', [], ch('Cosigner', -1, 0, { credibilite: 2, unite: -1, activite: 2 }), ch('Refuser', -1, 0, { unite: 1 })),
  LOC('La niche parlementaire', 'Votre groupe a une journée pour ses textes. Lequel pousser ?', [], ch('Un texte symbolique', -1, 0, { notoriete: 3, activite: 2 }), ch('Un texte qui peut passer', -1, 0, { credibilite: 3, activite: 3 })),
  LOC('Commission d\'enquête', 'Vous pouvez demander une commission d\'enquête sur un sujet d\'actualité.', [], ch('La demander', -1, 0, { notoriete: 3, capital: -3, activite: 4 }), ch('S\'abstenir', -1, 0, {})),
  LOC('Question au gouvernement', 'Vous avez la parole mardi. Quel ton ?', [], ch('Offensif', -1, 0, { notoriete: 3, risqueGaffe: 1, activite: 1 }), ch('Technique', -1, 0, { credibilite: 2, activite: 1 })),
  LOC('Un vote difficile', 'La consigne de votre groupe heurte vos électeurs.', [], ch('Suivre le groupe', -1, 0, { unite: 1, bilan: -2 }), ch('Voter selon sa circonscription', -1, 0, { unite: -2, bilan: 3 })),
  LOC('Un lobby insistant', 'Un groupe d\'intérêt vous propose un amendement clés en main.', [], ch('Refuser et le dire', -1, 0, { credibilite: 2, notoriete: 1 }), ch('Écouter poliment', -1, 0, { risqueAffaire: 1 })),
  LOC('Mission d\'information', 'On vous propose de corédiger un rapport.', [], ch('Accepter', -1, 0, { credibilite: 3, forme: -6, activite: 4 }), ch('Décliner', -1, 0, {})),
  LOC('Classement des députés', 'Un site publie les taux de présence. Le vôtre est moyen.', [], ch('Être plus présent à Paris', -1, 0, { credibilite: 1, bilan: -1, activite: 2 }), ch('Assumer la priorité au terrain', -1, 0, { bilan: 2 })),
  LOC('Incident de séance', 'Un échange vif tourne à l\'invective dans l\'hémicycle.', [], ch('Calmer le jeu', -1, 0, { credibilite: 1 }), ch('Monter le ton', -1, 0, { notoriete: 2, risqueGaffe: 1 })),
  LOC('Permanence parlementaire', 'Les demandes des habitants s\'accumulent.', [], ch('Recruter un collaborateur local', -1, 0, { bilan: 3 }), ch('Tenir plus de permanences', -1, 0, { bilan: 2, forme: -6 })),
]);

fam('perso', 'carriere', 'perso', 3, { mode: 'carriere' }, [], 0, [], [
  LOC('Une offre dans le privé', 'Une entreprise vous propose un poste bien payé, mais prenant.', [], ch('Refuser pour la politique', -1, 0, { moral: 3 }), ch('Accepter à temps partiel', -1, 0, { forme: -8, reseau: 1 })),
  LOC('Un mentor', 'Un élu chevronné propose de vous prendre sous son aile.', [], ch('Accepter', -1, 0, { mentor: 1 }), ch('Garder son indépendance', -1, 0, { moral: 2 })),
  LOC('Portrait dans la presse locale', 'Le journal veut faire votre portrait.', [], ch('Accepter', -1, 0, { notorietePerso: 3, risqueGaffe: 1 }), ch('Décliner', -1, 0, {})),
  LOC('Un rival local vous attaque', 'Un concurrent de votre propre camp répand des rumeurs.', [], ch('Répliquer', -1, 0, { notorietePerso: 1, unite: -1 }), ch('Laisser dire et travailler', -1, 0, { moral: -2, credibilitePerso: 1 })),
  LOC('Invitation à un dîner', 'Des notables de la ville vous invitent.', [], ch('Y aller', -1, 0, { reseau: 1, forme: -2 }), ch('Rester sur le terrain', -1, 0, { ancrage: 1 })),
  LOC('La fatigue s\'installe', 'Les semaines s\'enchaînent sans repos.', [], ch('Prendre une semaine de repos', -1, 0, { forme: 25, repos: 1 }), ch('Continuer', -1, 0, { forme: -10, moral: -3 })),
  LOC('Vie de famille', 'Vos proches trouvent que la politique prend trop de place.', [], ch('Lever le pied un mois', -1, 0, { forme: 15, moral: 5, repos: 2 }), ch('Expliquer que c\'est temporaire', -1, 0, { moral: -4 })),
  LOC('École des cadres', 'Le parti vous propose une formation de plusieurs week-ends.', [], ch('S\'inscrire', -1, 0, { formationPerso: 1, forme: -5 }), ch('Pas le temps', -1, 0, {})),
  LOC('Une rumeur', 'On raconte que vous voulez quitter le parti.', [], ch('Démentir publiquement', -1, 0, { notorietePerso: 1 }), ch('Ne rien dire', -1, 0, { unite: -1 })),
  LOC('Prise de parole en assemblée générale', 'Vous avez trois minutes devant les militants.', [], ch('Discours offensif', -1, 0, { notorietePerso: 2, capitalPerso: 2, risqueGaffe: 1 }), ch('Discours consensuel', -1, 0, { capitalPerso: 1 })),
  LOC('Engagement associatif', 'Une association de quartier cherche un bénévole régulier.', [], ch('S\'engager', -1, 0, { ancrage: 2, forme: -4 }), ch('Décliner', -1, 0, {})),
  LOC('Un adversaire vous tend la main', 'Un responsable d\'un autre parti vous verrait bien chez lui.', [], ch('Écouter la proposition', -1, 0, { offreDebauchage: 1 }), ch('Couper court', -1, 0, { loyaute: 1 })),
]);

fam('media', 'medias', 'parti', 2, {}, [], 0, [], [
  INT('Invitation à la grande matinale', 'La radio la plus écoutée veut votre porte-parole demain matin.', ch('Envoyer le chef', -1, 0, { interview: 1 }), ch('Envoyer un second couteau', -1, 0, { notoriete: 1 })),
  INT('Polémique sur un plateau', 'Un de vos représentants s\'est emporté en direct.', ch('Assumer', -1, 0, { notoriete: 2, credibilite: -1 }), ch('S\'excuser', -1, 0, { credibilite: 1 })),
  INT('Fausse information virale', 'Une rumeur infondée sur votre programme circule massivement.', ch('Démentir avec des chiffres', -1, 0, { credibilite: 1, argent: -10000 }), ch('Ignorer', -1, 0, { credibilite: -2 })),
  INT('Un documentaire sur le parti', 'Une chaîne prépare une enquête de fond.', ch('Ouvrir les portes', -1, 0, { notoriete: 3, risqueGaffe: 1 }), ch('Refuser de participer', -1, 0, { credibilite: -1 })),
  INT('Clash sur les réseaux', 'Un échange avec un influenceur dégénère.', ch('Surenchérir', -1, 0, { viralite: 3, credibilite: -1 }, { jeunes: 1 }), ch('Clore l\'échange', -1, 0, {})),
  INT('Format long', 'Un podcast politique propose deux heures d\'entretien.', ch('Accepter', -1, 0, { credibilite: 2, notoriete: 1 }, { diplomes: 1, jeunes: 1 }), ch('Refuser', -1, 0, {})),
  INT('Interview piège', 'Le journaliste a un dossier sur vos contradictions.', ch('Y aller préparé', -1, 0, { interview: 1 }), ch('Annuler', -1, 0, { credibilite: -1 })),
  INT('Sondage choc', 'Un institut vous donne quatre points de plus que la semaine dernière.', ch('Communiquer dessus', -1, 0, { notoriete: 2, militants: 2 }), ch('Rester prudent', -1, 0, { credibilite: 1 })),
]);

fam('pres', 'presidence', 'mandat', 4, { role: 'president' }, [], 0, [], [
  LOC('Réforme des retraites', 'Votre majorité attend un cap clair.', [['re', 4]], ch('Avancer l\'âge de départ', 7, 1, { popularite: 4, budgetEtat: -1 }, { populaire: 3, aise: -2 }), ch('Reculer l\'âge de départ', 7, -1, { popularite: -6, budgetEtat: 2 }, { aise: 2, populaire: -3 })),
  LOC('Réforme des institutions', 'Vous aviez promis de changer les règles du jeu.', [], ch('Proportionnelle et référendum d\'initiative citoyenne', 6, 1, { popularite: 3 }), ch('Statu quo', 6, -1, { popularite: -2 })),
  LOC('Colère sociale', 'Un mouvement parti des réseaux bloque les ronds-points.', [['pa', 4]], ch('Céder sur le pouvoir d\'achat', 0, -1, { popularite: 3, budgetEtat: -2 }), ch('Tenir la ligne', 0, 1, { popularite: -4, budgetEtat: 1 })),
  LOC('Sommet international', 'La France doit prendre position dans une crise majeure.', [['eu', 3]], ch('Jouer collectif avec l\'Europe', 2, 1, { popularite: 1 }), ch('Faire entendre une voix singulière', 2, -1, { popularite: 2 })),
  LOC('Le budget', 'Il manque trente milliards.', [['de', 4]], ch('Augmenter les impôts des plus aisés', 0, -1, { popularite: 1, budgetEtat: 2 }, { aise: -3 }), ch('Couper dans les dépenses', 0, 1, { popularite: -3, budgetEtat: 2 }, { public: -3 })),
  LOC('Catastrophe naturelle', 'Une région est dévastée.', [['eco', 3]], ch('Se rendre sur place et débloquer des fonds', -1, 0, { popularite: 3, budgetEtat: -1 }), ch('Envoyer le Premier ministre', -1, 0, { popularite: -2 })),
  LOC('Popularité en berne', 'Les sondages sont mauvais. Vos proches s\'inquiètent.', [], ch('Changer de Premier ministre', -1, 0, { popularite: 3, unite: -2 }), ch('Garder le cap', -1, 0, { popularite: -1, credibilite: 1 })),
  LOC('Promesse phare', 'Le moment est venu d\'appliquer votre mesure la plus attendue.', [], ch('Par la loi, vite', -1, 0, { popularite: 4, credibilite: 2, budgetEtat: -1 }), ch('Par étapes', -1, 0, { popularite: -1, credibilite: -1 })),
  LOC('Référendum', 'Vous pouvez consulter les Français sur un grand sujet.', [], ch('Organiser le référendum', 6, 1, { popularite: 2, referendum: 1 }), ch('Passer par le Parlement', 6, -1, {})),
  LOC('Réforme fiscale', 'Les entreprises demandent de la stabilité, les ménages du pouvoir d\'achat.', [['pa', 3]], ch('Baisser l\'impôt sur le revenu', 0, 1, { popularite: 3, budgetEtat: -2 }), ch('Baisser la TVA sur l\'essentiel', 0, -1, { popularite: 3, budgetEtat: -2 }, { populaire: 2 })),
]);

fam('saison', 'calendrier', 'nat', 5, {}, [], 2, [], [
  ['Rentrée scolaire', 'Il manque des professeurs dans de nombreuses académies.', [['ec', 3]], { mois: [9] }, 5, [ch('Demander un plan de recrutement', 7, 1, {}, { public: 2 }), ch('Demander plus d\'autonomie des établissements', 9, 1, {}, { aise: 1 }), SILENCE]],
  ['Salon de l\'agriculture', 'Tous les responsables politiques défilent porte de Versailles.', [['ag', 3]], { mois: [2] }, 5, [ch('Y passer une journée entière', -1, 0, { notoriete: 2, forme: -3 }, { agri: 2, rural: 1 }), ch('Faire une visite rapide', -1, 0, { notoriete: 1 }), ch('Ne pas y aller', -1, 0, {}, { agri: -1 })]],
  ['Premier mai', 'Les cortèges syndicaux défilent dans tout le pays.', [['em', 2]], { mois: [5] }, 5, [ch('Défiler avec les syndicats', 7, 1, { militants: 1 }, { populaire: 1, public: 1 }), ch('Organiser son propre rassemblement', -1, 0, { militants: 2, argent: -40000 }), SILENCE]],
  ['Vœux de début d\'année', 'C\'est le moment de fixer le cap.', [], { mois: [1] }, 5, [ch('Vœux offensifs', -1, 0, { notoriete: 2, militants: 1 }), ch('Vœux rassembleurs', -1, 0, { credibilite: 1, unite: 1 }), ch('Simple message vidéo', -1, 0, {})]],
  ['Congrès des maires', 'Les élus locaux expriment leur ras-le-bol face aux baisses de dotations.', [['sp', 2]], { mois: [11] }, 5, [ch('Défendre les dotations', 9, 1, {}, { rural: 2 }), ch('Appeler les collectivités à l\'effort', 9, -1, {}, { aise: 1, rural: -2 }), SILENCE]],
  ['Débat budgétaire', 'Le projet de loi de finances arrive à l\'Assemblée.', [['de', 3], ['pa', 2]], { mois: [10] }, 5, [ch('Présenter un contre-budget', -1, 0, { credibilite: 3, capital: -2 }), ch('Dénoncer l\'austérité', 0, -1, {}, { populaire: 1 }), ch('Dénoncer le laxisme', 0, 1, {}, { aise: 1 })]],
  ['Cérémonies du 11 novembre', 'Le pays rend hommage à ses morts.', [['id', 1]], { mois: [11] }, 4, [ch('Participer aux cérémonies', -1, 0, { credibilite: 1 }, { retraites: 1 }), ch('Envoyer un représentant', -1, 0, {})]],
  ['Départs en vacances', 'La vie politique tourne au ralenti.', [], { mois: [8] }, 4, [ch('Tournée des plages et des marchés', -1, 0, { notoriete: 1, militants: 1, forme: -4 }), ch('Laisser souffler les équipes', -1, 0, { forme: 8 })]],
  ['Fêtes de fin d\'année', 'Les banques alimentaires lancent leur collecte.', [['pa', 2]], { mois: [12] }, 4, [ch('Mobiliser les militants pour la collecte', -1, 0, { credibilite: 1, militants: 1 }, { precaires: 1 }), ch('Trêve des confiseurs', -1, 0, { forme: 5 })]],
  ['Parcoursup', 'Des milliers de bacheliers restent sans affectation.', [['ec', 3]], { mois: [6, 7] }, 4, [ch('Demander la suppression de la plateforme', 5, 1, {}, { jeunes: 2 }), ch('Défendre la sélection', 5, -1, {}, { aise: 1, jeunes: -1 }), SILENCE]],
]);

fam('deces', 'deces', 'nat', 1, {}, [], 2, [ch('Rendre hommage', -1, 0, { credibilite: 1 }), ch('Rester silencieux', -1, 0, {})], [
  ['Disparition d\'une grande figure', 'Une personnalité qui a marqué la vie publique pendant quarante ans s\'est éteinte.'],
  ['Hommage national', 'Le pays salue la mémoire d\'un ancien résistant, dernier de sa génération.'],
]);

writeFileSync('public/data/evenements.json', JSON.stringify({ _doc: 'Voir docs/DATA.md. portee : nat (tous les partis réagissent), parti (vie interne du parti du joueur), mandat (selon le mandat exercé), perso (mode Carrière). cond : conditions de déclenchement. themes : hausse des priorités dans l\'opinion. choix : axe et sens donnent la position prise, eff les effets directs, opinion l\'effet par étiquette de segment.', evenements: ev }, null, 1));
console.log(`evenements.json : ${ev.length} événements`);
