import { expect, test, type APIRequestContext, type ConsoleMessage, type Locator, type Page } from "@playwright/test";
import {
  ProjectSchema,
  validateProjectCrossReferences,
  validateProjectGeometry,
  validateProjectIdentifierUniqueness,
  validateProjectReferenceConsistency,
  type Project
} from "../packages/schema/src/index.js";

const apiBaseUrl = process.env.CASASTUDIO_E2E_API_URL ?? "http://localhost:3000";

type ApiProjectResponse = { readonly project: Project; readonly sourceRevision: number };
type Line = { readonly id: string; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number };

test("authors, persists, reloads, deeply edits, and navigates a complete multi-Level house", async ({ page, request }) => {
  test.setTimeout(600_000);
  page.setDefaultTimeout(15_000);
  const demoPassword = process.env.CASASTUDIO_KEYCLOAK_DEMO_PASSWORD;
  if (!demoPassword) throw new Error("CASASTUDIO_KEYCLOAK_DEMO_PASSWORD is required.");

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
    const projectName = `2D Acceptance ${Date.now()}`;
    await page.getByRole("button", { name: "New Project" }).click();
    await page.getByLabel("Project name").fill(projectName);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("heading", { name: projectName, level: 1 })).toBeVisible();
    projectId = new URL(page.url()).pathname.split("/").at(-1) ?? "";
    expect(projectId).not.toBe("");

    const viewport = editorViewport(page);
    await page.getByRole("button", { name: "Edit plan" }).click();
    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
    await createRoomShape(page, viewport, "L-shape", {
      width: "900",
      depth: "700",
      notchWidth: "200",
      notchDepth: "80"
    });
    await page.getByRole("button", { name: "Fit to view" }).click();
    await expect(viewport.locator('[data-testid="geometry-polygon"]')).toHaveCount(1);

    const originalExteriorWalls = (await readExteriorWalls(viewport))
      .sort((a, b) => lineLength(b) - lineLength(a));
    expect(originalExteriorWalls).toHaveLength(6);
    const exactWall = originalExteriorWalls[0]!;

    await selectWall(page, viewport, exactWall.id);
    const scaleBefore = await page.getByRole("combobox", { name: "Scale" }).textContent();
    const wallLength = page.getByRole("spinbutton", { name: "Length (cm)" });
    await wallLength.fill("960");
    await wallLength.press("Enter");
    await page.getByRole("combobox", { name: "Resize from" }).click();
    await page.getByRole("option", { name: "End" }).click();
    await wallLength.fill("940");
    await wallLength.press("Enter");
    await expect(wallLength).toHaveValue("940");
    expect(await page.getByRole("combobox", { name: "Scale" }).textContent()).toBe(scaleBefore);
    await page.getByRole("button", { name: "Undo" }).click();
    await page.getByRole("button", { name: "Redo" }).click();
    await selectWall(page, viewport, exactWall.id);
    await expect(page.getByRole("spinbutton", { name: "Length (cm)" })).toHaveValue("940");
    await expect(viewport.locator('[data-testid="selected-dimension"]')).toHaveAttribute("data-physical-value", "940");
    expect(await viewport.locator('[data-testid="automatic-dimension"]').count()).toBeGreaterThan(0);

    const vertexWall = (await readWalls(viewport)).find((wall) => wall.id === exactWall.id)!;
    await page.getByRole("tab", { name: "Properties" }).click();
    const wallCountBeforeVertex = await viewport.locator('[data-testid="boundary-edge"]').count();
    await page.getByRole("button", { name: "Add vertex" }).click();
    const vertexPoint = midpoint(vertexWall);
    await page.mouse.move(vertexPoint.x, vertexPoint.y);
    await expect(viewport.locator('[data-testid="add-wall-vertex-preview"]')).toBeVisible();
    await page.mouse.click(vertexPoint.x, vertexPoint.y);
    await expect(viewport.locator('[data-testid="boundary-edge"]')).toHaveCount(wallCountBeforeVertex + 1);
    const splitVertex = await nearest(viewport.locator('[data-testid="geometry-vertex"]'), vertexPoint);
    await splitVertex.click({ force: true });
    await expect(page.getByRole("button", { name: "Remove vertex" })).toBeEnabled();
    await page.getByRole("button", { name: "Remove vertex" }).click();
    await expect(viewport.locator('[data-testid="boundary-edge"]')).toHaveCount(wallCountBeforeVertex);
    await page.getByRole("button", { name: "Undo" }).click();
    await page.getByRole("button", { name: "Redo" }).click();

    await partitionIntoFourRooms(page, viewport);
    await expect(viewport.locator('[data-testid="geometry-polygon"]')).toHaveCount(4);
    await nameRooms(page, viewport, ["Living Room", "Kitchen", "Study", "Hall"]);
    const openingWalls = (await readExteriorWalls(viewport))
      .sort((a, b) => lineLength(b) - lineLength(a));
    expect(openingWalls.length).toBeGreaterThanOrEqual(5);
    await placeOpening(page, viewport, "Door", openingWalls[0]!, { width: 80, height: 205, elevation: 0, hinge: "End", swing: "Right" });
    await expect(viewport.locator('[data-testid="architectural-door"]')).toHaveCount(1);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(viewport.locator('[data-testid="architectural-door"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Redo" }).click();
    await expect(viewport.locator('[data-testid="architectural-door"]')).toHaveCount(1);
    await placeOpening(page, viewport, "Door", openingWalls.at(-1)!, { width: 70, height: 210, elevation: 0, hinge: "Start", swing: "Left" });
    await placeOpening(page, viewport, "Window", openingWalls[2]!, { width: 110, height: 120, elevation: 95 });
    await placeOpening(page, viewport, "Window", openingWalls[3]!, { width: 90, height: 100, elevation: 100 });
    await placeOpening(page, viewport, "Wall Opening", openingWalls[4]!, { width: 140, height: 220, elevation: 0 });
    await expect(viewport.locator('[data-testid="architectural-door"]')).toHaveCount(2);
    await expect(viewport.locator('[data-testid="architectural-window"]')).toHaveCount(2);
    await expect(viewport.locator('[data-testid="architectural-wall-opening"]')).toHaveCount(1);
    await expect(viewport.locator('[data-testid="architectural-wall-opening"] .architectural-door-leaf')).toHaveCount(0);
    await screenshot(page, "01-ground-floor-before-first-save.png");

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Edit plan" })).toBeVisible();
    const first = await getProject(request, authorization, projectId);
    expect(first.sourceRevision).toBe(2);
    assertProject(first.project, { levels: 1, rooms: [4], openings: { DOOR: 2, WINDOW: 2, OPENING: 1 } });
    const firstOpenings = first.project.building.levels[0]!.walls.flatMap((wall) => wall.openings);
    expect(firstOpenings).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "DOOR", width: 80, height: 205, elevation: 0, hingeSide: "END", swingSide: "RIGHT" }),
      expect.objectContaining({ type: "DOOR", width: 70, height: 210, elevation: 0, hingeSide: "START", swingSide: "LEFT" }),
      expect.objectContaining({ type: "WINDOW", width: 110, height: 120, elevation: 95 }),
      expect.objectContaining({ type: "WINDOW", width: 90, height: 100, elevation: 100 }),
      expect.objectContaining({ type: "OPENING", width: 140, height: 220, elevation: 0 })
    ]));
    await assertSnapshotRevision(request, authorization, projectId, first.sourceRevision);

    await page.reload();
    await expect(page.getByRole("heading", { name: projectName, level: 1 })).toBeVisible();
    await expect(editorViewport(page).locator('[data-testid="geometry-polygon"]')).toHaveCount(4);
    await expect(editorViewport(page).locator('[data-testid="architectural-door"]')).toHaveCount(2);
    await screenshot(page, "02-ground-floor-after-reload.png");
    const firstReload = await getProject(request, authorization, projectId);
    expect(firstReload).toEqual(first);

    await page.getByRole("button", { name: "Edit plan" }).click();
    await page.getByRole("button", { name: "Measure" }).click();
    const measureWalls = await readWalls(editorViewport(page));
    const measureStart = midpoint(measureWalls[0]!);
    const measureEnd = midpoint(measureWalls.at(-1)!);
    await page.mouse.click(measureStart.x, measureStart.y);
    await page.mouse.move(measureEnd.x, measureEnd.y);
    await page.mouse.click(measureEnd.x, measureEnd.y);
    await expect(editorViewport(page).locator('[data-testid="temporary-measurement"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();

    const movedOpening = editorViewport(page).locator('[data-testid="architectural-door"]').first();
    await page.getByRole("button", { name: "Select" }).click();
    await movedOpening.dispatchEvent("click", { bubbles: true });
    await page.getByRole("tab", { name: "Properties" }).click();
    const openingWidth = page.getByRole("spinbutton", { name: "Width (cm)" });
    const originalOpeningWidth = await openingWidth.inputValue();
    await openingWidth.fill("10000");
    await openingWidth.press("Enter");
    await expect(openingWidth).toHaveValue(originalOpeningWidth);
    await expect(page.getByText(
      "The opening cannot be placed or changed because it would violate wall clearance, collision, or dimension constraints."
    )).toBeVisible();
    await openingWidth.fill(String(Number(originalOpeningWidth) + 5));
    await openingWidth.press("Enter");

    const deepWall = await longestWall(editorViewport(page));
    await selectWall(page, editorViewport(page), deepWall.id);
    const thickness = page.getByRole("spinbutton", { name: "Thickness (cm)" });
    await thickness.fill("24");
    await thickness.press("Enter");
    const height = page.getByRole("spinbutton", { name: "Height (cm)" });
    await height.fill("310");
    await height.press("Enter");
    await screenshot(page, "03-deep-structural-edit.png");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Edit plan" })).toBeVisible();
    const second = await getProject(request, authorization, projectId);
    expect(second.sourceRevision).toBe(3);
    assertProject(second.project, { levels: 1, rooms: [4], openings: { DOOR: 2, WINDOW: 2, OPENING: 1 } });
    await assertSnapshotRevision(request, authorization, projectId, second.sourceRevision);
    expect(second.project.building.levels[0]?.walls.find((wall) => wall.id === deepWall.id)).toMatchObject({ thickness: 24, height: 310 });
    expect(second.project.building.levels[0]?.walls.flatMap((wall) => wall.openings)).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "DOOR", width: Number(originalOpeningWidth) + 5 })])
    );

    await page.reload();
    await expect(editorViewport(page).locator('[data-testid="geometry-polygon"]')).toHaveCount(4);
    const secondReload = await getProject(request, authorization, projectId);
    expect(secondReload).toEqual(second);
    await page.getByRole("button", { name: "Edit plan" }).click();
    await page.getByRole("button", { name: /^Level:/ }).click();
    await page.getByRole("menuitem", { name: "Add level" }).click();
    const levelDialog = page.getByRole("dialog", { name: "Create level" });
    await levelDialog.getByLabel("Level name").fill("First Floor");
    await levelDialog.getByLabel("Elevation (cm)").fill("300");
    await levelDialog.getByRole("button", { name: "Create Level" }).click();
    await expect(page.getByRole("button", { name: "Level: First Floor" })).toBeVisible();
    await expect(editorViewport(page).locator('[data-testid="geometry-polygon"]')).toHaveCount(0);
    await createRoomShape(page, editorViewport(page), "Rectangle", { width: "600", depth: "420" });
    await page.getByRole("button", { name: "Fit to view" }).click();
    await partitionOnce(page, editorViewport(page));
    await expect(editorViewport(page).locator('[data-testid="geometry-polygon"]')).toHaveCount(2);
    await nameRooms(page, editorViewport(page), ["Upper Lounge", "Guest Room"]);
    const upperWalls = (await readExteriorWalls(editorViewport(page))).sort((a, b) => lineLength(b) - lineLength(a));
    await placeOpening(page, editorViewport(page), "Door", upperWalls[0]!, { width: 80, height: 210, elevation: 0 });
    await placeOpening(page, editorViewport(page), "Window", upperWalls[1]!, { width: 100, height: 110, elevation: 95 });

    await switchLevel(page, "Ground Floor");
    await expect(editorViewport(page).locator('[data-testid="geometry-polygon"]')).toHaveCount(4);
    await screenshot(page, "04-multi-level-ground-floor.png");
    await switchLevel(page, "First Floor");
    await expect(editorViewport(page).locator('[data-testid="geometry-polygon"]')).toHaveCount(2);
    await screenshot(page, "05-final-first-floor.png");
    await switchLevel(page, "Ground Floor");
    await switchLevel(page, "First Floor");

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Edit plan" })).toBeVisible();
    const finalState = await getProject(request, authorization, projectId);
    expect(finalState.sourceRevision).toBe(4);
    assertProject(finalState.project, { levels: 2, rooms: [4, 2], openings: { DOOR: 3, WINDOW: 3, OPENING: 1 } });
    expect(finalState.project.building.levels.map(({ name, elevation }) => ({ name, elevation }))).toEqual([
      { name: "Ground Floor", elevation: 0 },
      { name: "First Floor", elevation: 300 }
    ]);
    await assertSnapshotRevision(request, authorization, projectId, finalState.sourceRevision);

    await page.reload();
    await switchLevel(page, "Ground Floor");
    await expect(editorViewport(page).locator('[data-testid="geometry-polygon"]')).toHaveCount(4);
    await switchLevel(page, "First Floor");
    await expect(editorViewport(page).locator('[data-testid="geometry-polygon"]')).toHaveCount(2);
    await screenshot(page, "06-final-clean-view.png");
    expect(await getProject(request, authorization, projectId)).toEqual(finalState);

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

