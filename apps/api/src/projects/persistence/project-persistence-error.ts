import type { ValidationError } from "@casastudio/schema";

/**
 * Internal failure raised when project persistence cannot complete a database operation.
 *
 * The error keeps the original cause available for logs and diagnostics while
 * allowing future HTTP boundaries to translate persistence failures without
 * exposing SQL or provider details to callers.
 */
export class ProjectPersistenceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProjectPersistenceError";
  }
}

/**
 * Internal failure raised when normalized records cannot reconstruct a Project.
 *
 * Repository reads use this error for incomplete relation graphs, invalid
 * ordering metadata, and unresolved persistence references. A missing project
 * remains represented by `null` instead of this error.
 */
export class ProjectReconstructionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ProjectReconstructionError";
  }
}

/**
 * Internal failure raised when reconstructed project data fails schema validation.
 *
 * The collected schema or semantic validation errors are retained for later
 * server-side diagnostics and future Problem Details mapping, while the error
 * itself stays below HTTP controller boundaries.
 */
export class PersistedProjectInvalidError extends ProjectReconstructionError {
  constructor(
    message: string,
    readonly validationErrors: readonly ValidationError[],
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "PersistedProjectInvalidError";
  }
}
