import { describe, expect, it } from "vitest";
import type { Project, Staircase } from "@casastudio/schema";

import {
  angleToProjectPlanVector,
  createStairIdentifiers,
  createStairProposal,
  findProjectStaircase,
  getStairConnectionElevations,
  getStaircaseRotation,
  getStairSourceRoomCandidates,
  getSuggestedStairParameters,
  inferStairTemplate,
  measureStaircase,
  rotateStaircaseInPlan,
  translateStaircase,
  updateStaircaseParameters
} from "./project-stair-authoring";

const project: Project = {
  id: "stair-authoring-project",
  name: "Stair authoring",
  schemaVersion: "4.0.0",
  revision: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  units: { length: "cm", angle: "deg" },
  building: {
    furniture: [],
    id: "building",
    name: "Building",
    type: "HOUSE",
    levels: [
      {
        id: "ground",
        name: "Ground",
        elevation: 0,
        rooms: [{ id: "elevated-room", name: "Elevated room", type: "STUDIO", elevation: 180, boundary: [] }],
        walls: [],
        staircases: []
      },
      { id: "upper", name: "Upper", elevation: 300, rooms: [], walls: [], staircases: [] }
    ]
  },
  viewpoints: [],
  baseImages: [],
  designBriefs: [],
  renderRequests: [],
  renderResults: []
};

