# 03 — Tech Stack

## Purpose

This document records the initial technology choices for CasaStudio.

## Frontend

React is selected because CasaStudio is an interactive application with complex UI state, panels, viewers, and tool-like workflows.

TypeScript is required because the app is highly data-driven and needs typed contracts for the project model, geometry primitives, viewpoints, render jobs, AI DTOs, and API responses.

Vite is preferred over Next.js because the MVP is a technical SPA and does not require SSR, SSG, SEO, or file-based routing.

React Router handles client-side routing.

Redux Toolkit manages complex local UI/application state. TanStack Query manages server state.

MUI provides mature professional UI components. Tailwind CSS is used alongside MUI for layout, spacing, responsive adjustments, and small refinements.

SVG is used for the 2D blueprint viewer. React Three Fiber and Three.js power the 3D viewer.

## Backend

NestJS is selected as the backend framework because CasaStudio is TypeScript-first and benefits from shared types, modular structure, and monorepo consistency.

Prisma is selected as ORM. PostgreSQL is selected from the start to avoid a later migration from a toy data store.

Zod is used for shared schema validation.

The backend foundation uses Nest ConfigModule with Zod environment validation,
Pino structured logging, URI versioning under `/api/v1`, Passport JWT bearer
authentication, and Keycloak as the local OIDC identity provider.

## AI

OpenAI Image API is the initial image-to-image provider. Provider logic must be isolated behind an adapter interface.

```ts
export interface AiImageProvider {
  generateDesignRender(input: GenerateDesignRenderInput): Promise<GeneratedRender>;
}
```

## Infrastructure

Initial infrastructure: GitHub, pnpm workspaces, Turborepo, Docker / Docker Compose, Jenkins, and Azure.

Local Docker Compose runs web, api, PostgreSQL, Keycloak, and a dedicated Prisma
migration service. Development containers use watch-mode targets, while
production-like local images use compiled API and static web runtime targets.

Cloud target: Azure Container Apps, Azure Database for PostgreSQL, Azure Blob Storage.

## Testing

Vitest for TypeScript packages, React Testing Library for React components, Nest testing utilities for backend APIs, and Playwright later for end-to-end flows.

## Formatting and linting

ESLint, Prettier, and EditorConfig.
