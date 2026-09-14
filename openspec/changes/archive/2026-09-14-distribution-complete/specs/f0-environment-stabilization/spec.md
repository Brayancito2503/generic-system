# F0 Environment Stabilization Specification

## Purpose

Stabilize the development environment so builds, lint, typecheck, and commit hooks are reproducible and environment secrets cannot be committed.

## Requirements

### Requirement: Reproducible, gated dev environment

`.gitignore` MUST ignore every `.env*` except `!.env.example`; the stale `turbopack:{root}` hack and OneDrive comment MUST be removed from `next.config.ts`; the stale `.next` folder MUST be deleted before build/dev; Husky MUST be re-initialized so `.husky/_` exists and commit hooks run. Verification gates `npm run lint`, `npm run typecheck`, and `npm run build` MUST pass.

#### Scenario: Env hygiene verified

- GIVEN the F0 changes applied
- WHEN `git check-ignore .env.local` and `git check-ignore .env.production` run
- THEN both are ignored
- AND `.husky/_` exists and a commit triggers `commit-msg`/`pre-commit`

#### Scenario: Build gate

- GIVEN a clean checkout without `.next`
- WHEN `npm run lint && npm run typecheck && npm run build` run
- THEN all three pass with no errors

#### Scenario: Config clean

- GIVEN `next.config.ts` post-change
- WHEN the file is inspected
- THEN no turbopack root hack nor OneDrive comment remains (single-package repo auto-detects root)