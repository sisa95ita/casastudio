import { expect, test, type Page } from "@playwright/test";
import {
  createFurnitureItemFromDefinition,
  resolveBuiltinFurnitureDefinition,
  type Project
} from "../packages/schema/src/index.js";
import { furnitureProjectFixture } from "../apps/web/src/test/furniture-project-fixture";

const api = "http://localhost:3106";

for (const operation of ["rotate", "add"] as const) {
  test(`AI-D1 ${operation}: real auth/API/DB, fixture provider, explicit Apply and normal history/save`, async ({
    page,
    request
  }, testInfo) => {
    const password = process.env.CASASTUDIO_KEYCLOAK_DEMO_PASSWORD;
    if (!password)
      throw new Error("CASASTUDIO_KEYCLOAK_DEMO_PASSWORD is required.");
    let authorization = "",
      projectId = "";
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (outgoing) => {
      if (outgoing.url().startsWith(api))
        authorization ||= outgoing.headers().authorization ?? "";
    });
    const headers = () => ({ Authorization: authorization });
    const read = async () =>
      (
        await (
          await request.get(`${api}/api/v1/projects/${projectId}`, {
            headers: headers()
          })
        ).json()
      ).project as Project;
    const state = async () =>
      (await (await request.get(`${api}/__ai-d1/state`)).json()).calls as {
        context: {
          placementHint?: {
            roomId: string;
            position: { x: number; z: number };
          };
          selectedFurniture: { id: string }[];
        };
      }[];
    const fixtureResult = async () => {
      const response = await request.post(`${api}/__ai-d1/result`, {
        data:
          operation === "rotate"
            ? {
                kind: "EDIT_PROPOSAL",
                operations: [
                  {
                    type: "ROTATE_FURNITURE",
                    furnitureId: "item-a",
                    targetRotation: 120
                  }
                ]
              }
            : { kind: "ADD_AT_ANCHOR", definitionId: "generic-desk" }
      });
      expect(response.status()).toBe(204);
    };
    try {
      await page.setViewportSize({ width: 1600, height: 1100 });
      await page.goto("/app");
      await page.locator("#username").fill("demo");
      await page.locator("#password").fill(password);
      await page.locator("#kc-login").click();
      await expect(
        page.getByRole("heading", { name: "Projects", level: 1 })
      ).toBeVisible();
      const created = await request.post(`${api}/api/v1/projects`, {
        headers: headers(),
        data: { name: `AI-D1 ${operation} synthetic ${Date.now()}` }
      });
      expect(created.status()).toBe(201);
      const base = (await created.json()).project as Project;
      projectId = base.id;
      const fixture = furnitureProjectFixture();
      fixture.building.furniture = [
        createFurnitureItemFromDefinition(
          resolveBuiltinFurnitureDefinition("generic-chair")!,
          {
            id: "item-a",
            roomId: "living",
            position: { x: 200, z: 200 },
            rotation: 30
          }
        )
      ];
      const saved = await request.put(`${api}/api/v1/projects/${projectId}`, {
        headers: headers(),
        data: {
          baseRevision: base.revision,
          project: { ...base, building: fixture.building }
        }
      });
      expect(saved.ok(), await saved.text()).toBe(true);
      const original = await read();
      const initialCalls = (await state()).length;
      await page.goto(`/app/projects/${projectId}`);
      await page
        .getByRole("button", { name: "Edit plan", exact: true })
        .click();
      await page.getByTestId("furniture-hit-target").click();
      const properties = page.locator(
        '[data-testid="furniture-properties"]:visible'
      );
      const rotation = () =>
        properties.getByRole("spinbutton", { name: "Rotation (°)" });
      await expect(rotation()).toHaveValue("30");
      const originalPoints = await page
        .getByTestId("furniture-hit-target")
        .getAttribute("points");
      await page.getByRole("button", { name: "AI Furniture editing" }).click();
      if (operation === "add") {
        await page.getByRole("button", { name: "Set here on 2D plan" }).click();
        const point = await projectPoint(page, 150, 400);
        await page.mouse.click(point.x, point.y);
        await expect(page.getByText(/^Here: X /)).toBeVisible();
      }
      const instruction = page.getByLabel("Furniture edit instruction");
      await instruction.fill(
        operation === "rotate"
          ? "Rotate this Furniture by 90 degrees"
          : "Add a desk here"
      );
      await fixtureResult();
      await page.getByRole("button", { name: "Request edit proposal" }).click();
      await expect(page.getByTestId("furniture-edit-review")).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("review.png") });
      await expect(rotation()).toHaveValue("30");
      await expect(page.getByTestId("furniture-symbol")).toHaveCount(1);
      expect(await read()).toEqual(original);
      await page.getByRole("button", { name: "Cancel edit" }).click();
      await expect(page.getByTestId("furniture-edit-review")).toHaveCount(0);
      expect(await read()).toEqual(original);
      await fixtureResult();
      await page.getByRole("button", { name: "Request edit proposal" }).click();
      await expect(page.getByTestId("furniture-edit-review")).toBeVisible();
      await page.getByRole("button", { name: "Apply changes" }).click();
      if (operation === "rotate") {
        await expect(rotation()).toHaveValue("120");
        expect(
          await page.getByTestId("furniture-hit-target").getAttribute("points")
        ).not.toBe(originalPoints);
      } else await expect(page.getByTestId("furniture-symbol")).toHaveCount(2);
      expect((await state()).length).toBe(initialCalls + 2); // Apply never calls the provider.
      expect(await read()).toEqual(original); // Normal unsaved draft only.
      await expect(
        page.getByRole("button", { name: "Request edit proposal" })
      ).toBeDisabled();
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await page
        .locator(
          '[data-testid="furniture-hit-target"][data-furniture-id="item-a"]'
        )
        .click();
      await expect(rotation()).toHaveValue("30");
      await expect(page.getByTestId("furniture-symbol")).toHaveCount(1);
      await page.getByRole("button", { name: "Redo", exact: true }).click();
      await page
        .locator(
          '[data-testid="furniture-hit-target"][data-furniture-id="item-a"]'
        )
        .click();
      if (operation === "rotate") await expect(rotation()).toHaveValue("120");
      else await expect(page.getByTestId("furniture-symbol")).toHaveCount(2);
      await page.getByRole("button", { name: "3D workspace" }).click();
      const scene = page.getByTestId("project-3d-workspace");
      await expect(scene).toHaveAttribute("data-renderer-status", "ready");
      await expect(scene).toHaveAttribute(
        "data-furniture-count",
        operation === "rotate" ? "1" : "2"
      );
      const poses = JSON.parse(
        (await scene.getAttribute("data-furniture-poses"))!
      ) as { id: string; yaw: number }[];
      expect(poses.find((item) => item.id === "item-a")!.yaw).toBeCloseTo(
        (-(operation === "rotate" ? 120 : 30) * Math.PI) / 180
      );
      const saveResponsePromise = page.waitForResponse(
        (response) =>
          response.url() === `${api}/api/v1/projects/${projectId}` &&
          response.request().method() === "PUT"
      );
      await page.getByRole("button", { name: "Save", exact: true }).click();
      expect((await saveResponsePromise).status()).toBe(200);
      await expect
        .poll(async () => (await read()).revision)
        .toBe(original.revision + 1);
      const after = await read();
      if (operation === "rotate") {
        expect(after.building.furniture[0]).toEqual({
          ...original.building.furniture[0],
          rotation: 120
        });
      } else {
        const anchor = (await state()).at(-1)!.context.placementHint!;
        expect(after.building.furniture[1]).toMatchObject({
          id: expect.stringMatching(/^furniture-/),
          definitionId: "generic-desk",
          roomId: anchor.roomId,
          position: anchor.position,
          width: 120,
          depth: 60,
          height: 75
        });
      }
      await page.reload();
      expect((await read()).building.furniture).toEqual(
        after.building.furniture
      );
      expect(errors).toEqual([]);
    } finally {
      if (projectId && authorization)
        expect(
          (
            await request.delete(`${api}/api/v1/projects/${projectId}`, {
              headers: headers()
            })
          ).ok()
        ).toBe(true);
    }
  });
}

async function projectPoint(page: Page, x: number, z: number) {
  return page
    .locator('[data-testid="geometry-polygon"][data-source-room-id="living"]')
    .evaluate(
      (element, point) => {
        const polygon = element as SVGPolygonElement;
        const points = Array.from(polygon.points);
        const minX = Math.min(...points.map((p) => p.x)),
          maxX = Math.max(...points.map((p) => p.x));
        const minY = Math.min(...points.map((p) => p.y)),
          maxY = Math.max(...points.map((p) => p.y));
        const screen = new DOMPoint(
          minX + ((maxX - minX) * point.x) / 600,
          maxY - ((maxY - minY) * point.z) / 600
        ).matrixTransform(polygon.getScreenCTM()!);
        return { x: screen.x, y: screen.y };
      },
      { x, z }
    );
}
