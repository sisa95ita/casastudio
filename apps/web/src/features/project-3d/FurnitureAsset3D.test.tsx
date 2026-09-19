import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import { FurnitureAssetBoundary, prepareFurnitureInstance3D } from "./FurnitureAsset3D";

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

it("configures shadows per clone without mutating shared GLB materials or sibling instances", () => {
  const material = new MeshStandardMaterial({ color: "#8b5a42", roughness: 0.47 });
  const source = new Group();
  source.add(new Mesh(new BoxGeometry(1, 1, 1), material));
  const first = source.clone(true);
  const second = source.clone(true);
  const firstMesh = first.children[0] as Mesh;
  const secondMesh = second.children[0] as Mesh;
  const originalColor = material.color.getHexString();
  const originalRoughness = material.roughness;

  const cleanupInstance = prepareFurnitureInstance3D(first);

  expect(firstMesh.castShadow).toBe(true);
  expect(firstMesh.receiveShadow).toBe(true);
  expect(secondMesh.castShadow).toBe(false);
  expect(secondMesh.receiveShadow).toBe(false);
  expect(firstMesh.material).toBe(material);
  expect(secondMesh.material).toBe(material);
  expect(material.color.getHexString()).toBe(originalColor);
  expect(material.roughness).toBe(originalRoughness);

  cleanupInstance();
  expect(firstMesh.castShadow).toBe(false);
  expect(firstMesh.receiveShadow).toBe(false);
  source.children.forEach((child) => (child as Mesh).geometry.dispose());
  material.dispose();
});
