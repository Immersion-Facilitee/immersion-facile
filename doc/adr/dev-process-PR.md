# Comment s'organise-t-on pour gérer le cycle de vie d'une feature ?

1. Dans "Prêt à développer", on est censé avoir les story qui sont prêtes à être développées (description claire, intervenants et partenaires identifiés sur le ticket)
2. Les stories à faire sont celles au statut "Prêt à développer" et rattachées au sprint en cours (champ "Sprint" du projet GitHub). Ce sont les prochaines à être développées, par ordre de priorité (la plus haute en premier) dans la vue Itération
3. Les dev se mettent d'accord entre eux sur qui prend quoi
4. Une story prise en charge par un/des devs doit avoir :
   - les devs assignés dessus
   - la story placée dans "En développement"
5. Les PR doivent référencer les issues qu'elles implémentent
   - Si une PR est créée sans Issue on est censé l'ajouter dans le backlog du projet
6. Les dev doivent indiquer s'ils ont besoin d'une review
   - en déplaçant l'issue dans le kanban à "Ready for Review"
   - faire un message dans le Slack sur #if-dev de type "RfR > [lien de la PR] + description de la PR"
7. Les reviewers qui ne sont pas les développeurs qui ont développé font leur commentaire et indiquent si c'est approuvé ou pas.
8. Si c'est ok, elle est approuvée et elle est dans la colonne "A merger"
9. Le dev qui a fait la feature est celui qui merge sur la branche "main"
10. Quand les devs veulent faire une release, on prévient @if-produit et @if-devs qu'une recette est faisable sur la staging en créant un thread sur Slack (dans #if-staging-déploiement, en partant du message de déploiement de la pré-release)
    - Pendant la recette, on bloque le merge de PR
    - Pour du détail sur la recette voir [la documentation du processus de recette](https://github.com/Immersion-Facilitee/immersion-facile/blob/main/doc/adr/review-and-deployment-process.md).
11. Quand le métier a validé la recette, on lance le déploiement en prod


# Précision concernant le contenu des PR et les actions de refactoring

```
Statut : Accepté
Date : 17 mars 2026
Décideurs : Équipe Technique hors Clément (congés)
```

## 1. Contexte
La fluidité des revues de code (PR) est essentielle pour maintenir une vélocité constante. Jusqu'à présent, certaines PR mélangeaient nouvelles fonctionnalités et refactorisations lourdes, rendant la lecture difficile et les retours subjectifs (performances, style, sécurité) sans base de référence commune.

## 2. Décision
### Périmètre d'une Pull Request lié à une Issue Métier (PR)

- **Focus "Make it work"** : Une PR doit répondre exclusivement à l'objectif de l'Issue associée avec le minimum de code nécessaire.

- **Critères d'opposabilité en revue** :
  - **Sécurité : Non négociable**. Tout risque de faille identifié en revue doit être corrigé avant le merge. La sécurité fait partie de la base commune indispensable.
  - **Performance** : Opposable dès lors que l'inefficacité est démontrable (ex: copies d'objets inutiles en boucle, requêtes SQL sans index prouvées par un EXPLAIN ANALYZE, fuites de mémoire). Les optimisations "préventives" ou basées sur des intuitions sans preuve restent soumises à discussion sans être bloquantes.
  - **Style et "Code Propre"** : Les choix d'implémentation, d'algorithmie ou de nommage (hors fautes manifestes) ne sont pas opposables s'ils respectent les standards de l'équipe et les ADRs en vigueur. Si un reviewer souhaite une approche différente pour des raisons de maintenabilité, il peut suggérer une tâche TECH ou un nouvel ADR, mais ne bloque pas la PR.

- **Tolérance** : Les changements mineurs (typos, renommages locaux) sont acceptés s'ils sont directement liés au code modifié, ou bien n'impose pas de problème de lisibilité.

- **Scission obligatoire** : Toute PR incluant du refactoring lourd non prévu sera rejetée et scindée (une PR de feature, une PR de refacto via le processus TECH).

### Processus de Refactorisation
Tout besoin de refactorisation doit suivre un parcours formel pour être planifié et visible :

- Création d'une Issue : Type `Task` avec les labels `TECH` & `suggestion`, avec une description claire du changement envisagé. La tâche est placée dans la colonne "Prêt à Dev".

- Communication : Proposition lors du point tech du mardi, du point matin (si urgent) ou en asynchrone dans l'issue (voir point suivant). Dans tout les cas, une formalisation dans l'issue est obligatoire pour le suivi général.

- Validation : Vote par l'ensemble des devs qui ne sont pas en congés via réactions (👍, 👎 ou abstention). Les commentaires servent à argumenter. Une tâche validée reste dans "Prêt à Dev" et est rattachée au Sprint de l'itération dans laquelle elle sera traitée.
> L'équipe technique est garant du temps disponible pour traiter ses sujets dans les itérations. Il est convenu que les tâches validées soient visible idéalement dans l'itération avant qu'elle démarre. Les tâches ne sont pas des choses à faire "en plus" en surchargeant les itérations. Le ratio tâches techs / métier est discutable en début d'itération.

- Issue non acceptée : Clôturée comme "Non planifiée". Elle peut être reproposée ultérieurement.

### Évolutions d'Architecture
Si le changement impacte l'architecture globale et/ou un changement de solution technique :

> Un ADR doit être rédigé et validé en amont.

Exemple: remplacer l'usage des classes de UseCase par le useCaseBuilder

Les tâches techniques découlant de cet ADR sont découpées en petits lots et ne nécessitent pas de nouveau vote d'approbation individuel.

## 3. Conséquences
### Positives ✅
- Revues accélérées : Moins de lignes à relire et des objectifs clairs.
- Transparence : La dette technique et les refactorisations deviennent visibles et priorisables par l'équipe.
- Moins de conflits : Réduction des débats subjectifs en PR grâce à l'appui sur les ADRs.
- Moins de réalisations subjectifs individuels et plus de réalisations souhaitée par la majorité de l'équipe technique

### Négatives ⚠️
- Lenteur administrative : Nécessite de créer des issues pour des changements qu'on aurait pu faire "au passage".
- Rigueur accrue : Demande une discipline constante pour ne pas laisser traîner les tâches TECH validées.
