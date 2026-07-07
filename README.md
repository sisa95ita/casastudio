# CasaStudio

CasaStudio is an open-source, AI-assisted platform for architectural visualization, interior design exploration, and spatial planning.

It starts from a structured 2D floor plan, stored as project data, generates a navigable 3D scene, allows the user to save meaningful viewpoints, exports the current 3D view as an image, and uses image-to-image AI generation to create interior design render proposals.

CasaStudio is not intended to be a full CAD system in the first version. The first goal is to create a focused MVP that can help validate real renovation decisions before expensive construction steps such as plastering, flooring, and final finishes.

## Project status

CasaStudio is currently in Sprint 0: documentation, environment setup, repository setup, and monorepo foundation.

## MVP flow

```text
Structured project model / casa.json
        ↓
2D blueprint viewer
        ↓
Geometry engine
        ↓
Navigable 3D viewer
        ↓
Saved viewpoints
        ↓
Export current 3D view as PNG
        ↓
AI design prompt
        ↓
Image-to-image generation
        ↓
Render gallery / decision timeline
```

## Core principle

> The house is the data. Everything else is a representation of that data.

The project model is the source of truth. The 2D viewer, 3D viewer, exported screenshots, AI render requests, and gallery entries must all derive from the same structured model.

## Stack

Frontend: React, TypeScript, Vite, React Router, Redux Toolkit, TanStack Query, MUI, Tailwind CSS, SVG, React Three Fiber, Three.js.

Backend: NestJS, TypeScript, Prisma, PostgreSQL, Zod.

Monorepo: pnpm workspaces, Turborepo.

AI: OpenAI Image API through an adapter pattern.

Infrastructure: Docker / Docker Compose, Azure Container Apps, Azure Blob Storage, Azure Database for PostgreSQL, Jenkins.

## Documentation

- `docs/00-vision.md`
- `docs/01-mvp-flow.md`
- `docs/02-architecture.md`
- `docs/03-tech-stack.md`
- `docs/04-monorepo.md`
- `docs/05-ai-integration.md`
- `docs/06-roadmap.md`
- `docs/07-codex-kickoff.md`
- `docs/08-development-environment.md`
- `docs/09-development-conventions.md`
- `docs/adr/ADR-001-architecture-style.md`
- `docs/adr/ADR-002-backend-framework.md`
- `docs/adr/ADR-003-cloud-provider.md`
- `docs/ai/project-context.md`
- `docs/ai/coding-guidelines.md`
- `docs/ai/task-template.md`
