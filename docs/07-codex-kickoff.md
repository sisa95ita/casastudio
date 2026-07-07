# 07 — Codex Kickoff

## Purpose

This document defines how to use Codex as a coding agent for CasaStudio.

Codex should not be asked to build the whole product at once. It should receive small, well-scoped tasks based on documentation and sprint goals.

## First Codex task: understanding only

```text
Read the repository documentation.

Summarize:
- the CasaStudio product vision;
- the MVP flow;
- the architecture style;
- the planned monorepo structure;
- the frontend stack;
- the backend stack;
- the first implementation step.

Do not write or modify any code.
```

## Monorepo setup prompt

```text
Create the initial CasaStudio monorepo.

Core MVP flow:
2D blueprint / casa.json → 2D viewer → 3D navigable viewer → saved viewpoints → export current view as PNG → AI design prompt → image-to-image API → render gallery.

Use pnpm workspaces and Turborepo.

Create:
- apps/web: React + Vite + TypeScript
- apps/api: NestJS + TypeScript
- packages/schema: shared Zod schemas for casa.json
- packages/geometry: pure TypeScript geometry utilities
- packages/shared: shared types/utilities
- packages/ai: shared AI provider interfaces and DTOs

Add root scripts:
- dev
- build
- lint
- test

Do not implement business features yet.
Do not implement AI calls yet.
Do not create a worker yet.

The project should compile after setup.
```

## Rule

Codex should implement one sprint or one task at a time. Never ask Codex to implement the whole product in one prompt.
