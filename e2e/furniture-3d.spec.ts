import { expect, test } from "@playwright/test";
import type { Project } from "@casastudio/schema";
import { createFurniture3DFixture } from "../apps/web/src/test/furniture-3d-fixture";

const api = process.env.CASASTUDIO_E2E_API_URL ?? "http://localhost:3000";

test("local Furniture assets, semantic inspection and Room-derived visibility preserve the Project", async ({ page, request }) => {
  const password = process.env.CASASTUDIO_KEYCLOAK_DEMO_PASSWORD;
  if (!password) throw new Error("CASASTUDIO_KEYCLOAK_DEMO_PASSWORD is required.");
  let authorization = "", projectId = "";
  const errors: string[] = [], resources: string[] = [], completedResources: string[] = [];
  page.on("response", async response => {
    if (/\.glb(?:\?|$)/.test(response.url()) && response.ok() && !(await response.finished())) completedResources.push(response.url());
  });
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", outgoing => {
    if (outgoing.url().startsWith(api)) authorization ||= outgoing.headers().authorization ?? "";
    if (/\.glb(?:\?|$)/.test(outgoing.url())) resources.push(outgoing.url());
  });
  try {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/app");
    await page.locator("#username").fill("demo"); await page.locator("#password").fill(password); await page.locator("#kc-login").click();
    await expect(page.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "New Project" }).click();
    const name = `Furniture GLB ${Date.now()}`;
    await page.getByLabel("Project name").fill(name); await page.getByRole("button", { name: "Create", exact: true }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    projectId = new URL(page.url()).pathname.split("/").at(-1)!;
    const headers = { Authorization: authorization };
    const currentResponse = await request.get(`${api}/api/v1/projects/${projectId}`, { headers });
    expect(currentResponse.ok()).toBe(true);
    const current = await currentResponse.json() as { project: Project; sourceRevision: number };
    const project = createFurniture3DFixture(current.project);
    const saved = await request.put(`${api}/api/v1/projects/${projectId}`, { headers, data: { baseRevision: current.sourceRevision, project } });
    expect(saved.ok(), await saved.text()).toBe(true);
    const before = await (await request.get(`${api}/api/v1/projects/${projectId}`, { headers })).json();
    await page.reload();
    await expect(page.getByRole("button", { name: "3D workspace" })).toBeVisible();
    expect(resources).toHaveLength(0);
    await page.getByRole("button", { name: "3D workspace" }).click();
    const workspace = page.getByTestId("project-3d-workspace");
    await expect(workspace).toHaveAttribute("data-renderer-status", "ready");
    await expect(workspace).toHaveAttribute("data-furniture-count", "11");
    await expect.poll(() => resources.length).toBe(7);
    await expect.poll(() => completedResources.length).toBe(7);
    expect(resources.every(url => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
    const poses = JSON.parse((await workspace.getAttribute("data-furniture-poses"))!);
    expect(poses).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "raised-chair", baseY: 2.7 }), expect.objectContaining({ id: "upper-chair", baseY: 3.4 }),
      expect.objectContaining({ id: "showcase-generic-desk", width: 1.45, depth: 0.72, height: 0.82 })
    ]));
    const canvas = workspace.locator("canvas");
    await page.getByRole("button", { name: "Fit to building" }).click();
    await expect.poll(() => workspace.getAttribute("data-projected-selection-targets")).not.toBe("");
    await canvas.screenshot({ path: test.info().outputPath("furniture-catalog.png") });
    const targets = JSON.parse((await workspace.getAttribute("data-projected-selection-targets"))!);
    const target = targets["showroom:furniture:showcase-generic-cabinet"];
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + (target.x + 1) * box.width / 2, box.y + (target.y + 1) * box.height / 2);
    await page.mouse.down(); await page.mouse.up();
    await expect(workspace).toHaveAttribute("data-selected-entity-id", "showcase-generic-cabinet");
    const details = page.getByRole("complementary", { name: "Inspector" }).first().getByTestId("project-3d-selection-details");
    await expect(details.getByText("generic-cabinet", { exact: true })).toBeVisible();
    await expect(details.getByText("1.80 m", { exact: true })).toBeVisible();
    await expect(details.locator("input")).toHaveCount(0);
    await canvas.screenshot({ path: test.info().outputPath("furniture-selection.png") });
    await page.getByRole("button", { name: "Active Level", exact: true }).click();
    await expect(workspace).toHaveAttribute("data-furniture-count", "10");
    await page.getByRole("button", { name: "All Levels", exact: true }).click();
    await expect(workspace).toHaveAttribute("data-furniture-count", "11");
    expect(resources).toHaveLength(7);
    expect(errors).toEqual([]);
    await page.getByRole("button", { name: "2D workspace" }).click();
    await expect(page.locator('svg[aria-labelledby="geometry-svg-title geometry-svg-description"]')).toBeVisible();
    const after = await (await request.get(`${api}/api/v1/projects/${projectId}`, { headers })).json();
    expect(after).toEqual(before);
  } finally {
    if (projectId && authorization) await request.delete(`${api}/api/v1/projects/${projectId}`, { headers: { Authorization: authorization } });
  }
});
