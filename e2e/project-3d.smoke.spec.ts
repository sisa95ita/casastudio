import {
  expect,
  test,
  type APIRequestContext,
  type ConsoleMessage,
  type Locator,
  type Page
} from "@playwright/test";
import type { Project, Wall } from "@casastudio/schema";

const apiBaseUrl = process.env.CASASTUDIO_E2E_API_URL ?? "http://localhost:3000";

test("renders and controls a clean multi-Level Project in the 3D workspace", async ({
  page,
  request
}) => {
  test.setTimeout(240_000);
  const demoPassword = process.env.CASASTUDIO_KEYCLOAK_DEMO_PASSWORD;
  if (!demoPassword) {
    throw new Error("CASASTUDIO_KEYCLOAK_DEMO_PASSWORD is required.");
  }

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  let authorization = "";
  let projectId = "";
  page.on("console", (message: ConsoleMessage) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (outgoing) => {
    if (outgoing.url().startsWith(apiBaseUrl)) {
      authorization ||= outgoing.headers().authorization ?? "";
    }
  });

  try {
    await login(page, demoPassword);
    const projectName = `3D Foundation ${Date.now()}`;
    await page.getByRole("button", { name: "New Project" }).click();
    await page.getByLabel("Project name").fill(projectName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: projectName, level: 1 })).toBeVisible();
    projectId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
    expect(projectId).not.toBe("");

    const plan = page.locator(
      'svg[aria-labelledby="geometry-svg-title geometry-svg-description"]'
    );
    await expect(page.getByRole("button", { name: "2D workspace" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await page.getByRole("button", { name: "Edit plan" }).click();
    await createRoomShape(page, plan, "L-shape", {
      width: "600",
      depth: "420",
      notchWidth: "160",
      notchDepth: "140"
    });

    await page.getByRole("button", { name: /^Level:/ }).click();
    await page.getByRole("menuitem", { name: "Add level" }).click();
    const levelDialog = page.getByRole("dialog", { name: "Create level" });
    await levelDialog.getByLabel("Level name").fill("Upper Level");
    await levelDialog.getByLabel("Elevation (cm)").fill("320");
    await levelDialog.getByRole("button", { name: "Create Level" }).click();
    await expect(page.getByRole("button", { name: "Level: Upper Level" })).toBeVisible();
    await createRoomShape(page, plan, "Rectangle", {
      width: "480",
      depth: "360"
    });

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Edit plan" })).toBeVisible();
    await seedArchitectural3DProject(request, authorization, projectId);
    await page.reload();
    await expect(page.getByRole("heading", { name: projectName, level: 1 })).toBeVisible();
    const before3D = await getProject(request, authorization, projectId);
    await plan.screenshot({ path: test.info().outputPath("asymmetric-2d-plan.png") });

    await page.getByRole("button", { name: "3D workspace" }).click();
    const workspace = page.getByTestId("project-3d-workspace");
    await expect(workspace).toBeVisible();
    await expect(workspace).toHaveAttribute("data-renderer-status", "ready");
    await expect(page.getByRole("button", { name: "Edit in 2D" })).toBeVisible();
    await page.getByRole("button", { name: "Edit in 2D" }).click();
    await expect(page.getByRole("toolbar", { name: "Editing tools" })).toBeVisible();
    await expect(page.getByRole("button", { name: "3D workspace" })).toHaveCount(0);
    await page.getByRole("button", { name: "Back to project" }).click();
    await expect(page.getByRole("button", { name: "Edit plan" })).toBeVisible();
    await page.getByRole("button", { name: "3D workspace" }).click();
    await expect(workspace).toHaveAttribute("data-renderer-status", "ready");
    await expect(workspace).toHaveAttribute("data-visible-level-elevations", "0,3.2");
    await expect(workspace).toHaveAttribute("data-architectural-opening-kinds", /DOOR/);
    await expect(workspace).toHaveAttribute("data-architectural-opening-kinds", /WINDOW/);
    await expect(workspace).toHaveAttribute("data-architectural-opening-kinds", /OPENING/);
    await expect(workspace).toHaveAttribute("data-architectural-door-count", "2");
    await expect(workspace).toHaveAttribute("data-architectural-window-count", "2");
    await expect(workspace).toHaveAttribute("data-architectural-wall-opening-count", "1");
    const doorPoses = JSON.parse(
      (await workspace.getAttribute("data-architectural-door-poses")) ?? "[]"
    ) as readonly {
      readonly id: string;
      readonly hingeSide: "START" | "END";
      readonly swingSide: "LEFT" | "RIGHT";
      readonly hinge: { readonly x: number; readonly z: number };
      readonly leafEnd: { readonly x: number; readonly z: number };
    }[];
    expect(doorPoses).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "e2e-door-start-left",
        hingeSide: "START",
        swingSide: "LEFT"
      }),
      expect.objectContaining({
        id: "e2e-door-end-right",
        hingeSide: "END",
        swingSide: "RIGHT"
      })
    ]));
    expect(doorPoses.every((pose) =>
      Math.hypot(pose.leafEnd.x - pose.hinge.x, pose.leafEnd.z - pose.hinge.z) > 0
    )).toBe(true);
    expect(Number(await workspace.getAttribute("data-architectural-wall-count")))
      .toBeGreaterThan(0);
    expect(Number(await workspace.getAttribute("data-architectural-wall-section-count")))
      .toBeGreaterThan(Number(await workspace.getAttribute("data-architectural-wall-count")));
    expect(Number(await workspace.getAttribute("data-architectural-floor-count")))
      .toBeGreaterThanOrEqual(2);
    const architecturalBounds = JSON.parse(
      (await workspace.getAttribute("data-visible-architectural-bounds")) ?? "{}"
    ) as { readonly min: { readonly y: number }; readonly max: { readonly y: number } };
    expect(architecturalBounds.min.y).toBe(0);
    expect(architecturalBounds.max.y).toBeGreaterThanOrEqual(6.2);
    const inspector = page.getByRole("complementary", { name: "Inspector" }).first();
    await expect(inspector.getByText("Ground Floor", { exact: true })).toBeVisible();
    await expect(inspector.getByText("Upper Level", { exact: true })).toBeVisible();
    await expect(inspector.getByText("0.00 m", { exact: true })).toBeVisible();
    await expect(inspector.getByText("3.20 m", { exact: true })).toBeVisible();
    await expect(page.getByText(/3D viewer · 2 visible Levels · Read-only/)).toBeVisible();
    await expect(page.getByText(/3D rendering is unavailable/)).toBeHidden();

    const canvas = workspace.locator("canvas");
    await expect(canvas).toBeVisible();
    await expect.poll(() => workspace.getAttribute("data-camera-position"))
      .not.toBe("");
    const initialPosition = await workspace.getAttribute("data-camera-position");
    const initialDirection = await workspace.getAttribute("data-camera-view-direction");
    assertScreenParity(await getProjectedLandmarks(workspace));

    const targets = await getProjectedSelectionTargets(workspace);
    const wallTarget = Object.keys(targets).find((key) => key.includes(":wall:"));
    const roomTarget = Object.keys(targets).find((key) => key.includes(":room:"));
    if (!wallTarget || !roomTarget) {
      throw new Error("The deterministic Project did not expose Wall and Room hit targets.");
    }
    await clickProjectedTarget(page, canvas, targets[wallTarget]!);
    await expect(workspace).toHaveAttribute("data-selected-entity-kind", "wall");
    await expect(inspector.getByText("Wall", { exact: true }).first()).toBeVisible();
    await expect(inspector.getByText("Length", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Fit to building" }).click();
    await expect(workspace).toHaveAttribute(
      "data-selected-entity-id",
      wallTarget.split(":").at(-1)!
    );

    await clickProjectedTarget(
      page,
      canvas,
      getProjectedTarget(targets, "door", "e2e-door-start-left")
    );
    await expect(workspace).toHaveAttribute("data-selected-entity-id", "e2e-door-start-left");
    await expect(inspector.getByText("Hinge side", { exact: true })).toBeVisible();
    await expect(inspector.getByText("START", { exact: true })).toBeVisible();
    await expect(inspector.getByText("LEFT", { exact: true })).toBeVisible();

    await clickProjectedTarget(
      page,
      canvas,
      getProjectedTarget(targets, "window", "e2e-window-ground")
    );
    await expect(workspace).toHaveAttribute("data-selected-entity-kind", "window");
    await expect(inspector.getByText("Elevation", { exact: true })).toBeVisible();

    await clickProjectedTarget(
      page,
      canvas,
      getProjectedTarget(targets, "wall-opening", "e2e-wall-opening")
    );
    await expect(workspace).toHaveAttribute("data-selected-entity-id", "e2e-wall-opening");
    await expect(inspector.getByText("Wall Opening", { exact: true }).first()).toBeVisible();

    await tiltCanvasTowardTop(page, canvas);
    await waitForCameraToSettle(page, workspace);
    const topDownTargets = await getProjectedSelectionTargets(workspace);
    await clickProjectedTarget(page, canvas, topDownTargets[roomTarget]!);
    await expect(workspace).toHaveAttribute("data-selected-entity-kind", "room");
    await expect(inspector.getByText("Area", { exact: true })).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath("selected-room-3d-inspector.png")
    });

    await clickEmptyGround(page, canvas);
    await expect(workspace).toHaveAttribute("data-selected-entity-kind", "");

    await clickProjectedTarget(
      page,
      canvas,
      topDownTargets[roomTarget]!
    );
    await expect(workspace).toHaveAttribute("data-selected-entity-kind", "room");
    await page.keyboard.press("Escape");
    await expect(workspace).toHaveAttribute("data-selected-entity-kind", "");
    await page.getByRole("button", { name: "Reset camera" }).click();
    await expect.poll(() => workspace.getAttribute("data-camera-position"))
      .toBe(initialPosition);

    await page.getByRole("button", { name: "Fit to building" }).click();
    assertScreenParity(await getProjectedLandmarks(workspace));
    expect(await workspace.getAttribute("data-camera-view-direction"))
      .toBe(initialDirection);

    await orbitCanvas(page, canvas);
    await expect.poll(() => workspace.getAttribute("data-camera-position"))
      .not.toBe(initialPosition);
    const orbitedPosition = await workspace.getAttribute("data-camera-position");
    await page.mouse.wheel(0, -500);
    await expect.poll(() => workspace.getAttribute("data-camera-position"))
      .not.toBe(orbitedPosition);
    await waitForCameraToSettle(page, workspace);
    const zoomedPosition = await workspace.getAttribute("data-camera-position");
    const orbitedDirection = await workspace.getAttribute("data-camera-view-direction");

    const selectionBeforeDrag = await workspace.getAttribute("data-selected-entity-id");
    expect(await workspace.getAttribute("data-selected-entity-id")).toBe(selectionBeforeDrag);

    await page.getByRole("button", { name: "Fit to building" }).click();
    await expect.poll(() => workspace.getAttribute("data-camera-position"))
      .not.toBe(zoomedPosition);
    expectDirectionToBeClose(
      await workspace.getAttribute("data-camera-view-direction"),
      orbitedDirection
    );
    assertScreenParity(await getProjectedLandmarks(workspace));

    await page.getByRole("button", { name: "Reset camera" }).click();
    await expect.poll(() => workspace.getAttribute("data-camera-position"))
      .toBe(initialPosition);
    expect(await workspace.getAttribute("data-camera-view-direction"))
      .toBe(initialDirection);
    assertScreenParity(await getProjectedLandmarks(workspace));
    await page.keyboard.press("f");
    assertScreenParity(await getProjectedLandmarks(workspace));
    await page.keyboard.press("r");
    await expect.poll(() => workspace.getAttribute("data-camera-position"))
      .toBe(initialPosition);
    await workspace.screenshot({
      path: test.info().outputPath("asymmetric-reset-3d-viewport.png")
    });

    const resetTargets = await getProjectedSelectionTargets(workspace);
    await clickProjectedTarget(
      page,
      canvas,
      getProjectedTarget(resetTargets, "window", "e2e-window-ground")
    );
    await expect(workspace).toHaveAttribute("data-selected-entity-id", "e2e-window-ground");
    await page.getByRole("button", { name: "Reset camera" }).click();
    await expect(workspace).toHaveAttribute("data-selected-entity-id", "e2e-window-ground");
    await page.getByRole("button", { name: "Active Level" }).click();
    await expect(workspace).toHaveAttribute("data-visible-level-elevations", "0");
    await expect(workspace).toHaveAttribute("data-architectural-door-count", "2");
    await expect(workspace).toHaveAttribute("data-architectural-window-count", "1");
    await expect(workspace).toHaveAttribute("data-architectural-wall-opening-count", "1");
    await page.getByRole("button", { name: /^Level:/ }).click();
    await expect(page.getByRole("menuitem", { name: "Add level" })).toHaveCount(0);
    await expect(page.getByRole("menuitem", { name: "Manage levels…" })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Upper Level" }).click();
    await expect(workspace).toHaveAttribute("data-selected-entity-kind", "");
    await expect(workspace).toHaveAttribute("data-visible-level-elevations", "3.2");
    await expect(workspace).toHaveAttribute("data-architectural-door-count", "0");
    await expect(workspace).toHaveAttribute("data-architectural-window-count", "1");
    await expect(workspace).toHaveAttribute("data-architectural-wall-opening-count", "0");
    await page.getByRole("button", { name: "All Levels" }).click();
    await expect(workspace).toHaveAttribute("data-visible-level-elevations", "0,3.2");
    await expect(workspace).toHaveAttribute("data-architectural-door-count", "2");
    await expect(workspace).toHaveAttribute("data-architectural-window-count", "2");
    await expect(workspace).toHaveAttribute("data-architectural-wall-opening-count", "1");

    await page.getByRole("button", { name: "2D workspace" }).click();
    await expect(plan).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit plan" })).toBeVisible();
    expect(await getProject(request, authorization, projectId)).toEqual(before3D);

    expect(pageErrors, "Unexpected uncaught browser errors").toEqual([]);
    expect(consoleErrors, "Unexpected browser console errors").toEqual([]);
  } finally {
    await test.info().attach("browser-console-errors", {
      body: Buffer.from(JSON.stringify(consoleErrors, null, 2)),
      contentType: "application/json"
    });
    if (projectId && authorization) {
      const cleanup = await request.delete(`${apiBaseUrl}/api/v1/projects/${projectId}`, {
        headers: { Authorization: authorization }
      });
      expect(cleanup.status()).toBe(204);
    }
  }
});

