import type { FurniturePresentationModel2D } from "../presentation/furniture-presentation-model-2d";

type SvgPoint = { readonly x: number; readonly y: number };

/** Shared vector symbol body used by the plan, transient preview, and catalog thumbnails. */
export function FurnitureSymbolSvg({
  model,
  project,
  stroke = "currentColor",
  surfaceFill = "#f5f3ec",
  detailFill = "#e8e4da",
  strokeWidth = 1.2,
  detailStrokeWidth = strokeWidth
}: {
  readonly model: FurniturePresentationModel2D;
  readonly project: (point: FurniturePresentationModel2D["center"]) => SvgPoint;
  readonly stroke?: string;
  readonly surfaceFill?: string;
  readonly detailFill?: string;
  readonly strokeWidth?: number;
  readonly detailStrokeWidth?: number;
}) {
  const points = (
    vertices: readonly FurniturePresentationModel2D["center"][]
  ) =>
    vertices
      .map((vertex) => {
        const point = project(vertex);
        return `${point.x},${point.y}`;
      })
      .join(" ");
  return (
    <>
      <polygon
        data-symbol-role="footprint"
        points={points(model.footprint)}
        fill={surfaceFill}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      {model.primitives.map((primitive, index) =>
        primitive.shape === "area" ? (
          <polygon
            key={`${primitive.role}:${index}`}
            data-symbol-role={primitive.role}
            points={points(primitive.points)}
            fill={detailFill}
            stroke={stroke}
            strokeWidth={detailStrokeWidth}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        ) : (
          <polyline
            key={`${primitive.role}:${index}`}
            data-symbol-role={primitive.role}
            points={points(primitive.points)}
            fill="none"
            stroke={stroke}
            strokeWidth={detailStrokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        )
      )}
    </>
  );
}
