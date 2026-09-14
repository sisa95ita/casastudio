import { expect, test } from "@playwright/test";

test("uses the visual Projects library and preserves its lifecycle flows", async ({
  page
}) => {
  const demoPassword = process.env.CASASTUDIO_KEYCLOAK_DEMO_PASSWORD;
  if (!demoPassword) {
    throw new Error("CASASTUDIO_KEYCLOAK_DEMO_PASSWORD is required.");
  }

  await page.goto("/app");
  await page.locator("#username").fill("demo");
  await page.locator("#password").fill(demoPassword);
  await page.locator("#kc-login").click();

  await expect(
    page.getByRole("heading", { name: "Projects", level: 1 })
  ).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Inspector" })).toHaveCount(
    0
  );
  await expect(page.locator(".app-shell__layout--without-inspector")).toBeVisible();

  const demoCard = page.getByRole("article").filter({ hasText: "Demo Project" });
  await expect(demoCard).toBeVisible();
  await expect(demoCard.locator("svg.project-card__plan")).toBeVisible();
  await expect(demoCard.getByText(/Levels? · \d+ Rooms?/)).toBeVisible();

  const search = page.getByLabel("Search projects");
  await search.fill("  dEmO pRoJeCt  ");
  await expect(demoCard).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(search).toHaveValue("");

  await demoCard.getByRole("link", { name: "Open Demo Project" }).click();
  await expect(page).toHaveURL(/\/app\/projects\/demo-project$/);
  await expect(
    page.getByRole("heading", { name: "Demo Project", level: 1 })
  ).toBeVisible();

  await page.goto("/app");
  const projectName = `Library Smoke ${Date.now()}`;
  await page.getByRole("button", { name: "New Project" }).click();
  await page.getByLabel("Project name").fill(projectName);
  await page.getByRole("button", { name: "Create" }).click();
  await expect(
    page.getByRole("heading", { name: projectName, level: 1 })
  ).toBeVisible();

  await page.goto("/app");
  const disposableCard = page
    .getByRole("article")
    .filter({ hasText: projectName });
  await expect(disposableCard).toBeVisible();
  await expect(disposableCard.getByText("Empty plan")).toBeVisible();
  await disposableCard
    .getByRole("button", { name: `Actions for ${projectName}` })
    .click();
  await page.getByRole("menuitem", { name: "Delete project" }).click();
  const dialog = page.getByRole("dialog", { name: "Delete project?" });
  await dialog.getByRole("button", { name: "Delete project" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(disposableCard).toHaveCount(0);
});
