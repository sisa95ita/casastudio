import {
  IdentifierSchema,
  type Level,
  type Point2D,
  type Project,
  type StairFlight,
  type StairLanding,
  type Staircase
} from "@casastudio/schema";

/** Initial authoring layouts that all materialize as canonical Staircase parts. */
export type StairTemplate = "STRAIGHT" | "L_SHAPED" | "U_SHAPED";

type StairDimensions = {
  readonly width: number;
  readonly treadDepth: number;
};

/** Assisted inputs for a one-Flight Staircase. */
export type StraightStairAuthoringParameters = StairDimensions & {
  readonly kind: "STRAIGHT";
  readonly flightStepCount: number;
};

/** Assisted inputs for a Staircase with two independently configurable Flights. */
export type TwoFlightStairAuthoringParameters = StairDimensions & {
  readonly kind: "TWO_FLIGHT";
  readonly firstFlightStepCount: number;
  readonly secondFlightStepCount: number;
};

/** Template-semantic assisted Stair inputs expressed in the Project length unit. */
export type StairAuthoringParameters =
  | StraightStairAuthoringParameters
  | TwoFlightStairAuthoringParameters;

/** Editable assisted values for an existing canonical Staircase. */
export type StairParameterChanges = {
  readonly width?: number;
  readonly treadDepth?: number;
  readonly flightStepCount?: number;
  readonly firstFlightStepCount?: number;
  readonly secondFlightStepCount?: number;
};

/** Connection-first destination chosen before spatial placement starts. */
export type StairDestination = {
  readonly toLevelId: string;
  readonly toRoomId?: string;
};

/** Complete transient canonical proposal plus product-level validity feedback. */
export type StairProposal = {
  readonly staircase: Staircase;
  readonly template: StairTemplate;
  readonly valid: boolean;
  readonly invalidReason?: "NO_RISE" | "TOO_SHORT" | "INVALID_PARAMETERS";
  readonly totalRise: number;
  readonly totalRun: number;
  readonly riserHeight: number;
  readonly treadDepth: number;
  readonly adjustmentPoint: Point2D;
};

/** Practical residential defaults; rise-dependent step count is resolved per destination. */
export const defaultStairAuthoringParameters: StairAuthoringParameters = Object.freeze({
  kind: "STRAIGHT",
  width: 90,
  flightStepCount: 16,
  treadDepth: 28
});

type StairIdentifiers = {
  readonly staircaseId: string;
  readonly flightIds: readonly string[];
  readonly landingIds: readonly string[];
};

/** Creates collision-resistant IDs for one complete semantic creation command. */
export function createStairIdentifiers(
  template: StairTemplate,
  randomUuid: () => string = () => crypto.randomUUID()
): StairIdentifiers {
  const partCount = template === "STRAIGHT" ? 1 : 2;
  return {
    staircaseId: identifier("staircase", randomUuid),
    flightIds: Array.from({ length: partCount }, () => identifier("stair-flight", randomUuid)),
    landingIds: template === "STRAIGHT" ? [] : [identifier("stair-landing", randomUuid)]
  };
}

/** Suggests a step count from the selected semantic destination. */
export function getSuggestedStairParameters(
  project: Project,
  owningLevelId: string,
  destination: StairDestination,
  template: StairTemplate = "STRAIGHT"
): StairAuthoringParameters {
  const rise = getStairConnectionElevations(project, owningLevelId, destination);
  const totalStepCount = rise ? Math.max(2, Math.ceil(rise.totalRise / 18)) : 16;
  if (template === "STRAIGHT") {
    return {
      kind: "STRAIGHT",
      width: defaultStairAuthoringParameters.width,
      treadDepth: defaultStairAuthoringParameters.treadDepth,
      flightStepCount: totalStepCount
    };
  }
  const firstFlightStepCount = Math.floor(totalStepCount / 2);
  return {
    kind: "TWO_FLIGHT",
    width: defaultStairAuthoringParameters.width,
    treadDepth: defaultStairAuthoringParameters.treadDepth,
    firstFlightStepCount,
    secondFlightStepCount: totalStepCount - firstFlightStepCount
  };
}

