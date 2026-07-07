# ADR-003 — Cloud Provider

## Status

Accepted

## Context

Options considered: AWS, Azure, and local-only.

The MVP should run locally first, but the application should be cloud-ready.

## Decision

Use Azure as the target cloud provider.

## Rationale

Azure fits the MVP+ direction: available credits, Azure Container Apps, Azure Blob Storage, Azure Database for PostgreSQL, container-friendly workflow, and good GitHub integration.

## Consequences

Local development remains Docker / Docker Compose based. Cloud deployment targets Azure Container Apps. Storage can evolve from filesystem to Azure Blob Storage. Database can evolve to Azure Database for PostgreSQL.
