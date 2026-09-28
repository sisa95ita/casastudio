import { expect, test, type Locator, type Page } from "@playwright/test";
import type { Project } from "@casastudio/schema";
import { createVerticalArchitectureFixture } from "../apps/web/src/test/vertical-architecture-fixture";

const apiBaseUrl = process.env.CASASTUDIO_E2E_API_URL ?? "http://localhost:3000";

for (const layout of ["straight", "L", "U"] as const) {
  test(`vertical architecture: ${layout} canonical Stair, closed elevated floor and semantic interaction`, async ({ page, request }) => {
    const password = process.env.CASASTUDIO_KEYCLOAK_DEMO_PASSWORD;
    if (!password) throw new Error("CASASTUDIO_KEYCLOAK_DEMO_PASSWORD is required.");
    let authorization = "", projectId = "";
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (outgoing) => {
      if (outgoing.url().startsWith(apiBaseUrl)) authorization ||= outgoing.headers().authorization ?? "";
    });
    try {
      await page.goto("/app");
      await page.locator("#username").fill("demo");
      await page.locator("#password").fill(password);
      await page.locator("#kc-login").click();
      await expect(page.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible();
      const name = `Vertical ${layout} ${Date.now()}`;
      await page.getByRole("button", { name: "New Project" }).click();
      await page.getByLabel("Project name").fill(name);
      await page.getByRole("button", { name: "Create", exact: true }).click();
      await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
      projectId = new URL(page.url()).pathname.split("/").at(-1)!;
      const url = `${apiBaseUrl}/api/v1/projects/${projectId}`;
      const headers = { Authorization: authorization };
      const response = await request.get(url, { headers });
      expect(response.ok()).toBe(true);
      const current = await response.json() as { project: Project; sourceRevision: number };
      const crossLevel = layout !== "straight";
      const project = createVerticalArchitectureFixture(current.project, layout, crossLevel);
      const saved = await request.put(url, { headers, data: { baseRevision: current.sourceRevision, project } });
      expect(saved.ok(), await saved.text()).toBe(true);
      const before = await (await request.get(url, { headers })).json();
      await page.reload();
      await page.getByRole("button", { name: "3D workspace" }).click();
      const scene = page.getByTestId("project-3d-workspace");
      await expect(scene).toHaveAttribute("data-renderer-status", "ready");
      await expect(scene).toHaveAttribute("data-architectural-staircase-count", "1");
      await expect(scene).toHaveAttribute("data-architectural-step-count", "12");
      const volumes = JSON.parse((await scene.getAttribute("data-architectural-floor-volumes"))!) as { roomId: string; top: number; bottom: number }[];
      expect(volumes).toHaveLength(2);
      expect(volumes.find((floor) => floor.roomId === "lower")).toEqual({ roomId: "lower", top: 0, bottom: -0.18 });
      expect(volumes.find((floor) => floor.roomId === "elevated")!.top).toBe(crossLevel ? 3 : 2.2);
      expect(volumes.every((floor) => Math.abs(floor.top - floor.bottom - 0.18) < 1e-9)).toBe(true);
      await page.getByRole("button", { name: "Fit to building", exact: true }).click();
      const canvas = scene.locator("canvas");
      await scene.screenshot({ path: test.info().outputPath(`${layout}-overview.png`) });
      await clickTarget(page, scene, canvas, "ground:staircase:stair");
      await expect(scene).toHaveAttribute("data-selected-entity-kind", "staircase");
      await expect(scene).toHaveAttribute("data-selected-entity-id", "stair");
      await expect(page.getByTestId("project-3d-selection-details").getByText("Staircase", { exact: true }).first()).toBeVisible();
      await page.keyboard.press("Escape");
      await clickTarget(page, scene, canvas, "ground:staircase:stair:slab");
      await expect(scene).toHaveAttribute("data-selected-entity-kind", "staircase");
      if (layout !== "straight") {
        await page.keyboard.press("Escape");
        await clickTarget(page, scene, canvas, "ground:staircase:stair:landing");
        await expect(scene).toHaveAttribute("data-selected-entity-kind", "staircase");
      }
      await page.keyboard.press("Escape");
      await clickTarget(page, scene, canvas, `${crossLevel ? "upper" : "ground"}:room:elevated:floor-side`);
      await expect(scene).toHaveAttribute("data-selected-entity-kind", "room");
      await expect(scene).toHaveAttribute("data-selected-entity-id", "elevated");
      await page.keyboard.press("Escape");
      const bounds = (await canvas.boundingBox())!;
      await page.mouse.move(bounds.x + bounds.width * 0.7, bounds.y + bounds.height * 0.45);
      await page.mouse.down();
      await page.mouse.move(bounds.x + bounds.width * 0.7 + 25, bounds.y + bounds.height * 0.2, { steps: 12 });
      await page.mouse.up();
      await scene.screenshot({ path: test.info().outputPath(`${layout}-soffit.png`) });
      await page.mouse.move(bounds.x + bounds.width * 0.65, bounds.y + bounds.height * 0.3);
      await page.mouse.down();
      await page.mouse.move(bounds.x + bounds.width * 0.65 - 65, bounds.y + bounds.height * 0.6, { steps: 12 });
      await page.mouse.up();
      await scene.screenshot({ path: test.info().outputPath(`${layout}-landing-treads.png`) });
      await page.getByRole("button", { name: "Reset camera", exact: true }).click();
      if (crossLevel) {
        await page.getByRole("button", { name: /^Level:/ }).click();
        await page.getByRole("menuitem", { name: "Upper", exact: true }).click();
        await page.getByRole("button", { name: "Active Level", exact: true }).click();
        await expect(scene).toHaveAttribute("data-architectural-staircase-count", "0");
        await page.getByRole("button", { name: /^Level:/ }).click();
        await page.getByRole("menuitem", { name: "Ground", exact: true }).click();
        await expect(scene).toHaveAttribute("data-architectural-staircase-count", "1");
        const bounds = JSON.parse((await scene.getAttribute("data-visible-architectural-bounds"))!);
        expect(bounds.max.y).toBe(3);
      }
      await page.getByRole("button", { name: "2D workspace" }).click();
      await expect(page.getByRole("button", { name: "Edit plan" })).toBeVisible();
      expect(await (await request.get(url, { headers })).json()).toEqual(before);
      expect(errors).toEqual([]);
    } finally {
      if (projectId && authorization) {
        const result = await request.delete(`${apiBaseUrl}/api/v1/projects/${projectId}`, { headers: { Authorization: authorization } });
        expect(result.ok()).toBe(true);
      }
    }
  });
}

async function clickTarget(page: Page, scene: Locator, canvas: Locator, key: string) {
  await expect.poll(() => scene.getAttribute("data-projected-selection-targets")).not.toBe("");
  const targets = JSON.parse((await scene.getAttribute("data-projected-selection-targets"))!) as Record<string, { x: number; y: number }>;
  const point = targets[key];
  expect(point, key).toBeDefined();
  expect(Math.abs(point!.x)).toBeLessThan(1);
  expect(Math.abs(point!.y)).toBeLessThan(1);
  const bounds = (await canvas.boundingBox())!;
  await page.mouse.click(bounds.x + (point!.x + 1) * bounds.width / 2, bounds.y + (point!.y + 1) * bounds.height / 2);
}
