import {
  ProjectSchema,
  validateProjectCrossReferences,
  validateProjectGeometry,
  validateProjectReferenceConsistency,
  type Project,
  type ValidationError,
  ValidationErrorCode
} from "@casastudio/schema";
import { z } from "zod";

import type { ProjectPersistenceAggregate } from "./project-persistence-aggregate";
import { PersistedProjectInvalidError, ProjectReconstructionError } from "./project-persistence-error";

type Positioned = {
  readonly position: number;
};

/**
 * Converts normalized persistence records into the canonical Project aggregate.
 *
 * The mapper preserves domain identifiers, reconstructs ordered collections
 * only from explicit positions, validates structural schema and semantic
 * references, and returns the parsed Project object. It never invokes geometry
 * model construction or mutates Prisma records.
 */
export class ProjectAggregateMapper {
  /**
   * Reconstructs and validates one canonical Project from a persistence aggregate.
   *
   * Missing required relations, non-contiguous ordering positions, schema
   * rejection, and semantic validation failures are reported as internal
   * reconstruction errors instead of returning partial domain data.
   */
  toProject(aggregate: ProjectPersistenceAggregate): Project {
    const building = aggregate.building;

    if (!building) {
      throw new ProjectReconstructionError(`Persisted project "${aggregate.domainId}" is missing its Building.`);
    }

    const candidate = {
      id: aggregate.domainId,
      name: aggregate.name,
      schemaVersion: aggregate.schemaVersion,
      revision: aggregate.revision,
      createdAt: aggregate.domainCreatedAt,
      updatedAt: aggregate.domainUpdatedAt,
      units: {
        length: aggregate.unitLength,
        angle: aggregate.unitAngle
      },
      building: {
        id: building.domainId,
        name: building.name,
        type: building.type,
        levels: mapPositioned(building.levels, "building.levels", (level) => ({
          id: level.domainId,
          name: level.name,
          elevation: level.elevation,
          rooms: mapPositioned(level.rooms, `building.levels.${level.domainId}.rooms`, (room) => ({
            id: room.domainId,
            name: room.name,
            type: room.type,
            description: room.description ?? undefined,
            elevation: room.elevation ?? undefined,
            boundary: mapPositioned(
              room.boundaryEdges,
              `building.levels.${level.domainId}.rooms.${room.domainId}.boundary`,
              (edge) => ({
                wallId: edge.wall.domainId,
                direction: edge.direction
              })
            )
          })),
          walls: mapPositioned(level.walls, `building.levels.${level.domainId}.walls`, (wall) => ({
            id: wall.domainId,
            name: wall.name ?? undefined,
            description: wall.description ?? undefined,
            start: {
              x: wall.startX,
              z: wall.startZ
            },
            end: {
              x: wall.endX,
              z: wall.endZ
            },
            height: wall.height,
            thickness: wall.thickness,
            roomIds: mapPositioned(
              wall.roomReferences,
              `building.levels.${level.domainId}.walls.${wall.domainId}.roomIds`,
              (reference) => reference.room.domainId
            ),
            openings: mapPositioned(
              wall.openings,
              `building.levels.${level.domainId}.walls.${wall.domainId}.openings`,
              (opening) => {
                const commonOpening = {
                  id: opening.domainId,
                  name: opening.name ?? undefined,
                  description: opening.description ?? undefined,
                  offsetFromStart: opening.offsetFromStart,
                  width: opening.width,
                  height: opening.height,
                  elevation: opening.elevation
                };

                if (opening.type === "DOOR") {
                  const connectedRoomIds =
                    opening.connectedRoomReferences.length === 0
                      ? undefined
                      : mapPositioned(
                          opening.connectedRoomReferences,
                          `building.levels.${level.domainId}.walls.${wall.domainId}.openings.${opening.domainId}.connectedRoomIds`,
                          (reference) => reference.room.domainId
                        );

                  return {
                    ...commonOpening,
                    type: "DOOR" as const,
                    connectedRoomIds
                  };
                }

                return {
                  ...commonOpening,
                  type: "WINDOW" as const
                };
              }
            )
          })),
          staircases: mapPositioned(
            level.ownedStaircases,
            `building.levels.${level.domainId}.staircases`,
            (staircase) => ({
              id: staircase.domainId,
              name: staircase.name ?? undefined,
              description: staircase.description ?? undefined,
              fromLevelId: staircase.fromLevel.domainId,
              toLevelId: staircase.toLevel.domainId,
              fromRoomId: staircase.fromRoom?.domainId,
              toRoomId: staircase.toRoom?.domainId,
              width: staircase.width,
              flights: mapPositioned(
                staircase.flights,
                `building.levels.${level.domainId}.staircases.${staircase.domainId}.flights`,
                (flight) => ({
                  id: flight.domainId,
                  name: flight.name ?? undefined,
                  description: flight.description ?? undefined,
                  start: {
                    x: flight.startX,
                    z: flight.startZ
                  },
                  end: {
                    x: flight.endX,
                    z: flight.endZ
                  },
                  width: flight.width,
                  stepCount: flight.stepCount,
                  startElevation: flight.startElevation,
                  endElevation: flight.endElevation
                })
              ),
              landings: mapPositioned(
                staircase.landings,
                `building.levels.${level.domainId}.staircases.${staircase.domainId}.landings`,
                (landing) => ({
                  id: landing.domainId,
                  name: landing.name ?? undefined,
                  description: landing.description ?? undefined,
                  position: {
                    x: landing.pointX,
                    z: landing.pointZ
                  },
                  width: landing.width,
                  depth: landing.depth,
                  elevation: landing.elevation
                })
              )
            })
          )
        }))
      },
      viewpoints: mapPositioned(aggregate.viewpoints, "viewpoints", (viewpoint) => ({
        id: viewpoint.domainId,
        name: viewpoint.name ?? undefined,
        description: viewpoint.description ?? undefined,
        levelId: viewpoint.level.domainId,
        roomId: viewpoint.room?.domainId,
        cameraPosition: {
          x: viewpoint.cameraPositionX,
          y: viewpoint.cameraPositionY,
          z: viewpoint.cameraPositionZ
        },
        cameraTarget: {
          x: viewpoint.cameraTargetX,
          y: viewpoint.cameraTargetY,
          z: viewpoint.cameraTargetZ
        },
        fieldOfView: viewpoint.fieldOfView,
        projection: viewpoint.projection
      })),
      baseImages: mapPositioned(aggregate.baseImages, "baseImages", (baseImage) => ({
        id: baseImage.domainId,
        name: baseImage.name ?? undefined,
        description: baseImage.description ?? undefined,
        viewpointId: baseImage.viewpoint.domainId,
        assetRef: baseImage.assetRef,
        projectRevision: baseImage.projectRevision,
        createdAt: baseImage.domainCreatedAt,
        width: baseImage.width ?? undefined,
        height: baseImage.height ?? undefined
      })),
      designBriefs: mapPositioned(aggregate.designBriefs, "designBriefs", (designBrief) => ({
        id: designBrief.domainId,
        name: designBrief.name ?? undefined,
        description: designBrief.description ?? undefined,
        promptText: designBrief.promptText,
        style: designBrief.style ?? undefined,
        constraints: mapPositioned(
          designBrief.constraints,
          `designBriefs.${designBrief.domainId}.constraints`,
          (constraint) => constraint.value
        ),
        palette: mapPositioned(
          designBrief.paletteEntries,
          `designBriefs.${designBrief.domainId}.palette`,
          (entry) => entry.value
        ),
        referenceAssetRefs: mapPositioned(
          designBrief.referenceAssets,
          `designBriefs.${designBrief.domainId}.referenceAssetRefs`,
          (asset) => asset.assetRef
        ),
        notes: designBrief.notes ?? undefined
      })),
      renderRequests: mapPositioned(aggregate.renderRequests, "renderRequests", (renderRequest) => ({
        id: renderRequest.domainId,
        name: renderRequest.name ?? undefined,
        description: renderRequest.description ?? undefined,
        viewpointId: renderRequest.viewpoint.domainId,
        baseImageId: renderRequest.baseImage.domainId,
        designBriefId: renderRequest.designBrief.domainId,
        status: renderRequest.status,
        requestedProviderId: renderRequest.requestedProviderId ?? undefined,
        requestedModelId: renderRequest.requestedModelId ?? undefined,
        requestedResultCount: renderRequest.requestedResultCount ?? undefined,
        createdAt: renderRequest.domainCreatedAt,
        startedAt: renderRequest.startedAt ?? undefined,
        completedAt: renderRequest.completedAt ?? undefined,
        error: renderRequest.error ?? undefined
      })),
      renderResults: mapPositioned(aggregate.renderResults, "renderResults", (renderResult) => ({
        id: renderResult.domainId,
        name: renderResult.name ?? undefined,
        description: renderResult.description ?? undefined,
        renderRequestId: renderResult.renderRequest.domainId,
        status: renderResult.status,
        createdAt: renderResult.domainCreatedAt,
        assetRef: renderResult.assetRef ?? undefined,
        providerId: renderResult.providerId ?? undefined,
        modelId: renderResult.modelId ?? undefined,
        notes: renderResult.notes ?? undefined,
        favorite: renderResult.favorite ?? undefined,
        error: renderResult.error ?? undefined,
        width: renderResult.width ?? undefined,
        height: renderResult.height ?? undefined
      }))
    };

    return validateProjectForPersistence(candidate);
  }
}

