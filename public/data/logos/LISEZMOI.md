# Logos des partis

Le jeu n'embarque aucun logo officiel. Par défaut, chaque parti est représenté par une pastille à sa couleur avec son sigle.

Pour afficher vos propres fichiers, déposez-les ici sous le nom de l'identifiant du parti (colonne `id` de `public/data/partis.json`), en SVG ou en PNG carré :

```
public/data/logos/RN.svg
public/data/logos/PS.png
```

Ajoutez ensuite le nom de chaque fichier dans `index.json`, dans la liste `fichiers` :

```
{ "fichiers": ["RN.svg", "PS.png"] }
```

Rechargez la page. Un parti sans fichier garde sa pastille.

Identifiants : LO, LFI, PCF, PS, ECO, PP, DVG, REG, RE, MDM, HOR, DVC, UDI, LR, DVD, UDR, RN, REC, DLF.
