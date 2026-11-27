# Décisions

Une ligne par décision, avec la raison.

- Dépôt : le dépôt GitHub créé s'appelle `Mandat-` et non `mandat`. Je l'utilise tel quel, car ma session ne peut ni créer ni renommer un dépôt. Le jeu utilise des chemins relatifs, donc un renommage ne casse rien.
- Interface : Preact, comme demandé. Pas de React.
- Graphiques : SVG fait main, sans librairie. Raison : zéro dépendance en plus, rendu cohérent avec la carte.
- Outils de construction : le registre npm n'est pas joignable depuis mon environnement. Le projet est configuré pour Vite, Preact et Vitest (c'est ce que lancent `npm run dev`, `npm run build`, `npm test` et le workflow GitHub). De mon côté je compile avec bun et les sources de Preact clonées depuis GitHub (`scripts/dev/`), et je lance les tests avec `bun test`, qui accepte les imports `vitest`.
- Données : data.gouv.fr et l'INSEE ne sont pas joignables depuis mon environnement, GitHub oui. Les données réelles viennent donc de dépôts GitHub publics qui republient les fichiers officiels (voir `docs/DATA.md`). Ce qui manque est remplacé par des données de substitution, signalées comme telles.
- Pipeline de données en Node sans dépendance (`.mjs`). Raison : lançable partout avec `node`, sans installation.
- Maquette de zones : communes de plus de 10 000 habitants une par une (1 045), autres communes regroupées en bassins par canton (1 699), 34 secteurs pour Paris, Lyon, Marseille, 19 zones pour les collectivités d'outre-mer et les Français de l'étranger. Raison : c'est la granularité demandée, et elle tient les performances.
- Vingt groupes sociaux par zone au lieu du croisement complet âge x catégorie x territoire. Raison : performance et lisibilité. Le type de territoire est porté par la zone.
- Calibrage refait à chaque création de partie (moins d'une seconde) plutôt que stocké dans un fichier. Raison : si vous modifiez un parti ou un segment dans les JSON, le calibrage reste juste sans rien relancer.
- Le parti exact des candidats UG et ENS de 2024 n'est pas dans les données officielles par nuance. Les élus connus sont rattachés par la liste `affiliations`, les autres par défaut au PS (UG) ou à Renaissance (ENS).
- Paris, Lyon, Marseille : j'applique la réforme de 2025 (un vote pour le conseil de la ville avec prime de 25 %, un vote par secteur avec prime de 50 %). Raison : c'est le régime en vigueur depuis les municipales 2026.
- Les secteurs sont dessinés par des cercles sur la carte. Raison : les contours des arrondissements municipaux n'étaient pas dans les sources joignables.
- Un vote a lieu le dimanche et le moteur le traite le lundi suivant. Raison : un tour commence le lundi, la soirée électorale ouvre la semaine.
- Législatives placées en juin après chaque présidentielle (2027, 2032, etc.). Raison : c'est l'usage depuis 2002, et le président élu en 2027 n'aurait pas de majorité avec l'Assemblée de 2024. La dissolution libre est renvoyée à la V4.
- Départementales et régionales en mars 2028 puis tous les six ans. Raison : report légal de 2027 à 2028.
- Postes de direction des partis (trésorier, porte-parole, etc.) et délégués départementaux confiés à des personnages générés. Raison : ne pas attribuer à une personne réelle une fonction qu'elle n'occupe pas.
- Traits des personnes réelles tirés uniquement de leur fonction, jamais au hasard. Raison : un trait comme « Gaffeur » serait un jugement personnel.
- Les personnes réelles ne meurent pas dans le jeu, elles se retirent avec l'âge. Raison : éviter d'annoncer le décès d'une personne réelle.
- Médias : noms fictifs inspirés des vrais. Raison : le cahier des charges demande des médias « inspirés des vrais », et donner une orientation éditoriale à un média réel serait un jugement.
- Usure du pouvoir ajoutée au moteur (le parti du président et ses alliés perdent du terrain, l'opposition se refait). Raison : sans elle, le premier parti des données réelles gagnait toutes les présidentielles dans la simulation automatique.
- Pas plus de deux mandats présidentiels consécutifs. Raison : article 6 de la Constitution.
- Scissions : le courant qui part rejoint le parti existant le plus proche, ou active un des deux partis de réserve s'il pèse plus de 22 %. Raison : garder un nombre de partis fixe en mémoire tout en permettant la création de partis (scission, fondation par le joueur).
- Sénateurs et élus locaux sans rôle de jeu : sièges comptés par parti sans fiche personnage, sauf pour le parti du joueur. Raison : limiter le nombre de personnages (environ 2 700 au départ, 7 000 en 2050).
- En mode Carrière, l'IA dirige le parti du joueur pour tout ce que ses postes ne lui permettent pas de décider. Raison : c'est la règle demandée (un militant ne décide pas des investitures).
- Le score du mode Carrière compte surtout le parcours personnel. Le poids du parti n'est compté en entier que si le joueur le préside.
- Déploiement : le workflow GitHub Actions teste, construit et déploie. L'activation de GitHub Pages se fait dans les réglages du dépôt et je n'y ai pas accès depuis ma session.
- Partie d'essai : jouée à travers la vraie interface par un robot (Playwright) qui prend les décisions comme un joueur, avec relecture des journaux et des captures d'écran. Raison : c'est le seul moyen pour moi de jouer dix ans dans le navigateur.
- Usure du pouvoir plafonnée à 0,42 pour le parti du président et à 0,2 pour ses alliés. Raison : sans plafond, le parti au pouvoir s'effondrait partout après un mandat (7 villes et une trésorerie négative dans la partie d'essai).
- Formation du gouvernement : le camp du président gouverne, sauf si un autre bloc a la majorité absolue ou le dépasse de plus de 35 %. Raison : éviter des cohabitations pour quelques sièges d'écart.
- Victoires collectives (majorité absolue, hégémonie locale, victoire culturelle) réservées au joueur qui dirige son parti. Raison : en mode Carrière, un cadre moyen recevait le mérite de son parti.
- Personnes réelles : attributs mentaux fixés autour de 11 avec très peu de bruit, fidélité cachée fixée à 12, pas de profession ni de formation inventées. Raison : ne porter aucun jugement personnel et ne rien inventer sur elles.
- Une prise de parole médiatique pèse sur le parti selon le rang de celui qui parle. Raison : la gaffe d'un simple militant ne doit pas coûter autant que celle du chef.
- La confirmation avant de quitter une partie se fait par un second clic sur le bouton, sans boîte de dialogue du navigateur. Raison : ces boîtes sont bloquées dans certains cadres d'affichage.
- Équilibrage final accepté en l'état : le RN gagne 75 % des présidentielles simulées et 19 des 20 scrutins de 2027. Raison : c'est la conséquence du calage sur les législatives 2024 (premier parti au premier tour) et non d'une règle propre à ce parti. Corrigé en partie par l'usure, à reprendre en V4 (voir docs/EQUILIBRAGE.md).

## V4

- Ordre des lots : interface, réseau social, équilibre, exécutif, puis données. Raison : les données dépendent d'un accès que je n'ai pas depuis ma session.
- Habillage : règles du design system cité par Pierre transposées à la main (docs/DESIGN.md), sans copier ses fichiers. Raison : sa référence est une application mobile, seules les règles se transposent au web.
- Thème clair par défaut, sombre en option. Raison : plus proche du modèle demandé.
- Accent de l'interface : couleur du parti joué, foncée ou éclaircie jusqu'à un contraste de 4,5. Raison : rester lisible avec les partis à couleur claire.
- Logos : aucun logo officiel embarqué ni redessiné. Emplacement `public/data/logos/` pour les fichiers du joueur, pastille au sigle par défaut. Raison : les logos des partis sont des marques.
- Réseau social : un seul réseau fictif nommé Agora. Raison : demandé, et un nom neutre évite toute confusion avec un réseau réel.
- Agora, personnes réelles : leurs publications sont décrites en une ligne neutre, aucun propos ne leur est attribué. Les comptes citoyens commentent des sujets, jamais des personnes. Les vieilles publications qui ressortent ne concernent que des personnages générés.
- Agora remplace les anciennes publications de l'écran Médias. En mode Carrière, le joueur publie sur son compte personnel dès le départ. Raison : donner une action hebdomadaire à un simple militant.
- Trois publications utiles par semaine, portée dégressive. Raison : éviter le clic en rafale.
- Exécutif : réformes en trois étapes, 49.3 avec risque de censure, remaniement, changement de Premier ministre, référendum, dissolution. Les gouvernements IA utilisent les mêmes règles.
- Dissolution : la prochaine échéance législative est avancée, les suivantes gardent leur date. Raison : garder un calendrier simple. Limite connue : en réalité le mandat de cinq ans repart de la dissolution.
- Reports de second tour : correction d'une erreur de la V3. L'abstention des électeurs sans candidat était comparée à des poids non normalisés et absorbait environ 70 % des reports. Le candidat arrivé en tête gagnait presque toujours. Les poids sont maintenant ramenés au meilleur choix.
- Érosion des fidélités calées sur 2024 : 0,5 % par mois pour les valeurs positives, 0,2 % pour les négatives. Raison : sur 25 ans, ce que les partis font en jeu doit prendre le relais du point de départ. La règle est la même pour tous les partis.
- Scissions : possibles quand un courant de 12 à 50 % est durablement mécontent dans un parti à l'unité sous 52, au plus une fois tous les trois ans. Une déroute aux législatives fait baisser l'unité et l'humeur des courants. Raison : aucune scission en 20 parties dans la V3.
- Données réelles : un dépôt GitHub public contient le répertoire des maires et les résultats des municipales 2026 au format parquet. Je n'ai pas pu les lire : l'outil de lecture nécessaire a été refusé par les garde-fous de ma session et je n'ai pas contourné ce refus. Le lot reste à faire.

## V5

- Déverrouillage des écrans en mode Carrière : un écran non gagné n'apparaît pas du tout dans le menu, sans bouton grisé. Raison : demande de Pierre. Paliers : militant (boîte de réception, Agora), responsable de section ou élu (carte, effectif, historique, Panthéon, campagne), élu (mandat), cadre départemental (parti, finances), bureau national ou figure nationale (médias, doctrine). L'écran Médias s'ouvre aussi le temps d'un entretien en cours.
- Le tutoriel ne présente que les écrans déjà ouverts.
- Écran Terrain ouvert dès le rang de simple militant, avec les sorties (porte-à-porte, tractage). La direction de l'équipe arrive avec la section. Raison : donner tout de suite quelque chose à faire au militant de base.
- Six quartiers génériques par secteur (Centre-ville, Grands Ensembles, Pavillons, Hauts, Faubourg, Gare), décrits par les segments d'électeurs du jeu. Raison : pas de découpage réel par bureau de vote tant que les vraies données ne sont pas intégrées.
- Pas de campagne de terrain pour les sénatoriales. Raison : le scrutin se joue entre grands électeurs.
- Soir du vote : le score des bureaux est lu dans le modèle de vote au moment de la clôture, pas dans le résultat officiel du scrutin. Raison : garder l'équipe indépendante du type de scrutin. Les deux peuvent différer de quelques dixièmes.
- Événements en trois temps : l'issue à froid est tirée au sort (55 % confirmation, 20 % retournement, 25 % oubli). Raison : rendre risquée la réaction à chaud sans la rendre perdante.
- Assistant d'écriture : côté interface uniquement, facultatif, avec repli sur les textes du jeu. Le moteur reste déterministe et sans réseau. Pierre veut le modèle sur un serveur : le dossier `serveur/` fournit Ollama derrière Caddy, non déployé faute d'informations sur le serveur.
- Discussion libre réservée aux militants de l'équipe, qui sont tous des personnages générés. Raison : ne prêter aucun propos inventé à une personne réelle.
- Affaires réelles : règle levée par Pierre. Elles entreront avec la base historique, comme des faits datés et sourcés. Rien n'est encore intégré.
- Négociation et question au gouvernement en mini-jeux : reportées. Le débat télévisé existant en tient lieu pour l'instant.
- Données : script `scripts/data/telecharger-mac.mjs`, à lancer sur le Mac de Pierre. Les identifiants des jeux de données ont été vérifiés sur data.gouv.fr. Une copie est déposée dans `~/Mandat-donnees/`.

## V5.2

- Mise en ligne : Pierre a rendu le dépôt public et activé GitHub Pages. Le jeu est déployé à chaque push sur https://pcouvefrv.github.io/Mandat-/ . Raison : il ne veut rien payer, et Pages est gratuit sur un dépôt public.
- Textes des publications : générateur du moteur (`rediger` dans `agora.ts`) qui assemble le fait (texte de l'événement ou chiffre du moment), la position du parti (choix de l'événement le plus proche de sa ligne, ou formule d'action par axe et par pôle) et une mesure adoptée. Raison : Pierre trouvait les anciennes formules incompréhensibles. Les personnes réelles gardent une description neutre.
- Les brouillons proposés au joueur viennent du même générateur, avec un tirage séparé : en demander ne change pas la partie.
- Commentaires sous les publications du joueur : trois, tirés selon l'accueil. Comptes citoyens générés.
- Petite IA : Pierre la voulait « sur le serveur du site ». Un hébergement statique ne peut pas faire tourner de modèle. Elle tourne donc dans le navigateur (WebLLM, WebGPU), gratuitement. Le modèle est choisi dans la liste fournie par la bibliothèque, parmi des petits modèles, sans identifiant figé dans le code. Non testée avec un vrai modèle : la session n'a pas accès au réseau depuis son navigateur de test.
- Écrans Mon parcours et Carnet ouverts dès le rang de militant, en mode Carrière seulement. Raison : ce sont les écrans du personnage, pas du parti.
- Barre du haut : un militant voit ses ressources personnelles (compte, notoriété, forme, moral, estime). Les ressources du parti apparaissent quand l'écran Parti s'ouvre.
- Encart du parti dans la barre latérale : logo, rang, intentions de vote, tendance, députés. Les variations hebdomadaires s'affichent à côté des ressources.
- Logos des partis : toujours aucun logo officiel embarqué ni redessiné, pour la même raison qu'en V4 (ce sont des marques). L'encart affiche la pastille au sigle ou le fichier déposé par le joueur.
- Portrait du joueur : dessin à composer à partir de formes simples, sans ressemblance recherchée.
- Argent personnel : salaire hebdomadaire, indemnités par mandat, 330 euros de dépenses par semaine. Valeurs de jeu, pas des barèmes officiels.
- Investiture : le dossier donne un bonus au calcul existant (estime, rang, notoriété) au lieu de le remplacer. Raison : garder la cohérence avec les règles de la V3. Les rivaux sont des personnages générés pour l'occasion.
- Dissidence après un refus d'investiture : pas faite. Elle demande de créer une candidature hors parti dans chaque scrutin.
- Contacts : cinq personnages générés propres au joueur, distincts des personnages du monde. Raison : pouvoir leur prêter des répliques.
- Scissions : seuil d'unité relevé de 52 à 60.

## V6

- Élus réels : les maires viennent du Répertoire national des élus. Le parti est déduit de la nuance officielle de la liste aux municipales 2026. Une nuance ambiguë (divers, extrême sans parti précis, vide) ne donne aucun parti : le moteur garde alors le maire simulé. Raison : ne pas attribuer une étiquette à une personne réelle sans source.
- Récupération des données : un workflow GitHub (`donnees.yml`) télécharge les fichiers officiels et les pousse sur la branche `donnees`. Raison : data.gouv.fr n'est pas joignable depuis l'environnement de travail, et Pierre préfère passer par GitHub plutôt que télécharger à la main.
- Incarner une personne réelle : on reprend son nom, son parti et son mandat à la date de départ, rien d'autre. Un bandeau « Fiction générée par le jeu » figure sur sa page Chronique. Aucune affaire judiciaire n'est inventée pour une personne réelle, joueur compris.
- Chronique : mise en page et nom propres au jeu, sans reprise de l'habillage d'un site existant. Pour une personne réelle non jouée, la biographie et la profession restent vides : la page ne contient que ce qui arrive dans la partie.
- Emblème : dessin original composé dans le jeu (4 formes, 8 symboles neutres, 2 couleurs, initiales). Les logos réels des partis ne sont pas dessinés (marques déposées) ; l'emplacement `public/data/logos` reste prévu pour des fichiers fournis par le joueur.
- Financement : emprunt bancaire à 12 % sur trois ans, plafonné selon les sondages et les adhérents ; appel aux dons une fois par trimestre ; prêts d'adhérents une fois par semestre, contre un peu d'unité. Un seul prêt à la fois.
- Le tableau de bord est l'écran d'ouverture et la première étape du tutoriel. Il est accessible dès le rang de militant, comme Chronique et Personnalisation.
- Portrait du personnage : le premier dessin maison a été retiré à la demande de Pierre (rendu jugé mauvais). Pierre a choisi le style Notionists de DiceBear (dessins de Zoish, CC0 ; code MIT). La bibliothèque est embarquée dans `public/vendor/avatars.js`, sans appel réseau. Le visage est tiré du nom, avec cent variantes au choix. Une personne réelle garde ses initiales : un visage tiré au hasard ne lui ressemblerait pas.
- Visage modifiable : neuf réglages (cheveux, yeux, sourcils, nez, bouche, tenue, lunettes, barbe, geste). Un réglage laissé « au hasard » suit le tirage lié au nom. Enregistré dans la sauvegarde (`parcours.visage`).
- Annuaire des élus : quatre portées (secteur, département, région, national), repères du territoire (maire, député, présidents du département et de la région), filtre par parti, recherche. En mode Carrière, deux prises de contact par semaine ; la réponse dépend du parti, de l'écart de niveau et de la notoriété. Un refus bloque huit semaines.
- Les conseillers du répertoire officiel n'ont pas de fiche tant que le joueur ne les contacte pas. Raison : 38 792 fiches alourdiraient chaque tour.
- Personne réelle dans le carnet : le jeu résume l'échange au style indirect et ne lui prête aucune parole. La discussion libre avec le modèle d'écriture est désactivée pour elle.

## V7

- Logos : fichiers officiels pris sur Wikimedia Commons par un workflow GitHub (`logos.yml`), uniquement domaine public ou licence libre. Le choix final se fait à la main sur une planche, puis les fichiers retenus sont copiés dans `public/data/logos`. Ils ne sont pas redessinés. Les logos restent des marques : usage pour désigner les partis dans un jeu personnel sans but commercial. Aucun fichier libre trouvé pour le PS, qui garde sa pastille.
- Actualité : Pierre a refusé les vrais titres de presse. Le jeu fabrique ses histoires. Les faits politiques viennent de la simulation ; les histoires locales et les feuilletons sont inventés, avec des entreprises, des lieux-dits et des personnes fictifs. Aucune personne réelle n'y est citée (testé).
- La petite IA ne sert qu'à allonger un article à partir des éléments du jeu, avec interdiction de citer une personne réelle. Sans elle, le texte du jeu suffit.
- Réseau social : une réponse compte comme une publication de la semaine ; trois republications par semaine ; un adversaire peut répondre, ce qui augmente les vues des deux. Une personne réelle qui répond n'a pas de texte inventé (« Répond à cette publication. »).
- Les étiquettes « divers » et « régionalistes » n'ont pas de compte officiel : elles ne répondent pas et n'interpellent pas.
- Réseau social et presse tirent leurs hasards sur un générateur à part, dérivé de la graine. Raison : ne pas décaler le reste de la simulation, et garder une partie reproductible.
- Objectif du moment : une seule consigne, calculée dans cet ordre : décision en attente, soir de vote, incident, réaction à chaud, investiture, puis étape de progression.
- La vue de recherche universelle s'appelle `rechercheTout` : `recherche` existait déjà pour l'écran Effectif.
- Mode Claude de l'assistant : le navigateur appelle directement l'API Claude (`/v1/messages`) avec la clé du joueur. La clé reste dans le stockage local du navigateur, jamais dans le dépôt, le site ou les sauvegardes (vérifié par le robot). Modèle par défaut : `claude-haiku-5-5`, modifiable dans le menu. Un compteur d'appels et de jetons est affiché pour suivre la dépense.
- Usages de l'assistant étendus : réponse proposée sur Agora, réactions d'abonnés, directeur de campagne sur le tableau de bord, slogan et biographie du personnage inventé, article complet. Tous à la demande : aucun appel automatique, donc aucune dépense sans clic. Le directeur de campagne ne reçoit que des chiffres et des sigles de partis, aucun nom de personne.
