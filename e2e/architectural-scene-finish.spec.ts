import { expect, test, type Locator, type Page } from "@playwright/test";
import type { Project } from "@casastudio/schema";

import { createArchitecturalSceneFinishFixture } from "../apps/web/src/test/architectural-scene-finish-fixture";

const api = process.env.CASASTUDIO_E2E_API_URL ?? "http://localhost:3000";

test("finished architectural scene remains coherent, bounded, selectable and read-only", async ({ page, request }) => {
  const password = process.env.CASASTUDIO_KEYCLOAK_DEMO_PASSWORD;
  if (!password) throw new Error("CASASTUDIO_KEYCLOAK_DEMO_PASSWORD is required.");
  let authorization = "", projectId = "";
  const pageErrors: string[] = [], consoleErrors: string[] = [], resources: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("request", (outgoing) => {
    if (outgoing.url().startsWith(api)) authorization ||= outgoing.headers().authorization ?? "";
    if (/\.glb(?:\?|$)/.test(outgoing.url())) resources.push(outgoing.url());
  });
  try {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/app");
    await page.locator("#username").fill("demo");
    await page.locator("#password").fill(password);
    await page.locator("#kc-login").click();
    await expect(page.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "New Project" }).click();
    const name = `Scene Finish ${Date.now()}`;
    await page.getByLabel("Project name").fill(name);
    await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    projectId = new URL(page.url()).pathname.split("/").at(-1)!;
    const url = `${api}/api/v1/projects/${projectId}`;
    const headers = { Authorization: authorization };
    const current = await (await request.get(url, { headers })).json() as {
      project: Project;
      sourceRevision: number;
    };
    const project = createArchitecturalSceneFinishFixture(current.project);
    const saved = await request.put(url, {
      headers,
      data: { baseRevision: current.sourceRevision, project }
    });
    expect(saved.ok(), await saved.text()).toBe(true);
    const before = await (await request.get(url, { headers })).json();

    await page.reload();
    expect(resources).toHaveLength(0);
    await page.getByRole("button", { name: "3D workspace" }).click();
    const scene = page.getByTestId("project-3d-workspace");
    const canvas = scene.locator("canvas");
    await expect(scene).toHaveAttribute("data-renderer-status", "ready");
    await expect(scene).toHaveAttribute("data-furniture-count", "11");
    await expect(scene).toHaveAttribute("data-architectural-staircase-count", "1");
    await expect(scene).toHaveAttribute("data-architectural-step-count", "12");
    await expect(scene).toHaveAttribute("data-architectural-door-count", "1");
    await expect(scene).toHaveAttribute("data-architectural-window-count", "1");
    await expect(scene).toHaveAttribute("data-architectural-wall-opening-count", "1");
    await expect.poll(() => resources.length).toBe(7);
    expect(resources.every((resource) => new URL(resource).origin === new URL(page.url()).origin)).toBe(true);

    await expect.poll(() => scene.getAttribute("data-camera-position")).not.toBe("");
    const initialPosition = await scene.getAttribute("data-camera-position");
    await page.getByRole("button", { name: "Fit to building", exact: true }).click();
    await expect.poll(() => scene.getAttribute("data-projected-selection-targets")).not.toBe("");
    await scene.screenshot({ path: test.info().outputPath("finished-house-overview.png") });
    const bounds = (await canvas.boundingBox())!;
    await page.mouse.move(bounds.x + bounds.width * 0.72, bounds.y + bounds.height * 0.42);
    await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width * 0.62, bounds.y + bounds.height * 0.3, { steps: 10 });
    await page.mouse.up();
    await page.getByRole("button", { name: "Reset camera", exact: true }).click();
    await expect.poll(() => scene.getAttribute("data-camera-position")).toBe(initialPosition);

    await clickTarget(page, scene, canvas, "showroom:furniture:showcase-generic-cabinet");
    await expect(scene).toHaveAttribute("data-selected-entity-kind", "furniture");
    await expect(scene).toHaveAttribute("data-selected-entity-id", "showcase-generic-cabinet");
    await expect(page.getByTestId("project-3d-selection-details").locator("input")).toHaveCount(0);
    await clickTarget(page, scene, canvas, "showroom:staircase:scene-stair:landing");
    await expect(scene).toHaveAttribute("data-selected-entity-kind", "staircase");
    await expect(scene).toHaveAttribute("data-selected-entity-id", "scene-stair");

    await page.getByRole("button", { name: "Active Level", exact: true }).click();
    await expect(scene).toHaveAttribute("data-furniture-count", "10");
    await expect(scene).toHaveAttribute("data-architectural-staircase-count", "1");
    await page.getByRole("button", { name: "All Levels", exact: true }).click();
    await expect(scene).toHaveAttribute("data-furniture-count", "11");
    await page.getByRole("button", { name: "Fit to building", exact: true }).click();
    await scene.screenshot({ path: test.info().outputPath("finished-house-all-levels.png") });
    await page.getByRole("button", { name: "2D workspace" }).click();
    await expect(page.locator('svg[aria-labelledby="geometry-svg-title geometry-svg-description"]')).toBeVisible();
    expect(await (await request.get(url, { headers })).json()).toEqual(before);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  } finally {
    if (projectId && authorization) {
      const removed = await request.delete(`${api}/api/v1/projects/${projectId}`, {
        headers: { Authorization: authorization }
      });
      if (!removed.ok()) console.warn(`Could not remove E2E Project ${projectId}.`);
    }
  }
});

async function clickTarget(page: Page, scene: Locator, canvas: Locator, key: string) {
  await expect.poll(() => scene.getAttribute("data-projected-selection-targets")).not.toBe("");
  const targets = JSON.parse((await scene.getAttribute("data-projected-selection-targets"))!) as
    Record<string, { x: number; y: number }>;
  const point = targets[key];
  expect(point, key).toBeDefined();
  expect(Math.abs(point!.x)).toBeLessThan(1);
  expect(Math.abs(point!.y)).toBeLessThan(1);
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.click(
    bounds.x + (point!.x + 1) * bounds.width / 2,
    bounds.y + (point!.y + 1) * bounds.height / 2
  );
}
