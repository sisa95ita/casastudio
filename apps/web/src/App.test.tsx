import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";

afterEach(() => {
  cleanup();
});

describe("App routing and shell", () => {
  it("renders the home route inside the shared shell", async () => {
    render(<App initialEntries={["/"]} />);

    expect(screen.getByRole("banner").textContent).toContain("CasaStudio");
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeTruthy();
    expect(screen.getByRole("main").textContent).toContain("Technical application foundation");
    expect(screen.getByRole("complementary", { name: "Inspector" }).textContent).toContain(
      "Current foundation"
    );
    expect((await screen.findByRole("status", { name: "Status bar" })).textContent).toContain(
      "CasaStudio foundation ready"
    );
  });

  it("renders the geometry playground route with inspector and status content", async () => {
    render(<App initialEntries={["/geometry-playground"]} />);

    expect(await screen.findByRole("heading", { name: "Geometry Playground" })).toBeTruthy();
    expect(screen.getByRole("banner").textContent).toContain("Technical preview");
    expect(screen.getByRole("main").textContent).toContain("SVG Debug Viewer");
    expect(screen.getByRole("complementary", { name: "Inspector" }).textContent).toContain(
      "Layers"
    );
    expect(screen.getByRole("complementary", { name: "Inspector" }).textContent).toContain(
      "Runtime Summary"
    );
    expect(screen.getByRole("status", { name: "Status bar" }).textContent).toContain(
      "Level: ground-floor"
    );
    expect(screen.getByRole("status", { name: "Status bar" }).textContent).toContain(
      "Engine: OK"
    );
  });

  it("uses client-side navigation and updates selected navigation state", async () => {
    render(<App initialEntries={["/"]} />);

    const homeLink = screen.getByRole("link", { name: "Home" });
    const geometryLink = screen.getByRole("link", { name: "Geometry Playground" });

    expect(homeLink.getAttribute("aria-current")).toBe("page");
    expect(geometryLink.hasAttribute("aria-current")).toBe(false);

    fireEvent.click(geometryLink);

    expect(await screen.findByRole("heading", { name: "Geometry Playground" })).toBeTruthy();
    expect(geometryLink.getAttribute("aria-current")).toBe("page");
    expect(homeLink.hasAttribute("aria-current")).toBe(false);
  });

  it("renders a stable not-found route inside the shell", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    render(<App initialEntries={["/missing-workspace"]} />);

    expect(await screen.findByRole("heading", { name: "Route not found" })).toBeTruthy();
    expect(screen.getByRole("main").textContent).toContain("CasaStudio does not have a workspace");
    expect(screen.getByRole("status", { name: "Status bar" }).textContent).toContain(
      "Route not found"
    );

    consoleWarnSpy.mockRestore();
  });
});