function editorViewport(page: Page) {
  return page.locator('svg[aria-labelledby="geometry-svg-title geometry-svg-description"]');
}

async function createRoomShape(page: Page, viewport: Locator, shape: "Rectangle" | "L-shape", dimensions: Record<string, string>) {
  await page.getByRole("button", { name: "Room" }).click();
  await page.getByRole("menuitem", { name: shape }).click();
  const labels: Readonly<Record<string, string>> = {
    width: "Width",
    depth: "Depth",
    notchWidth: "Notch width",
    notchDepth: "Notch depth"
  };
  for (const [label, value] of Object.entries(dimensions)) {
    const accessibleLabel = labels[label];
    if (!accessibleLabel) throw new Error(`Unsupported Room shape dimension "${label}".`);
    await page.getByRole("spinbutton", { name: accessibleLabel, exact: true }).fill(value);
  }
  const bounds = await viewport.boundingBox();
  if (!bounds) throw new Error("The editor viewport has no bounds.");
  const point = { x: bounds.x + bounds.width * 0.3, y: bounds.y + bounds.height * 0.25 };
  await page.mouse.move(point.x, point.y);
  await expect(viewport.locator('[data-testid="room-shape-preview"]')).toBeVisible();
  await page.mouse.click(point.x, point.y);
}