const identifiers = (template: "STRAIGHT" | "L_SHAPED" | "U_SHAPED") =>
  createStairIdentifiers(template, (() => {
    let next = 0;
    return () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`;
  })());

describe("stair template authoring", () => {
  it.each([0, 90, 180, 270, 37])(
    "maps %d° from Project +X without changing first-Flight run",
    (rotation) => {
      const direction = angleToProjectPlanVector(rotation)!;
      const run = 16 * 28;
      const proposal = createStairProposal({
        project,
        owningLevelId: "ground",
        destination: { toLevelId: "upper" },
        template: "STRAIGHT",
        parameters: { kind: "STRAIGHT", width: 90, flightStepCount: 16, treadDepth: 28 },
        start: { x: 25, z: -40 },
        control: { x: 25 + direction.x * run, z: -40 + direction.z * run },
        identifiers: identifiers("STRAIGHT")
      })!;
      const flight = proposal.staircase.flights[0]!;
      expect(Math.hypot(flight.end.x - flight.start.x, flight.end.z - flight.start.z)).toBeCloseTo(run);
      expect((flight.end.x - flight.start.x) / run).toBeCloseTo(direction.x);
      expect((flight.end.z - flight.start.z) / run).toBeCloseTo(direction.z);
      expect(getStaircaseRotation(proposal.staircase)).toBeCloseTo(rotation === 270 ? -90 : rotation);
    }
  );

  it.each(["STRAIGHT", "L_SHAPED", "U_SHAPED"] as const)(
    "rotates the complete %s authoring frame coherently at arbitrary angles",
    (template) => {
      const parameters = template === "STRAIGHT"
        ? { kind: "STRAIGHT" as const, width: 90, flightStepCount: 16, treadDepth: 28 }
        : { kind: "TWO_FLIGHT" as const, width: 90, firstFlightStepCount: 7, secondFlightStepCount: 10, treadDepth: 28 };
      const start = { x: 80, z: -30 };
      const run = (parameters.kind === "STRAIGHT" ? parameters.flightStepCount : parameters.firstFlightStepCount) * parameters.treadDepth;
      const make = (rotation: number, turnDirection: "LEFT" | "RIGHT" = "LEFT") => {
        const direction = angleToProjectPlanVector(rotation)!;
        return createStairProposal({ project, owningLevelId: "ground", destination: { toLevelId: "upper" },
          template, parameters, start,
          control: { x: start.x + direction.x * run, z: start.z + direction.z * run },
          turnDirection, identifiers: identifiers(template) })!.staircase;
      };
      const baseline = make(0);
      for (const rotation of [90, 37]) {
        const actual = make(rotation);
        const expected = rotateStaircaseInPlan(baseline, start, rotation)!;
        expect(actual.flights.map((flight) => flight.stepCount)).toEqual(baseline.flights.map((flight) => flight.stepCount));
        expect(actual.flights.map((flight) => [flight.startElevation, flight.endElevation])).toEqual(
          baseline.flights.map((flight) => [flight.startElevation, flight.endElevation])
        );
        actual.flights.forEach((flight, index) => {
          expect(flight.start.x).toBeCloseTo(expected.flights[index]!.start.x);
          expect(flight.start.z).toBeCloseTo(expected.flights[index]!.start.z);
          expect(flight.end.x).toBeCloseTo(expected.flights[index]!.end.x);
          expect(flight.end.z).toBeCloseTo(expected.flights[index]!.end.z);
        });
        actual.landings.forEach((landing, index) => {
          expect(landing.position.x).toBeCloseTo(expected.landings[index]!.position.x);
          expect(landing.position.z).toBeCloseTo(expected.landings[index]!.position.z);
        });
      }
      if (template === "L_SHAPED") {
        const left = make(37, "LEFT");
        const right = make(37, "RIGHT");
        const first = left.flights[0]!;
        const direction = angleToProjectPlanVector(37)!;
        const leftDelta = { x: left.flights[1]!.end.x - first.end.x, z: left.flights[1]!.end.z - first.end.z };
        const rightDelta = { x: right.flights[1]!.end.x - first.end.x, z: right.flights[1]!.end.z - first.end.z };
        expect(direction.x * leftDelta.z - direction.z * leftDelta.x).toBeGreaterThan(0);
        expect(direction.x * rightDelta.z - direction.z * rightDelta.x).toBeLessThan(0);
      }
    }
  );

  it("derives a same-Level elevated Room connection without a special entity", () => {
    const parameters = getSuggestedStairParameters(project, "ground", {
      toLevelId: "ground",
      toRoomId: "elevated-room"
    });
    const proposal = createStairProposal({
      project,
      owningLevelId: "ground",
      destination: { toLevelId: "ground", toRoomId: "elevated-room" },
      template: "STRAIGHT",
      parameters,
      start: { x: 0, z: 0 },
      control: { x: 400, z: 0 },
      identifiers: identifiers("STRAIGHT")
    });

    expect(proposal).toMatchObject({ valid: true, totalRise: 180 });
    expect(proposal?.staircase).toMatchObject({
      fromLevelId: "ground",
      toLevelId: "ground",
      toRoomId: "elevated-room"
    });
    expect(proposal?.staircase.flights[0]).toMatchObject({ startElevation: 0, endElevation: 180 });
  });

  it("keeps a short Straight preview visible but invalid until its run fits", () => {
    const options = {
      project,
      owningLevelId: "ground",
      destination: { toLevelId: "upper" },
      template: "STRAIGHT" as const,
      parameters: { kind: "STRAIGHT" as const, width: 90, flightStepCount: 16, treadDepth: 28 },
      start: { x: 0, z: 0 },
      identifiers: identifiers("STRAIGHT")
    };
    expect(createStairProposal({ ...options, control: { x: 300, z: 0 } })).toMatchObject({
      valid: false,
      invalidReason: "TOO_SHORT"
    });
    expect(createStairProposal({ ...options, control: { x: 500, z: 0 } })).toMatchObject({ valid: true });
  });

  it.each([
    ["L_SHAPED" as const, 2, 1],
    ["U_SHAPED" as const, 2, 1]
  ])("starts %s as one complete parametric aggregate", (template, flightCount, landingCount) => {
    const proposal = createStairProposal({
      project,
      owningLevelId: "ground",
      destination: { toLevelId: "upper" },
      template,
      parameters: { kind: "TWO_FLIGHT", width: 90, firstFlightStepCount: 8, secondFlightStepCount: 8, treadDepth: 28 },
      start: { x: 0, z: 0 },
      control: { x: 300, z: 0 },
      identifiers: identifiers(template)
    });
    expect(proposal?.valid).toBe(true);
    expect(proposal?.staircase.flights).toHaveLength(flightCount);
    expect(proposal?.staircase.landings).toHaveLength(landingCount);
    expect(inferStairTemplate(proposal!.staircase)).toBe(template);
  });

  it("updates width, steps, and tread depth while preserving aggregate part IDs", () => {
    const proposal = createStairProposal({
      project,
      owningLevelId: "ground",
      destination: { toLevelId: "upper" },
      template: "L_SHAPED",
      parameters: { kind: "TWO_FLIGHT", width: 90, firstFlightStepCount: 8, secondFlightStepCount: 8, treadDepth: 28 },
      start: { x: 0, z: 0 },
      control: { x: 300, z: 0 },
      identifiers: identifiers("L_SHAPED")
    })!;
    const updated = updateStaircaseParameters(proposal.staircase, {
      width: 100,
      firstFlightStepCount: 4,
      secondFlightStepCount: 14,
      treadDepth: 30
    })!;

    expect(updated.id).toBe(proposal.staircase.id);
    expect(updated.flights.map((flight) => flight.id)).toEqual(proposal.staircase.flights.map((flight) => flight.id));
    expect(measureStaircase(updated)).toMatchObject({ width: 100, stepCount: 18, treadDepth: 30 });
    expect(updated.flights.map((flight) => flight.stepCount)).toEqual([4, 14]);
    expect(updated.flights[0]?.endElevation).toBe(updated.landings[0]?.elevation);
    expect(updated.flights[1]?.startElevation).toBe(updated.landings[0]?.elevation);
    expect(findProjectStaircase({ staircases: [updated] }, updated.landings[0]?.id)?.staircase.id).toBe(updated.id);
  });

  it.each(["L_SHAPED", "U_SHAPED"] as const)("persists asymmetric %s Flight counts with one exact transition", (template) => {
    const proposal = createStairProposal({
      project,
      owningLevelId: "ground",
      destination: { toLevelId: "upper" },
      template,
      parameters: { kind: "TWO_FLIGHT", width: 90, firstFlightStepCount: 4, secondFlightStepCount: 13, treadDepth: 28 },
      start: { x: 0, z: 0 },
      control: { x: 140, z: 0 },
      identifiers: identifiers(template)
    })!;

    expect(proposal.valid).toBe(true);
    expect(proposal.staircase.flights.map((flight) => flight.stepCount)).toEqual([4, 13]);
    const transition = 300 * 4 / 17;
    expect(proposal.staircase.flights[0]?.endElevation).toBe(transition);
    expect(proposal.staircase.flights[1]?.startElevation).toBe(transition);
    expect(proposal.staircase.landings[0]?.elevation).toBe(transition);
  });

  it("mirrors an L-shaped proposal without changing its vertical connection", () => {
    const options = {
      project,
      owningLevelId: "ground",
      destination: { toLevelId: "upper" },
      template: "L_SHAPED" as const,
      parameters: { kind: "TWO_FLIGHT" as const, width: 90, firstFlightStepCount: 8, secondFlightStepCount: 8, treadDepth: 28 },
      start: { x: 50, z: 20 },
      control: { x: 274, z: 20 },
      identifiers: identifiers("L_SHAPED")
    };
    const left = createStairProposal({ ...options, turnDirection: "LEFT" })!;
    const right = createStairProposal({ ...options, turnDirection: "RIGHT" })!;
    expect(left.staircase.flights[1]!.end.z - 20).toBe(-(right.staircase.flights[1]!.end.z - 20));
    expect(left.staircase.flights.map((flight) => flight.stepCount)).toEqual(
      right.staircase.flights.map((flight) => flight.stepCount)
    );
    expect(left.staircase.width).toBe(right.staircase.width);
    expect(left.staircase.flights.map((flight) => [flight.startElevation, flight.endElevation])).toEqual(
      right.staircase.flights.map((flight) => [flight.startElevation, flight.endElevation])
    );
    expect(left.staircase.toLevelId).toBe(right.staircase.toLevelId);
  });

  it("translates every Flight and Landing rigidly while preserving elevation", () => {
    const proposal = createStairProposal({
      project,
      owningLevelId: "ground",
      destination: { toLevelId: "upper" },
      template: "U_SHAPED",
      parameters: { kind: "TWO_FLIGHT", width: 90, firstFlightStepCount: 8, secondFlightStepCount: 8, treadDepth: 28 },
      start: { x: 0, z: 0 },
      control: { x: 224, z: 0 },
      identifiers: identifiers("U_SHAPED")
    })!;
    const moved = translateStaircase(proposal.staircase, { x: 125, z: -40 });
    expect(moved.flights.map((flight) => flight.start)).toEqual(
      proposal.staircase.flights.map((flight) => ({ x: flight.start.x + 125, z: flight.start.z - 40 }))
    );
    expect(moved.landings.map((landing) => landing.position)).toEqual(
      proposal.staircase.landings.map((landing) => ({ x: landing.position.x + 125, z: landing.position.z - 40 }))
    );
    expect(moved.flights.map((flight) => [flight.startElevation, flight.endElevation])).toEqual(
      proposal.staircase.flights.map((flight) => [flight.startElevation, flight.endElevation])
    );
  });

  it("rigidly rotates a committed Stair around its first Flight start", () => {
    const staircase = {
      ...createStairProposal({ project, owningLevelId: "ground", destination: { toLevelId: "upper" },
        fromRoomId: undefined, template: "U_SHAPED",
        parameters: { kind: "TWO_FLIGHT" as const, width: 90, firstFlightStepCount: 8, secondFlightStepCount: 8, treadDepth: 28 },
        start: { x: 50, z: 25 }, control: { x: 274, z: 25 }, identifiers: identifiers("U_SHAPED") })!.staircase,
      fromRoomId: "source-room",
      toRoomId: "target-room"
    };
    const rotated = rotateStaircaseInPlan(staircase, staircase.flights[0]!.start, 37)!;
    const selectedEdit = updateStaircaseParameters(staircase, { rotation: 37 })!;
    expect(selectedEdit).toEqual(rotated);
    expect(rotated.id).toBe(staircase.id);
    expect(rotated.fromRoomId).toBe("source-room");
    expect(rotated.toRoomId).toBe("target-room");
    expect(rotated.flights.map((flight) => flight.id)).toEqual(staircase.flights.map((flight) => flight.id));
    expect(rotated.landings.map((landing) => landing.id)).toEqual(staircase.landings.map((landing) => landing.id));
    expect(rotated.flights.map((flight) => [flight.startElevation, flight.endElevation])).toEqual(
      staircase.flights.map((flight) => [flight.startElevation, flight.endElevation])
    );
    const allPoints = (value: Staircase) => [
      ...value.flights.flatMap((flight) => [flight.start, flight.end]),
      ...value.landings.map((landing) => landing.position)
    ];
    const original = allPoints(staircase);
    const transformed = allPoints(rotated);
    for (let first = 0; first < original.length; first += 1) {
      for (let second = 0; second < original.length; second += 1) {
        expect(Math.hypot(
          transformed[first]!.x - transformed[second]!.x,
          transformed[first]!.z - transformed[second]!.z
        )).toBeCloseTo(Math.hypot(
          original[first]!.x - original[second]!.x,
          original[first]!.z - original[second]!.z
        ));
      }
    }
  });

  it("derives source and destination floor elevations once across Rooms and Levels", () => {
    const connectionProject = projectWithStackedRooms();
    expect(getStairConnectionElevations(connectionProject, "ground", { toLevelId: "ground", toRoomId: "room-b" }, "room-a"))
      .toEqual({ startElevation: 0, endElevation: 220, totalRise: 220 });
    connectionProject.building.levels[0]!.rooms[0]!.elevation = 100;
    connectionProject.building.levels[0]!.rooms[1]!.elevation = 300;
    expect(getStairConnectionElevations(connectionProject, "ground", { toLevelId: "ground", toRoomId: "room-b" }, "room-a"))
      .toEqual({ startElevation: 100, endElevation: 300, totalRise: 200 });
    expect(getStairConnectionElevations(connectionProject, "ground", { toLevelId: "upper", toRoomId: "upper-room" }, "room-a"))
      .toEqual({ startElevation: 100, endElevation: 420, totalRise: 320 });
  });

  it("surfaces stacked source Rooms instead of guessing one", () => {
    const connectionProject = projectWithStackedRooms();
    const candidates = getStairSourceRoomCandidates(connectionProject, "ground", { x: 50, z: 50 });
    expect(candidates.map((candidate) => candidate.roomId)).toEqual(["room-a", "room-b"]);
    const proposal = createStairProposal({ project: connectionProject, owningLevelId: "ground",
      destination: { toLevelId: "upper", toRoomId: "upper-room" }, sourceRoomAmbiguous: true,
      template: "STRAIGHT", parameters: { kind: "STRAIGHT", width: 90, flightStepCount: 16, treadDepth: 28 },
      start: { x: 50, z: 50 }, control: { x: 498, z: 50 }, identifiers: identifiers("STRAIGHT") })!;
    expect(proposal).toMatchObject({ valid: false, invalidReason: "AMBIGUOUS_SOURCE" });
    const explicit = createStairProposal({ project: connectionProject, owningLevelId: "ground",
      destination: { toLevelId: "upper", toRoomId: "upper-room" }, fromRoomId: "room-b",
      template: "STRAIGHT", parameters: { kind: "STRAIGHT", width: 90, flightStepCount: 16, treadDepth: 28 },
      start: { x: 50, z: 50 }, control: { x: 498, z: 50 }, identifiers: identifiers("STRAIGHT") })!;
    expect(explicit.staircase.fromRoomId).toBe("room-b");
    expect(explicit.staircase.flights[0]!.startElevation).toBe(220);
  });
});

function projectWithStackedRooms(): Project {
  const square = [
    { x: 0, z: 0 }, { x: 100, z: 0 }, { x: 100, z: 100 }, { x: 0, z: 100 }
  ];
  const boundary = square.map((start, index) => ({
    kind: "FREE" as const,
    start,
    end: square[(index + 1) % square.length]!
  }));
  const result = structuredClone(project);
  result.building.levels[0]!.rooms = [
    { id: "room-a", name: "Room A", type: "STUDIO", elevation: 0, boundary },
    { id: "room-b", name: "Room B", type: "STUDIO", elevation: 220, boundary }
  ];
  result.building.levels[1]!.rooms = [
    { id: "upper-room", name: "Upper Room", type: "STUDIO", elevation: 120, boundary }
  ];
  return result;
}
