# Product team writing guidelines

Write in French for product managers, product owners and UX designers who know Immersion Facile and its business concepts but do not need implementation details.

## Issue

Use a short title describing the user-visible or business objective. Do not add a technical prefix.

Keep the body concise, normally no more than 15 lines. Explain:

- the need or problem;
- what must change or has changed;
- the affected user journey or application area;
- a high-level structural choice only when it helps understand the scope.

Do not include filenames, function names, code excerpts or low-level implementation details.

## Pull request

Use one of these title formats:

- `#<issue-number> - <clear French description>`;
- `#<issue-number> - Tech - <clear French description>` when the change only affects infrastructure, tooling, performance, CI/CD, dependencies, internal refactoring or maintenance with no visible functional impact.

Start the body with:

```text
Fixes #<issue-number>

```

Append the current `.github/PULL_REQUEST_TEMPLATE.md` unchanged after that prefix.

## Issue documentation comment

Start the comment with this invisible idempotency marker:

```html
<!-- immersion-facile-pr-documentation -->
```

Then provide a succinct functional summary, normally no more than 15 lines, covering:

- what was done;
- what changes for users;
- the affected parts of the application, such as a journey, form, dashboard, back office, email or API;
- any high-level structural choice relevant to product review.

Do not mention filenames, function names or code excerpts.

When the diff changes user interface files under `front/`, `libs/react-design-system/`, or related styles, end with a short `Captures suggérées` section listing the exact screens or states that should be added to the issue.