async function login(page: Page, password: string) {
  await page.goto("/app");
  await page.locator("#username").fill("demo");
  await page.locator("#password").fill(password);
  await page.locator("#kc-login").click();
  await expect(page.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible();
}

async function createRoomShape(
  page: Page,
  viewport: Locator,
  shape: "Rectangle" | "L-shape",
  dimensions: Readonly<Record<string, string>>
) {
  const roomButton = page.getByRole("button", { name: "Room" });
  if (await roomButton.getAttribute("aria-pressed") === "true") {
    await roomButton.click();
  }
  await roomButton.click();
  await page.getByRole("menuitem", { name: shape }).click();
  const labels: Readonly<Record<string, string>> = {
    width: "Width",
    depth: "Depth",
    notchWidth: "Notch width",
    notchDepth: "Notch depth"
  };
  for (const [key, value] of Object.entries(dimensions)) {
    const label = labels[key];
    if (!label) throw new Error(`Unsupported Room dimension "${key}".`);
    await page.getByRole("spinbutton", { name: label, exact: true }).fill(value);
  }
  const bounds = await viewport.boundingBox();
  if (!bounds) throw new Error("The Project plan has no interactive bounds.");
  const point = {
    x: bounds.x + bounds.width * 0.3,
    y: bounds.y + bounds.height * 0.25
  };
  await page.mouse.move(point.x, point.y);
  await expect(viewport.getByTestId("room-shape-preview")).toBeVisible();
  await page.mouse.click(point.x, point.y);
  await expect(viewport.getByTestId("geometry-polygon")).toHaveCount(1);
}

async function orbitCanvas(page: Page, canvas: Locator) {
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("The 3D Canvas has no interactive bounds.");
  const start = {
    x: bounds.x + bounds.width * 0.56,
    y: bounds.y + bounds.height * 0.48
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 90, start.y - 35, { steps: 8 });
  await page.mouse.up();
}

async function tiltCanvasTowardTop(page: Page, canvas: Locator) {
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("The 3D Canvas has no interactive bounds.");
  const start = {
    x: bounds.x + bounds.width * 0.7,
    y: bounds.y + bounds.height * 0.45
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, start.y + bounds.height * 0.28, { steps: 10 });
  await page.mouse.up();
}

type ProjectedSelectionTarget = Readonly<{ x: number; y: number; depth: number }>;

async function getProjectedSelectionTargets(
  workspace: Locator
): Promise<Readonly<Record<string, ProjectedSelectionTarget>>> {
  await expect.poll(() => workspace.getAttribute("data-projected-selection-targets"))
    .not.toBe("");
  return JSON.parse(
    (await workspace.getAttribute("data-projected-selection-targets")) ?? "{}"
  ) as Readonly<Record<string, ProjectedSelectionTarget>>;
}

async function clickProjectedTarget(
  page: Page,
  canvas: Locator,
  target: ProjectedSelectionTarget | undefined
) {
  if (!target) throw new Error("The requested architectural hit target is unavailable.");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("The 3D Canvas has no interactive bounds.");
  await page.mouse.click(
    bounds.x + (target.x + 1) * bounds.width / 2,
    bounds.y + (target.y + 1) * bounds.height / 2
  );
}

function getProjectedTarget(
  targets: Readonly<Record<string, ProjectedSelectionTarget>>,
  kind: string,
  id: string
): ProjectedSelectionTarget | undefined {
  const key = Object.keys(targets).find((candidate) =>
    candidate.endsWith(`:${kind}:${id}`)
  );
  return key ? targets[key] : undefined;
}

async function clickEmptyGround(page: Page, canvas: Locator) {
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("The 3D Canvas has no interactive bounds.");
  await page.mouse.click(
    bounds.x + bounds.width * 0.92,
    bounds.y + bounds.height * 0.88
  );
}

type ProjectedLandmarks = Readonly<Record<
  "left" | "right" | "top" | "bottom",
  Readonly<{ x: number; y: number }>
>>;

async function getProjectedLandmarks(workspace: Locator): Promise<ProjectedLandmarks> {
  await expect.poll(() => workspace.getAttribute("data-projected-landmarks"))
    .not.toBe("");
  const serialized = await workspace.getAttribute("data-projected-landmarks");
  if (!serialized) throw new Error("The 3D viewport did not expose projected landmarks.");
  return JSON.parse(serialized) as ProjectedLandmarks;
}

function assertScreenParity(landmarks: ProjectedLandmarks) {
  expect(landmarks.left.x).toBeLessThan(landmarks.right.x);
  expect(landmarks.top.y).toBeLessThan(landmarks.bottom.y);
}

function expectDirectionToBeClose(actual: string | null, expected: string | null) {
  expect(actual).not.toBeNull();
  expect(expected).not.toBeNull();
  const actualValues = actual!.split(",").map(Number);
  const expectedValues = expected!.split(",").map(Number);
  expect(actualValues).toHaveLength(3);
  for (const [index, value] of actualValues.entries()) {
    expect(value).toBeCloseTo(expectedValues[index]!, 3);
  }
}

async function waitForCameraToSettle(page: Page, workspace: Locator) {
  await expect.poll(async () => {
    const before = parseCameraPosition(
      await workspace.getAttribute("data-camera-position")
    );
    await page.waitForTimeout(150);
    const after = parseCameraPosition(
      await workspace.getAttribute("data-camera-position")
    );
    return Math.hypot(
      after[0] - before[0],
      after[1] - before[1],
      after[2] - before[2]
    );
  }, { timeout: 10_000 }).toBeLessThan(0.002);
}

function parseCameraPosition(value: string | null): readonly [number, number, number] {
  const values = value?.split(",").map(Number) ?? [];
  if (values.length !== 3 || values.some((coordinate) => !Number.isFinite(coordinate))) {
    throw new Error("The 3D viewport exposed invalid camera-position telemetry.");
  }
  return [values[0]!, values[1]!, values[2]!];
}

async function getProject(
  request: APIRequestContext,
  authorization: string,
  projectId: string
): Promise<{ readonly project: Project; readonly sourceRevision: number }> {
  const response = await request.get(`${apiBaseUrl}/api/v1/projects/${projectId}`, {
    headers: { Authorization: authorization }
  });
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{
    readonly project: Project;
    readonly sourceRevision: number;
  }>;
}

async function seedArchitectural3DProject(
  request: APIRequestContext,
  authorization: string,
  projectId: string
) {
  const current = await getProject(request, authorization, projectId);
  const project = structuredClone(current.project);
  const ground = project.building.levels[0];
  if (!ground || ground.walls.length < 2) {
    throw new Error("The deterministic 3D Project requires at least two authored Walls.");
  }
  const frontWall = [...ground.walls].sort((left, right) =>
    (left.start.z + left.end.z) / 2 - (right.start.z + right.end.z) / 2
  )[0]!;
  const frontWallLength = Math.hypot(
    frontWall.end.x - frontWall.start.x,
    frontWall.end.z - frontWall.start.z
  );
  const frontDoor = createOpeningForWall(
    frontWall,
    "DOOR",
    "e2e-door-start-left"
  );
  const frontWindow = createOpeningForWall(
    frontWall,
    "WINDOW",
    "e2e-window-ground"
  );
  frontWall.openings = [
    { ...frontDoor, offsetFromStart: frontWallLength * 0.15 },
    { ...frontWindow, offsetFromStart: frontWallLength * 0.65 }
  ];
  const allPoints = ground.walls.flatMap((wall) => [wall.start, wall.end]);
  const maxX = Math.max(...allPoints.map((point) => point.x));
  const minZ = Math.min(...allPoints.map((point) => point.z));
  ground.walls.push({
    id: "e2e-angled-opening-wall",
    name: "Angled Opening Wall",
    start: { x: maxX + 100, z: minZ },
    end: { x: maxX + 500, z: minZ + 300 },
    height: 300,
    thickness: 20,
    roomIds: [],
    openings: [
      {
        id: "e2e-door-end-right",
        type: "DOOR",
        offsetFromStart: 50,
        width: 90,
        height: 210,
        elevation: 0,
        hingeSide: "END",
        swingSide: "RIGHT"
      },
      {
        id: "e2e-wall-opening",
        type: "OPENING",
        offsetFromStart: 250,
        width: 100,
        height: 220,
        elevation: 0
      }
    ]
  });
  const upper = project.building.levels.find((level) => level.name === "Upper Level");
  if (!upper?.walls[0]) {
    throw new Error("The deterministic 3D Project requires an Upper Level Wall.");
  }
  upper.walls[0].openings = [createOpeningForWall(
    upper.walls[0],
    "WINDOW",
    "e2e-window-upper"
  )];

  const response = await request.put(`${apiBaseUrl}/api/v1/projects/${projectId}`, {
    headers: { Authorization: authorization },
    data: { baseRevision: current.sourceRevision, project }
  });
  expect(response.ok(), await response.text()).toBe(true);
}

function createOpeningForWall(
  wall: Wall,
  kind: "DOOR" | "WINDOW",
  id: string
) {
  const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z);
  const width = Math.min(100, length * 0.4);
  const offsetFromStart = (length - width) / 2;
  if (kind === "DOOR") {
    return {
      id,
      type: kind,
      offsetFromStart,
      width,
      height: Math.min(210, wall.height),
      elevation: 0,
      hingeSide: "START",
      swingSide: "LEFT"
    } as const;
  }
  const elevation = Math.min(90, wall.height / 3);
  return {
    id,
    type: kind,
    offsetFromStart,
    width,
    height: Math.min(120, wall.height - elevation),
    elevation
  } as const;
}
