# Fonctionnement du moteur

Le moteur est dans `src/engine/`, en TypeScript pur, sans accès au DOM. Il tourne dans un Web Worker (`src/worker/worker.ts`). L'interface ne lit l'état qu'à travers des vues (`src/engine/vues.ts`) et ne le modifie qu'à travers des actions (`src/engine/actions.ts`).

## Principes

- 1 tour = 1 semaine. La semaine 0 commence le lundi 5 janvier 2026. Une partie s'arrête fin 2050.
- L'état de jeu (`Etat`, voir `types.ts`) est un objet JSON. Une sauvegarde est cet objet, tel quel.
- Aléatoire à graine : `rng.ts` (mulberry32). L'état du générateur est stocké dans l'état de jeu. Une même graine et les mêmes choix donnent exactement la même partie (test `déterminisme`).
- Chaque système est une fonction déterministe de l'état, des données et du générateur aléatoire. Il n'a aucun effet en dehors de l'état et de la liste de messages. Pour la performance, le tour modifie l'état en place au lieu de le copier à chaque système.
- Aucun parti n'est favorisé par le code. Les règles sont les mêmes pour tous. Les écarts viennent des données de départ.

## Ordre d'exécution d'un tour (`tour.ts`)

1. `evenements` : tirage des événements, chocs sur les priorités, réactions des partis IA, réponses par défaut aux messages expirés.
2. `medias` : invitations, passages médias des partis IA. Puis `agora` : tendances, publications des partis IA, comptes de médias et de citoyens, abonnés.
3. `partis` : décroissance de l'implantation et de la mobilisation, militants, terrain, adhésions, capital, crédibilité, notoriété, unité, usure du pouvoir, congrès, scissions.
4. `campagnes` : désignation des candidats à la présidentielle, parrainages, ouverture des campagnes, effets des dépenses.
5. `ia` : accords électoraux, terrain, finances, doctrine, mercato des partis IA.
6. `doctrine` : oubli progressif des changements de ligne.
7. `scrutins` : premiers et seconds tours prévus cette semaine.
8. Chaque mois : `finances`, progression des personnages, `mandats` (bilans locaux, présidence, économie). Chaque trimestre : recalcul des courants.
9. Chaque année : retraits, décès de personnages générés, nouveaux talents.
10. `executif` : référendum, réformes des gouvernements IA, censure. Puis `justice` : affaires. Contrôle des comptes de campagne.
11. `sondages` : intentions de vote réelles (cachées), sondages publiés.
12. `equipe` : équipe de militants, campagne locale, incidents. Puis `carriere` : accès aux écrans, activité hebdomadaire, promotions (mode Carrière).
13. `victoire` : conditions de victoire, de défaite, fin de partie.

Un vote a lieu le dimanche. Le moteur le traite au tour qui commence le lundi suivant.

## Le vote (`systems/electorat.ts`)

Le pays est découpé en 2 797 zones. Chaque zone contient 20 groupes sociaux (segments), avec un poids propre à la zone.

Pour un segment `s` d'une zone `z` et un parti `p`, l'utilité est :

```
u(z, s, p) = echelle x [ prox(z, p) + impl(z, p) + nat(p) - LAMBDA x D(s, p) ]
           + opinion(s, p) + prop(s, p) + mob(z, p) x volatilite(s) + bonus du candidat
```

- `D(s, p)` : distance doctrinale. Somme sur les 10 axes de `poids(axe) x (position du segment - position du parti)^2`, divisée par la somme des poids. Le poids d'un axe est la somme, sur les 15 thèmes, de la priorité actuelle du segment pour ce thème multipliée par le poids de l'axe dans le thème (`doctrine.json`), plus 0,6. Les priorités actuelles sont les priorités de base du segment plus les chocs d'actualité, nationaux ou propres à une région, qui décroissent linéairement jusqu'à leur date de fin. `LAMBDA` vaut 0,11.
- `prox(z, p)` : proximité initiale, fixée par le calibrage. Elle ne bouge plus ensuite.
- `impl(z, p)` : implantation acquise en cours de partie (terrain, élus, ralliements, gaffes). Elle perd 0,35 % par semaine.
- `nat(p)` = 0,012 x (notoriété - notoriété de départ) + 0,015 x (crédibilité - crédibilité de départ) + 0,01 x dynamique - (usure du pouvoir - usure de départ).
- `opinion(s, p)` : effet des réactions aux événements, des passages médias et des réseaux. Il perd 1,5 % par semaine.
- `prop(s, p)` : effet durable des propositions phares. Pour chaque proposition au programme, chaque segment qui porte une étiquette attirée gagne 0,03 + 0,012 x priorité du thème, chaque segment repoussé perd 80 % de cette valeur.
- `mob(z, p)` : mobilisation de court terme (terrain, meetings, campagne). Elle perd 14 % par semaine.
- Bonus du candidat : qualité du candidat (terrain, charisme, ancrage, notoriété), prime au sortant (selon le bilan), poids des notables du parti pour les scrutins locaux.
- `echelle` : 1 pour les scrutins nationaux, 0,75 aux municipales, 0,8 aux départementales, 0,9 aux régionales. Plus elle est basse, plus les facteurs locaux comptent.

