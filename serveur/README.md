# Serveur de l'assistant d'écriture

Le jeu est une page statique : il n'a besoin d'aucun serveur pour fonctionner. Ce dossier sert uniquement à brancher l'assistant d'écriture (propositions de publications sur Agora, discussion libre avec les militants de votre équipe).

Le jeu parle à n'importe quel serveur qui expose l'API « chat completions » au format OpenAI. La solution proposée ici : Ollama (le modèle) derrière Caddy (HTTPS, jeton d'accès, autorisation du navigateur).

## Ce qu'il faut

- Un serveur Linux avec Docker, un nom de domaine qui pointe dessus, les ports 80 et 443 ouverts.
- De la mémoire : comptez environ 8 Go de RAM pour un petit modèle de 3 à 4 milliards de paramètres. Sans carte graphique, une réponse prend de 10 à 30 secondes. Avec une carte graphique, quelques secondes.

## Installation

```
cp .env.exemple .env      # puis remplir DOMAINE, JETON et MODELE
docker compose up -d
docker compose exec ollama ollama pull "$MODELE"   # téléchargement du modèle, une fois
```

Choisissez le modèle dans la bibliothèque d'Ollama (https://ollama.com/library) selon la mémoire du serveur. Prenez un modèle récent qui écrit bien en français. Le nom exact change souvent : vérifiez-le sur le site au moment de l'installation.

## Dans le jeu

Menu > Assistant d'écriture :

- Adresse du serveur : `https://votre-domaine`
- Modèle : le nom donné à `ollama pull`
- Jeton : la valeur de `JETON`

Le bouton Tester envoie une question courte et affiche la réponse.

## Limites

- La page publiée sur claude.ai bloque les appels vers d'autres serveurs. L'assistant fonctionne sur la version GitHub Pages ou sur une copie locale du jeu.
- Le jeton est enregistré dans le navigateur du joueur. C'est suffisant pour un usage privé, pas pour un service ouvert au public.
- Le jeu donne à l'assistant des consignes fixes : pas de nom de personne réelle, aucun propos ni aucune accusation attribués à une personne réelle. Un petit modèle peut quand même s'en écarter : relisez toujours une proposition avant de la publier.
- L'assistant ne décide de rien. Les effets d'une publication ou d'une discussion sont calculés par le moteur du jeu.

## Vérifié et non vérifié

Le client du jeu a été testé contre un faux serveur qui répond au même format. Ce dossier (Docker, Caddy, Ollama) n'a pas été déployé ni testé sur un vrai serveur.
