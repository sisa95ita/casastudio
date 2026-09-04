import {
  createExteriorLevelDimensions,
  createLinearDimension,
  createOrthogonalRoomDimensions,
  createWallDimension,
  calculatePolygonInteriorAnchor,
  documentDistanceToProjectUnits,
  measureRoom,
  type ArchitecturalScaleDenominator,
  type DimensionLineSegment,
  type LinearDimension
} from "@casastudio/geometry";
import {
  formatArchitecturalArea,
  formatArchitecturalLength,
  type Level,
  type Point2D,
  type Room,
  type Units,
  type Wall
} from "@casastudio/schema";

import type { ProjectDimensionDisplayState } from "../../editor-2d/state/project-editor-slice";
import type { GeometryPresentationModel2D } from "./geometry-presentation-model-2d";
import type { ScreenPoint, ViewportTransform2D } from "../viewport/viewport-transform-2d";

/** Screen-space line used exclusively by the SVG dimension renderer. */
export type DimensionPresentationLine2D = {
  readonly start: ScreenPoint;
  readonly end: ScreenPoint;
};

/** Screen-projected dimension retaining its authoritative physical value. */
export type LinearDimensionPresentation2D = {
  readonly kind: "linear";
  readonly extensionLines: readonly [DimensionPresentationLine2D, DimensionPresentationLine2D];
  readonly dimensionLine: DimensionPresentationLine2D;
  readonly markers: readonly [DimensionPresentationLine2D, DimensionPresentationLine2D];
  readonly labelAnchor: ScreenPoint;
  readonly physicalValue: number;
  readonly formattedValue: string;
  readonly orientation: LinearDimension["direction"]["orientation"];
};

/** Room label derived from exact ordered polygon metrics. */
export type RoomMetricPresentation2D = {
  readonly roomId: string;
  readonly roomName: string;
  readonly roomType: Room["type"];
  readonly anchor: ScreenPoint;
  readonly area: number;
  readonly formattedArea: string;
  readonly elevationLabel?: string;
};

/** Complete derived measurement model consumed by SVG presentation layers. */
export type ArchitecturalDimensionPresentationModel2D = {
  readonly automatic: readonly LinearDimensionPresentation2D[];
  readonly selected: readonly LinearDimensionPresentation2D[];
  readonly roomMetrics: readonly RoomMetricPresentation2D[];
  readonly temporary?: LinearDimensionPresentation2D;
};

/** Inputs for deriving screen presentation from canonical Project measurements. */
export type CreateArchitecturalDimensionPresentationModel2DOptions = {
  readonly level: Level;
  readonly units: Pick<Units, "length">;
  readonly transform: ViewportTransform2D;
  readonly geometryModel: GeometryPresentationModel2D;
  readonly scaleDenominator: ArchitecturalScaleDenominator;
  readonly display: ProjectDimensionDisplayState;
  readonly selectedWall?: Pick<Wall, "start" | "end">;
  readonly selectedRoom?: Pick<Room, "boundary">;
  readonly temporaryMeasurement?: {
    readonly start: Point2D;
    readonly end: Point2D;
  };
};

/**
 * Derives dimension graphics from Project-space values and projects them only
 * after every physical measurement and architectural offset has been resolved.
 */
export function createArchitecturalDimensionPresentationModel2D({
  level,
  units,
  transform,
  geometryModel,
  scaleDenominator,
  display,
  selectedWall,
  selectedRoom,
  temporaryMeasurement
}: CreateArchitecturalDimensionPresentationModel2DOptions): ArchitecturalDimensionPresentationModel2D {
  const exterior = display.overallDimensions
    ? createExteriorLevelDimensions(level, units, scaleDenominator)
    : undefined;
  const automatic = exterior
    ? [
        exterior.overallHorizontal,
        exterior.overallVertical,
        ...exterior.horizontalChain,
        ...exterior.verticalChain
      ].flatMap((dimension) => dimension ? [projectDimension(dimension, transform)] : [])
    : [];
  const selectedDimension = display.selectedDimensions && selectedWall
    ? createWallDimension(selectedWall, units, scaleDenominator)
    : undefined;
  const selectedRoomDimensions = display.selectedDimensions && selectedRoom
    ? createOrthogonalRoomDimensions(level, selectedRoom, units, scaleDenominator)
    : [];
  const temporary = temporaryMeasurement
    ? createLinearDimension({
        start: temporaryMeasurement.start,
        end: temporaryMeasurement.end,
        offset: 0,
        markerSize: documentDistanceToProjectUnits(0.05, scaleDenominator, units.length),
        units
      })
    : undefined;
  const roomMetrics = display.roomMetrics
    ? level.rooms.flatMap((room) => {
        const measurement = measureRoom(level, room);
        const polygon = geometryModel.polygons.find((candidate) => candidate.sourceRoomId === room.id);
        if (!measurement || !polygon) return [];
        const interiorAnchor = calculatePolygonInteriorAnchor(
          polygon.points.map((point) => point.world)
        );
        return [{
          roomId: room.id,
          roomName: room.name,
          roomType: room.type,
          anchor: interiorAnchor ? transform.worldToScreen(interiorAnchor) : polygon.centroid.screen,
          area: measurement.area,
          formattedArea: formatArchitecturalArea(measurement.area, units.length),
          ...(room.elevation
            ? { elevationLabel: `+${formatArchitecturalLength(room.elevation, units.length)}` }
            : {})
        }];
      })
    : [];
  return Object.freeze({
    automatic: Object.freeze(automatic),
    selected: Object.freeze([
      ...(selectedDimension ? [projectDimension(selectedDimension, transform)] : []),
      ...selectedRoomDimensions.map((dimension) => projectDimension(dimension, transform))
    ]),
    roomMetrics: Object.freeze(roomMetrics),
    temporary: temporary ? projectDimension(temporary, transform) : undefined
  });
}

function projectDimension(
  dimension: LinearDimension,
  transform: ViewportTransform2D
): LinearDimensionPresentation2D {
  return Object.freeze({
    kind: "linear",
    extensionLines: mapLinePair(dimension.extensionLines, transform),
    dimensionLine: mapLine(dimension.dimensionLine, transform),
    markers: mapLinePair(dimension.markers, transform),
    labelAnchor: transform.worldToScreen(dimension.labelAnchor),
    physicalValue: dimension.physicalValue,
    formattedValue: dimension.formattedValue,
    orientation: dimension.direction.orientation
  });
}

function mapLinePair(
  lines: readonly [DimensionLineSegment, DimensionLineSegment],
  transform: ViewportTransform2D
): readonly [DimensionPresentationLine2D, DimensionPresentationLine2D] {
  return [mapLine(lines[0], transform), mapLine(lines[1], transform)];
}

function mapLine(
  line: DimensionLineSegment,
  transform: ViewportTransform2D
): DimensionPresentationLine2D {
  return { start: transform.worldToScreen(line.start), end: transform.worldToScreen(line.end) };
}
