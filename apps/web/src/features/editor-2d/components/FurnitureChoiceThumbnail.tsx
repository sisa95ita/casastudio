import type { FurnitureDefinition } from "@casastudio/schema";
import { createFurniturePresentation2D } from "../../geometry-2d/presentation/furniture-presentation-model-2d";
import { FurnitureSymbolSvg } from "../../geometry-2d/viewer/FurnitureSymbolSvg";

/** Catalog thumbnail generated from the exact semantic presentation model used on canvas. */
export function FurnitureChoiceThumbnail({
  definition
}: {
  readonly definition: Readonly<FurnitureDefinition>;
}) {
  const model = createFurniturePresentation2D({
    id: `thumbnail:${definition.id}`,
    roomId: "thumbnail",
    definitionId: definition.id,
    position: { x: 0, z: 0 },
    rotation: 0,
    width: definition.defaultWidth,
    depth: definition.defaultDepth,
    height: definition.defaultHeight
  });
  const padding = Math.max(model.width, model.depth) * 0.12 + 4;
  return (
    <svg
      viewBox={`${-model.width / 2 - padding} ${-model.depth / 2 - padding} ${model.width + padding * 2} ${model.depth + padding * 2}`}
      width="64"
      height="48"
      preserveAspectRatio="xMidYMid meet"
      focusable="false"
    >
      <FurnitureSymbolSvg
        model={model}
        project={(point) => ({ x: point.x, y: -point.z })}
        stroke="currentColor"
        surfaceFill="#f5f3ec"
        detailFill="#e7e2d8"
        strokeWidth={1.25}
      />
    </svg>
  );
}
