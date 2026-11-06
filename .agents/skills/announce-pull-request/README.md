# Announce Pull Request

Skill pour annoncer une pull request GitHub dans le canal Slack `#if-dev`, avec un message standardisé et une mention du groupe `@if-devs`.

## Prérequis

### 1. Connecter l’agent au MCP Slack

Ce skill **ne fonctionne pas** sans le serveur MCP Slack officiel connecté à ton agent.

Prérequis communs :

- Accès au workspace Slack Immersion Facilitée
- Intégration MCP Slack **approuvée par un admin** du workspace (sinon l’OAuth échoue)
- Authentification avec **ton compte Slack** (pas un bot)

Sans cette connexion, l’agent peut préparer le message, mais **ne doit pas** le publier.

#### Cursor

```bash
# Debug : est-ce que slack est bien installé ?
agent mcp list

# Login OAuth
agent mcp login slack
```

Doc : [Connect to Cursor](https://docs.slack.dev/ai/slack-mcp-server/connect-to-cursor/)

#### Claude Code

```bash
# Debug : est-ce que slack est bien installé ?
claude mcp list

# Login OAuth
claude mcp login slack
```

Doc : [Connect to Claude Code](https://docs.slack.dev/ai/slack-mcp-server/connect-to-harnesses/#connect-to-claude)

#### Codex

```bash
# Debug : est-ce que slack est bien installé ?
codex mcp list

# Login OAuth
codex mcp login slack
```

Doc : [Connect to Codex](https://docs.slack.dev/ai/slack-mcp-server/connect-to-harnesses/#connect-to-codex)

### 2. Accès GitHub CLI

L’agent utilise `gh` pour récupérer le titre et l’URL de la PR. Assure-toi d’être authentifié (`gh auth status`).

## Utilisation

Demande à l’agent d’annoncer une PR via le skill /announce-pull-request (ou en langage naturel)

L’agent :

1. Récupère le titre et l’URL exacts via `gh`
2. Prépare le message au format attendu
3. Te demande confirmation avant publication
4. Publie dans `#if-dev` **en ton nom** via le MCP Slack
5. Te renvoie le lien du message publié

## Format du message

```
<!subteam^S089GE2GKEH> 🔀 PR <URL|TITRE>
```

Le titre affiché peut être une version résumée du titre GitHub (sans `#` ni ids). L’agent te propose ce titre par défaut ; tu peux le modifier avant publication.

## Règles importantes

- Publication uniquement après confirmation explicite
- Publication uniquement avec ton identité Slack (jamais en bot)
- Pas d’annonce en double
- Pas de titre ou d’URL inventés
