import type { MouseEvent, PointerEvent } from "react";
import type { FurniturePresentationModel2D } from "../presentation/furniture-presentation-model-2d";
import type { ViewportTransform2D } from "../viewport/viewport-transform-2d";
import {
  isGeometrySelectionMatch,
  type GeometrySelectionState
} from "../selection/geometry-selection-state";

/** Renderer-neutral Furniture plan plus transient geometry and interaction availability. */
export type FurnitureViewerModel = {
  readonly items: readonly FurniturePresentationModel2D[];
  readonly preview?: FurniturePresentationModel2D;
  readonly previewValid: boolean;
  readonly editing: boolean;
};

/** Renders semantic line symbols with whole-footprint hit targets and one rotation handle. */
export function FurnitureSvgLayer({
  model,
  transform,
  selection,
  visible,
  selectionEnabled,
  onClick,
  onHover,
  onPointerDown
}: {
  readonly model: FurnitureViewerModel;
  readonly transform: ViewportTransform2D;
  readonly selection: GeometrySelectionState;
  readonly visible: boolean;
  readonly selectionEnabled: boolean;
  readonly onClick: (event: MouseEvent<SVGElement>, id: string) => void;
  readonly onHover: (id?: string) => void;
  readonly onPointerDown: (
    event: PointerEvent<SVGElement>,
    id: string,
    intent: "move" | "rotate"
  ) => void;
}) {
  const points = (vertices: FurniturePresentationModel2D["footprint"]) =>
    vertices
      .map((vertex) => {
        const p = transform.worldToScreen(vertex);
        return `${p.x},${p.y}`;
      })
      .join(" ");
  const symbol = (item: FurniturePresentationModel2D, preview = false) => {
    const selected = isGeometrySelectionMatch(
      selection.selected,
      "FURNITURE",
      item.id
    );
    const hovered = isGeometrySelectionMatch(
      selection.hovered,
      "FURNITURE",
      item.id
    );
    const color =
      preview && !model.previewValid
        ? "#bd4c42"
        : selected || preview
          ? "#246caf"
          : hovered
            ? "#3f80b6"
            : "#343d3f";
    const center = transform.worldToScreen(item.center);
    const handle = transform.worldToScreen(item.rotationHandle);
    return (
      <g
        key={preview ? "preview" : item.id}
        data-testid={preview ? "furniture-preview" : "furniture-symbol"}
        data-furniture-id={item.id}
        data-category={item.category}
        data-valid={preview ? model.previewValid : undefined}
        data-selected={selected}
        opacity={preview ? 0.8 : model.preview?.id === item.id ? 0.25 : 1}
        stroke={color}
        strokeWidth={selected ? 1.8 : 1.2}
        strokeLinejoin="round"
        pointerEvents={preview ? "none" : undefined}
      >
        <title>{item.name}</title>
        <polygon
          points={points(item.footprint)}
          fill="#f5f3ec"
          pointerEvents="none"
        />
        {item.lines.map((line, index) => (
          <polyline
            key={index}
            points={points(line)}
            fill="none"
            pointerEvents="none"
          />
        ))}
        {!preview ? (
          <polygon
            data-testid="furniture-hit-target"
            data-furniture-id={item.id}
            points={points(item.footprint)}
            fill="transparent"
            stroke="transparent"
            strokeWidth={8}
            style={{ cursor: model.editing ? "grab" : "pointer" }}
            pointerEvents={selectionEnabled ? "all" : "none"}
            onClick={(event) => onClick(event, item.id)}
            onMouseEnter={() => onHover(item.id)}
            onMouseLeave={() => onHover()}
            onPointerDown={(event) => onPointerDown(event, item.id, "move")}
          />
        ) : null}
        {!preview &&
        selected &&
        model.editing &&
        selectionEnabled &&
        !model.preview ? (
          <g>
            <line
              x1={center.x}
              y1={center.y}
              x2={handle.x}
              y2={handle.y}
              strokeDasharray="3 3"
              pointerEvents="none"
            />
            <circle
              data-testid="furniture-rotation-handle"
              aria-label={`Rotate ${item.name}; exact angle available in Properties`}
              role="img"
              cx={handle.x}
              cy={handle.y}
              r={7}
              fill="white"
              strokeWidth={2}
              style={{ cursor: "grab" }}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => onPointerDown(event, item.id, "rotate")}
            />
          </g>
        ) : null}
      </g>
    );
  };
  return (
    <g data-layer="furniture">
      {visible ? model.items.map((item) => symbol(item)) : null}
      {model.preview ? symbol(model.preview, true) : null}
    </g>
  );
}
