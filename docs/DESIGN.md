# Habillage de l'interface (V4)

Source d'inspiration : le skill « claude-apple-design-system » (licence MIT, https://github.com/rukkiecodes/claude-apple-design-system). Ses règles ont été transposées à la main dans `src/ui/style.css`. Aucun fichier du dépôt d'origine n'est copié.

## Règles appliquées

- Un seul accent. Dans une partie, cet accent est la couleur du parti joué. À l'accueil, c'est le bleu d'action.
- Pas d'ombre sur l'interface. Les niveaux se lisent par un changement de surface et des filets d'un pixel.
- Boutons d'action principaux en pilule. Boutons secondaires sur une surface grise, sans bordure.
- Graisses 400, 600 et 700 uniquement.
- Coins arrondis : 8 px pour les champs et boutons, 12 px pour les blocs, 16 px pour les fenêtres.
- Fenêtres de confirmation internes au jeu, jamais celles du navigateur.
- Thème clair par défaut, thème sombre dans le menu.

## Disposition

- Barre latérale sur toute la hauteur : logo et nom du parti, écrans groupés (Bureau, Organisation, Élections, Bilan), indicateurs en pied.
- Barre d'outils au-dessus du contenu : date, ressources, menu, bouton Continuer et menu de vitesse.
- Boîte de réception en deux volets comme une messagerie : liste à gauche avec pastille de non-lu, lecture à droite.

## Couleur du parti

`accentParti` (dans `src/ui/composants.tsx`) part de la couleur du parti et la fonce ou l'éclaircit jusqu'à obtenir un contraste d'au moins 4,5 :

- `--accent` : fond des boutons principaux et de l'élément actif, lisible avec du texte blanc.
- `--accent-t` : liens et texte d'accent, lisible sur le fond du thème courant.
- `--accent-doux` : fond de sélection.

Un parti à la couleur très claire (jaune, rose pâle) garde donc sa teinte, en plus soutenu.

## Logos

Voir `public/data/logos/LISEZMOI.md`. Le jeu n'embarque aucun logo officiel.
