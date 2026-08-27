# TypeScript code style

Prefer functional code and follow the surrounding module's established style.

- Prefer functions over classes. Repository adapters are the usual exception.
- Use arrow functions.
- Prefer `const`; avoid `let`.
- Avoid `any`, casts to `any`, and `as` assertions.
- Prefer explicit function return types, including for concise implicit-return arrow functions; keep type inference when an explicit type would be impractical or disproportionately complex, such as for some builders.
- For a single statement, prefer `if` without braces.
- Do not add comments that explain code behavior or new `TODO` comments. Make names and structure express the intent.
- Keep comments for linter directives and technical adapter documentation links or non-obvious integration warnings.
- When an existing `TODO` appears in touched code, implement it when in scope. Otherwise remove it only once a corresponding TECH issue exists; if creating that issue is not authorized, report the `TODO` and proposed issue.

Do not mechanically rewrite unrelated code to match these preferences.

These rules implement the accepted ADRs on [code comments](../../doc/adr/code/comments.md) and [explicit function return types](../../doc/adr/code/function-explicit-output-type.md).
