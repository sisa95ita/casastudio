import { expect, test, type Locator, type Page } from "@playwright/test";
import type { Project } from "@casastudio/schema";

import { createArchitecturalSceneFinishFixture } from "../apps/web/src/test/architectural-scene-finish-fixture";

const api = process.env.CASASTUDIO_E2E_API_URL ?? "http://localhost:3000";

test("edits Furniture through the canonical 3D draft while View remains read-only", async ({
  page,
  request
}) => {
  const password = process.env.CASASTUDIO_KEYCLOAK_DEMO_PASSWORD;
  if (!password)
    throw new Error("CASASTUDIO_KEYCLOAK_DEMO_PASSWORD is required.");
  let authorization = "";
  let projectId = "";
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (outgoing) => {
    if (outgoing.url().startsWith(api))
      authorization ||= outgoing.headers().authorization ?? "";
  });

  try {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/app");
    await page.locator("#username").fill("demo");
    await page.locator("#password").fill(password);
    await page.locator("#kc-login").click();
    await expect(
      page.getByRole("heading", { name: "Projects", level: 1 })
    ).toBeVisible();
    await page.getByRole("button", { name: "New Project" }).click();
    const name = `3D Furniture interaction ${Date.now()}`;
    await page.getByLabel("Project name").fill(name);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();

    projectId = new URL(page.url()).pathname.split("/").at(-1)!;
    const url = `${api}/api/v1/projects/${projectId}`;
    const headers = { Authorization: authorization };
    const current = (await (await request.get(url, { headers })).json()) as {
      project: Project;
      sourceRevision: number;
    };
    const fixture = createArchitecturalSceneFinishFixture(current.project);
    const sofa = fixture.building.furniture.find(
      (item) => item.id === "showcase-generic-sofa"
    )!;
    const cabinet = fixture.building.furniture.find(
      (item) => item.id === "showcase-generic-cabinet"
    )!;
    [sofa.position, cabinet.position] = [cabinet.position, sofa.position];
    const prepared = await request.put(url, {
      headers,
      data: { baseRevision: current.sourceRevision, project: fixture }
    });
    expect(prepared.ok(), await prepared.text()).toBe(true);

    await page.reload();
    await page.getByRole("button", { name: "Edit plan" }).click();
    await page.getByRole("button", { name: "3D workspace" }).click();
    const scene = page.getByTestId("project-3d-workspace");
    const canvas = scene.locator("canvas");
    await expect(scene).toHaveAttribute("data-renderer-status", "ready");
    await page.getByRole("button", { name: "Fit to building" }).click();

    const sofaKey = "showroom:furniture:showcase-generic-sofa";
    await clickProjectedTarget(page, scene, canvas, sofaKey);
    await expect(scene).toHaveAttribute(
      "data-selected-entity-id",
      "showcase-generic-sofa"
    );
    const properties = page.locator('[data-testid="furniture-properties"]:visible');
    const x = properties.getByRole("spinbutton", { name: "X (cm)" });
    const z = properties.getByRole("spinbutton", { name: "Z (cm)" });
    const rotation = properties.getByRole("spinbutton", {
      name: "Rotation (°)"
    });
    const originalX = Number(await x.inputValue());
    const originalZ = Number(await z.inputValue());
    const originalRotation = Number(await rotation.inputValue());

    const sofaPoint = await projectedPoint(scene, canvas, sofaKey);
    await page.mouse.move(sofaPoint.x, sofaPoint.y);
    await page.mouse.down();
    await page.mouse.move(sofaPoint.x + 24, sofaPoint.y + 12);
    await page.mouse.up();
    await expect.poll(async () => [Number(await x.inputValue()), Number(await z.inputValue())])
      .not.toEqual([originalX, originalZ]);
    const movedX = Number(await x.inputValue());
    const movedZ = Number(await z.inputValue());

    await rotation.fill(String(originalRotation + 37));
    await rotation.blur();
    await expect(rotation).toHaveValue(String(originalRotation + 37));
    const rotated = Number(await rotation.inputValue());

    await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
    await page.getByRole("button", { name: "Undo" }).click();
    await page.getByRole("button", { name: "2D workspace" }).click();
    await selectFurnitureIn2D(page, "showcase-generic-sofa");
    await expect(
      page.locator('[data-testid="furniture-properties"]:visible').getByRole(
        "spinbutton",
        { name: "Rotation (°)" }
      )
    ).toHaveValue(String(originalRotation));
    await page.getByRole("button", { name: "Redo" }).click();
    await selectFurnitureIn2D(page, "showcase-generic-sofa");
    await page.getByRole("button", { name: "3D workspace" }).click();
    const restoredProperties = page.locator(
      '[data-testid="furniture-properties"]:visible'
    );
    const restoredRotation = restoredProperties.getByRole("spinbutton", {
      name: "Rotation (°)"
    });
    await expect(restoredRotation).toHaveValue(String(rotated));

    const restoredX = restoredProperties.getByRole("spinbutton", {
      name: "X (cm)"
    });
    const restoredZ = restoredProperties.getByRole("spinbutton", {
      name: "Z (cm)"
    });
    await restoredX.fill("790");
    await restoredX.blur();
    await expect(restoredX).toHaveValue(String(movedX));
    await expect(restoredZ).toHaveValue(String(movedZ));

    const raisedKey = "showroom:furniture:raised-chair";
    await page.getByRole("button", { name: "2D workspace" }).click();
    await selectFurnitureIn2D(page, "raised-chair");
    await expect(properties.getByTestId("furniture-floor")).toHaveText("2.70 m");
    const raisedX = properties.getByRole("spinbutton", { name: "X (cm)" });
    const raisedBefore = Number(await raisedX.inputValue());
    await page.getByRole("button", { name: "3D workspace" }).click();
    await raisedX.fill(String(raisedBefore + 10));
    await raisedX.blur();
    await expect(raisedX).toHaveValue(String(raisedBefore + 10));
    await expect(properties.getByTestId("furniture-floor")).toHaveText("2.70 m");

    const raisedMovedX = Number(await raisedX.inputValue());
    await page.getByRole("button", { name: "2D workspace" }).click();
    await expect(
      page.locator('svg[aria-labelledby="geometry-svg-title geometry-svg-description"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="furniture-properties"]:visible').getByRole(
        "spinbutton",
        { name: "X (cm)" }
      )
    ).toHaveValue(String(raisedMovedX));
    await page.getByRole("button", { name: "3D workspace" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Edit in 2D" })).toBeVisible();

    const saved = (await (await request.get(url, { headers })).json()) as {
      project: Project;
    };
    const savedSofa = saved.project.building.furniture.find(
      (item) => item.id === "showcase-generic-sofa"
    )!;
    expect(savedSofa.position.x).toBeCloseTo(movedX, 2);
    expect(savedSofa.position.z).toBeCloseTo(movedZ, 2);
    expect(savedSofa.rotation).toBeCloseTo(rotated, 2);
    expect(
      saved.project.building.furniture.find((item) => item.id === "raised-chair")
        ?.position.x
    ).toBeCloseTo(raisedMovedX, 2);

    await expect(
      page
        .getByRole("complementary", { name: "Inspector" })
        .first()
        .getByTestId("project-3d-selection-details")
    ).toBeVisible();
    await expect(page.locator('[data-testid="furniture-properties"]:visible')).toHaveCount(0);
    const beforeReadOnlyDrag = await (await request.get(url, { headers })).json();
    const readOnlyPoint = await projectedPoint(scene, canvas, sofaKey);
    await page.mouse.move(readOnlyPoint.x, readOnlyPoint.y);
    await page.mouse.down();
    await page.mouse.move(readOnlyPoint.x + 30, readOnlyPoint.y + 10);
    await page.mouse.up();
    expect(await (await request.get(url, { headers })).json()).toEqual(
      beforeReadOnlyDrag
    );

    await page.reload();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    expect(await (await request.get(url, { headers })).json()).toEqual(
      beforeReadOnlyDrag
    );
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  } finally {
    if (projectId && authorization)
      await request.delete(`${api}/api/v1/projects/${projectId}`, {
        headers: { Authorization: authorization }
      });
  }
});

async function projectedPoint(
  scene: Locator,
  canvas: Locator,
  key: string
): Promise<{ x: number; y: number }> {
  await expect.poll(() => scene.getAttribute("data-projected-selection-targets"))
    .not.toBe("");
  const targets = JSON.parse(
    (await scene.getAttribute("data-projected-selection-targets"))!
  ) as Record<string, { x: number; y: number }>;
  return toCanvasPoint((await canvas.boundingBox())!, targets[key]!);
}

async function clickProjectedTarget(
  page: Page,
  scene: Locator,
  canvas: Locator,
  key: string
) {
  const point = await projectedPoint(scene, canvas, key);
  await page.mouse.click(point.x, point.y);
}

async function selectFurnitureIn2D(page: Page, id: string) {
  await page
    .locator(`[data-testid="furniture-hit-target"][data-furniture-id="${id}"]`)
    .click({ force: true });
}

function toCanvasPoint(
  box: { x: number; y: number; width: number; height: number },
  point: { x: number; y: number }
) {
  expect(point).toBeDefined();
  expect(Math.abs(point.x)).toBeLessThan(1);
  expect(Math.abs(point.y)).toBeLessThan(1);
  return {
    x: box.x + ((point.x + 1) * box.width) / 2,
    y: box.y + ((point.y + 1) * box.height) / 2
  };
}
