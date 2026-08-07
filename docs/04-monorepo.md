# 04 — Monorepo

## Purpose

This document defines the planned monorepo structure for CasaStudio.

## Repository layout

```text
casastudio/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   ├── schema/
│   ├── geometry/
│   ├── shared/
│   └── ai/
├── docs/
│   ├── adr/
│   └── ai/
├── examples/
│   └── casa-simone/
├── docker/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

## apps/web

React + Vite + TypeScript. Responsibilities: 2D viewer, 3D viewer, AI prompt panel, gallery, viewpoint management, PNG export.

## apps/api

NestJS + TypeScript. Responsibilities: project APIs, blueprint APIs, viewpoint APIs, render APIs, gallery APIs, AI provider calls, storage, and database persistence.

## packages/schema

Shared Zod schemas and derived types: ProjectSchema, BlueprintSchema, RoomSchema, WallSchema, OpeningSchema, StairSchema, MezzanineSchema, ViewpointSchema, RenderSchema.

## packages/geometry

Pure TypeScript geometry utilities: coordinate normalization, 2D to 3D conversion, bounding boxes, wall helpers, opening helpers, staircase helpers, and validation. Must not depend on React, NestJS, Prisma, or Three.js.

## packages/shared

Shared utilities and generic types.

## packages/ai

AI provider interfaces and DTOs. Defines contracts, not provider implementation details.

## Root scripts

```json
{
  "scripts": {
    "dev": "turbo dev",
    "api:dev": "pnpm --filter @casastudio/api dev",
    "api:build": "pnpm --filter @casastudio/api build",
    "api:test": "pnpm --filter @casastudio/api test",
    "api:lint": "pnpm --filter @casastudio/api lint",
    "web:dev": "pnpm --filter @casastudio/web dev",
    "web:build": "pnpm --filter @casastudio/web build",
    "web:test": "pnpm --filter @casastudio/web test",
    "web:lint": "pnpm --filter @casastudio/web lint",
    "app:dev": "pnpm --parallel --filter @casastudio/api --filter @casastudio/web dev",
    "app:build": "pnpm --filter @casastudio/api build && pnpm --filter @casastudio/web build",
    "app:test": "pnpm --filter @casastudio/api test && pnpm --filter @casastudio/web test",
    "app:lint": "pnpm --filter @casastudio/api lint && pnpm --filter @casastudio/web lint",
    "db:generate": "pnpm --filter @casastudio/api db:generate",
    "db:validate": "pnpm --filter @casastudio/api db:validate",
    "docker:build": "docker compose build web api",
    "jenkins:up": "docker compose -f compose.jenkins.yml up -d --build",
    "jenkins:down": "docker compose -f compose.jenkins.yml down",
    "jenkins:logs": "docker compose -f compose.jenkins.yml logs -f",
    "jenkins:config": "docker compose -f compose.jenkins.yml config",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test"
  }
}
```

## Package names

Use `@casastudio/schema`, `@casastudio/geometry`, `@casastudio/shared`, and `@casastudio/ai`.
