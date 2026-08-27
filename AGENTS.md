# Immersion Facile

Immersion Facile is a beta.gouv.fr TypeScript monorepo managed with pnpm.

## Repository map

- `back/`: Express backend and business domains
- `front/`: React application
- `shared/`: contracts shared by front and back, with no build step
- `libs/`: reusable UI, email and SCSS tooling
- `playwright-e2e/`: browser end-to-end tests
- `doc/adr/`: accepted, rejected, and pending architecture and team decision records

## Working in the repository

Task-specific instructions live in `.agents/skills/`. Load only the skills matching the requested work and follow the references they route to.

Relevant accepted ADRs are linked from those skills. Do not treat records marked rejected, standby, POC, or still undecided as binding. ADRs are collective team decisions: agents must not draft, create, or replace one on their own. When work would require a new ADR or contradict an accepted one, stop and report the decision needed so the team can discuss it before any ADR is written.

Prefer the patterns already used by the nearest code in the same domain. Keep changes scoped to the request and preserve existing public contracts unless the task requires changing them.

Run `pnpm fullcheck` after significant changes before handing off.