/** Builds a complete Straight, L, or U template without adding preview data to the Project. */
export function createStairProposal(options: {
  readonly project: Project;
  readonly owningLevelId: string;
  readonly destination: StairDestination;
  readonly template: StairTemplate;
  readonly parameters: StairAuthoringParameters;
  readonly start: Point2D;
  readonly control: Point2D;
  readonly turnDirection?: "LEFT" | "RIGHT";
  readonly identifiers: StairIdentifiers;
  readonly name?: string;
}): StairProposal | undefined {
  const elevations = getStairConnectionElevations(
    options.project,
    options.owningLevelId,
    options.destination
  );
  if (!elevations) return undefined;

  const requestedWidth = options.parameters.width;
  const { treadDepth } = options.parameters;
  const width = Number.isFinite(requestedWidth) && requestedWidth > 0
    ? requestedWidth
    : defaultStairAuthoringParameters.width;
  const requestedStepCounts = getParameterStepCounts(options.template, options.parameters);
  const stepCounts = requestedStepCounts.map((count) =>
    Number.isInteger(count) && count > 0 ? count : 1
  );
  const totalStepCount = stepCounts.reduce((sum, count) => sum + count, 0);
  const parametersValid = Number.isFinite(requestedWidth) && requestedWidth > 0 &&
    parametersMatchTemplate(options.template, options.parameters) &&
    requestedStepCounts.every((count) => Number.isInteger(count) && count > 0) &&
    totalStepCount > 1 &&
    Number.isFinite(treadDepth) && treadDepth > 0;
  const delta = subtract(options.control, options.start);
  const controlLength = Math.hypot(delta.x, delta.z);
  const direction = controlLength > 0
    ? { x: delta.x / controlLength, z: delta.z / controlLength }
    : { x: 1, z: 0 };
  const turnSign = options.turnDirection === "RIGHT" ? -1 : 1;
  const side = { x: -direction.z * turnSign, z: direction.x * turnSign };
  const firstSteps = stepCounts[0] ?? 1;
  const secondSteps = stepCounts[1] ?? 0;
  const transitionElevation = elevations.startElevation +
    elevations.totalRise * (firstSteps / totalStepCount);
  const firstEnd = add(options.start, scale(direction, controlLength));
  const flights: StairFlight[] = [];
  const landings: StairLanding[] = [];

  if (options.template === "STRAIGHT") {
    flights.push(createFlight(
      options.identifiers.flightIds[0]!,
      options.start,
      firstEnd,
      width,
      firstSteps,
      elevations.startElevation,
      elevations.endElevation
    ));
  } else if (options.template === "L_SHAPED") {
    const secondLength = controlLength * (secondSteps / firstSteps);
    const secondEnd = add(firstEnd, scale(side, secondLength));
    flights.push(
      createFlight(options.identifiers.flightIds[0]!, options.start, firstEnd, width, firstSteps, elevations.startElevation, transitionElevation),
      createFlight(options.identifiers.flightIds[1]!, firstEnd, secondEnd, width, secondSteps, transitionElevation, elevations.endElevation)
    );
    landings.push(createLanding(
      options.identifiers.landingIds[0]!,
      firstEnd,
      width,
      width,
      transitionElevation
    ));
  } else {
    const offset = width;
    const secondStart = add(firstEnd, scale(side, offset));
    const secondEnd = add(secondStart, scale(direction, -controlLength * (secondSteps / firstSteps)));
    flights.push(
      createFlight(options.identifiers.flightIds[0]!, options.start, firstEnd, width, firstSteps, elevations.startElevation, transitionElevation),
      createFlight(options.identifiers.flightIds[1]!, secondStart, secondEnd, width, secondSteps, transitionElevation, elevations.endElevation)
    );
    landings.push(createLanding(
      options.identifiers.landingIds[0]!,
      midpoint(firstEnd, secondStart),
      width * 2,
      width,
      transitionElevation
    ));
  }

  const totalRun = flights.reduce((sum, flight) => sum + distance(flight.start, flight.end), 0);
  const flightRunsValid = flights.every((flight) =>
    distance(flight.start, flight.end) + 1e-7 >= flight.stepCount * treadDepth
  );
  const invalidReason = !parametersValid
    ? "INVALID_PARAMETERS" as const
    : elevations.totalRise <= 0
      ? "NO_RISE" as const
      : !flightRunsValid
        ? "TOO_SHORT" as const
        : undefined;
  const staircase: Staircase = {
    id: options.identifiers.staircaseId,
    name: options.name ?? "Staircase",
    fromLevelId: options.owningLevelId,
    toLevelId: options.destination.toLevelId,
    ...(options.destination.toRoomId ? { toRoomId: options.destination.toRoomId } : {}),
    width,
    flights,
    landings
  };

  return {
    staircase,
    template: options.template,
    valid: invalidReason === undefined,
    invalidReason,
    totalRise: elevations.totalRise,
    totalRun,
    riserHeight: elevations.totalRise / totalStepCount,
    treadDepth: totalRun / totalStepCount,
    adjustmentPoint: firstEnd
  };
}

