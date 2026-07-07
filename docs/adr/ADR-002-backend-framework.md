# ADR-002 — Backend Framework

## Status

Accepted

## Context

The main backend options considered were Spring Boot and NestJS.

Spring Boot is mature and enterprise-grade. NestJS is TypeScript-first and fits naturally with the selected frontend and monorepo stack.

## Decision

Use NestJS.

## Rationale

CasaStudio is a TypeScript-first project: React frontend, React Three Fiber / Three.js, Zod schemas, shared monorepo packages, and AI provider DTOs.

## Consequences

Backend code remains in TypeScript. DTO and schema sharing is simpler. Spring Boot is not used in the initial product. Architectural discipline is required to avoid an unstructured Node.js backend.
