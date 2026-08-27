---
name: prepare-pull-request
description: Prepare current work for review by resolving its GitHub issue, branch, draft pull request, and issue documentation. Use only when the user explicitly asks to prepare a pull request.
---

# Prepare pull request

Complete the GitHub workflow from the current repository state. Reuse existing resources and create only what is missing. Keep the operation resumable: if a step fails, report the resources already created so another invocation can continue without duplication.

Before writing to GitHub or changing Git state, inspect in parallel when possible:

- the current branch and default branch;
- the worktree status;
- commits and diff against `origin/main`;
- whether the branch exists on the remote;
- whether a pull request already exists for the branch;
- issue references in the pull request, branch name and commit messages.

Fetch `origin/main` first when the local remote reference may be stale.

If there is no commit, staged change or uncommitted change relative to the default branch, stop without creating an issue, branch or pull request.

## Resolve the issue

Use the issue linked by an existing pull request first, then a numeric prefix in the branch name, then `Fixes #N` or `Refs #N` in commits. Verify that every candidate exists and is related to the work.

- If sources disagree or several issues remain plausible, ask the user which one to use before mutating anything.
- If a matching issue exists, reuse it. Never create a duplicate.
- If none exists, read `../../references/product-team-writing-guidelines.md`, draft the issue from the commits and diff, present it for validation, then create it with `gh issue create --assignee @me`.
- If an apparent match is closed or unrelated, ask before reusing it.

## Prepare the branch

The preferred name is `<issue-number>-<short-kebab-case-slug>`.

- If the current branch is the default branch, create a feature branch after resolving the issue.
- If a non-default branch has no issue prefix and has not been pushed, propose renaming it.
- Preserve the name of an already-pushed branch unless the user explicitly requests a remote rename.
- Do not amend a commit merely to add an issue reference. The pull request body provides the closing link.
- Write concise commit subjects in English, starting with a lowercase letter. Keep issue and pull request titles in French as required by the product-team writing guidelines.
- Never create an empty commit.
- If changes are uncommitted, show their scope and ask before staging or committing them. Do not choose files silently.
- Do not create the pull request until the branch contains at least one commit not in `origin/main`.

## Resolve the pull request

Search for a pull request whose head is the current branch, including non-open pull requests when useful for preventing duplicates.

- If a pull request exists, reuse it and preserve its current draft or review state.
- If none exists, read `.github/PULL_REQUEST_TEMPLATE.md`, push the branch when needed, and create a draft pull request assigned to the current user.
- Follow `../../references/product-team-writing-guidelines.md` for the title and body.
- Use `.github/PULL_REQUEST_TEMPLATE.md` as the pull request body without removing or rewriting its checklist. Prepend `Fixes #<issue-number>` and a blank line.
- Do not overwrite useful content in an existing pull request. Add or correct only missing linkage or required metadata, and ask before materially rewriting user-authored content.

## Document the issue

Read and follow the [`document-issue` skill](../document-issue/SKILL.md), using the issue already resolved by this workflow. When the pull request already existed, still ensure the marked documentation comment exists and is current.

## Finish

Return the issue and pull request URLs, the branch name, and a concise list of actions performed or remaining. If the workflow stopped partway through, make the partial state explicit and do not repeat successful external mutations on retry.
