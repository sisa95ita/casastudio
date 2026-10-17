import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FurnitureAsset3D } from "./FurnitureAsset3D";
import type { FurnitureModel3D } from "./model/furniture-3d-model";

const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@react-three/drei", () => ({
  useGLTF: load,
  Edges: () => null,
  // React owns the real Suspense/error boundaries. Replace only GPU primitives.
  RoundedBox: ({ args, position }: { args: number[]; position: number[] }) => (
    <span
      data-testid="fallback-envelope"
      data-size={JSON.stringify(args)}
      data-position={JSON.stringify(position)}
    />
  )
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  load.mockReset();
});

const model: FurnitureModel3D = {
  id: "synthetic-volume",
  roomId: "synthetic-room",
  roomName: "Synthetic",
  levelId: "synthetic-level",
  definitionId: "generic-cabinet",
  name: "Cabinet",
  category: "CABINET",
  position: { x: 1.2, y: 3.1, z: -0.8 },
  width: 0.95,
  depth: 0.42,
  height: 1.65,
  rotation: -30,
  yaw: Math.PI / 6,
  bounds: {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 2, y: 5, z: 2 },
    center: { x: 1, y: 2.5, z: 1 },
    size: { x: 2, y: 5, z: 2 }
  },
  asset: {
    resource: "/synthetic.glb",
    nativeMin: [0, 0, 0],
    nativeMax: [1, 1, 1],
    yaw: 0,
    deformation: { kind: "free-axes", maxAnisotropy: 6 }
  }
};

describe("Furniture evidence before GLB readiness", () => {
  it.each(["pending", "failed", "unavailable"] as const)(
    "keeps a positioned, oriented fallback when the asset is %s",
    (state) => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      if (state === "pending")
        load.mockImplementation(() => {
          throw new Promise(() => undefined);
        });
      if (state === "failed")
        load.mockImplementation(() => {
          throw new Error("Synthetic resource failure");
        });
      const { container } = render(
        <FurnitureAsset3D
          model={
            state === "unavailable" ? { ...model, asset: undefined } : model
          }
          state="idle"
        />
      );
      const envelope = screen.getByTestId("fallback-envelope");
      // Body plus recessed plinth retains the canonical height; width/depth are exact.
      const plinth = Math.min(model.height * 0.06, 0.04);
      expect(JSON.parse(envelope.getAttribute("data-size")!)).toEqual([
        model.width,
        model.height - plinth,
        model.depth
      ]);
      expect(JSON.parse(envelope.getAttribute("data-position")!)).toEqual([
        0,
        (model.height + plinth) / 2,
        0
      ]);
      expect(container.firstElementChild?.getAttribute("position")).toBe(
        "1.2,3.1,-0.8"
      );
      expect(container.firstElementChild?.getAttribute("rotation")).toBe(
        `0,${model.yaw},0`
      );
      if (state === "unavailable") expect(load).not.toHaveBeenCalled();
      else expect(load).toHaveBeenCalledWith("/synthetic.glb", false, false);
    }
  );
});
