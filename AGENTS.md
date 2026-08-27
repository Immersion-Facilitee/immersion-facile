# Immersion Facile

Immersion Facile is a beta.gouv.fr TypeScript monorepo managed with pnpm.

## Repository map

- `back/`: Express backend and business domains
- `front/`: React application
- `shared/`: contracts shared by front and back, with no build step
- `libs/`: reusable UI, email and SCSS tooling
- `playwright-e2e/`: browser end-to-end tests

## Working in the repository

Task-specific instructions live in `.agents/skills/`. Load only the skills matching the requested work and follow the references they route to.

Prefer the patterns already used by the nearest code in the same domain. Keep changes scoped to the request and preserve existing public contracts unless the task requires changing them.

Run `pnpm fullcheck` after significant changes before handing off.
