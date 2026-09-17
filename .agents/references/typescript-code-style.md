# TypeScript code style

Prefer functional code and follow the surrounding module's established style.

- Prefer functions over classes. Repository adapters are the usual exception.
- Use arrow functions.
- Prefer `const`; avoid `let`.
- Prefer explicit function return types, including for concise implicit-return arrow functions; keep type inference when an explicit type would be impractical or disproportionately complex, such as for some builders.
- For a single statement, prefer `if` without braces.
- Do not add comments that explain code behavior or new `TODO` comments. Make names and structure express the intent.
- Keep comments for linter directives and technical adapter documentation links or non-obvious integration warnings.
- When an existing `TODO` appears in touched code, implement it when in scope. Otherwise remove it only once a corresponding TECH issue exists; if creating that issue is not authorized, report the `TODO` and proposed issue.

## Type assertions

Do not use `any`, `as`, `as any`, or `as unknown as` in new or edited code.

Prefer, in order:
1. Fix the upstream type or generic
2. Zod schema `.parse` / shared DTO validation
3. Type guard or discriminated union narrowing
4. `satisfies` for object literals

Bad:

```ts
const user = payload as User;
```

Good:

```ts
const user = userSchema.parse(payload);
```

If typing is blocked, stop and ask rather than assert.

Do not mechanically rewrite unrelated code to match these preferences.

These rules implement the accepted ADRs on [code comments](../../doc/adr/code/comments.md) and [explicit function return types](../../doc/adr/code/function-explicit-output-type.md).
