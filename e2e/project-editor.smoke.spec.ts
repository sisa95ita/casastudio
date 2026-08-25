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

test("presents the architectural plan cleanly across View and Edit", async ({ page }) => {
  const demoPassword = process.env.CASASTUDIO_KEYCLOAK_DEMO_PASSWORD;
  if (!demoPassword) {
    throw new Error(
      "CASASTUDIO_KEYCLOAK_DEMO_PASSWORD is required in the environment or repository-root .env."
    );
  }
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message: ConsoleMessage) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/app");
  await page.locator("#username").fill("demo");
  await page.locator("#password").fill(demoPassword);
  await page.locator("#kc-login").click();
  const demoProject = page.getByRole("article").filter({ hasText: "Demo Project" });
  await expect(demoProject).toBeVisible();
  await demoProject.getByRole("link", { name: "Open project" }).click();

  const editorViewport = page.locator(
    'svg[aria-labelledby="geometry-svg-title geometry-svg-description"]'
  );
  await expect(editorViewport).toHaveClass(/geometry-svg--presentation/);
  await expect(editorViewport.locator('[data-testid="polygon-centroid"]')).toHaveCount(0);
  await expect(editorViewport.locator('[data-testid="boundary-edge"]')).toHaveCount(0);
  await expect(editorViewport.locator('[data-testid="geometry-vertex"]')).toHaveCount(0);
  await expect(editorViewport.locator('[data-testid="architectural-door"]')).not.toHaveCount(0);
  await expect(editorViewport.locator('[data-testid="architectural-window"]')).not.toHaveCount(0);
  await expect(editorViewport.locator('[data-testid="automatic-dimension"]')).not.toHaveCount(0);
  const roomLabels = editorViewport.locator('[data-testid="room-metric"]');
  await expect(roomLabels).toHaveCount(2);
  const labelText = (await roomLabels.allTextContents()).join(" ");
  expect(labelText).toContain("Living Room");
  expect(labelText).toContain("Kitchen");
  expect(labelText.match(/m²/g)).toHaveLength(2);
  await test.info().attach("architectural-view", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png"
  });

  await page.getByRole("button", { name: "Edit" }).click();
  const authoringToolbar = page.getByRole("toolbar", { name: "Editing tools" });
  await expect(authoringToolbar.getByRole("button")).toHaveCount(6);
  await expect(authoringToolbar.getByRole("button", { name: "Pan" })).toHaveCount(0);
  await expect(editorViewport).toHaveClass(/geometry-svg--authoring/);
  await expect(editorViewport.locator('[data-testid="polygon-centroid"]')).toHaveCount(2);
  await expect(page.getByRole("switch", { name: "Snap to grid" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Snap", exact: true })).toHaveCount(0);
  await page.getByRole("switch", { name: "Snap to grid" }).hover();
  await expect(
    page.getByRole("tooltip").filter({
      hasText: "Align points to the current grid spacing"
    })
  ).toHaveCount(1);

  const spacePanDrag = async (target: ReturnType<typeof page.locator>, pointerOffset = 0.5) => {
    const box = await target.boundingBox();
    if (!box) throw new Error("Expected a rendered pan target.");
    const start = {
      x: box.x + Math.max(1, box.width * pointerOffset),
      y: box.y + Math.max(1, box.height * pointerOffset)
    };
    await page.keyboard.down("Space");
    await expect(editorViewport).toHaveClass(/geometry-svg--pan/);
    await expect(editorViewport).toHaveCSS("cursor", "grab");
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await expect(editorViewport).toHaveClass(/geometry-svg--panning/);
    await expect(editorViewport).toHaveCSS("cursor", "grabbing");
    await page.mouse.move(start.x + 28, start.y + 18);
    await page.mouse.up();
    await page.keyboard.up("Space");
    await expect(editorViewport).not.toHaveClass(/geometry-svg--panning/);
    await expect(editorViewport).not.toHaveClass(/geometry-svg--pan/);
  };
  const trackedRoom = editorViewport.locator(
    '[data-testid="geometry-polygon"][data-geometry-id="polygon:kitchen"]'
  );
  const initialRoomPoints = await trackedRoom.getAttribute("points");
  const wallCountBeforePan = await editorViewport.locator('[data-testid="boundary-edge"]').count();
  const drawWallTool = authoringToolbar.getByRole("button", { name: "Draw Wall" });
  await drawWallTool.click();
  await expect(drawWallTool).toHaveAttribute("aria-pressed", "true");
  await spacePanDrag(trackedRoom, 0.3);
  await expect(trackedRoom).not.toHaveAttribute("points", initialRoomPoints ?? "");
  await expect(drawWallTool).toHaveAttribute("aria-pressed", "true");
  await spacePanDrag(editorViewport.locator('[data-testid="architectural-door"]').first(), 0.35);
  await expect(drawWallTool).toHaveAttribute("aria-pressed", "true");
  await expect(editorViewport.locator('[data-testid="boundary-edge"]')).toHaveCount(
    wallCountBeforePan
  );
  await expect(editorViewport.locator(".geometry-entity-selected")).toHaveCount(0);
  await expect(page.getByText("No unsaved changes", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();

  await page.getByRole("button", { name: "Select" }).click();
  const beforeBackgroundPan = await trackedRoom.getAttribute("points");
  const viewportBox = await editorViewport.boundingBox();
  if (!viewportBox) throw new Error("Expected a rendered editor viewport.");
  const backgroundPoint = await page.evaluate(() => {
    const background = document.querySelector(".geometry-pan-background");
    const svg = document.querySelector("svg.geometry-svg");
    if (!background || !svg) return undefined;
    const bounds = svg.getBoundingClientRect();
    for (let y = bounds.top + 8; y < bounds.bottom; y += 8) {
      for (let x = bounds.left + 8; x < bounds.right; x += 8) {
        if (document.elementFromPoint(x, y) === background) return { x, y };
      }
    }
    return undefined;
  });
  if (!backgroundPoint) throw new Error("Expected visible empty viewport background.");
  await page.mouse.move(backgroundPoint.x, backgroundPoint.y);
  await page.mouse.down();
  await page.mouse.move(backgroundPoint.x + 22, backgroundPoint.y + 14);
  await page.mouse.up();
  await expect(trackedRoom).not.toHaveAttribute("points", beforeBackgroundPan ?? "");
  const beforeWheelZoom = await trackedRoom.getAttribute("points");
  await page.mouse.move(viewportBox.x + viewportBox.width / 2, viewportBox.y + viewportBox.height / 2);
  await page.mouse.wheel(0, -240);
  await expect(trackedRoom).not.toHaveAttribute("points", beforeWheelZoom ?? "");
  await expect(page.getByText("No unsaved changes", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Shortcuts" }).click();
  const shortcutsDialog = page.getByRole("dialog", { name: "Shortcuts" });
  await expect(shortcutsDialog.getByText("Pan viewport", { exact: true })).toHaveCount(1);
  await expect(shortcutsDialog.getByText("Space + drag", { exact: true })).toHaveCount(1);
  await expect(shortcutsDialog.getByText("Redo", { exact: true })).toHaveCount(1);
  await expect(
    shortcutsDialog.getByText("Ctrl/Cmd + Shift + Z · Ctrl/Cmd + Y", { exact: true })
  ).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(shortcutsDialog).toHaveCount(0);

  await editorViewport.locator(
    '.architectural-wall-hit-target[data-geometry-id="living-east-wall"]'
  ).click({ force: true });
  await page.getByRole("tab", { name: "Selection" }).click();
  await expect(page.getByRole("button", { name: "Delete Wall" })).toBeVisible();

  await editorViewport.locator('[data-testid="geometry-polygon"]').first().click({ force: true });
  await expect(page.getByRole("button", { name: "Delete Room" })).toBeVisible();
  await page.getByRole("tab", { name: "Properties" }).click();
  await expect(page.getByLabel("Name")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Type" })).toBeVisible();

  await editorViewport.locator('[data-testid="architectural-door"]').first().dispatchEvent("click");
  await page.getByRole("tab", { name: "Selection" }).click();
  await expect(page.getByRole("button", { name: "Delete Opening" })).toBeVisible();
  await expect(page.getByText("Door", { exact: true }).first()).toBeVisible();

  await editorViewport.locator('[data-testid="architectural-window"]').first().dispatchEvent("click");
  await expect(page.getByText("Window", { exact: true }).first()).toBeVisible();
  await test.info().attach("architectural-edit", {
    body: await page.screenshot({ fullPage: true }),
    contentType: "image/png"
  });

  await trackedRoom.click({ force: true });
  await page.getByRole("tab", { name: "Selection" }).click();
  await page.getByRole("button", { name: "Delete Room" }).click();
  await expect(roomLabels).toHaveCount(1);
  await expect(roomLabels).toContainText("42.00 m²");
  const separatorWall = editorViewport.locator(
    '.architectural-wall-hit-target[data-geometry-id="living-kitchen-partition"]'
  );
  await expect(separatorWall).toHaveCount(1);
  await separatorWall.dispatchEvent("click");
  await page.getByRole("button", { name: "Delete Wall" }).click();
  await expect(separatorWall).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(separatorWall).toHaveCount(1);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(roomLabels).toHaveCount(2);
  await expect(roomLabels).toContainText(["Living Room", "Kitchen"]);

  await page.getByRole("button", { name: "View", exact: true }).click();
  await expect(authoringToolbar).toHaveCount(0);
  await expect(editorViewport).toHaveClass(/geometry-svg--presentation/);
  await expect(editorViewport.locator('[data-testid="polygon-centroid"]')).toHaveCount(0);
  await expect(editorViewport.locator('[data-testid="selected-wall-overlay"]')).toHaveCount(0);
  await expect(roomLabels).toHaveCount(2);

  await test.info().attach("visual-browser-console-errors", {
    body: Buffer.from(JSON.stringify(consoleErrors, null, 2)),
    contentType: "application/json"
  });
  expect(pageErrors, "Unexpected uncaught browser errors").toEqual([]);
  expect(consoleErrors, "Unexpected browser console errors").toEqual([]);
});
