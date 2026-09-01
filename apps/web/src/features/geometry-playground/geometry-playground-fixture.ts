import { ProjectSchema, type Project } from "@casastudio/schema";

const playgroundProject = {
  id: "geometry-playground-shared-wall",
  name: "Geometry Playground Shared Wall",
  schemaVersion: "2.0.0",
  revision: 1,
  createdAt: "2026-08-02T10:00:00+02:00",
  updatedAt: "2026-08-02T10:00:00+02:00",
  units: {
    length: "cm",
    angle: "deg"
  },
  building: {
    id: "playground-building",
    name: "Playground Building",
    type: "HOUSE",
    levels: [
      {
        id: "ground-floor",
        name: "Ground Floor",
        elevation: 0,
        rooms: [
          {
            id: "left-room",
            name: "Left Room",
            type: "LIVING_ROOM",
            boundary: [
              { wallId: "left-room-north-wall", direction: "FORWARD" },
              { wallId: "left-room-east-shared-wall", direction: "FORWARD" },
              { wallId: "left-room-south-wall", direction: "FORWARD" },
              { wallId: "left-room-west-wall", direction: "FORWARD" }
            ]
          },
          {
            id: "right-room",
            name: "Right Room",
            type: "STUDIO",
            boundary: [
              { wallId: "right-room-north-wall", direction: "FORWARD" },
              { wallId: "right-room-east-wall", direction: "FORWARD" },
              { wallId: "right-room-south-wall", direction: "FORWARD" },
              { wallId: "left-room-east-shared-wall", direction: "REVERSE" }
            ]
          }
        ],
        walls: [
          {
            id: "left-room-north-wall",
            name: "Left Room North Wall",
            start: { x: 0, z: 0 },
            end: { x: 400, z: 0 },
            height: 300,
            thickness: 20,
            roomIds: ["left-room"],
            openings: []
          },
          {
            id: "left-room-east-shared-wall",
            name: "Shared Wall",
            start: { x: 400, z: 0 },
            end: { x: 400, z: 300 },
            height: 300,
            thickness: 15,
            roomIds: ["left-room", "right-room"],
            openings: []
          },
          {
            id: "left-room-south-wall",
            name: "Left Room South Wall",
            start: { x: 400, z: 300 },
            end: { x: 0, z: 300 },
            height: 300,
            thickness: 20,
            roomIds: ["left-room"],
            openings: []
          },
          {
            id: "left-room-west-wall",
            name: "Left Room West Wall",
            start: { x: 0, z: 300 },
            end: { x: 0, z: 0 },
            height: 300,
            thickness: 20,
            roomIds: ["left-room"],
            openings: []
          },
          {
            id: "right-room-north-wall",
            name: "Right Room North Wall",
            start: { x: 400, z: 0 },
            end: { x: 800, z: 0 },
            height: 300,
            thickness: 20,
            roomIds: ["right-room"],
            openings: []
          },
          {
            id: "right-room-east-wall",
            name: "Right Room East Wall",
            start: { x: 800, z: 0 },
            end: { x: 800, z: 300 },
            height: 300,
            thickness: 20,
            roomIds: ["right-room"],
            openings: []
          },
          {
            id: "right-room-south-wall",
            name: "Right Room South Wall",
            start: { x: 800, z: 300 },
            end: { x: 400, z: 300 },
            height: 300,
            thickness: 20,
            roomIds: ["right-room"],
            openings: []
          }
        ],
        staircases: []
      }
    ]
  },
  viewpoints: [],
  baseImages: [],
  designBriefs: [],
  renderRequests: [],
  renderResults: []
} satisfies Project;

/**
 * Canonical schema-v2 playground fixture used by the read-only geometry page.
 *
 * The local fixture is parsed once so the frontend executes the same typed
 * schema contract as application data while avoiding any runtime migration or
 * direct import from non-exported package example paths.
 */
export const geometryPlaygroundProject: Project = ProjectSchema.parse(playgroundProject);