async function selectWall(page: Page, viewport: Locator, wallId: string, tab: "Properties" = "Properties") {
  await ensureSelectTool(page);
  await viewport.locator(`.architectural-wall-hit-target[data-geometry-id="${wallId}"]`).dispatchEvent("click", {
    bubbles: true
  });
  await page.getByRole("tab", { name: tab }).click();
}

async function partitionIntoFourRooms(page: Page, viewport: Locator) {
  await partitionOnce(page, viewport);
  await expect(viewport.locator('[data-testid="geometry-polygon"]')).toHaveCount(2);
  await exerciseRoomDissolution(page, viewport);
  const lines = await readWalls(viewport);
  const vertical = lines.filter((line) => Math.abs(line.y2 - line.y1) > Math.abs(line.x2 - line.x1));
  const left = vertical.reduce((best, line) => midpoint(line).x < midpoint(best).x ? line : best);
  const right = vertical.reduce((best, line) => midpoint(line).x > midpoint(best).x ? line : best);
  const center = vertical.filter((line) => line.id !== left.id && line.id !== right.id)
    .sort((a, b) => lineLength(b) - lineLength(a))[0]!;
  const centralPoint = midpoint(center);
  await drawWall(page, midpoint(left), centralPoint);
  await detectRoom(page, viewport);
  const refreshed = await readWalls(viewport);
  const rightBoundary = refreshed
    .filter((line) => Math.abs(line.y2 - line.y1) > Math.abs(line.x2 - line.x1))
    .reduce((best, line) => midpoint(line).x > midpoint(best).x ? line : best);
  await drawWall(page, centralPoint, midpoint(rightBoundary));
  await detectRoom(page, viewport);
}

