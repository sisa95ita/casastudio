# ADR-001 — Architecture Style

## Status

Accepted

## Context

CasaStudio could be built as a quick local-only prototype, an unstructured monolith, a full microservice architecture, or a monorepo with a modular monolith.

## Decision

Use `Monorepo + Modular Monolith + Cloud Ready`.

## Rationale

This provides fast development, clear module boundaries, simple local execution, easier onboarding for Codex, and future service extraction when needed.

## Consequences

No premature distributed architecture. RenderModule stays inside the backend for the MVP. Modules must maintain clean boundaries. Future worker extraction remains possible.
