import type {
  DesignArtifact,
  DesignReferenceView,
  InteriorDesignProvider
} from "@casastudio/ai";
import { createInitialProject } from "@casastudio/schema";
import { vi } from "vitest";
import type {
  StoredDesignProposal,
  DesignProposalsRepository
} from "../persistence/design-proposal.repository";

export const pngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGMw69gNAAJxAXoD7wlzAAAAAElFTkSuQmCC";
export const fixtureArtifact: DesignArtifact = {
  kind: "image",
  mimeType: "image/png",
  uri: `data:image/png;base64,${pngBase64}`,
  width: 1,
  height: 1
};
export const jpegArtifact: DesignArtifact = {
  kind: "image",
  mimeType: "image/jpeg",
  width: 1,
  height: 1,
  uri: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAAaADAAQAAAABAAAAAQAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAAQABAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAAf/aAAwDAQACEQMRAD8A5Oiiiv6cP5LP/9k="
};
export const webpArtifact: DesignArtifact = {
  kind: "image",
  mimeType: "image/webp",
  width: 1,
  height: 1,
  uri: "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA"
};
export function fixtureProject() {
  const p = createInitialProject({
    projectId: "design-project",
    buildingId: "building",
    levelId: "ground",
    name: "Home",
    createdAt: "2026-10-05T10:00:00.000Z"
  });
  return {
    ...p,
    building: {
      ...p.building,
      levels: [
        {
          ...p.building.levels[0]!,
          rooms: [
            {
              id: "living",
              name: "Living",
              type: "LIVING_ROOM" as const,
              boundary: []
            }
          ]
        }
      ]
    }
  };
}
export const input = {
  levelId: "ground",
  roomId: "living",
  instructions: "Warm design",
  referenceViews: (
    ["room-axonometric", "room-interior-a", "room-interior-b"] as const
  ).map(
    (kind) =>
      ({
        kind,
        target: {
          kind: "room",
          projectId: "design-project",
          levelId: "ground",
          roomId: "living"
        },
        image: {
          dataUrl: fixtureArtifact.uri,
          mimeType: "image/png",
          width: 1,
          height: 1
        },
        camera: {
          projection: "perspective",
          position: { x: 1, y: 2, z: 3 },
          direction: { x: 0, y: 0, z: -1 },
          up: { x: 0, y: 1, z: 0 },
          verticalFovDegrees: 45
        }
      }) satisfies DesignReferenceView
  )
};
export function fixtureProvider(): InteriorDesignProvider {
  return {
    name: "fake",
    generateDesign: vi.fn().mockResolvedValue({
      artifact: fixtureArtifact,
      telemetry: {
        durationMs: 12,
        generatedAt: "2026-10-05T10:00:00.000Z",
        imageModel: "fixture",
        generationMode: "edit",
        image: { format: "png", width: 1, height: 1, quality: "low" },
        usage: {
          inputTokens: 1,
          outputTokens: 2,
          totalTokens: 3,
          raw: "must-not-persist"
        }
      }
    })
  };
}

/** Test-only persistence; production always uses Prisma. */
export function memoryProposals() {
  const records = new Map<string, StoredDesignProposal>();
  const repository: DesignProposalsRepository = {
    create: vi.fn(async (record) => {
      const p = record.proposal;
      const stored = {
        ...record,
        proposal: {
          ...p,
          providerMetadata: { provider: p.telemetry!.provider },
          artifact: {
            ...p.artifact,
            uri: `/api/v1/projects/${p.target.projectId}/design-proposals/${p.id}/artifact`
          }
        }
      };
      records.set(p.id, stored);
      return stored;
    }),
    find: vi.fn(async (projectId, id) => {
      const r = records.get(id);
      if (!r || r.proposal.target.projectId !== projectId) return null;
      return r;
    }),
    list: vi.fn(async (target, limit, before) =>
      [...records.values()]
        .filter(
          ({ proposal: p }) =>
            p.target.projectId === target.projectId &&
            p.target.levelId === target.levelId &&
            p.target.roomId === target.roomId &&
            (!before ||
              p.createdAt < before.createdAt.toISOString() ||
              (p.createdAt === before.createdAt.toISOString() &&
                p.id < before.id))
        )
        .sort(
          (a, b) =>
            b.proposal.createdAt.localeCompare(a.proposal.createdAt) ||
            b.proposal.id.localeCompare(a.proposal.id)
        )
        .slice(0, limit)
    ),
    delete: vi.fn(async (projectId, id) => {
      const r = records.get(id);
      if (!r || r.proposal.target.projectId !== projectId) return null;
      records.delete(id);
      return r;
    })
  };
  return { records, repository };
}