async function partitionOnce(page: Page, viewport: Locator) {
  const lines = await readWalls(viewport);
  const horizontal = lines.filter((line) => Math.abs(line.x2 - line.x1) >= Math.abs(line.y2 - line.y1));
  const top = horizontal.reduce((best, line) => midpoint(line).y < midpoint(best).y ? line : best);
  const bottom = horizontal.reduce((best, line) => midpoint(line).y > midpoint(best).y ? line : best);
  await drawWall(page, midpoint(top), midpoint(bottom));
  await detectRoom(page, viewport);
}

async function drawWall(page: Page, start: { x: number; y: number }, end: { x: number; y: number }) {
  await page.getByRole("button", { name: "Wall" }).click();
  await page.mouse.click(start.x, start.y);
  await page.mouse.move(end.x, end.y);
  await expect(page.locator('[data-testid="draw-wall-preview-length"]')).toBeVisible();
  await page.mouse.click(end.x, end.y);
  await page.keyboard.press("Escape");
}

async function detectRoom(page: Page, viewport: Locator) {
  await page.getByRole("button", { name: "Room" }).click();
  await page.getByRole("menuitem", { name: "Detect room" }).click();
  const candidate = viewport.locator('[data-testid="room-face-candidate"]').first();
  await expect(candidate).toBeVisible();
  await candidate.click({ force: true });
}

