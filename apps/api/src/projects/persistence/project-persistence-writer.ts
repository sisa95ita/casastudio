import type { Project } from "@casastudio/schema";
import type { Prisma } from "@prisma/client";

import { validateProjectForPersistence } from "./project-aggregate.mapper";
import type { NewProjectMetadata } from "./project-persistence-aggregate";
import { ProjectPersistenceError } from "./project-persistence-error";

type DomainRecord = {
  readonly id: string;
  readonly domainId: string;
};

type DomainLookup = Map<string, DomainRecord>;

/**
 * Transactional writer for replacing the current persisted Project state.
 *
 * The writer accepts an already canonical Project, validates it before writing,
 * inserts normalized records in foreign-key order, preserves every domain ID,
 * and leaves rollback to the surrounding Prisma transaction when any insert or
 * lookup fails.
 */
export class ProjectPersistenceWriter {
  /**
   * Replaces one known demo Project inside an existing transaction.
   *
   * Existing rows are deleted only when the stored owner subject matches the
   * supplied owner subject. This keeps repeatable local seeding deterministic
   * without silently overwriting a project that is no longer owned by the demo
   * Keycloak subject.
   */
  async replaceProjectInTransaction(
    tx: Prisma.TransactionClient,
    project: Project,
    metadata: NewProjectMetadata
  ): Promise<void> {
    const canonicalProject = validateProjectForPersistence(project);
    const existingProject = await tx.project.findUnique({
      where: {
        domainId: canonicalProject.id
      },
      select: {
        id: true,
        ownerSubject: true
      }
    });

    if (existingProject) {
      if (existingProject.ownerSubject !== metadata.ownerSubject) {
        throw new ProjectPersistenceError(
          `Refusing to replace project "${canonicalProject.id}" because it is not owned by the expected seed subject.`
        );
      }

      await tx.project.delete({
        where: {
          id: existingProject.id
        }
      });
    }

    await this.createProjectInTransaction(tx, canonicalProject, metadata);
  }

