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

## Documentation rule

Any architectural or stack decision must be documented. Use ADRs for important decisions.

## AI agent rule

When using Codex or another coding agent: ask it to read relevant documentation first, give one task at a time, define what must not be implemented, review the diff manually, run tests before committing, and prefer small commits.

## Dependency policy

Use stable versions. Prefer well-maintained libraries. Do not introduce a dependency if a small internal utility is enough. Future dependency automation may be introduced with Renovate after the first working MVP foundation is in place.
