import type { GeometryBuildError } from "./geometry-build-error.js";
import type { GeometryModel } from "./model/index.js";

/**
 * Result returned by `GeometryEngine.build`.
 *
 * Expected build failures are represented as `ok: false` with diagnostics.
 * Exceptions remain reserved for unexpected internal faults or impossible
 * implementation invariants.
 */
export type GeometryBuildResult =
  | {
      readonly ok: true;
      readonly model: GeometryModel;
    }
  | {
      readonly ok: false;
      readonly errors: readonly GeometryBuildError[];
    };
