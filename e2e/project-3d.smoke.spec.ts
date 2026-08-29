import {
  expect,
  test,
  type APIRequestContext,
  type ConsoleMessage,
  type Locator,
  type Page
} from "@playwright/test";

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
    const before3D = await getProject(request, authorization, projectId);
    await plan.screenshot({ path: test.info().outputPath("asymmetric-2d-plan.png") });

    await page.getByRole("button", { name: "3D workspace" }).click();
    const workspace = page.getByTestId("project-3d-workspace");
    await expect(workspace).toBeVisible();
    await expect(workspace).toHaveAttribute("data-renderer-status", "ready");
    await expect(workspace).toHaveAttribute("data-visible-level-elevations", "0,3.2");
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
    await page.getByRole("combobox", { name: "Level" }).click();
    await page.getByRole("option", { name: "Upper Level" }).click();
    await expect(workspace).toHaveAttribute("data-visible-level-elevations", "3.2");
    await page.getByRole("button", { name: "All Levels" }).click();
    await expect(workspace).toHaveAttribute("data-visible-level-elevations", "0,3.2");

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
    const before = await workspace.getAttribute("data-camera-position");
    await page.waitForTimeout(100);
    return workspace.getAttribute("data-camera-position").then((after) => after === before);
  }, { timeout: 5_000 }).toBe(true);
}

async function getProject(
  request: APIRequestContext,
  authorization: string,
  projectId: string
): Promise<unknown> {
  const response = await request.get(`${apiBaseUrl}/api/v1/projects/${projectId}`, {
    headers: { Authorization: authorization }
  });
  expect(response.ok()).toBe(true);
  return response.json();
}
