import { GeometryEngine } from "@casastudio/geometry";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { App } from "./App";

describe("App", () => {
  it("routes to the geometry playground and renders the runtime summary", () => {
    const buildSpy = vi.spyOn(GeometryEngine, "build");

    const markup = renderToStaticMarkup(<App pathname="/geometry-playground" />);

    expect(buildSpy).toHaveBeenCalled();
    expect(markup).toContain("Geometry Playground");
    expect(markup).toContain("ground-floor");
    expect(markup).toContain("6 vertices");
    expect(markup).toContain("7 boundary edges");
    expect(markup).toContain("8 boundary edge uses");
    expect(markup).toContain("2 loops");
    expect(markup).toContain("2 polygons");
    expect(markup).toContain("role=\"img\"");
  });

  it("keeps the foundation screen available outside the playground route", () => {
    const markup = renderToStaticMarkup(<App pathname="/" />);

    expect(markup).toContain("CasaStudio");
    expect(markup).toContain("/geometry-playground");
  });
});