La part de vote d'un candidat dans un segment est `exp(u) / somme des exp(u)` sur les candidats présents. Un candidat soutenu par d'autres partis reçoit en plus 85 % du poids de chaque allié : une partie des électeurs de l'allié ne suit pas.

Participation d'un segment : `1 - abstention de base x facteur du scrutin x (1 - 0,3 x intensité de la campagne locale)`. Facteurs : présidentielle 0,6, législatives 0,8, municipales 1,05, européennes 1,18, départementales et régionales 1,55. 2,5 % de blancs et nuls. Chaque total reçoit un bruit de quelques pour cent.

### Second tour

Depuis la V4, les poids des reports sont ramenés au meilleur choix avant de calculer l'abstention : auparavant, l'abstention écrasait les reports et le candidat arrivé en tête gagnait presque toujours. Les fidélités calées sur 2024 (`prox`) s'érodent aussi de 0,5 % par mois quand elles sont positives et de 0,2 % quand elles sont négatives.

Les voix du premier tour sont reportées à l'échelle de chaque unité (circonscription, ville, région, pays). Les candidats maintenus gardent 97 % de leurs voix. Pour chaque candidat éliminé ou retiré, ses voix se répartissent entre les candidats restants selon :

```
poids(r) = exp( - distance(partis) / 6 + 0,5 x ln(part de r au premier tour) + relation / 60 + consigne + barrage )
```

La consigne de vote vaut +1,2 pour le candidat désigné. Un appel au barrage vaut +0,7 pour tous les autres candidats et -0,8 pour le candidat visé. Une part des électeurs s'abstient : `exp(-1,2 + distance au candidat restant le plus proche / 9)`, davantage si la consigne est « ni l'un ni l'autre ». Les partis IA déduisent consignes et barrages de leurs relations. Le grand débat présidentiel déplace jusqu'à 4 %.

### Calibrage

Au lancement d'une partie (`creation.ts`) :

1. Les résultats réels du premier tour des législatives 2024 par circonscription et par nuance sont convertis en parts par parti (table `nuances`, avec une part plus forte pour le parti du candidat). Un parti absent d'une circonscription garde un socle de 22 % de sa moyenne nationale.
2. Ces parts sont réparties entre les zones de la circonscription, avec une inflexion selon le type de territoire, puis ajustées pour que l'agrégat par circonscription retrouve le résultat réel.
3. `calibrer` ajuste `prox` zone par zone jusqu'à ce que le moteur reproduise ces cibles (itérations de `prox += 0,9 x ln(cible / simulé)`).

Contrôle : `npx tsx scripts/calibrer.ts` et le test `calibrage`. Écart moyen par circonscription et par bloc : environ 1,3 point. Les quatre blocs nationaux sont reproduits à moins d'un point.

## Les modes de scrutin (`systems/regles.ts`, testés dans `tests/regles.test.ts`)

- Municipales : liste élue au premier tour au-dessus de 50 %. Sinon maintien à 10 %, fusion possible entre 5 % et 10 %. Prime de 50 % des sièges à la liste en tête, le reste à la proportionnelle à la plus forte moyenne entre les listes à 5 % et plus. Paris, Lyon, Marseille (loi de 2025) : un vote pour le conseil de la ville entière avec une prime de 25 %, un vote par secteur avec une prime de 50 %. Les petites communes (bassins) ne sont pas simulées une par une : le moteur calcule la répartition des mairies par sensibilité.
- Départementales : scrutin majoritaire à deux tours par canton, seuil de 12,5 % des inscrits, 2 sièges par canton. Les grandes villes comptent pour plusieurs cantons.
- Régionales : listes, mêmes seuils que les municipales, prime de 25 %.
- Législatives : élu au premier tour avec la majorité absolue et 25 % des inscrits. Qualifiés à 12,5 % des inscrits, à défaut les deux premiers.
- Européennes : proportionnelle nationale à la plus forte moyenne, seuil de 5 %, 81 sièges.
- Sénatoriales : par département, tous les trois ans, par série. Les grands électeurs sont déduits des conseils municipaux, des petites communes, des conseillers départementaux et des députés. Proportionnelle à partir de 3 sièges, majoritaire en dessous.
- Présidentielle : 500 parrainages, deux tours.

Après des législatives, un gouvernement se forme : le parti du président s'il a des députés, sinon le premier groupe, cherche des partenaires dont la relation dépasse 25 jusqu'à la majorité absolue.

