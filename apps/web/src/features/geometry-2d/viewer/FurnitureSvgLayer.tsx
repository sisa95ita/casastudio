import type { MouseEvent, PointerEvent } from "react";
import type { FurniturePresentationModel2D } from "../presentation/furniture-presentation-model-2d";
import type { ViewportTransform2D } from "../viewport/viewport-transform-2d";
import {
  isGeometrySelectionMatch,
  type GeometrySelectionState
} from "../selection/geometry-selection-state";
import { FurnitureSymbolSvg } from "./FurnitureSymbolSvg";

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
    const stateClass = preview
      ? model.previewValid
        ? " furniture-plan-symbol--preview"
        : " furniture-plan-symbol--preview furniture-plan-symbol--invalid"
      : selected
        ? " furniture-plan-symbol--selected"
        : hovered
          ? " furniture-plan-symbol--hovered"
          : "";
    const strokeWidth = selected ? 1.7 : hovered || preview ? 1.25 : 1.05;
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
        className={`furniture-plan-symbol${stateClass}`}
        opacity={preview ? 0.8 : model.preview?.id === item.id ? 0.25 : 1}
        strokeLinejoin="round"
        pointerEvents={preview ? "none" : undefined}
      >
        <title>{item.name}</title>
        <FurnitureSymbolSvg
          model={item}
          project={(point) => transform.worldToScreen(point)}
          stroke="currentColor"
          surfaceFill="var(--casa-plan-furniture-surface)"
          detailFill="var(--casa-plan-furniture-detail)"
          strokeWidth={strokeWidth}
          detailStrokeWidth={Math.max(0.75, strokeWidth - 0.2)}
        />
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
        selection.selected.length === 1 &&
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