/** Infers the authoring layout from canonical ordered Flights after reload. */
export function inferStairTemplate(staircase: Staircase): StairTemplate {
  if (staircase.flights.length < 2) return "STRAIGHT";
  const first = unitDirection(staircase.flights[0]!);
  const second = unitDirection(staircase.flights[1]!);
  return first.x * second.x + first.z * second.z < -0.7 ? "U_SHAPED" : "L_SHAPED";
}

/** Returns coherent Inspector metrics from one canonical Staircase aggregate. */
export function measureStaircase(staircase: Staircase) {
  const flightStepCounts = staircase.flights.map((flight) => flight.stepCount);
  const stepCount = flightStepCounts.reduce((sum, count) => sum + count, 0);
  const totalRun = staircase.flights.reduce((sum, flight) => sum + distance(flight.start, flight.end), 0);
  const startElevation = staircase.flights[0]?.startElevation ?? 0;
  const endElevation = staircase.flights.at(-1)?.endElevation ?? startElevation;
  const totalRise = endElevation - startElevation;
  return {
    width: staircase.width,
    stepCount,
    flightStepCounts,
    startElevation,
    endElevation,
    totalRise,
    totalRun,
    riserHeight: stepCount > 0 ? totalRise / stepCount : 0,
    treadDepth: stepCount > 0 ? totalRun / stepCount : 0
  };
}

/** Reconstructs template-semantic assisted inputs from canonical ordered Flights. */
export function getStairAuthoringParameters(staircase: Staircase): StairAuthoringParameters {
  const metrics = measureStaircase(staircase);
  if (inferStairTemplate(staircase) === "STRAIGHT") {
    return {
      kind: "STRAIGHT",
      width: metrics.width,
      flightStepCount: metrics.flightStepCounts[0] ?? 0,
      treadDepth: metrics.treadDepth
    };
  }
  return {
    kind: "TWO_FLIGHT",
    width: metrics.width,
    firstFlightStepCount: metrics.flightStepCounts[0] ?? 0,
    secondFlightStepCount: metrics.flightStepCounts[1] ?? 0,
    treadDepth: metrics.treadDepth
  };
}

/** Applies assisted numeric controls while preserving canonical part identity and elevations. */
export function updateStaircaseParameters(
  staircase: Staircase,
  changes: StairParameterChanges
): Staircase | undefined {
  const metrics = measureStaircase(staircase);
  const width = changes.width ?? staircase.width;
  const treadDepth = changes.treadDepth ?? metrics.treadDepth;
  const template = inferStairTemplate(staircase);
  const nextSteps = template === "STRAIGHT"
    ? [changes.flightStepCount ?? metrics.flightStepCounts[0] ?? 0]
    : [
        changes.firstFlightStepCount ?? metrics.flightStepCounts[0] ?? 0,
        changes.secondFlightStepCount ?? metrics.flightStepCounts[1] ?? 0
      ];
  const totalStepCount = nextSteps.reduce((sum, count) => sum + count, 0);
  if (!Number.isFinite(width) || width <= 0 || totalStepCount < 2 ||
      nextSteps.some((count) => !Number.isInteger(count) || count <= 0) ||
      !Number.isFinite(treadDepth) || treadDepth <= 0 || staircase.flights.length === 0) return undefined;

  const startElevation = metrics.startElevation;
  const first = staircase.flights[0]!;
  const firstDirection = unitDirection(first);
  const firstEnd = add(first.start, scale(firstDirection, nextSteps[0]! * treadDepth));
  const transitionElevation = startElevation + metrics.totalRise * (nextSteps[0]! / totalStepCount);
  const flights: StairFlight[] = [{
    ...first,
    end: firstEnd,
    width,
    stepCount: nextSteps[0]!,
    startElevation,
    endElevation: template === "STRAIGHT" ? metrics.endElevation : transitionElevation
  }];
  if (template !== "STRAIGHT") {
    const originalSecond = staircase.flights[1];
    if (!originalSecond) return undefined;
    const secondDirection = unitDirection(originalSecond);
    const secondStart = template === "L_SHAPED"
      ? firstEnd
      : add(firstEnd, scale(unitDirectionBetween(first.end, originalSecond.start), width));
    flights.push({
      ...originalSecond,
      start: secondStart,
      end: add(secondStart, scale(secondDirection, nextSteps[1]! * treadDepth)),
      width,
      stepCount: nextSteps[1]!,
      startElevation: transitionElevation,
      endElevation: metrics.endElevation
    });
  }
  const landings = staircase.landings.map((landing, index) => {
    const firstFlight = flights[Math.min(index, flights.length - 1)]!;
    const secondFlight = flights[Math.min(index + 1, flights.length - 1)]!;
    return {
      ...landing,
      position: template === "U_SHAPED"
        ? midpoint(firstFlight.end, secondFlight.start)
        : firstFlight.end,
      width: template === "U_SHAPED" ? width * 2 : width,
      depth: width,
      elevation: firstFlight.endElevation
    };
  });
  return { ...staircase, width, flights, landings };
}

