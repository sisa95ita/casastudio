import { render } from "@testing-library/react";
import { builtinFurnitureDefinitions } from "@casastudio/schema";
import { describe, expect, it } from "vitest";
import { createFurniturePresentation2D } from "../../geometry-2d/presentation/furniture-presentation-model-2d";
import { FurnitureChoiceThumbnail } from "./FurnitureChoiceThumbnail";

describe("FurnitureChoiceThumbnail", () => {
  it("renders every built-in through the same semantic symbol roles as canvas presentation", () => {
    for (const definition of builtinFurnitureDefinitions) {
      const { container, unmount } = render(
        <FurnitureChoiceThumbnail definition={definition} />
      );
      const model = createFurniturePresentation2D({
        id: "comparison",
        roomId: "room",
        definitionId: definition.id,
        position: { x: 0, z: 0 },
        rotation: 0,
        width: definition.defaultWidth,
        depth: definition.defaultDepth,
        height: definition.defaultHeight
      });
      expect(
        Array.from(container.querySelectorAll("[data-symbol-role]"), (node) =>
          node.getAttribute("data-symbol-role")
        )
      ).toEqual([
        "footprint",
        ...model.primitives.map((primitive) => primitive.role)
      ]);
      expect(container.querySelector("text")).toBeNull();
      unmount();
    }
  });
});
