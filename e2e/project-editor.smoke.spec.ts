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
  await page.getByRole("button", { name: "Edit plan" }).click();
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

  await page.getByRole("button", { name: "Wall" }).click();
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
  await page.getByRole("menuitem", { name: "Detect room" }).click();
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

test("keeps the workspace hierarchy coherent on tablet and phone", async ({
  page
}) => {
  const demoPassword = process.env.CASASTUDIO_KEYCLOAK_DEMO_PASSWORD;
  if (!demoPassword) {
    throw new Error(
      "CASASTUDIO_KEYCLOAK_DEMO_PASSWORD is required in the environment or repository-root .env."
    );
  }

  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto("/app");
  await page.locator("#username").fill("demo");
  await page.locator("#password").fill(demoPassword);
  await page.locator("#kc-login").click();

  const demoProject = page
    .getByRole("article")
    .filter({ hasText: "Demo Project" });
  await expect(demoProject).toBeVisible();
  await demoProject.getByRole("link", { name: "Open project" }).click();
  await expect(page.getByRole("button", { name: "Edit plan" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Project representation" })).toBeVisible();

  await page.getByRole("button", { name: "Edit plan" }).click();
  await expect(page.getByRole("toolbar", { name: "Editing tools" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Shortcuts" })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Inspector sections" })).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("tablet-edit-workspace.png"),
    fullPage: true
  });

  await page.getByRole("button", { name: "Back to project" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Edit plan" })).toHaveCount(0);
  await expect(page.getByRole("toolbar", { name: "Editing tools" })).toHaveCount(0);
  await expect(page.getByText(/larger screen/i)).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("phone-project-view.png"),
    fullPage: true
  });
});

test("creates, places, persists, and reloads a rectangular Room shape", async ({
  page
}) => {
  test.setTimeout(120_000);
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
  await expect(page.getByRole("heading", { name: "Projects", level: 1 }))
    .toBeVisible();

  const projectName = `Room Shape ${Date.now()}`;
  await page.getByRole("button", { name: "New Project" }).click();
  await page.getByLabel("Project name").fill(projectName);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: projectName, level: 1 }))
    .toBeVisible();
  await page.getByRole("button", { name: "Edit plan" }).click();
  await page.getByRole("button", { name: "Room" }).click();
  await expect(page.getByRole("menuitem", { name: "Detect room" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Rectangle" })).toBeEnabled();
  await expect(page.getByRole("menuitem", { name: "L-shape" })).toBeEnabled();
  await page.getByRole("menuitem", { name: "Rectangle" }).click();
  await page.getByRole("spinbutton", { name: "Width" }).fill("400");
  await page.getByRole("spinbutton", { name: "Depth" }).fill("300");

  const editorViewport = page.locator(
    'svg[aria-labelledby="geometry-svg-title geometry-svg-description"]'
  );
  await expect(editorViewport).toBeVisible();
  const viewportBounds = await editorViewport.boundingBox();
  if (!viewportBounds) throw new Error("The empty Project editor viewport has no bounds.");
  const placement = {
    x: viewportBounds.x + viewportBounds.width * 0.28,
    y: viewportBounds.y + viewportBounds.height * 0.24
  };
  await page.mouse.move(placement.x, placement.y);
  const preview = editorViewport.locator('[data-testid="room-shape-preview"]');
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("data-segment-count", "4");
  await expect(page.getByText("No unsaved changes", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();

  await page.keyboard.down("Space");
  await expect(editorViewport).toHaveClass(/geometry-svg--pan/);
  await page.mouse.move(placement.x + 30, placement.y + 20);
  await page.mouse.down();
  await page.mouse.move(placement.x + 58, placement.y + 38);
  await page.mouse.up();
  await page.keyboard.up("Space");
  await expect(preview).toBeVisible();
  await expect(editorViewport).not.toHaveClass(/geometry-svg--pan/);

  await page.mouse.move(placement.x, placement.y);
  await expect(preview).toBeVisible();
  await page.mouse.click(placement.x, placement.y);
  await expect(preview).toHaveCount(0);
  const roomLabels = editorViewport.locator('[data-testid="room-metric"]');
  await expect(roomLabels).toHaveCount(1);
  await expect(roomLabels).toContainText("12.00 m²");
  await expect(editorViewport.locator('[data-testid="geometry-polygon"]')).toHaveCount(1);
  await expect(editorViewport.locator('[data-testid="architectural-wall-body"]')).toHaveCount(4);
  await expect(page.getByRole("menuitem", { name: "Rectangle" })).toBeDisabled();
  await expect(page.getByRole("menuitem", { name: "L-shape" })).toBeDisabled();
  await expect(
    page.getByText("Room shapes are currently available only on an empty level.")
  ).toBeVisible();

  await page.getByRole("tab", { name: "Properties" }).click();
  const roomName = page.getByLabel("Name");
  await roomName.fill("Rectangle Studio");
  await roomName.press("Enter");
  await expect(roomLabels).toContainText("Rectangle Studio");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(roomLabels).toContainText("Room 1");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(roomLabels).toHaveCount(0);
  await expect(editorViewport.locator('[data-testid="architectural-wall-body"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(roomLabels).toHaveCount(1);
  await expect(editorViewport.locator('[data-testid="architectural-wall-body"]')).toHaveCount(4);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(roomLabels).toContainText("Rectangle Studio");

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Edit plan" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: projectName, level: 1 }))
    .toBeVisible();
  const reloadedViewport = page.locator(
    'svg[aria-labelledby="geometry-svg-title geometry-svg-description"]'
  );
  await expect(reloadedViewport.locator('[data-testid="room-metric"]'))
    .toContainText("Rectangle Studio");
  await expect(reloadedViewport.locator('[data-testid="geometry-polygon"]')).toHaveCount(1);
  await expect(reloadedViewport.locator('[data-testid="architectural-wall-body"]')).toHaveCount(4);

  await test.info().attach("room-shape-browser-console-errors", {
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

  await page.getByRole("button", { name: "Edit plan" }).click();
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
  const drawWallTool = authoringToolbar.getByRole("button", { name: "Wall" });
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

  await page.getByRole("button", { name: "Back to project" }).click();
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

test("persists an elevated Room and asymmetric L-shaped Staircase", async ({ page }) => {
  const demoPassword = process.env.CASASTUDIO_KEYCLOAK_DEMO_PASSWORD;
  if (!demoPassword) throw new Error("CASASTUDIO_KEYCLOAK_DEMO_PASSWORD is required.");

  await page.goto("/app");
  await page.locator("#username").fill("demo");
  await page.locator("#password").fill(demoPassword);
  await page.locator("#kc-login").click();
  const projectName = `Elevated Room Stair ${Date.now()}`;
  await page.getByRole("button", { name: "New Project" }).click();
  await page.getByLabel("Project name").fill(projectName);
  await page.getByRole("button", { name: "Create" }).click();
  await page.getByRole("button", { name: "Edit plan" }).click();
  const inspector = page.getByRole("complementary", { name: "Inspector" });

  await page.getByRole("button", { name: "Room" }).click();
  await page.getByRole("menuitem", { name: "Rectangle" }).click();
  const viewport = page.locator('svg[aria-labelledby="geometry-svg-title geometry-svg-description"]');
  await expect(viewport).toBeVisible();
  const bounds = await viewport.boundingBox();
  if (!bounds) throw new Error("Expected the Stair authoring viewport.");
  const roomPoint = { x: bounds.x + bounds.width * 0.22, y: bounds.y + bounds.height * 0.25 };
  await page.mouse.move(roomPoint.x, roomPoint.y);
  await page.mouse.click(roomPoint.x, roomPoint.y);
  await expect(viewport.locator('[data-testid="geometry-polygon"]')).toHaveCount(1);
  await inspector.getByRole("tab", { name: "Properties" }).click();
  await inspector.getByRole("spinbutton", { name: "Elevation above Level" }).fill("180");
  await inspector.getByRole("spinbutton", { name: "Elevation above Level" }).press("Tab");

  await page.getByRole("button", { name: "Stair" }).click();
  await expect(page.getByRole("spinbutton", { name: "Width" })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Target Level" }).click();
  await page.getByRole("option", { name: /same Level/ }).click();
  await page.getByRole("combobox", { name: "Target Room (optional)" }).click();
  await page.getByRole("option", { name: /Room 1 · \+180 cm/ }).click();
  await page.getByRole("button", { name: "L-shaped" }).click();
  await expect(inspector.getByTestId("stair-authoring-inspector")).toBeVisible();
  await expect(page.getByText("Choose the destination, then a complete template before placing it in the plan.")).toHaveCount(0);
  await inspector.getByRole("spinbutton", { name: "Flight 1 steps" }).fill("4");
  await inspector.getByRole("spinbutton", { name: "Flight 2 steps" }).fill("13");

  const stairStart = { x: bounds.x + bounds.width * 0.52, y: bounds.y + bounds.height * 0.36 };
  const stairEnd = { x: stairStart.x + Math.min(220, bounds.width * 0.28), y: stairStart.y };
  await page.mouse.click(stairStart.x, stairStart.y);
  await page.mouse.move(stairEnd.x, stairEnd.y);
  await expect(viewport.locator('[data-testid="stair-preview"]')).toHaveAttribute("data-valid", "true");
  await page.mouse.click(stairEnd.x, stairEnd.y);
  await inspector.getByRole("button", { name: "Create Staircase" }).click();
  await expect(viewport.locator('[data-testid="architectural-staircase"]')).toHaveCount(1);
  await expect(inspector.getByRole("spinbutton", { name: "Flight 1 steps" })).toHaveValue("4");
  await expect(inspector.getByRole("spinbutton", { name: "Flight 2 steps" })).toHaveValue("13");

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Edit plan" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: projectName, level: 1 })).toBeVisible();
  await expect(viewport.locator('[data-testid="architectural-staircase"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Edit plan" }).click();
  await page.getByRole("button", { name: "Select" }).click();
  await viewport.locator('[data-testid="geometry-polygon"]').click({ force: true });
  await inspector.getByRole("tab", { name: "Properties" }).click();
  await expect(inspector.getByRole("spinbutton", { name: "Elevation above Level" })).toHaveValue("180");
  await viewport.locator('[data-testid="architectural-stair-flight"]').first().click({ force: true });
  await inspector.getByRole("tab", { name: "Properties" }).click();
  await expect(inspector.getByRole("spinbutton", { name: "Flight 1 steps" })).toHaveValue("4");
  await expect(inspector.getByRole("spinbutton", { name: "Flight 2 steps" })).toHaveValue("13");
});

test("accepts precision Walls, vertices, pending Opening properties, and the wide Room menu", async ({ page }) => {
  test.setTimeout(120_000);
  const demoPassword = process.env.CASASTUDIO_KEYCLOAK_DEMO_PASSWORD;
  if (!demoPassword) throw new Error("CASASTUDIO_KEYCLOAK_DEMO_PASSWORD is required.");
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
  await page.getByRole("button", { name: "Edit plan" }).click();

  const viewport = page.locator('svg[aria-labelledby="geometry-svg-title geometry-svg-description"]');
  const viewportBox = await viewport.boundingBox();
  if (!viewportBox) throw new Error("Expected the editor viewport.");
  await page.getByRole("button", { name: "Wall" }).click();
  const previewStart = { x: viewportBox.x + 70, y: viewportBox.y + 70 };
  const previewEnd = { x: previewStart.x + 120, y: previewStart.y + 45 };
  await page.mouse.click(previewStart.x, previewStart.y);
  await page.mouse.move(previewEnd.x, previewEnd.y);
  await expect(viewport.locator('[data-testid="draw-wall-preview-length"]')).toContainText(/m|cm/);
  await page.keyboard.press("Escape");
  await expect(viewport.locator('[data-testid="draw-wall-preview-length"]')).toHaveCount(0);
  await expect(page.getByText("No unsaved changes", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Select" }).click();
  const eastWall = viewport.locator('.architectural-wall-hit-target[data-geometry-id="living-east-wall"]');
  await eastWall.click({ force: true });
  await page.getByRole("tab", { name: "Properties" }).click();
  const length = page.getByRole("spinbutton", { name: "Length (cm)" });
  await expect(length).toHaveValue("400");
  await length.fill("450");
  await length.press("Enter");
  await expect(length).toHaveValue("450");
  await page.getByRole("combobox", { name: "Resize from" }).click();
  await page.getByRole("option", { name: "End" }).click();
  await length.fill("420");
  await length.press("Enter");
  await expect(length).toHaveValue("420");
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Undo" }).click();

  await eastWall.click({ force: true });
  await page.getByRole("tab", { name: "Selection" }).click();
  const wallCountBeforeSplit = await viewport.locator('[data-testid="boundary-edge"]').count();
  await page.getByRole("button", { name: "Add vertex" }).click();
  const wallBox = await eastWall.boundingBox();
  if (!wallBox) throw new Error("Expected the selected Wall hit target.");
  const splitPoint = { x: wallBox.x + wallBox.width / 2, y: wallBox.y + wallBox.height / 2 };
  await page.mouse.move(splitPoint.x, splitPoint.y);
  await expect(viewport.locator('[data-testid="add-wall-vertex-preview"]')).toBeVisible();
  await page.mouse.click(splitPoint.x, splitPoint.y);
  await expect(viewport.locator('[data-testid="boundary-edge"]')).toHaveCount(wallCountBeforeSplit + 1);
  const vertices = viewport.locator('[data-testid="geometry-vertex"]');
  let nearestVertex = vertices.first();
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < await vertices.count(); index += 1) {
    const candidate = vertices.nth(index);
    const box = await candidate.boundingBox();
    if (!box) continue;
    const distance = Math.hypot(box.x + box.width / 2 - splitPoint.x, box.y + box.height / 2 - splitPoint.y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestVertex = candidate;
    }
  }
  await nearestVertex.click({ force: true });
  const removeVertex = page.getByRole("button", { name: "Remove vertex" });
  await expect(removeVertex).toBeVisible();
  await removeVertex.click();
  await expect(viewport.locator('[data-testid="boundary-edge"]')).toHaveCount(wallCountBeforeSplit);
  await page.getByRole("button", { name: "Undo" }).click();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("No unsaved changes", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Openings" }).click();
  await page.getByRole("menuitem", { name: "Door" }).click();
  await page.getByRole("tab", { name: "Properties" }).click();
  await expect(page.getByText("New Door", { exact: true })).toBeVisible();
  const pendingDoorWidth = page.getByRole("spinbutton", { name: "Width (cm)" });
  await pendingDoorWidth.fill("70");
  await pendingDoorWidth.press("Enter");
  await expect(page.getByText("No unsaved changes", { exact: true })).toBeVisible();
  const westWall = viewport.locator('.architectural-wall-hit-target[data-geometry-id="living-west-wall"]');
  const westBox = await westWall.boundingBox();
  if (!westBox) throw new Error("Expected the Door placement Wall.");
  await page.mouse.move(westBox.x + westBox.width / 2, westBox.y + westBox.height / 2);
  await expect(viewport.locator('[data-testid="opening-placement-preview"]')).toHaveAttribute("data-valid", "true");
  await page.mouse.click(westBox.x + westBox.width / 2, westBox.y + westBox.height / 2);
  await expect(viewport.locator('[data-testid="architectural-door"]')).toHaveCount(3);
  await page.getByRole("button", { name: "Undo" }).click();

  await page.getByRole("button", { name: "Openings" }).click();
  await page.getByRole("menuitem", { name: "Wall Opening" }).click();
  await page.getByRole("tab", { name: "Properties" }).click();
  await expect(page.getByText("New Wall Opening", { exact: true })).toBeVisible();
  const pendingOpeningWidth = page.getByRole("spinbutton", { name: "Width (cm)" });
  await pendingOpeningWidth.fill("180");
  await pendingOpeningWidth.press("Enter");
  const southWall = viewport.locator('.architectural-wall-hit-target[data-geometry-id="ground-south-wall"]');
  const southBox = await southWall.boundingBox();
  if (!southBox) throw new Error("Expected the Wall Opening placement Wall.");
  await page.mouse.move(southBox.x + southBox.width / 2, southBox.y + southBox.height / 2);
  await page.mouse.click(southBox.x + southBox.width / 2, southBox.y + southBox.height / 2);
  const wallOpening = viewport.locator('[data-testid="architectural-wall-opening"]');
  await expect(wallOpening).toHaveCount(1);
  await expect(wallOpening.locator(".architectural-door-arc")).toHaveCount(0);
  await expect(wallOpening.locator(".architectural-door-leaf")).toHaveCount(0);
  await expect(wallOpening.locator(".architectural-window-line")).toHaveCount(0);

  await page.getByRole("button", { name: "Room" }).click();
  const roomMenu = page.locator("#room-authoring-menu");
  await expect(roomMenu).toBeVisible();
  expect(await roomMenu.evaluate((element) => getComputedStyle(element).display)).toBe("grid");
  const roomMenuBox = await roomMenu.boundingBox();
  if (!roomMenuBox) throw new Error("Expected the Room authoring menu.");
  expect(roomMenuBox.width).toBeGreaterThan(roomMenuBox.height);
  await expect(page.getByRole("menuitem", { name: "Detect room" })).toBeVisible();

  await test.info().attach("precision-browser-console-errors", {
    body: Buffer.from(JSON.stringify(consoleErrors, null, 2)),
    contentType: "application/json"
  });
  expect(pageErrors, "Unexpected uncaught browser errors").toEqual([]);
  expect(consoleErrors, "Unexpected browser console errors").toEqual([]);
});