## Agora (`systems/agora.ts`)

- État : `e.agora` (publications récentes, tendances, abonnés des partis, fenêtres de réaction) et `abonnes` sur chaque personnage. Tout est créé à la première lecture : une sauvegarde V3 se charge sans migration.
- Une publication a un score : (niveau en réseaux sociaux - 10) / 4, plus un tirage, plus un bonus de tendance, de cohérence avec la ligne et de réaction à chaud. Les vues partent du nombre d'abonnés et croissent exponentiellement avec ce score. Au-dessus de 2,1 c'est un buzz, en dessous de -0,5 un mauvais buzz est possible selon le format, le ton et les traits de l'auteur.
- Les effets (viralité, crédibilité, opinion des segments jeunes, militants, dons, abonnés) dépendent de l'audience et du rang de celui qui parle. La portée des publications du joueur baisse à chaque publication de la semaine : 100 %, 60 %, 35 %, 15 %.
- Un événement national ouvre une tendance et une fenêtre de réaction de deux semaines.
- Les partis IA publient avec la même fonction que le joueur.
- Personnes réelles : le texte de leurs publications est une description neutre, jamais une citation.

## Terrain et équipe (`systems/equipe.ts`)

- État : `e.equipe` (militants, candidats, six quartiers, caisse, matériel, campagne en cours, incident, mini-jeu en cours, bilan du dernier scrutin). L'équipe de départ est tirée avec un générateur propre, dérivé de la graine, de la zone et du parti : elle ne dépend pas du moment de sa création.
- Accueil d'un quartier : distance entre la ligne du parti et les segments qui composent le quartier.
- Rendement hebdomadaire d'un militant : compétence utile x disponibilité x (1 - fatigue) x motivation x accueil x matériel. Il fait monter l'ancrage du quartier (avec rendement décroissant) et, pondéré par le poids du quartier, l'implantation du parti dans la zone (`e.impl`). En campagne, il nourrit aussi la mobilisation (`e.mob`).
- Campagne : ouverte 12 semaines avant le prochain scrutin hors sénatoriales. À la clôture, le score de la zone est lu dans le modèle de vote et réparti en 12 bureaux selon l'accueil et l'ancrage.
- Mini-jeux : le porte-à-porte compare le thème choisi aux priorités et aux positions du segment tiré. Le tractage additionne affluence et affinité du public. Le résultat alimente ancrage, implantation, estime.
- Quand le joueur ne dirige pas l'équipe (simple militant, ou mode automatique), un responsable IA répartit, commande, règle les incidents et organise les temps forts.

## Événements en trois temps (`systems/agora.ts`)

- `suivis` : chaque événement national est suivi quatre semaines. Semaine +1 : message « Le lendemain ». Semaine +4 : tirage (55 % les faits confirment, 20 % ils se retournent, 25 % oubli) et effet sur la crédibilité selon le ton et le moment de la réaction du joueur, pondéré par son rang.
- `suites` : 35 % des événements ont une suite, 25 % une seconde. Une suite rouvre une tendance et une fenêtre de réaction.

## Assistant d'écriture (`src/ui/assistant.ts`)

- Côté interface uniquement : le moteur n'appelle jamais de modèle et reste déterministe.
- Client d'une API « chat completions » au format OpenAI. Consignes fixes : français simple, aucun nom de personne réelle, aucun propos ni accusation attribués à une personne réelle.
- Repli automatique sur les textes du jeu si le serveur est absent, refuse ou répond mal.

## Exécutif (`systems/executif.ts`)

- État : `e.executif` (réformes, dates du dernier remaniement, de la dernière dissolution, du dernier référendum, référendum en cours, nombre de censures).
- Soutien d'une réforme : part pondérée des segments dont la position sur l'axe va dans le sens du texte.
- Vote : avec 289 sièges ou plus, adoption sauf accident. En dessous, il faut une marge positive (soutien, tirage). 49.3 : sans majorité absolue, la censure passe avec une probabilité qui croît avec le nombre de sièges manquants et l'impopularité.
- Une réforme adoptée déplace la popularité selon son soutien, la crédibilité et l'unité du parti qui gouverne selon sa cohérence avec sa ligne, et l'opinion de chaque segment selon sa position.
- Dissolution : la prochaine échéance législative est avancée à quatre semaines.
- Les exécutifs IA ouvrent un chantier de temps en temps sur l'axe le plus marqué de leur parti et le mènent avec les mêmes règles.

## Les partis (`systems/partis.ts`, `systems/finances.ts`)

Chaque semaine :

