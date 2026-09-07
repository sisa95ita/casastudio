import { describe, expect, it } from "vitest";
import type { Project } from "@casastudio/schema";

import {
  createStairIdentifiers,
  createStairProposal,
  findProjectStaircase,
  getSuggestedStairParameters,
  inferStairTemplate,
  measureStaircase,
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
});
