import { expect, test, type Page } from "@playwright/test";
import { furnitureProjectFixture } from "../apps/web/src/test/furniture-project-fixture";
import type { Project } from "../packages/schema/src/index.js";

const apiBaseUrl =
  process.env.CASASTUDIO_E2E_API_URL ?? "http://localhost:3000";

test("authors Furniture in ordinary and overlapping elevated Rooms and persists exact instances", async ({
  page,
  request
}) => {
  const password = process.env.CASASTUDIO_KEYCLOAK_DEMO_PASSWORD;
  if (!password)
    throw new Error("CASASTUDIO_KEYCLOAK_DEMO_PASSWORD is required.");
  let authorization = "",
    projectId = "";
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (outgoing) => {
    if (outgoing.url().startsWith(apiBaseUrl))
      authorization ||= outgoing.headers().authorization ?? "";
  });
  try {
    await page.goto("/app");
    await page.locator("#username").fill("demo");
    await page.locator("#password").fill(password);
    await page.locator("#kc-login").click();
    await page.getByRole("button", { name: "New Project" }).click();
    await page.getByLabel("Project name").fill("Furniture workshop");
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Furniture workshop", level: 1 })
    ).toBeVisible();
    projectId = new URL(page.url()).pathname.split("/").at(-1)!;
    const url = `${apiBaseUrl}/api/v1/projects/${projectId}`;
    const read = await request.get(url, { headers: { authorization } });
    expect(read.ok()).toBe(true);
    const existing = (await read.json()).project as Project;
    const fixture = furnitureProjectFixture();
    fixture.building.levels.push({
      id: "upper",
      name: "Upper",
      elevation: 280,
      rooms: [],
      walls: [],
      staircases: []
    });
    fixture.building.levels[0]!.staircases.push({
      id: "stair",
      name: "Straight stair",
      fromLevelId: "ground",
      toLevelId: "upper",
      width: 100,
      flights: [
        {
          id: "flight",
          start: { x: 400, z: 100 },
          end: { x: 500, z: 100 },
          width: 100,
          stepCount: 10,
          startElevation: 0,
          endElevation: 280
        }
      ],
      landings: []
    });
    const initial = { ...existing, building: fixture.building };
    const replace = await request.put(url, {
      headers: { authorization },
      data: { baseRevision: existing.revision, project: initial }
    });
    expect(replace.ok(), await replace.text()).toBe(true);
    await page.reload();
    await page.getByRole("button", { name: "Edit plan" }).click();
    const originalLabel = page.locator(
      '[data-testid="room-metric"][data-source-room-id="living"]'
    );
    const originalLabelPosition = {
      x: await originalLabel.getAttribute("x"),
      y: await originalLabel.getAttribute("y")
    };
    await page.keyboard.press("u");
    await expect(
      page.getByRole("button", { name: "Furniture", exact: true })
    ).toHaveAttribute("aria-pressed", "true");
    await move(page, -50, 150);
    await chooseCatalog(page, "SOFA · Sofa");
    await expect(page.getByRole("textbox", { name: "Room" })).toHaveValue(
      "No Room"
    );
    await expect(page.getByRole("textbox", { name: "Room" })).toBeDisabled();
    await expect(page.getByTestId("furniture-preview")).toHaveAttribute(
      "data-valid",
      "false"
    );
    await move(page, 55, 150);
    await expect(page.getByRole("textbox", { name: "Room" })).toHaveValue(
      "Living Room"
    );
    await expect(page.getByTestId("furniture-preview")).toHaveAttribute(
      "data-valid",
      "false"
    );
    await move(page, 115, 150);
    await expect(page.getByTestId("furniture-preview")).toHaveAttribute(
      "data-valid",
      "true"
    );
    await place(page, 115, 150);
    await expect(page.getByTestId("furniture-symbol")).toHaveCount(1);
    await page.getByRole("button", { name: "Select", exact: true }).click();
    await page.getByTestId("furniture-hit-target").click();
    await expect(
      page.locator('[data-testid="furniture-properties"]:visible')
    ).toContainText("Sofa");
    const before = await page
      .getByTestId("furniture-hit-target")
      .getAttribute("points");
    const start = await point(page, 115, 150),
      end = await point(page, 170, 210);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 5 });
    await page.mouse.up();
    await expect(page.getByTestId("furniture-hit-target")).not.toHaveAttribute(
      "points",
      before!
    );
    await number(page, "Width (cm)", 230);
    await number(page, "Depth (cm)", 110);
    await number(page, "Height (cm)", 95);
    const handle = await page
      .getByTestId("furniture-rotation-handle")
      .boundingBox();
    expect(handle).toBeTruthy();
    await page.mouse.move(
      handle!.x + handle!.width / 2,
      handle!.y + handle!.height / 2
    );
    await page.mouse.down();
    await page.mouse.move(end.x + 70, end.y, { steps: 5 });
    await page.mouse.up();
    await number(page, "Rotation (°)", 27.5);
    await page.getByRole("button", { name: "Duplicate Furniture" }).click();
    await expect(page.getByTestId("furniture-symbol")).toHaveCount(1);
    await place(page, 450, 220);
    await expect(page.getByTestId("furniture-symbol")).toHaveCount(2);
    await page.getByRole("button", { name: "Select", exact: true }).click();
    await page.getByTestId("furniture-hit-target").last().click();
    await page.getByRole("button", { name: "Delete Furniture" }).click();
    await expect(page.getByTestId("furniture-symbol")).toHaveCount(1);
    // Move Sofa into the common footprint while keeping its valid lower Room ownership.
    await page.getByTestId("furniture-hit-target").click();
    await number(page, "X (cm)", 350);
    await number(page, "Z (cm)", 350);
    await expect(originalLabel).toBeVisible();
    expect({
      x: await originalLabel.getAttribute("x"),
      y: await originalLabel.getAttribute("y")
    }).not.toEqual(originalLabelPosition);
    await expect(
      page.locator('[data-testid="furniture-floor"]:visible')
    ).toHaveText("0.00 m");
    await page.getByRole("button", { name: "Furniture", exact: true }).click();
    await chooseCatalog(page, "DESK · Desk");
    const overlap = await point(page, 350, 350);
    await page.mouse.move(overlap.x, overlap.y);
    await expect(page.getByTestId("furniture-preview")).toHaveAttribute(
      "data-valid",
      "false"
    );
    await page.mouse.click(overlap.x, overlap.y);
    await expect(page.getByTestId("furniture-symbol")).toHaveCount(1);
    await page.getByRole("combobox", { name: "Room", exact: true }).click();
    await page.getByRole("option", { name: "Living Room · 0.00 m" }).click();
    await expect(page.getByTestId("furniture-preview")).toHaveAttribute(
      "data-valid",
      "false"
    );
    await page.getByRole("combobox", { name: "Room", exact: true }).click();
    await page
      .getByRole("option", { name: "Elevated Study · +2.00 m" })
      .click();
    await expect(page.locator('[role="listbox"]')).toHaveCount(0);
    await expect(page.getByTestId("furniture-preview")).toHaveAttribute(
      "data-valid",
      "true"
    );
    await page.screenshot({
      path: "test-results/furniture-authoring.png",
      fullPage: true
    });
    await place(page, 350, 350);
    await expect(page.getByTestId("furniture-symbol")).toHaveCount(2);
    await page.getByRole("button", { name: "Select", exact: true }).click();
    await page.getByTestId("furniture-hit-target").last().click();
    await expect(
      page.locator('[data-testid="furniture-floor"]:visible')
    ).toHaveText("2.00 m");
    await number(page, "X (cm)", 350);
    await number(page, "Z (cm)", 350);
    await page.keyboard.press("u");
    await chooseCatalog(page, "CHAIR · Chair");
    await move(page, 450, 100);
    await expect(page.getByTestId("furniture-preview")).toHaveAttribute(
      "data-valid",
      "true"
    );
    await expect(
      page.locator('[data-testid="furniture-properties"]:visible')
    ).toContainText("Vertical clearance is not validated");
    await page.keyboard.down("Alt");
    await place(page, 450, 100);
    await page.keyboard.up("Alt");
    await expect(page.getByTestId("furniture-symbol")).toHaveCount(3);
    await page.getByRole("button", { name: "Select", exact: true }).click();
    await page.getByTestId("furniture-hit-target").last().click();
    await page.screenshot({
      path: "test-results/furniture-selected.png",
      fullPage: true
    });
    await page.getByRole("tab", { name: "Layers", exact: true }).click();
    await page.getByRole("switch", { name: "Furniture", exact: true }).click();
    await expect(page.getByTestId("furniture-symbol")).toHaveCount(0);
    await expect(page.getByTestId("furniture-hit-target")).toHaveCount(0);
    await page.getByRole("tab", { name: "Properties", exact: true }).click();
    await expect(
      page.locator('[data-testid="furniture-properties"]:visible')
    ).toHaveCount(0);
    await page.getByRole("tab", { name: "Layers", exact: true }).click();
    await page.getByRole("switch", { name: "Furniture", exact: true }).click();
    await expect(page.getByTestId("furniture-symbol")).toHaveCount(3);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Edit plan", exact: true })
    ).toBeVisible();
    const saved = await request.get(url, { headers: { authorization } });
    const savedProject = (await saved.json()).project as Project;
    expect(savedProject.building.furniture).toHaveLength(3);
    expect(savedProject.building.furniture[0]).toMatchObject({
      roomId: "living",
      definitionId: "generic-sofa",
      position: { x: 350, z: 350 },
      rotation: 27.5,
      width: 230,
      depth: 110,
      height: 95
    });
    expect(savedProject.building.furniture[1]).toMatchObject({
      roomId: "study",
      definitionId: "generic-desk",
      width: 120,
      depth: 60,
      height: 75
    });
    expect(savedProject.building.furniture[1]!.position.x).toBeCloseTo(350);
    expect(savedProject.building.furniture[1]!.position.z).toBeCloseTo(350);
    expect(savedProject.building.furniture[2]).toMatchObject({
      roomId: "living",
      definitionId: "generic-chair"
    });
    expect(
      Math.abs(savedProject.building.furniture[2]!.position.x - 450)
    ).toBeLessThan(2);
    expect(
      Math.abs(savedProject.building.furniture[2]!.position.z - 100)
    ).toBeLessThan(2);
    for (const item of savedProject.building.furniture) {
      expect(item).not.toHaveProperty("levelId");
      expect(item).not.toHaveProperty("elevation");
      expect(item.position).not.toHaveProperty("y");
    }
    await page.reload();
    await expect(page.getByTestId("furniture-symbol")).toHaveCount(3);
    const reloaded = await request.get(url, { headers: { authorization } });
    expect((await reloaded.json()).project.building.furniture).toEqual(
      savedProject.building.furniture
    );
    await page.getByRole("button", { name: "Edit plan", exact: true }).click();
    await page.getByRole("button", { name: "Select", exact: true }).click();
    await page.getByTestId("furniture-hit-target").last().click();
    await page.keyboard.press("Delete");
    await expect(page.getByTestId("furniture-symbol")).toHaveCount(2);
    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByTestId("furniture-symbol")).toHaveCount(3);
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(page.getByTestId("furniture-symbol")).toHaveCount(2);
    await page.getByRole("button", { name: "Discard", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Discard unsaved changes?" })
      .getByRole("button", { name: "Discard changes", exact: true })
      .click();
    await expect(page.getByTestId("furniture-symbol")).toHaveCount(3);
    const discarded = await request.get(url, { headers: { authorization } });
    expect((await discarded.json()).project.building.furniture).toEqual(
      savedProject.building.furniture
    );
    expect(errors).toEqual([]);
  } finally {
    if (projectId && authorization) {
      const deleted = await request.delete(
        `${apiBaseUrl}/api/v1/projects/${projectId}`,
        { headers: { authorization } }
      );
      expect(deleted.ok()).toBe(true);
    }
  }
});