- Militants actifs : tendent vers `adhérents x (0,10 + dynamique / 400 + (unité - 50) / 500)`.
- Terrain : pour chaque affectation (département, action, part des militants), `impl` et `mob` montent dans les zones du département selon la densité de militants, la qualité du délégué et la fatigue. La fatigue monte avec l'effort.
- Adhésions : croissance selon la dynamique, la notoriété, la crédibilité, la qualité des délégués, avec un rappel vers une taille cohérente avec le poids électoral. Boucle négative : au-delà de 0,4 % de croissance par semaine, l'unité baisse et des gaffes locales apparaissent, surtout dans les départements sans délégué.
- Crédibilité : tend vers `crédibilité de départ + 2 x (compétence moyenne des figures - 12,5) + 0,2 x (bilan moyen des mairies - 58) - 1,5 x passif de gaffes - 2 x changements de ligne récents`.
- Notoriété : tend vers un plancher qui dépend des parlementaires et des adhérents, plus la viralité.
- Unité : tend vers `78 - 60 x poids des courants mécontents + 0,3 x dynamique`. Sous 16, la scission menace.
- Usure du pouvoir : +0,0019 par semaine pour le parti du président (x 1,25 si sa popularité est sous 45 %, x 0,6 sinon), plafonnée à 0,42. +0,0009 pour ses alliés au gouvernement, plafonnée à 0,2. -0,003 par semaine dans l'opposition. Elle se retranche directement de l'utilité : à 0,42, le parti pèse environ un tiers de moins dans le vote.
- Dynamique : suit la tendance des intentions de vote et les résultats, revient vers 0.

Chaque mois : cotisations, dons, financement public par douzièmes, reversements d'élus, permanents, locaux, communication, formation, mensualités. Six mois de trésorerie négative : faillite (défaite pour le joueur, plan de sauvetage pour une IA).

Financement public : 1,64 € par voix au premier tour des législatives si le parti dépasse 1 % dans 50 circonscriptions, plus 37 400 € par parlementaire. Retenue de 150 % de l'écart de parité des candidatures. Comptes de campagne : plafond légal par scrutin, contrôle 26 semaines après, remboursement de 47,5 % du plafond au-dessus de 5 % des voix (3 % aux européennes). Rejet certain au-dessus du plafond, possible sinon selon la gestion du trésorier et les prises de risque.

## Les personnages (`systems/personnages.ts`)

21 attributs de 1 à 20, notoriété de 0 à 100, trois valeurs cachées (potentiel, fidélité réelle, casserole latente), 2 à 4 traits. L'attribut effectif dans un contexte ajoute les bonus des traits, puis dépend de la forme et du moral. Chaque mois, un attribut lié à l'activité du personnage peut progresser vers son potentiel (plus vite avant 30 ans, avec un mentor, avec un budget de formation). Après 62 ans, l'énergie et le terrain déclinent. Un rapport d'observation estime les valeurs cachées avec une marge de 1 à 5 points selon l'observateur.

Mercato : probabilité d'acceptation = fonction logistique de la fidélité réelle, de l'opportunisme, de l'ambition, de l'écart doctrinal, de l'offre, de l'unité et de la dynamique des deux partis. Un transfert déplace une partie de l'implantation locale.

## L'IA (`systems/ia.ts`)

Chaque parti IA a une stratégie (conquête locale, coup présidentiel, union, isolement) et un style (prudent, offensif, opportuniste). Il utilise les mêmes fonctions que le joueur : répartition du terrain, budget, emprunt, adoption de propositions, changement de ligne, accords, débauchage, investitures, consignes. En mode Carrière, l'IA dirige aussi le parti du joueur pour tout ce que ses postes ne lui permettent pas de décider.

## Performance

Mesures sur la machine de construction (2 coeurs) : environ 65 ms par semaine en moyenne, 250 à 400 ms un soir d'élection nationale, 3,5 s pour une année d'avance rapide, 80 s pour une partie complète jusqu'en 2050.

## V6 (`systems/parcours.ts`, `creation.ts`)

- `vueTableau` : résumé de la semaine (tâches, quartiers, classement, échéances, fil Agora, proches négligés).
- `vueChronique(e, d, id?)` : page d'un personnage, construite depuis son historique, ses publications, ses promesses. Champ `reel` pour le bandeau de fiction.
- `actionV6` : `emblemeModifier` (valeurs nettoyées), `fonderPartiV6`, `finEmprunt`, `finAppel`, `finPrets`. `tourFinancement` rembourse chaque semaine.
- `creerPartie` : `perso.incarne` reprend un personnage réel existant ou crée l'élu à partir du répertoire. Les maires réels remplacent les maires simulés quand leur parti est connu.
- `systems/annuaire.ts` : `vueAnnuaire(e, d, { portee, q, parti })` et `actionAnnuaire` (`annuaireContact` pour un personnage de la partie, `annuaireContactElu` pour un conseiller du répertoire, créé à la volée). Action `profilVisage` dans `parcours.ts`.
