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
    await page.getByRole("button", { name: "Edit" }).click();
    await createRoomShape(page, plan, "L-shape", {
      width: "600",
      depth: "420",
      notchWidth: "160",
      notchDepth: "140"
    });

    await page.getByRole("button", { name: "Create level" }).click();
    const levelDialog = page.getByRole("dialog", { name: "Create level" });
    await levelDialog.getByLabel("Level name").fill("Upper Level");
    await levelDialog.getByLabel("Elevation (cm)").fill("320");
    await levelDialog.getByRole("button", { name: "Create Level" }).click();
    await expect(page.getByRole("combobox", { name: "Level" })).toContainText(
      "Upper Level"
    );
    await createRoomShape(page, plan, "Rectangle", {
      width: "480",
      depth: "360"
    });

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "View", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await seedArchitectural3DProject(request, authorization, projectId);
    await page.reload();
    await expect(page.getByRole("heading", { name: projectName, level: 1 })).toBeVisible();
    const before3D = await getProject(request, authorization, projectId);
    await plan.screenshot({ path: test.info().outputPath("asymmetric-2d-plan.png") });

    await page.getByRole("button", { name: "3D workspace" }).click();
    const workspace = page.getByTestId("project-3d-workspace");
    await expect(workspace).toBeVisible();
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
    await workspace.screenshot({
      path: test.info().outputPath("asymmetric-reset-3d-viewport.png")
    });

    await page.getByRole("button", { name: "Active Level" }).click();
    await expect(workspace).toHaveAttribute("data-visible-level-elevations", "0");
    await expect(workspace).toHaveAttribute("data-architectural-door-count", "2");
    await expect(workspace).toHaveAttribute("data-architectural-window-count", "1");
    await expect(workspace).toHaveAttribute("data-architectural-wall-opening-count", "1");
    await page.getByRole("combobox", { name: "Level" }).click();
    await page.getByRole("option", { name: "Upper Level" }).click();
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
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
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
  ground.walls[0]!.openings = [createOpeningForWall(
    ground.walls[0]!,
    "DOOR",
    "e2e-door-start-left"
  )];
  ground.walls[1]!.openings = [createOpeningForWall(
    ground.walls[1]!,
    "WINDOW",
    "e2e-window-ground"
  )];
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
