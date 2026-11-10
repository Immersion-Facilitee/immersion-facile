# Code review report template

Write the report in French. Keep each finding to a title, one or two sentences of evidence, its source, and a fix.

## Severity

Severity follows the review criteria of the accepted [PR content and refactoring ADR](../../../../doc/adr/dev-process-PR.md).

- 🔴 **Bloquant**: must be fixed before merge. Security risk, demonstrable performance issue, breach of a documented standard or accepted ADR, missing or wrong spec requirement, unplanned heavy refactoring that must be split out.
- 🟠 **Majeur**: not opposable on its own, but worth fixing in this pull request or tracking as a `TECH` task. Maintainability concern, scope creep, risky shortcut.
- 🟡 **Mineur**: nitpick the author may accept or decline. Typo, local naming, wording.

A baseline smell is never 🔴. When it calls for refactoring beyond the diff, suggest a `TECH` task instead of a change in the pull request.

## Verdict

Following the accepted [code review practices ADR](../../../../doc/adr/code-review-practices.md), conclude with an explicit verdict:

- ❌ **Demander des changements** when at least one 🔴 finding exists on either axis;
- ✅ **Approuver** otherwise.

## Finding format

Number findings `F1`, `F2`, … across the whole report so each one can be referenced in discussion. Within each axis, list 🔴 first, then 🟠, then 🟡. Name the file only where relevant, without line numbers.

```markdown
- 🔴 **F1 · <short title>** · `<file>`
  <evidence in one or two sentences>
  📚 <cited standard (file + rule), baseline smell, or quoted spec line>
  💡 <proposed fix>
```

## Report

```markdown
**Verdict : ❌ Demander des changements** _or_ **✅ Approuver** · `<fixed-point>...HEAD` · spec : #<issue-number>

## 📏 Standards

<findings, or `_Aucun finding._`>

## 🎯 Spec

<findings, `_Aucun finding._`, or `_Aucune spec disponible._`>
```
