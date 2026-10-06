# Workflows GitHub Actions

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

## Scan des logs Actions

Le dépôt est public : les logs de tous les runs sont lisibles par tous. Le workflow
[scan-actions-logs-for-secrets.yml](scan-actions-logs-for-secrets.yml) analyse les
logs de chaque run terminé avec [gitleaks](https://github.com/gitleaks/gitleaks),
avec les règles par défaut et celles de [gitleaks-actions-logs.toml](../gitleaks-actions-logs.toml).

En cas de détection :

- les logs du run analysé sont supprimés ;
- `@if-devs` est alerté sur `#if-dev` par un message d’une ligne ;
- le fil de ce message détaille les détections (règle, job, ligne, variable) et contient un extrait
  des logs autour de chacune (30 lignes avant, 10 après), chaque valeur détectée y étant remplacée
  par `REDACTED` ;
- le job de scan échoue et liste la règle, l’étape, la ligne et le nom de la variable, sans la valeur.

L’extrait peut contenir des secrets que gitleaks n’a pas reconnus : il n’est envoyé que sur Slack,
jamais dans un artefact ou un log GitHub, publics sur ce dépôt.

Les secrets concernés doivent ensuite être changés.

`workflow_run` exige le nom de chaque workflow surveillé : tout nouveau workflow ayant son propre
déclencheur doit être ajouté à la liste `workflows`. Les workflows réutilisables (`workflow_call`)
n’y figurent pas : leurs logs font partie du run du workflow appelant. Les logs restent publics pendant l’exécution du run
analysé ; le scan réduit la durée d’exposition sans la supprimer.

Une fausse alerte se corrige par une entrée `[[allowlists]]` dans la configuration.
Toute nouvelle règle doit définir `secretGroup` et être vérifiée avec de fausses valeurs :
sans cela, `--redact` peut masquer la mauvaise partie et afficher le secret.
