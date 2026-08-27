# TypeScript code style

Prefer functional code and follow the surrounding module's established style.

- Prefer functions over classes. Repository adapters are the usual exception.
- Use arrow functions.
- Prefer `const`; avoid `let`.
- Avoid `any`, casts to `any`, and `as` assertions.
- Prefer implicit returns when the function remains clear.
- For a single statement, prefer `if` without braces.
- Do not add comments. Make names and structure express the intent.

Do not mechanically rewrite unrelated code to match these preferences.
