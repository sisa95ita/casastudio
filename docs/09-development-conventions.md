# 09 — Development Conventions

## Purpose

This document defines development conventions for CasaStudio.

## Language

Technical project assets must be written in English: code, comments, documentation, commits, issues, pull requests, ADRs, and prompts stored in the repository.

## Commit messages

CasaStudio uses Conventional Commits.

Reference: https://www.conventionalcommits.org/en/v1.0.0/

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`.

Examples:

```text
docs: add initial project documentation
chore: setup pnpm workspace
feat: create initial 2D blueprint viewer
feat: implement geometry engine primitives
test: add geometry conversion tests
refactor: extract render provider interface
ci: add Jenkins pipeline skeleton
```

## Branch naming

Recommended names: `docs/initial-documentation`, `chore/monorepo-setup`, `feat/2d-viewer`, `feat/geometry-engine`, `feat/3d-viewer`, `feat/ai-render-module`.

## Pull request rules

Pull requests should include summary, scope, screenshots for UI changes, testing notes, linked issue when available, and documentation updates when needed.

## Application versioning

The root `package.json` version is the single source of truth for the current
CasaStudio release line. Active development uses an `x.y.z-SNAPSHOT` version.
Before 1.0, MINOR identifies a meaningful product capability or milestone,
while PATCH identifies fixes and refinements that do not add a major
capability. Starting a new release line is an intentional source change; CI
never chooses the next semantic version or rewrites `package.json`.

Without an override, local tools resolve the build version to the declared
snapshot. Validation builds derive one immutable UTC-timestamped version using
`yyyyMMdd.HHmmss`, for example
`0.1.0-SNAPSHOT-20260820.151245`. An explicit validated
`CASASTUDIO_BUILD_VERSION` may supply the resolved identity for future build or
promotion jobs. The same resolved value identifies frontend diagnostic
metadata plus the web and API Docker images.

The current Jenkins Multibranch pull-request pipeline is validation-only. It
validates and builds local snapshot artifacts, then deletes the exact local
image tags it created. It does not publish, deploy, create tags, advance
version state, or discover and build `main`; the local Mac remains protected
from duplicate branch builds.

A future manual DEV job can source `main`, resolve a snapshot identity, and
publish or deploy that immutable artifact. A future manual Release job can
select a validated snapshot, derive `x.y.z` by removing `-SNAPSHOT`, and promote
the same artifact rather than rebuilding semantically different content.
Registry publication, deployment, Git tagging, and release-state management
remain separate future concerns.

## Documentation rule

Any architectural or stack decision must be documented. Use ADRs for important decisions.

## AI agent rule

When using Codex or another coding agent: ask it to read relevant documentation first, give one task at a time, define what must not be implemented, review the diff manually, run tests before committing, and prefer small commits.

## Dependency policy

Use stable versions. Prefer well-maintained libraries. Do not introduce a dependency if a small internal utility is enough. Future dependency automation may be introduced with Renovate after the first working MVP foundation is in place.