async function nameRooms(page: Page, viewport: Locator, names: readonly string[]) {
  const polygons = viewport.locator('[data-testid="geometry-polygon"]');
  await expect(polygons).toHaveCount(names.length);
  for (let index = 0; index < names.length; index += 1) {
    await ensureSelectTool(page);
    await polygons.nth(index).click({ force: true });
    await page.getByRole("tab", { name: "Properties" }).click();
    const name = page.getByLabel("Name");
    await name.fill(names[index]!);
    await name.press("Enter");
    if (index === 1) {
      await page.getByRole("combobox", { name: "Type" }).click();
      await page.getByRole("option", { name: "Kitchen" }).click();
    }
  }
}

async function exerciseRoomDissolution(page: Page, viewport: Locator) {
  await ensureSelectTool(page);
  await viewport.locator('[data-testid="geometry-polygon"]').first().dispatchEvent("click", { bubbles: true });
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await inspector.getByRole("tab", { name: "Properties" }).click();
  await expect(inspector.getByText("Area", { exact: true })).toBeVisible();
  await expect(inspector.getByText("Perimeter", { exact: true })).toBeVisible();
  await inspector.getByRole("button", { name: "Delete Room" }).click();
  await expect(viewport.locator('[data-testid="geometry-polygon"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(viewport.locator('[data-testid="geometry-polygon"]')).toHaveCount(2);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(viewport.locator('[data-testid="geometry-polygon"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(viewport.locator('[data-testid="geometry-polygon"]')).toHaveCount(2);
  await inspector.getByRole("tab", { name: "Layers" }).click();
  await expect(inspector.getByText("Total room area", { exact: true })).toBeVisible();
  await expect(inspector.getByText("Overall width", { exact: true })).toBeVisible();
  await expect(inspector.getByText("Overall depth", { exact: true })).toBeVisible();
}

async function placeOpening(
  page: Page,
  viewport: Locator,
  tool: "Door" | "Window" | "Wall Opening",
  wall: Line,
  values: { readonly width: number; readonly height: number; readonly elevation: number; readonly hinge?: "Start" | "End"; readonly swing?: "Left" | "Right" }
) {
  await ensureSelectTool(page);
  await page.getByRole("button", { name: "Openings" }).click();
  await page.getByRole("menuitem", { name: tool }).click();
  await page.getByRole("tab", { name: "Properties" }).click();
  await commitNumber(page, "Width (cm)", values.width);
  await commitNumber(page, "Height (cm)", values.height);
  await commitNumber(page, tool === "Window" ? "Sill height (cm)" : "Elevation (cm)", values.elevation);
  if (tool === "Door" && values.hinge) {
    await page.getByRole("combobox", { name: "Hinge side" }).click();
    await page.getByRole("option", { name: values.hinge }).click();
  }
  if (tool === "Door" && values.swing) {
    await page.getByRole("combobox", { name: "Swing side" }).click();
    await page.getByRole("option", { name: values.swing }).click();
  }
  const targetWall = viewport.locator(
    `.architectural-wall-hit-target[data-geometry-id="${wall.id}"]`
  );
  const center = await targetWall.evaluate((element) => {
    const line = element as SVGLineElement;
    const matrix = line.getScreenCTM();
    if (!matrix) throw new Error("Opening target Wall has no screen transform.");
    const start = new DOMPoint(line.x1.baseVal.value, line.y1.baseVal.value).matrixTransform(matrix);
    const end = new DOMPoint(line.x2.baseVal.value, line.y2.baseVal.value).matrixTransform(matrix);
    return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  });
  await viewport.dispatchEvent("pointermove", {
    bubbles: true,
    clientX: center.x,
    clientY: center.y,
    pointerId: 1,
    pointerType: "mouse"
  });
  await expect(viewport.locator('[data-testid="opening-placement-preview"]')).toHaveAttribute("data-valid", "true");
  await viewport.dispatchEvent("click", {
    bubbles: true,
    clientX: center.x,
    clientY: center.y
  });
}

async function ensureSelectTool(page: Page) {
  const select = page.getByRole("button", { name: "Select" });
  if (await select.getAttribute("aria-pressed") !== "true") await select.click();
}

async function commitNumber(page: Page, label: string, value: number) {
  const input = page.getByRole("spinbutton", { name: label, exact: true });
  await input.fill(String(value));
  await input.press("Enter");
}

async function switchLevel(page: Page, name: string) {
  const selector = page.getByRole("button", { name: /^Level:/ });
  if ((await selector.textContent()) === name) return;
  await selector.click();
  await page.getByRole("menuitem", { name }).click();
  await expect(page.getByRole("button", { name: `Level: ${name}` })).toBeVisible();
}

async function readWalls(viewport: Locator): Promise<Line[]> {
  return viewport.locator(".architectural-wall-hit-target").evaluateAll((elements) =>
    elements.map((element) => {
      const line = element as SVGLineElement;
      const matrix = line.getScreenCTM();
      if (!matrix) throw new Error("A rendered Wall has no screen transformation matrix.");
      const start = new DOMPoint(line.x1.baseVal.value, line.y1.baseVal.value).matrixTransform(matrix);
      const end = new DOMPoint(line.x2.baseVal.value, line.y2.baseVal.value).matrixTransform(matrix);
      return {
        id: line.getAttribute("data-geometry-id") ?? "",
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y
      };
    })
  );
}

async function readExteriorWalls(viewport: Locator): Promise<Line[]> {
  return viewport.locator(".architectural-wall-hit-target").evaluateAll((elements) => {
    const boundaryLines = [...document.querySelectorAll<SVGLineElement>(
      '[data-testid="boundary-edge"][data-shared="false"]'
    )];
    const samePoint = (firstX: number, firstY: number, secondX: number, secondY: number) =>
      Math.abs(firstX - secondX) <= 0.01 && Math.abs(firstY - secondY) <= 0.01;
    return elements.flatMap((element) => {
      const line = element as SVGLineElement;
      const x1 = line.x1.baseVal.value;
      const y1 = line.y1.baseVal.value;
      const x2 = line.x2.baseVal.value;
      const y2 = line.y2.baseVal.value;
      const exterior = boundaryLines.some((boundary) =>
        (samePoint(x1, y1, boundary.x1.baseVal.value, boundary.y1.baseVal.value) &&
          samePoint(x2, y2, boundary.x2.baseVal.value, boundary.y2.baseVal.value)) ||
        (samePoint(x1, y1, boundary.x2.baseVal.value, boundary.y2.baseVal.value) &&
          samePoint(x2, y2, boundary.x1.baseVal.value, boundary.y1.baseVal.value))
      );
      if (!exterior) return [];
      const matrix = line.getScreenCTM();
      if (!matrix) throw new Error("A rendered Wall has no screen transformation matrix.");
      const start = new DOMPoint(x1, y1).matrixTransform(matrix);
      const end = new DOMPoint(x2, y2).matrixTransform(matrix);
      return [{
        id: line.getAttribute("data-geometry-id") ?? "",
        x1: start.x,
        y1: start.y,
        x2: end.x,
        y2: end.y
      }];
    });
  });
}

async function longestWall(viewport: Locator): Promise<Line> {
  return (await readWalls(viewport)).sort((a, b) => lineLength(b) - lineLength(a))[0]!;
}

const midpoint = (line: Line) => ({ x: (line.x1 + line.x2) / 2, y: (line.y1 + line.y2) / 2 });
const lineLength = (line: Line) => Math.hypot(line.x2 - line.x1, line.y2 - line.y1);

async function nearest(locator: Locator, point: { x: number; y: number }): Promise<Locator> {
  let result = locator.first();
  let distance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < await locator.count(); index += 1) {
    const candidate = locator.nth(index);
    const bounds = await candidate.boundingBox();
    if (!bounds) continue;
    const candidateDistance = Math.hypot(bounds.x + bounds.width / 2 - point.x, bounds.y + bounds.height / 2 - point.y);
    if (candidateDistance < distance) {
      result = candidate;
      distance = candidateDistance;
    }
  }
  return result;
}

async function getProject(request: APIRequestContext, authorization: string, projectId: string): Promise<ApiProjectResponse> {
  const response = await request.get(`${apiBaseUrl}/api/v1/projects/${projectId}`, { headers: { Authorization: authorization } });
  expect(response.ok()).toBe(true);
  const body = await response.json() as ApiProjectResponse;
  ProjectSchema.parse(body.project);
  return body;
}

async function assertSnapshotRevision(request: APIRequestContext, authorization: string, projectId: string, revision: number) {
  const response = await request.get(`${apiBaseUrl}/api/v1/projects/${projectId}/geometry`, { headers: { Authorization: authorization } });
  expect(response.ok()).toBe(true);
  expect((await response.json() as { sourceRevision: number }).sourceRevision).toBe(revision);
}

function assertProject(
  project: Project,
  expected: { readonly levels: number; readonly rooms: readonly number[]; readonly openings: Readonly<Record<"DOOR" | "WINDOW" | "OPENING", number>> }
) {
  expect(project.building.levels).toHaveLength(expected.levels);
  expect(project.building.levels.map((level) => level.rooms.length)).toEqual(expected.rooms);
  const openings = project.building.levels.flatMap((level) => level.walls.flatMap((wall) => wall.openings));
  for (const type of ["DOOR", "WINDOW", "OPENING"] as const) {
    expect(openings.filter((opening) => opening.type === type)).toHaveLength(expected.openings[type]);
  }
  for (const validate of [
    validateProjectIdentifierUniqueness,
    validateProjectCrossReferences,
    validateProjectReferenceConsistency,
    validateProjectGeometry
  ]) expect(validate(project)).toEqual({ valid: true, errors: [] });
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: test.info().outputPath(name), fullPage: true });
}
