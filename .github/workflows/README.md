# Workflows GitHub Actions

## Agent explo

Le workflow [agent-explo.yml](agent-explo.yml) répond aux commentaires d’issue ou de PR
commençant par `@Immersion-Facilitee/agent-explo`. Il explore la branche par défaut
et le web en lecture seule, puis publie sa réponse via une GitHub App dédiée.
Le [prompt](../scripts/agent-explo.prompt.md) définit ses consignes.

Les réactions indiquent l’état : 👀 en cours, 👍 réponse publiée, 😕 échec.
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
| `AGENT_EXPLO_MODEL` | `opencode-go/gpt-5.6-luna` (obligatoire, sans repli) |
| `AGENT_EXPLO_ENABLED` | `true` pour activer, `false` pour désactiver |

Le futur agent-code aura sa propre App et ses variables `AGENT_CODE_*`.

### Recette et limites

Vérifier l’autorisation et le refus d’accès, la réponse, la relance, l’échec,
la recherche web et la lecture d’une image par URL.

Les commentaires de review dans le diff ne sont pas chargés. La lecture des
images dépend de l’accès à leur URL et du modèle.

Aucun token GitHub n’est transmis à OpenCode. L’exploration a un délai de
10 minutes ; une annulation forcée ou une panne GitHub peut empêcher la
publication et la réaction finale.
