---
name: document-issue
description: Documents completed work as a concise functional comment on its GitHub issue. Use when the user asks to document an issue, invokes /document-issue, or wants to complete the pull-request documentation checklist.
---

# Document issue

Document the current work for the product team without exposing implementation details. Do not create an issue or pull request, change project status, or modify the codebase as part of this workflow.

Read [the product-team writing guidelines](../../references/product-team-writing-guidelines.md) before drafting the comment.

## Resolve the issue

Use an issue number supplied by the user first, then an issue linked by the current pull request, then a numeric prefix in the branch name. Verify the candidate with `gh issue view` and ensure it relates to the work.

If sources disagree, several issues remain plausible, or no issue can be resolved, ask the user before publishing anything.

## Gather context

- Read the issue and its existing comments.
- Inspect the commits and complete diff against `origin/main`; fetch the remote branch first if the local reference may be stale.
- Inspect the worktree so the proposed summary does not overlook unfinished changes.
- Determine which user journeys or application areas changed.
- For UI changes under `front/`, `libs/react-design-system/`, or related styles, identify the exact screens and states that merit screenshots.

## Draft the comment

Write the marked issue documentation comment described in the writing guidelines. Keep it concise, functional, and understandable by product managers, product owners, and UX designers.

Present the exact draft to the user and wait for validation before publishing it.

## Publish idempotently

After validation, find an existing comment by the current GitHub user containing the documentation marker. Update that comment when present; otherwise create one comment on the resolved issue.

Return the issue URL and the created or updated comment URL. If publication fails, report whether any existing comment was changed so a retry does not create a duplicate.

Typical invocations include `/document-issue`, `documente cette issue`, and `documente l'issue #1234`.
