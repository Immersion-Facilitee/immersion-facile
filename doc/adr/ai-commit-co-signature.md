# Co-signature des commits par l'IA

## Status : 2026-11-24 - Accepté

Prise de décision : à préciser avant merge (participants et mode de décision, cf. [processus de décisions techniques](dev-team-organisation.md#processus-de-décisions-techniques-de-léquipe-adr)).

## Description

Définir quand un commit doit être signé par l'IA, pour rendre visible dans l'historique Git la part de code produite avec l'IA.

## Contexte

- La [charte des devs](dev-team-organisation.md#utilisation-de-lia-et-responsabilité-des-devs) impose une utilisation transparente de l'IA, sans tabou, et autorise à produire 100 % du code avec l'IA.
- Aucune règle ne précise aujourd'hui comment cette utilisation apparaît dans les commits : certains commits contenant du code fait par une IA sont signés par l'IA, d'autres non.

## Décision

### Règle 1 : du code fait par une IA dans un commit = commit signé par l'IA

C'est la règle d'or : dès qu'un commit contient du code fait par une IA, ce commit est signé par l'IA, en co-auteur du dev.

| Code développé par | Commit signé par |
| ------------------ | ---------------- |
| un dev             | le dev           |
| un dev + une IA    | le dev + l'IA    |
| une IA             | le dev + l'IA    |

La signature de l'IA se fait avec le trailer Git `Co-Authored-By` en fin de message de commit, en nommant l'outil ou le modèle utilisé :

```text
add agency referent validation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

### Règle 2 : une self-review engendre un nouveau commit (si possible)

Les corrections apportées par le dev lors de sa self-review d'un code produit par l'IA font l'objet d'un nouveau commit, plutôt que d'être fusionnées dans le commit signé par l'IA. L'historique distingue ainsi ce que l'IA a produit de ce que le dev a corrigé.

Ce nouveau commit suit la règle 1 : signé par le dev seul si le dev a fait seul les corrections, signé par le dev + l'IA si l'IA a fait du code dans ces corrections.

« Si possible » : la règle cède lorsque garder un commit séparé n'a pas de sens (par exemple une correction triviale dans un commit qui n'est pas encore poussé, ou un squash demandé avant merge).

### Responsabilité

La signature de l'IA est un outil de transparence : elle ne transfère aucune responsabilité. Conformément à la charte des devs, l'auteur et le reviewer restent responsables du code mergé, et la review ne peut pas être déléguée à l'IA.

## Conséquences

### Positives ✅

- Transparence : la part de code produite avec l'IA est visible dans l'historique Git.
- Review facilitée : les corrections humaines d'un code produit par l'IA sont isolées dans leurs propres commits.
- Règle explicite, applicable aussi par les agents IA qui commitent eux-mêmes.

### Négatives ⚠️

- Discipline : demande de penser à faire signer par l'IA les commits faits manuellement après une session avec l'IA.
- Historique plus long : la self-review ajoute des commits, en tension avec le squash suggéré par la checklist de PR.
