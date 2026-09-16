import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { FurnitureAssetBoundary } from "./FurnitureAsset3D";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("isolates a rejected or malformed GLB while leaving sibling furniture and its semantic parent usable", () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  function FailedAsset(): never { throw new Error("Malformed GLB"); }
  render(<div data-testid="semantic-parent">
    <FurnitureAssetBoundary fallback={<span>Exact dimension fallback</span>}><FailedAsset /></FurnitureAssetBoundary>
    <FurnitureAssetBoundary fallback={<span>Wrong fallback</span>}><span>Other Furniture</span></FurnitureAssetBoundary>
  </div>);
  expect(screen.getByTestId("semantic-parent")).toBeTruthy();
  expect(screen.getByText("Exact dimension fallback")).toBeTruthy();
  expect(screen.getByText("Other Furniture")).toBeTruthy();
  expect(screen.queryByText("Wrong fallback")).toBeNull();
});
