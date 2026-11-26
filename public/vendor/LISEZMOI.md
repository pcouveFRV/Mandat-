# Avatars

`avatars.js` est un assemblage de deux paquets du projet DiceBear (https://github.com/dicebear/dicebear, branche 9.x, commit 9dd1e77) :

- `@dicebear/core` : code sous licence MIT, Copyright (c) 2024 Florian Körner.
- `@dicebear/notionists` : code sous licence MIT ; dessins « Notionists » de Zoish (https://heyzoish.gumroad.com/l/notionists), licence CC0 1.0.

Le fichier exporte une seule fonction, `avatar(graine, options)`, qui renvoie un SVG. Le même nom donne toujours le même visage. Rien n'est envoyé à un serveur.

Pour le reconstruire : cloner le dépôt DiceBear, puis assembler `core` et `notionists` avec `bun build` (format ESM, cible navigateur).
