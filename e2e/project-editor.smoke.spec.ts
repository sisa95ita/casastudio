import { expect, test, type ConsoleMessage } from "@playwright/test";

test("authenticates and exercises the Demo Project editor in Chromium", async ({
  page
}) => {
  const demoPassword = process.env.CASASTUDIO_KEYCLOAK_DEMO_PASSWORD;
  if (!demoPassword) {
    throw new Error(
      "CASASTUDIO_KEYCLOAK_DEMO_PASSWORD is required in the environment or repository-root .env."
    );
  }

  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message: ConsoleMessage) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/app");
  await expect(page).toHaveURL(
    /\/realms\/casastudio\/protocol\/openid-connect\/auth/
  );
  await page.locator("#username").fill("demo");
  await page.locator("#password").fill(demoPassword);
  await page.locator("#kc-login").click();

  await expect(page).toHaveURL(/\/app(?:[?#].*)?$/);
  await expect(
    page.getByRole("heading", { name: "Projects", level: 1 })
  ).toBeVisible();

  const demoProject = page
    .getByRole("article")
    .filter({ hasText: "Demo Project" });
  await expect(demoProject).toBeVisible();
  await demoProject.getByRole("link", { name: "Open project" }).click();

  await expect(page).toHaveURL(/\/app\/projects\/demo-project$/);
  await expect(
    page.getByRole("heading", { name: "Demo Project", level: 1 })
  ).toBeVisible();

  const editorViewport = page.locator(
    'svg[aria-labelledby="geometry-svg-title geometry-svg-description"]'
  );
  await expect(editorViewport).toBeVisible();
  const polygon = editorViewport
    .locator('[data-testid="geometry-polygon"]')
    .first();
  await expect(polygon).toBeVisible();
  const pointsBeforeWheel = await polygon.getAttribute("points");
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByText("No unsaved changes")).toBeVisible();
  const scaleBeforeWheel = await page
    .getByRole("combobox", { name: "Scale" })
    .textContent();
  await polygon.evaluate((element) => {
    const browserWindow = window as typeof window & {
      __casastudioWheelMutationCount?: number;
      __casastudioWheelObserver?: MutationObserver;
    };
    browserWindow.__casastudioWheelMutationCount = 0;
    browserWindow.__casastudioWheelObserver = new MutationObserver((records) => {
      browserWindow.__casastudioWheelMutationCount =
        (browserWindow.__casastudioWheelMutationCount ?? 0) +
        records.filter(
          (record) =>
            record.type === "attributes" && record.attributeName === "points"
        ).length;
    });
    browserWindow.__casastudioWheelObserver.observe(element, {
      attributes: true,
      attributeFilter: ["points"]
    });
  });

  await editorViewport.hover();
  await page.mouse.wheel(0, -160);
  await expect
    .poll(() => polygon.getAttribute("points"))
    .not.toBe(pointsBeforeWheel);
  const wheelMutationCount = await page.evaluate(() => {
    const browserWindow = window as typeof window & {
      __casastudioWheelMutationCount?: number;
      __casastudioWheelObserver?: MutationObserver;
    };
    browserWindow.__casastudioWheelObserver?.disconnect();
    return browserWindow.__casastudioWheelMutationCount ?? 0;
  });
  expect(wheelMutationCount, "One wheel gesture should update the viewport once")
    .toBe(1);
  await expect(page.getByText("No unsaved changes")).toBeVisible();
  expect(await page.getByRole("combobox", { name: "Scale" }).textContent())
    .toBe(scaleBeforeWheel);

  const pointsBeforeFit = await polygon.getAttribute("points");
  await page.getByRole("button", { name: "Fit to view" }).click();
  await expect.poll(() => polygon.getAttribute("points")).not.toBe(pointsBeforeFit);

  const wallEdges = editorViewport.locator('[data-testid="boundary-edge"]');
  const wallCountBeforeDrawing = await wallEdges.count();
  const roomPolygons = editorViewport.locator('[data-testid="geometry-polygon"]');
  const roomCentroids = editorViewport.locator('[data-testid="polygon-centroid"]');
  const roomCountBeforeDrawing = await roomPolygons.count();
  const centroidCountBeforeDrawing = await roomCentroids.count();
  const viewportBounds = await editorViewport.boundingBox();
  if (!viewportBounds) throw new Error("The Project editor viewport has no bounds.");

  await page.getByRole("button", { name: "Draw Wall" }).click();
  const inset = 48;
  const side = Math.min(112, viewportBounds.width / 6, viewportBounds.height / 5);
  const drawnFace = [
    { x: viewportBounds.x + inset, y: viewportBounds.y + inset },
    { x: viewportBounds.x + inset + side, y: viewportBounds.y + inset },
    { x: viewportBounds.x + inset + side, y: viewportBounds.y + inset + side },
    { x: viewportBounds.x + inset, y: viewportBounds.y + inset + side },
    { x: viewportBounds.x + inset, y: viewportBounds.y + inset }
  ];
  for (const point of drawnFace) await page.mouse.click(point.x, point.y);
  await expect.poll(() => wallEdges.count()).toBeGreaterThan(wallCountBeforeDrawing);
  const wallCountAfterDrawing = await wallEdges.count();

  await page.getByRole("button", { name: "Room" }).click();
  const roomCandidate = editorViewport
    .locator('[data-testid="room-face-candidate"]')
    .first();
  await expect(roomCandidate).toBeVisible();
  await roomCandidate.click({ force: true });
  await expect(roomPolygons).toHaveCount(roomCountBeforeDrawing + 1);
  await expect(roomCentroids).toHaveCount(centroidCountBeforeDrawing + 1);
  await expect(roomCandidate).toHaveCount(0);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(roomPolygons).toHaveCount(roomCountBeforeDrawing);
  await expect(roomCentroids).toHaveCount(centroidCountBeforeDrawing);
  await expect(wallEdges).toHaveCount(wallCountAfterDrawing);

  await test.info().attach("browser-console-errors", {
    body: Buffer.from(JSON.stringify(consoleErrors, null, 2)),
    contentType: "application/json"
  });
  expect(pageErrors, "Unexpected uncaught browser errors").toEqual([]);
  expect(consoleErrors, "Unexpected browser console errors").toEqual([]);
});
