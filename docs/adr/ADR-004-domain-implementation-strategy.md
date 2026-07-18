# ADR-004: Domain Implementation Strategy

## Status

Accepted

## Context

CasaStudio has already defined:

- the conceptual Domain Model;
- the Spatial Coordinate System;
- the Project Schema Design;
- the shared schema primitives and enums.

The remaining domain schemas must be implemented in a sequence that preserves composability, makes reviews manageable, and prevents aggregate-level validation from being introduced before individual entity contracts are stable.

## Decision

CasaStudio domain schemas will be implemented incrementally from reusable components toward the Project aggregate.

The implementation order is:

1. Shared primitives and enums
2. Physical Building Model
3. Staircase Model
4. Observation Model
5. Design Rendering Model
6. Project aggregate schema
7. Cross-reference validation
8. Reference Consistency validation
9. Renderability validation
10. First complete `project.json`

Each phase must:

- reuse existing shared schemas;
- include unit tests;
- pass build, lint, and test checks;
- remain consistent with the repository documentation;
- avoid introducing aggregate-level assumptions prematurely.

Individual entity schemas must be stable before they are assembled into `ProjectSchema`.

Cross-reference, Reference Consistency, and Renderability validation must remain separate from basic structural validation.

Validation responsibilities are intentionally layered. Each validation phase verifies a distinct class of invariants and builds upon the guarantees provided by the previous phase without duplicating its responsibilities.

## Consequences

### Positive

- Smaller and more reviewable implementation tasks
- Better schema composability
- Easier isolation of validation errors
- Lower risk of premature coupling
- Clearer Codex sessions and atomic commits
- ProjectSchema becomes an assembly of already-tested components

### Negative

- The complete Project contract will not be available immediately
- Some validation rules will be intentionally postponed
- Intermediate schemas may temporarily allow combinations that are structurally valid but not renderable

## Alternatives Considered

### Implement ProjectSchema immediately

Rejected because it would require designing and validating all nested entities and cross-references in one large task.

### Implement schemas by UI workflow

Rejected because the domain implementation order should not depend on the current user interface.

### Implement schemas by backend persistence needs

Rejected because persistence is an implementation concern and must not define the domain model.

## Related Documentation

- `docs/11-domain-model.md`
- `docs/12-spatial-coordinate-system.md`
- `docs/13-project-schema.md`
