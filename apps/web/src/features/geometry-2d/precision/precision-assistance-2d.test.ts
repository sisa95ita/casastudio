import { describe, expect, it } from "vitest";

import {
  createAxisPrecisionCandidate,
  resolvePrecisionTranslation
} from "./precision-assistance-2d";

const candidate = (
  id: string,
  relation: Parameters<typeof createAxisPrecisionCandidate>[0]["relation"],
  correction: number,
  pixelsPerWorldUnit = 1
) =>
  createAxisPrecisionCandidate({
    id,
    relation,
    axis: "x",
    correction,
    pixelsPerWorldUnit
  });

describe("2D precision assistance", () => {
  it("uses screen-space tolerance independently of zoom", () => {
    expect(
      resolvePrecisionTranslation({ x: 0, z: 0 }, [
        candidate("normal", "grid", 9, 1)
      ]).delta.x
    ).toBe(9);
    expect(
      resolvePrecisionTranslation({ x: 0, z: 0 }, [
        candidate("zoomed", "grid", 0.9, 10)
      ]).delta.x
    ).toBe(0.9);
    expect(
      resolvePrecisionTranslation({ x: 0, z: 0 }, [
        candidate("outside", "grid", 1.1, 10)
      ]).delta.x
    ).toBe(0);
  });

  it("ranks architecture before object and grid candidates", () => {
    const result = resolvePrecisionTranslation({ x: 20, z: 0 }, [
      candidate("grid", "grid", 1),
      candidate("furniture", "object-edge", 2),
      candidate("wall", "wall-face", 3)
    ]);
    expect(result.delta.x).toBe(23);
    expect(result.active[0]?.id).toBe("wall");
  });

  it("uses stable identity for semantic and distance ties", () => {
    const result = resolvePrecisionTranslation({ x: 0, z: 0 }, [
      candidate("z", "object-center", 4),
      candidate("a", "object-center", -4)
    ]);
    expect(result.active[0]?.id).toBe("a");
    expect(result.delta.x).toBe(-4);
  });

  it("bypasses every snap without invoking constraint selection", () => {
    expect(
      resolvePrecisionTranslation(
        { x: 7, z: 8 },
        [candidate("wall", "wall-face", -7)],
        { bypass: true }
      )
    ).toEqual({ delta: { x: 7, z: 8 }, active: [], guides: [] });
  });

  it("discards an invalid higher-priority candidate", () => {
    const result = resolvePrecisionTranslation(
      { x: 0, z: 0 },
      [
        candidate("wall", "wall-face", 5),
        candidate("object", "object-edge", 3)
      ],
      { isValid: (delta) => delta.x !== 5 }
    );
    expect(result.delta.x).toBe(3);
    expect(result.active[0]?.id).toBe("object");
  });

  it("retains an active candidate through the release tolerance unless priority improves", () => {
    const previous = resolvePrecisionTranslation({ x: 0, z: 0 }, [
      candidate("active", "object-center", 4)
    ]);
    const retained = resolvePrecisionTranslation(
      { x: 0, z: 0 },
      [
        candidate("active", "object-center", 12),
        candidate("nearer", "object-center", 1)
      ],
      { previous }
    );
    expect(retained.active[0]?.id).toBe("active");

    const released = resolvePrecisionTranslation(
      { x: 0, z: 0 },
      [
        candidate("active", "object-center", 14),
        candidate("nearer", "object-center", 1)
      ],
      { previous }
    );
    expect(released.active[0]?.id).toBe("nearer");

    const superseded = resolvePrecisionTranslation(
      { x: 0, z: 0 },
      [
        candidate("active", "object-center", 12),
        candidate("wall", "wall-face", 8)
      ],
      { previous }
    );
    expect(superseded.active[0]?.id).toBe("wall");
  });
});
