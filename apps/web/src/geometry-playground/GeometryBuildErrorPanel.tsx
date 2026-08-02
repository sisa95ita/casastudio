import type { GeometryBuildError } from "@casastudio/geometry";

/**
 * Props for the technical Geometry Engine build-error panel.
 */
export type GeometryBuildErrorPanelProps = {
  readonly errors: readonly GeometryBuildError[];
};

/**
 * Displays expected `GeometryEngine.build` failures as readable diagnostics.
 *
 * Build errors are part of the runtime build contract, so the playground shows
 * their stable code, message, source path, and source identifier instead of
 * throwing or presenting a blank viewer.
 */
export function GeometryBuildErrorPanel({ errors }: GeometryBuildErrorPanelProps) {
  return (
    <section className="geometry-error-panel" role="alert" aria-labelledby="geometry-error-heading">
      <h2 id="geometry-error-heading">Geometry build failed</h2>
      <ul>
        {errors.map((error, index) => (
          <li key={`${error.code}-${error.sourceId ?? "unknown"}-${index}`}>
            <strong>{error.code}</strong>
            <p>{error.message}</p>
            {error.path ? <p>Path: {error.path}</p> : null}
            {error.sourceId ? <p>Source ID: {error.sourceId}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