/**
 * Validates a Project before it crosses the persistence/domain boundary.
 *
 * Structural parsing runs first, followed by reference existence,
 * bidirectional-reference consistency, and persisted geometry validation. The
 * renderability validator is deliberately excluded so draft but valid projects
 * can be persisted before they contain every rendering prerequisite.
 */
export function validateProjectForPersistence(project: unknown): Project {
  const parsed = parseProject(project);
  const validationErrors = [
    ...validateProjectCrossReferences(parsed).errors,
    ...validateProjectReferenceConsistency(parsed).errors,
    ...validateProjectGeometry(parsed).errors
  ];

  if (validationErrors.length > 0) {
    throw new PersistedProjectInvalidError("Persisted project failed semantic validation.", validationErrors);
  }

  return parsed;
}

function parseProject(project: unknown): Project {
  const result = ProjectSchema.safeParse(project);

  if (result.success) {
    return result.data;
  }

  throw new PersistedProjectInvalidError("Persisted project failed schema validation.", toValidationErrors(result.error), {
    cause: result.error
  });
}

function toValidationErrors(error: z.ZodError): readonly ValidationError[] {
  return error.issues.map((issue) => ({
    code: ValidationErrorCode.PROJECT_SCHEMA_VALIDATION_FAILED,
    path: issue.path.join("."),
    message: issue.message
  }));
}

function mapPositioned<Item extends Positioned, Result>(
  items: readonly Item[],
  path: string,
  mapItem: (item: Item) => Result
): Result[] {
  assertContiguousPositions(items, path);

  return items.map(mapItem);
}

function assertContiguousPositions(items: readonly Positioned[], path: string): void {
  items.forEach((item, index) => {
    if (item.position !== index) {
      throw new ProjectReconstructionError(
        `Persisted collection "${path}" has position ${item.position} at sorted index ${index}.`
      );
    }
  });
}