async function chooseCatalog(page: Page, name: string) {
  await page.getByRole("combobox", { name: "Catalog" }).click();
  await page.getByRole("option", { name, exact: true }).click();
  await expect(page.locator('[role="listbox"]')).toHaveCount(0);
}
async function number(page: Page, name: string, value: number) {
  const input = page.getByRole("spinbutton", { name, exact: true });
  await input.fill(String(value));
  await input.press("Enter");
}
async function place(page: Page, x: number, z: number) {
  const p = await point(page, x, z);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
}
async function move(page: Page, x: number, z: number) {
  const p = await point(page, x, z);
  await page.mouse.move(p.x, p.y);
}
async function point(page: Page, x: number, z: number) {
  return page
    .locator('[data-testid="geometry-polygon"][data-source-room-id="living"]')
    .evaluate(
      (element, { x, z }) => {
        const polygon = element as SVGPolygonElement;
        const points = Array.from(polygon.points);
        const minX = Math.min(...points.map((p) => p.x)),
          maxX = Math.max(...points.map((p) => p.x)),
          minY = Math.min(...points.map((p) => p.y)),
          maxY = Math.max(...points.map((p) => p.y));
        const p = new DOMPoint(
          minX + ((maxX - minX) * x) / 600,
          maxY - ((maxY - minY) * z) / 600
        ).matrixTransform(polygon.getScreenCTM()!);
        return { x: p.x, y: p.y };
      },
      { x, z }
    );
}