/** Resolves the exact absolute floor elevations for cross- or same-Level connections. */
export function getStairConnectionElevations(
  project: Project,
  owningLevelId: string,
  destination: StairDestination
): { readonly startElevation: number; readonly endElevation: number; readonly totalRise: number } | undefined {
  const fromLevel = project.building.levels.find((level) => level.id === owningLevelId);
  const toLevel = project.building.levels.find((level) => level.id === destination.toLevelId);
  if (!fromLevel || !toLevel) return undefined;
  const toRoom = destination.toRoomId
    ? toLevel.rooms.find((room) => room.id === destination.toRoomId)
    : undefined;
  if (destination.toRoomId && !toRoom) return undefined;
  const startElevation = fromLevel.elevation;
  const endElevation = toLevel.elevation + (toRoom?.elevation ?? 0);
  return { startElevation, endElevation, totalRise: endElevation - startElevation };
}

/** Finds a Staircase or owned part by canonical ID without promoting parts to roots. */
export function findProjectStaircase(
  level: Pick<Level, "staircases"> | undefined,
  geometryId: string | undefined
): { readonly staircase: Staircase; readonly part?: StairFlight | StairLanding } | undefined {
  if (!level || !geometryId) return undefined;
  for (const staircase of level.staircases) {
    if (staircase.id === geometryId) return { staircase };
    const flight = staircase.flights.find((candidate) => candidate.id === geometryId);
    if (flight) return { staircase, part: flight };
    const landing = staircase.landings.find((candidate) => candidate.id === geometryId);
    if (landing) return { staircase, part: landing };
  }
  return undefined;
}

/** Translates every plan-space part of a canonical Staircase by one rigid delta. */
export function translateStaircase(
  staircase: Staircase,
  delta: Point2D
): Staircase {
  return {
    ...staircase,
    flights: staircase.flights.map((flight) => ({
      ...flight,
      start: add(flight.start, delta),
      end: add(flight.end, delta)
    })),
    landings: staircase.landings.map((landing) => ({
      ...landing,
      position: add(landing.position, delta)
    }))
  };
}

function createFlight(
  id: string,
  start: Point2D,
  end: Point2D,
  width: number,
  stepCount: number,
  startElevation: number,
  endElevation: number
): StairFlight {
  return { id, start: { ...start }, end: { ...end }, width, stepCount, startElevation, endElevation };
}

function createLanding(
  id: string,
  position: Point2D,
  width: number,
  depth: number,
  elevation: number
): StairLanding {
  return { id, position: { ...position }, width, depth, elevation };
}

function parametersMatchTemplate(
  template: StairTemplate,
  parameters: StairAuthoringParameters
): boolean {
  return template === "STRAIGHT"
    ? parameters.kind === "STRAIGHT"
    : parameters.kind === "TWO_FLIGHT";
}

function getParameterStepCounts(
  template: StairTemplate,
  parameters: StairAuthoringParameters
): readonly number[] {
  if (template === "STRAIGHT") {
    return [parameters.kind === "STRAIGHT" ? parameters.flightStepCount : 0];
  }
  return parameters.kind === "TWO_FLIGHT"
    ? [parameters.firstFlightStepCount, parameters.secondFlightStepCount]
    : [0, 0];
}

function identifier(prefix: string, randomUuid: () => string): string {
  return IdentifierSchema.parse(`${prefix}-${randomUuid().toLowerCase()}`);
}

function distance(start: Point2D, end: Point2D): number {
  return Math.hypot(end.x - start.x, end.z - start.z);
}

function unitDirection(flight: Pick<StairFlight, "start" | "end">): Point2D {
  const length = distance(flight.start, flight.end);
  return length > 0
    ? { x: (flight.end.x - flight.start.x) / length, z: (flight.end.z - flight.start.z) / length }
    : { x: 1, z: 0 };
}

function unitDirectionBetween(start: Point2D, end: Point2D): Point2D {
  return unitDirection({ start, end });
}

function add(first: Point2D, second: Point2D): Point2D {
  return { x: first.x + second.x, z: first.z + second.z };
}

function subtract(first: Point2D, second: Point2D): Point2D {
  return { x: first.x - second.x, z: first.z - second.z };
}

function scale(point: Point2D, multiplier: number): Point2D {
  return { x: point.x * multiplier, z: point.z * multiplier };
}

function midpoint(first: Point2D, second: Point2D): Point2D {
  return { x: (first.x + second.x) / 2, z: (first.z + second.z) / 2 };
}
