# Workflows GitHub Actions

## Merge queue

Les PR sont mergées sur `main` via la merge queue GitHub : l’auteur clique sur
**Merge when ready**, et la PR entre dans la file dès qu’elle est approuvée et
que sa CI est verte. GitHub la rebase sur `main` dans une branche temporaire
`gh-readonly-queue/main/...`, relance la CI dessus, puis merge si elle passe.
En cas de conflit ou d’échec, la PR sort de la file et l’auteur est notifié.

Les workflows [validation-pr.yml](validation-pr.yml) et
[pr-checklist.yml](pr-checklist.yml) écoutent l’événement `merge_group` pour
rapporter les checks requis sur ces branches temporaires. La checklist étant
déjà vérifiée sur la PR, elle passe directement dans la file.

### Configuration

Dans la règle de protection de `main`, **Require merge queue** est activé avec :

| Réglage | Valeur |
| --- | --- |
| Merge method | Rebase |
| Build concurrency | 4 |
| Min / max group size | 1 / 1 |
| Only merge non-failing pull requests | Oui |

Quand la recette est bloquée, ne pas ajouter de PR à la file.

## Agent explo

Le workflow [agent-explo.yml](agent-explo.yml) répond aux commentaires d’issue ou de PR
commençant par `@Immersion-Facilitee/agent-explo`. Il explore la branche par défaut
et le web en lecture seule, puis publie sa réponse via une GitHub App dédiée.
Le [prompt](../scripts/agent-explo.prompt.md) définit ses consignes.

L’événement GitHub `issue_comment` couvre les issues et l’onglet **Conversation**
des PR. Les commentaires de review sur les lignes du diff ne déclenchent pas l’agent.

Les réactions indiquent l’état : 👀 prise en compte dès le démarrage du job,
👎 auteur non autorisé ou question vide, 👍 réponse publiée, 😕 échec.
Une relance du workflow met à jour la même réponse.

### Installation

Installer une App dédiée sur ce dépôt, sans webhook, avec les permissions
`Members: read` et `Issues: read/write`. La team visible `agent-explo` sert à
l’autocomplétion de la mention.

Configurer les secrets :

- `AGENT_EXPLO_APP_PRIVATE_KEY` : clé privée de l’App au format PEM.
- `OPENCODE_API_KEY` : clé API OpenCode Go.

Configurer les variables :

| Variable | Valeur |
| --- | --- |
| `AGENT_EXPLO_APP_CLIENT_ID` | Client ID de l’App |
| `AGENT_EXPLO_ALLOWED_TEAM` | `immersion-facilitee` |
| `AGENT_EXPLO_MODEL` | Identifiant du modèle au format `opencode-go/<modèle>` (obligatoire, sans valeur par défaut) |

Le futur agent-code aura sa propre App et ses variables `AGENT_CODE_*`.

L’agent est actif lorsque la variable `AGENT_EXPLO_MODEL` est renseignée.
Supprimer cette variable désactive l’agent.
Si le secret `OPENCODE_API_KEY` est absent ou si le modèle ne respecte pas
le format attendu, l’exploration échoue.

### Recette et limites

Vérifier l’autorisation et le refus d’accès, la réponse, la relance, l’échec,
la recherche web et la lecture d’une image par URL.

Les commentaires de review dans le diff ne sont pas chargés. La lecture des
images dépend de l’accès à leur URL et du modèle.

Aucun token GitHub n’est transmis à OpenCode. L’exploration a un délai de
10 minutes ; une annulation forcée ou une panne GitHub peut empêcher la
publication et la réaction finale.