  private async createProjectInTransaction(
    tx: Prisma.TransactionClient,
    project: Project,
    metadata: NewProjectMetadata
  ): Promise<void> {
    const dbProject = await tx.project.create({
      data: {
        domainId: project.id,
        name: project.name,
        schemaVersion: project.schemaVersion,
        revision: project.revision,
        domainCreatedAt: project.createdAt,
        domainUpdatedAt: project.updatedAt,
        unitLength: project.units.length,
        unitAngle: project.units.angle,
        ownerSubject: metadata.ownerSubject,
        createdBySubject: metadata.createdBySubject,
        updatedBySubject: metadata.updatedBySubject,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt
      }
    });

    const dbBuilding = await tx.building.create({
      data: {
        projectId: dbProject.id,
        domainId: project.building.id,
        name: project.building.name,
        type: project.building.type
      }
    });

    const levels = new Map<string, DomainRecord>();
    const rooms = new Map<string, DomainRecord>();
    const walls = new Map<string, DomainRecord>();
    const viewpoints = new Map<string, DomainRecord>();
    const baseImages = new Map<string, DomainRecord>();
    const designBriefs = new Map<string, DomainRecord>();
    const renderRequests = new Map<string, DomainRecord>();

    for (const [levelPosition, level] of project.building.levels.entries()) {
      const dbLevel = await tx.level.create({
        data: {
          projectId: dbProject.id,
          buildingId: dbBuilding.id,
          domainId: level.id,
          position: levelPosition,
          name: level.name,
          elevation: level.elevation
        }
      });

      levels.set(level.id, dbLevel);

      for (const [roomPosition, room] of level.rooms.entries()) {
        const dbRoom = await tx.room.create({
          data: {
            projectId: dbProject.id,
            levelId: dbLevel.id,
            domainId: room.id,
            position: roomPosition,
            name: room.name,
            type: room.type,
            description: room.description,
            elevation: room.elevation
          }
        });

        rooms.set(room.id, dbRoom);
      }

      for (const [wallPosition, wall] of level.walls.entries()) {
        const dbWall = await tx.wall.create({
          data: {
            projectId: dbProject.id,
            levelId: dbLevel.id,
            domainId: wall.id,
            position: wallPosition,
            name: wall.name,
            description: wall.description,
            startX: wall.start.x,
            startZ: wall.start.z,
            endX: wall.end.x,
            endZ: wall.end.z,
            height: wall.height,
            thickness: wall.thickness
          }
        });

        walls.set(wall.id, dbWall);
      }
    }

    for (const level of project.building.levels) {
      for (const room of level.rooms) {
        const dbRoom = getRequired(rooms, room.id, "Room");

        for (const [boundaryPosition, boundaryEdge] of room.boundary.entries()) {
          await tx.roomBoundaryEdge.create({
            data: {
              projectId: dbProject.id,
              roomId: dbRoom.id,
              wallId: getRequired(walls, boundaryEdge.wallId, "Wall").id,
              position: boundaryPosition,
              direction: boundaryEdge.direction
            }
          });
        }
      }

      for (const wall of level.walls) {
        const dbWall = getRequired(walls, wall.id, "Wall");

        for (const [roomReferencePosition, roomId] of wall.roomIds.entries()) {
          await tx.wallRoomReference.create({
            data: {
              projectId: dbProject.id,
              wallId: dbWall.id,
              roomId: getRequired(rooms, roomId, "Room").id,
              position: roomReferencePosition
            }
          });
        }

        for (const [openingPosition, opening] of wall.openings.entries()) {
          const dbOpening = await tx.opening.create({
            data: {
              projectId: dbProject.id,
              wallId: dbWall.id,
              domainId: opening.id,
              position: openingPosition,
              name: opening.name,
              description: opening.description,
              type: opening.type,
              offsetFromStart: opening.offsetFromStart,
              width: opening.width,
              height: opening.height,
              elevation: opening.elevation
            }
          });

          if (opening.type === "DOOR") {
            for (const [connectedRoomPosition, roomId] of (opening.connectedRoomIds ?? []).entries()) {
              await tx.openingConnectedRoomReference.create({
                data: {
                  projectId: dbProject.id,
                  openingId: dbOpening.id,
                  roomId: getRequired(rooms, roomId, "Room").id,
                  position: connectedRoomPosition
                }
              });
            }
          }
        }
      }

      for (const [staircasePosition, staircase] of level.staircases.entries()) {
        const dbStaircase = await tx.staircase.create({
          data: {
            projectId: dbProject.id,
            owningLevelId: getRequired(levels, level.id, "Level").id,
            domainId: staircase.id,
            position: staircasePosition,
            name: staircase.name,
            description: staircase.description,
            fromLevelId: getRequired(levels, staircase.fromLevelId, "Level").id,
            toLevelId: getRequired(levels, staircase.toLevelId, "Level").id,
            fromRoomId: getOptional(rooms, staircase.fromRoomId, "Room")?.id,
            toRoomId: getOptional(rooms, staircase.toRoomId, "Room")?.id,
            width: staircase.width
          }
        });

        for (const [flightPosition, flight] of staircase.flights.entries()) {
          await tx.stairFlight.create({
            data: {
              projectId: dbProject.id,
              staircaseId: dbStaircase.id,
              domainId: flight.id,
              position: flightPosition,
              name: flight.name,
              description: flight.description,
              startX: flight.start.x,
              startZ: flight.start.z,
              endX: flight.end.x,
              endZ: flight.end.z,
              width: flight.width,
              stepCount: flight.stepCount,
              startElevation: flight.startElevation,
              endElevation: flight.endElevation
            }
          });
        }

        for (const [landingPosition, landing] of staircase.landings.entries()) {
          await tx.stairLanding.create({
            data: {
              projectId: dbProject.id,
              staircaseId: dbStaircase.id,
              domainId: landing.id,
              position: landingPosition,
              name: landing.name,
              description: landing.description,
              pointX: landing.position.x,
              pointZ: landing.position.z,
              width: landing.width,
              depth: landing.depth,
              elevation: landing.elevation
            }
          });
        }
      }
    }

    for (const [viewpointPosition, viewpoint] of project.viewpoints.entries()) {
      const dbViewpoint = await tx.viewpoint.create({
        data: {
          projectId: dbProject.id,
          domainId: viewpoint.id,
          position: viewpointPosition,
          name: viewpoint.name,
          description: viewpoint.description,
          levelId: getRequired(levels, viewpoint.levelId, "Level").id,
          roomId: getOptional(rooms, viewpoint.roomId, "Room")?.id,
          cameraPositionX: viewpoint.cameraPosition.x,
          cameraPositionY: viewpoint.cameraPosition.y,
          cameraPositionZ: viewpoint.cameraPosition.z,
          cameraTargetX: viewpoint.cameraTarget.x,
          cameraTargetY: viewpoint.cameraTarget.y,
          cameraTargetZ: viewpoint.cameraTarget.z,
          fieldOfView: viewpoint.fieldOfView,
          projection: viewpoint.projection
        }
      });

      viewpoints.set(viewpoint.id, dbViewpoint);
    }

    for (const [baseImagePosition, baseImage] of project.baseImages.entries()) {
      const dbBaseImage = await tx.baseImage.create({
        data: {
          projectId: dbProject.id,
          viewpointId: getRequired(viewpoints, baseImage.viewpointId, "Viewpoint").id,
          domainId: baseImage.id,
          position: baseImagePosition,
          name: baseImage.name,
          description: baseImage.description,
          assetRef: baseImage.assetRef,
          projectRevision: baseImage.projectRevision,
          domainCreatedAt: baseImage.createdAt,
          width: baseImage.width,
          height: baseImage.height
        }
      });

      baseImages.set(baseImage.id, dbBaseImage);
    }

    for (const [designBriefPosition, designBrief] of project.designBriefs.entries()) {
      const dbDesignBrief = await tx.designBrief.create({
        data: {
          projectId: dbProject.id,
          domainId: designBrief.id,
          position: designBriefPosition,
          name: designBrief.name,
          description: designBrief.description,
          promptText: designBrief.promptText,
          style: designBrief.style,
          notes: designBrief.notes
        }
      });

      designBriefs.set(designBrief.id, dbDesignBrief);

      for (const [position, value] of designBrief.constraints.entries()) {
        await tx.designBriefConstraint.create({
          data: {
            projectId: dbProject.id,
            designBriefId: dbDesignBrief.id,
            position,
            value
          }
        });
      }

      for (const [position, value] of designBrief.palette.entries()) {
        await tx.designBriefPaletteEntry.create({
          data: {
            projectId: dbProject.id,
            designBriefId: dbDesignBrief.id,
            position,
            value
          }
        });
      }

      for (const [position, assetRef] of designBrief.referenceAssetRefs.entries()) {
        await tx.designBriefReferenceAsset.create({
          data: {
            projectId: dbProject.id,
            designBriefId: dbDesignBrief.id,
            position,
            assetRef
          }
        });
      }
    }

    for (const [renderRequestPosition, renderRequest] of project.renderRequests.entries()) {
      const dbRenderRequest = await tx.renderRequest.create({
        data: {
          projectId: dbProject.id,
          viewpointId: getRequired(viewpoints, renderRequest.viewpointId, "Viewpoint").id,
          baseImageId: getRequired(baseImages, renderRequest.baseImageId, "BaseImage").id,
          designBriefId: getRequired(designBriefs, renderRequest.designBriefId, "DesignBrief").id,
          domainId: renderRequest.id,
          position: renderRequestPosition,
          name: renderRequest.name,
          description: renderRequest.description,
          status: renderRequest.status,
          requestedProviderId: renderRequest.requestedProviderId,
          requestedModelId: renderRequest.requestedModelId,
          requestedResultCount: renderRequest.requestedResultCount,
          domainCreatedAt: renderRequest.createdAt,
          startedAt: renderRequest.startedAt,
          completedAt: renderRequest.completedAt,
          error: renderRequest.error
        }
      });

      renderRequests.set(renderRequest.id, dbRenderRequest);
    }

    for (const [renderResultPosition, renderResult] of project.renderResults.entries()) {
      await tx.renderResult.create({
        data: {
          projectId: dbProject.id,
          renderRequestId: getRequired(renderRequests, renderResult.renderRequestId, "RenderRequest").id,
          domainId: renderResult.id,
          position: renderResultPosition,
          name: renderResult.name,
          description: renderResult.description,
          status: renderResult.status,
          domainCreatedAt: renderResult.createdAt,
          assetRef: renderResult.assetRef,
          providerId: renderResult.providerId,
          modelId: renderResult.modelId,
          notes: renderResult.notes,
          favorite: renderResult.favorite,
          error: renderResult.error,
          width: renderResult.width,
          height: renderResult.height
        }
      });
    }
  }
}

function getRequired(lookup: DomainLookup, domainId: string, entityName: string): DomainRecord {
  const record = lookup.get(domainId);

  if (!record) {
    throw new ProjectPersistenceError(`${entityName} "${domainId}" was not created before it was referenced.`);
  }

  return record;
}

function getOptional(
  lookup: DomainLookup,
  domainId: string | undefined,
  entityName: string
): DomainRecord | undefined {
  return domainId ? getRequired(lookup, domainId, entityName) : undefined;
}
