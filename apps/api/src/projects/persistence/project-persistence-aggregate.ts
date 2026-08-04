import type { Prisma } from "@prisma/client";

/**
 * Prisma include tree required to reconstruct the current canonical Project aggregate.
 *
 * Every persisted collection with canonical order is loaded by `position`, and
 * every relationship needed for domain identifier reconstruction is loaded in
 * one aggregate graph. Callers must not mutate the returned records.
 */
export const projectPersistenceInclude = {
  building: {
    include: {
      levels: {
        orderBy: { position: "asc" },
        include: {
          rooms: {
            orderBy: { position: "asc" },
            include: {
              boundaryEdges: {
                orderBy: { position: "asc" },
                include: {
                  wall: true
                }
              }
            }
          },
          walls: {
            orderBy: { position: "asc" },
            include: {
              roomReferences: {
                orderBy: { position: "asc" },
                include: {
                  room: true
                }
              },
              openings: {
                orderBy: { position: "asc" },
                include: {
                  connectedRoomReferences: {
                    orderBy: { position: "asc" },
                    include: {
                      room: true
                    }
                  }
                }
              }
            }
          },
          ownedStaircases: {
            orderBy: { position: "asc" },
            include: {
              fromLevel: true,
              toLevel: true,
              fromRoom: true,
              toRoom: true,
              flights: {
                orderBy: { position: "asc" }
              },
              landings: {
                orderBy: { position: "asc" }
              }
            }
          }
        }
      }
    }
  },
  viewpoints: {
    orderBy: { position: "asc" },
    include: {
      level: true,
      room: true
    }
  },
  baseImages: {
    orderBy: { position: "asc" },
    include: {
      viewpoint: true
    }
  },
  designBriefs: {
    orderBy: { position: "asc" },
    include: {
      constraints: {
        orderBy: { position: "asc" }
      },
      paletteEntries: {
        orderBy: { position: "asc" }
      },
      referenceAssets: {
        orderBy: { position: "asc" }
      }
    }
  },
  renderRequests: {
    orderBy: { position: "asc" },
    include: {
      viewpoint: true,
      baseImage: true,
      designBrief: true
    }
  },
  renderResults: {
    orderBy: { position: "asc" },
    include: {
      renderRequest: true
    }
  }
} satisfies Prisma.ProjectInclude;

/**
 * Complete immutable persistence graph consumed by the Project mapper.
 *
 * The aggregate is intentionally distinct from the canonical Project type: it
 * contains database technical IDs, application metadata, and normalized join
 * records that must be mapped and validated before domain services can use it.
 */
export type ProjectPersistenceAggregate = Prisma.ProjectGetPayload<{
  include: typeof projectPersistenceInclude;
}>;

/**
 * Application metadata required when creating the current persisted Project state.
 *
 * The subject fields are Keycloak `sub` values. Optional timestamps allow tests
 * and deterministic maintenance operations to control database metadata while
 * normal seed and runtime writes can rely on database defaults.
 */
export type NewProjectMetadata = {
  readonly ownerSubject: string;
  readonly createdBySubject: string;
  readonly updatedBySubject: string;
  readonly createdAt?: Date;
  readonly updatedAt?: Date;
};
