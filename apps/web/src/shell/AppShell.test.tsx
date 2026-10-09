import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { useMemo } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { useAppShellContent } from "./AppShellContext";

const viewport = vi.hoisted(() => ({ compact: false }));
vi.mock("@mui/material", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mui/material")>()),
  useMediaQuery: () => viewport.compact
}));
vi.mock("../core/auth/AuthControls", () => ({ AuthControls: () => null }));
vi.mock("./NavigationRail", () => ({ NavigationRail: () => null }));
vi.mock("./AppHeader", () => ({ AppHeader: () => null }));

function Workspace() {
  const content = useMemo(
    () => ({
      title: "Fixture",
      inspector: <div data-testid="stateful-inspector">Inspector owner</div>
    }),
    []
  );
  useAppShellContent(content);
  return <div>Project viewport</div>;
}
function harness() {
  return (
    <MemoryRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Workspace />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}
afterEach(() => {
  cleanup();
  viewport.compact = false;
});
describe("responsive Inspector ownership", () => {
  it("mounts one Inspector owner on desktop and one in the compact drawer", async () => {
    const view = render(harness());
    await waitFor(() =>
      expect(screen.getAllByTestId("stateful-inspector")).toHaveLength(1)
    );
    expect(
      screen
        .getByTestId("stateful-inspector")
        .closest(".inspector-panel--drawer")
    ).toBeNull();
    viewport.compact = true;
    view.rerender(harness());
    await waitFor(() =>
      expect(screen.getAllByTestId("stateful-inspector")).toHaveLength(1)
    );
    expect(
      screen
        .getByTestId("stateful-inspector")
        .closest(".inspector-panel--drawer")
    ).toBeTruthy();
  });
});
