# Co-signature des commits par l'IA

## Status : 2026-11-24 - Accepté

Prise de décision : à préciser avant merge (participants et mode de décision, cf. [processus de décisions techniques](dev-team-organisation.md#processus-de-décisions-techniques-de-léquipe-adr)).

## Description

Définir quand un commit doit être co-signé par l'IA, pour rendre visible dans l'historique Git la part de code produite avec l'IA.

## Contexte

- La [charte des devs](dev-team-organisation.md#utilisation-de-lia-et-responsabilité-des-devs) impose une utilisation transparente de l'IA, sans tabou, et autorise à produire 100 % du code avec l'IA.
- Aucune règle ne précise aujourd'hui comment cette utilisation apparaît dans les commits : certains commits produits avec l'IA sont co-signés, d'autres non.
- Les cas possibles pour un commit sont :

| Développé par | Commité par |
| ------------- | ----------- |
| un dev        | un dev      |
| un dev + IA   | un dev      |
| une IA        | un dev      |
| une IA        | une IA      |

## Décision

### Règle 1 : une IA a produit du code dans un commit = commit co-signé par l'IA

Dès qu'une IA a écrit tout ou partie du code d'un commit, ce commit est co-signé par l'IA, quel que soit celui qui crée le commit (dev ou IA).

La co-signature se fait avec le trailer Git `Co-Authored-By` en fin de message de commit, en nommant l'outil ou le modèle utilisé :

```text
add agency referent validation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

Application aux cas possibles :

| Développé par | Commité par | Co-signé par l'IA |
| ------------- | ----------- | ----------------- |
| un dev        | un dev      | Non               |
| un dev + IA   | un dev      | Oui               |
| une IA        | un dev      | Oui               |
| une IA        | une IA      | Oui               |

### Règle 2 : une self-review engendre un nouveau commit (si possible)

Les corrections apportées par le dev lors de sa self-review d'un code produit par l'IA font l'objet d'un nouveau commit, plutôt que d'être fusionnées dans le commit co-signé par l'IA. L'historique distingue ainsi ce que l'IA a produit de ce que le dev a corrigé.

Le nouveau commit n'est co-signé par l'IA que si l'IA a aussi produit du code lors de ces corrections (règle 1).

« Si possible » : la règle cède lorsque garder un commit séparé n'a pas de sens (par exemple une correction triviale dans un commit qui n'est pas encore poussé, ou un squash demandé avant merge).

### Responsabilité

La co-signature est un outil de transparence : elle ne transfère aucune responsabilité. Conformément à la charte des devs, l'auteur et le reviewer restent responsables du code mergé, et la review ne peut pas être déléguée à l'IA.

## Conséquences

### Positives ✅

- Transparence : la part de code produite avec l'IA est visible dans l'historique Git.
- Review facilitée : les corrections humaines d'un code produit par l'IA sont isolées dans leurs propres commits.
- Règle explicite, applicable aussi par les agents IA qui commitent eux-mêmes.

### Négatives ⚠️

- Discipline : demande de penser à co-signer les commits faits manuellement après une session avec l'IA.
- Historique plus long : la self-review ajoute des commits, en tension avec le squash suggéré par la checklist de PR.
