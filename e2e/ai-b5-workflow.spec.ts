import { expect, test, type Locator, type Page } from "@playwright/test";
import type { Project } from "@casastudio/schema";
import type {
  DesignProposal,
  DesignReferenceView,
  DurableDesignProposal
} from "@casastudio/ai";
import { rectangleRoom } from "../apps/web/src/test/vertical-architecture-fixture";

const api = "http://localhost:3105";
type State = {
  calls: {
    target: DesignProposal["target"];
    revision: number;
    references: DesignReferenceView[];
  }[];
  writes: number;
  artifacts: number;
  proposals: number;
};

test("AI-B lifecycle through real auth, API, fake provider, filesystem and PostgreSQL", async ({
  page,
  request
}) => {
  test.setTimeout(180_000);
  const password = process.env.CASASTUDIO_KEYCLOAK_DEMO_PASSWORD;
  if (!password)
    throw new Error("CASASTUDIO_KEYCLOAK_DEMO_PASSWORD is required.");
  let authorization = "";
  let projectId = "";
  const errors: string[] = [];
  const generationRequests: unknown[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (outgoing) => {
    if (!outgoing.url().startsWith(api)) return;
    authorization ||= outgoing.headers().authorization ?? "";
    if (
      outgoing.method() === "POST" &&
      outgoing.url().endsWith("/design-proposals")
    )
      generationRequests.push(outgoing.postDataJSON());
  });
  const state = async (): Promise<State> =>
    (await request.get(`${api}/__ai-b5/state`)).json();
  const initial = await state();
  const headers = () => ({ Authorization: authorization });
  const getProject = async () =>
    (
      await request.get(`${api}/api/v1/projects/${projectId}`, {
        headers: headers()
      })
    ).json() as Promise<{ project: Project; sourceRevision: number }>;
  const list = async (levelId = "lower", roomId = "target") => {
    const response = await request.get(
      `${api}/api/v1/projects/${projectId}/design-proposals`,
      {
        headers: headers(),
        params: { levelId, roomId }
      }
    );
    expect(response.ok()).toBe(true);
    return (await response.json()).proposals as DurableDesignProposal[];
  };
  try {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto("/app");
    await page.locator("#username").fill("demo");
    await page.locator("#password").fill(password);
    await page.locator("#kc-login").click();
    await expect(
      page.getByRole("heading", { name: "Projects", level: 1 })
    ).toBeVisible();
    const created = await request.post(`${api}/api/v1/projects`, {
      headers: headers(),
      data: { name: `AI-B5 synthetic ${Date.now()}` }
    });
    expect(created.status()).toBe(201);
    const base = await created.json();
    projectId = base.project.id;
    const fixture = createFixture(base.project);
    const saved = await request.put(`${api}/api/v1/projects/${projectId}`, {
      headers: headers(),
      data: { baseRevision: base.sourceRevision, project: fixture }
    });
    expect(saved.ok(), await saved.text()).toBe(true);
    const canonical = await getProject();
    await page.goto(`/app/projects/${projectId}`);
    await enter3D(page);
    const scene = page.getByTestId("project-3d-workspace");
    const designer = page.getByRole("region", { name: "AI Interior Designer" });
    await page.getByRole("tab", { name: "Designer", exact: true }).click();
    await expect(
      page.getByText("Select a Room to start designing.")
    ).toBeVisible();
    await selectRoom(page, scene, "lower", "target");
    await expect(
      designer.getByText("Room: Target studio", { exact: true })
    ).toBeVisible();
    await expect(
      page
        .getByRole("complementary", { name: "Inspector", exact: true })
        .getByRole("region", { name: "AI Interior Designer" })
    ).toBeVisible();
    await expect(
      scene.getByRole("region", { name: "AI Interior Designer" })
    ).toHaveCount(0);
    await expect(designer).toHaveAttribute("data-generation-state", "ready");
    await expect(
      designer.getByRole("button", { name: "Generate design", exact: true })
    ).toBeDisabled();
    expect(await state()).toEqual(initial);

    // Keyboard tabs preserve references and perform no generation.
    await page.getByRole("tab", { name: "Properties", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("tab", { name: "Properties", exact: true })
    ).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("tab", { name: "Designer", exact: true })
    ).toHaveAttribute("aria-selected", "true");
    await designer.getByRole("button", { name: "Inspect references" }).click();
    const references = page.getByRole("dialog", {
      name: "Reference views",
      exact: true
    });
    await expect(references.getByRole("img")).toHaveCount(3);
    await references
      .getByRole("button", { name: "Interior perspective A", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("dialog", { name: "Interior perspective A", exact: true })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      references.getByRole("button", {
        name: "Interior perspective A",
        exact: true
      })
    ).toBeFocused();
    await references
      .getByRole("button", { name: "Refresh", exact: true })
      .click();
    await expect(references.getByRole("img")).toHaveCount(3);
    await references
      .getByRole("button", { name: "Close", exact: true })
      .click();
    expect(await state()).toEqual(initial);

    const direction = "Natural materials and quiet colors";
    await designer
      .getByRole("textbox", { name: "Design direction" })
      .fill(direction);
    const generate = async (number: number) => {
      const button = designer.getByRole("button", {
        name: number === 1 ? "Generate design" : "Try another",
        exact: true
      });
      const response = page.waitForResponse(
        (r) =>
          r.request().method() === "POST" &&
          r.url().endsWith("/design-proposals")
      );
      // Two native click events in one task exercise the synchronous lock.
      await button.evaluate((element: HTMLButtonElement) => {
        element.click();
        element.click();
      });
      await expect
        .poll(async () => (await state()).calls.length)
        .toBe(initial.calls.length + number);
      await expect(button).toBeDisabled();
      await expect(designer.getByRole("progressbar")).not.toHaveAttribute(
        "aria-valuenow",
        /.+/
      );
      await expect(
        designer.getByText(
          "Generating design for Target studio. This may take a few minutes."
        )
      ).toBeVisible();
      expect(generationRequests).toHaveLength(number);
      expect((await state()).writes).toBe(initial.writes + number - 1);
      expect((await request.post(`${api}/__ai-b5/complete`)).status()).toBe(
        204
      );
      const result = await response;
      expect(result.ok(), await result.text()).toBe(true);
      const proposal = (await result.json()) as DurableDesignProposal;
      await expect(
        designer.locator(`img[data-proposal-id="${proposal.id}"]`)
      ).toBeVisible();
      await expect(
        designer.getByText(
          `${number} saved proposal${number === 1 ? "" : "s"}`,
          { exact: true }
        )
      ).toBeVisible();
      const persisted = await state();
      expect(persisted.writes).toBe(initial.writes + number);
      expect(persisted.artifacts).toBe(initial.artifacts + number);
      expect(persisted.proposals).toBe(initial.proposals + number);
      expect((await list())[0]!.id).toBe(proposal.id);
      expect(await getProject()).toEqual(canonical);
      return proposal;
    };
    const first = await generate(1);
    const firstReferences = (await state()).calls.at(-1)!.references;
    expect(firstReferences.map((r) => r.kind).sort()).toEqual([
      "room-axonometric",
      "room-interior-a",
      "room-interior-b"
    ]);
    expect(
      firstReferences.every(
        (r) =>
          r.target.roomId === "target" && r.width === 960 && r.height === 720
      )
    ).toBe(true);
    await designer
      .getByRole("button", { name: "Open design", exact: true })
      .click();
    const review = page.getByRole("dialog", { name: /Proposal review/ });
    await expect(review.locator("img")).toHaveAttribute(
      "data-proposal-id",
      first.id
    );
    await review.getByRole("button", { name: "Generation details" }).click();
    await expect(review.getByText(/fixture-1/)).toBeVisible();
    // Focus stays inside Review; Escape restores the originating control.
    await page.keyboard.press("Tab");
    expect(
      await review.evaluate((dialog) => dialog.contains(document.activeElement))
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(
      designer.getByRole("button", { name: "Open design", exact: true })
    ).toBeFocused();
    await orbit(page, scene.locator("canvas"));
    const second = await generate(2);
    expect((await state()).calls.at(-1)!.references).toEqual(firstReferences);
    await designer
      .getByRole("button", { name: "Proposal 1", exact: true })
      .click();
    await expect(designer.locator("img[data-proposal-id]")).toHaveAttribute(
      "data-proposal-id",
      first.id
    );
    await designer
      .getByRole("button", { name: "Open design", exact: true })
      .click();
    await expect(review.locator("img")).toHaveAttribute(
      "data-proposal-id",
      first.id
    );
    await expect(review.getByText(/fixture-1/)).toBeVisible();
    await review
      .getByRole("button", { name: "Proposal 2", exact: true })
      .click();
    await expect(review.locator("img")).toHaveAttribute(
      "data-proposal-id",
      second.id
    );
    await review.getByRole("button", { name: "Generation details" }).click();
    await expect(review.getByText(/fixture-2/)).toBeVisible();
    await page.keyboard.press("Escape");
    await generate(3);
    const fourth = await generate(4);
    await expect(
      designer
        .getByRole("group", { name: "Compare proposals" })
        .getByRole("button")
    ).toHaveCount(3);
    await expect(
      designer.getByRole("button", { name: "Proposal 1", exact: true })
    ).toHaveCount(0);
    expect(generationRequests).toHaveLength(4);

    // Deletion reconciles the same identity in a live comparison and history.
    await designer
      .getByRole("button", { name: "Proposal 2", exact: true })
      .click();
    await designer
      .getByRole("button", { name: "Open design", exact: true })
      .click();
    await review.getByRole("button", { name: "Delete saved design" }).click();
    const sessionConfirmation = page.getByRole("dialog", {
      name: "Delete this saved design?",
      exact: true
    });
    await expect(
      sessionConfirmation.getByRole("button", { name: "Cancel", exact: true })
    ).toBeFocused();
    await sessionConfirmation
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(review.locator("img")).toHaveAttribute(
      "data-proposal-id",
      second.id
    );
    await review.getByRole("button", { name: "Delete saved design" }).click();
    await sessionConfirmation
      .getByRole("button", { name: "Delete design", exact: true })
      .click();
    await expect(review).toBeHidden();
    await expect(
      designer.getByRole("button", { name: "Proposal 2", exact: true })
    ).toHaveCount(0);
    await expect(
      designer
        .getByRole("group", { name: "Compare proposals" })
        .getByRole("button")
    ).toHaveCount(2);
    await expect(designer.locator("img[data-proposal-id]")).toHaveAttribute(
      "data-proposal-id",
      fourth.id
    );
    expect(
      (
        await request.get(`${api}${second.artifact.uri}`, {
          headers: headers()
        })
      ).status()
    ).toBe(404);
    expect(await getProject()).toEqual(canonical);
    expect(generationRequests).toHaveLength(4);

    // Camera movement + local refresh cannot alter reference camera metadata.
    await orbit(page, scene.locator("canvas"));
    await designer.getByRole("button", { name: "Inspect references" }).click();
    await references
      .getByRole("button", { name: "Refresh", exact: true })
      .click();
    await references
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await expect(
      designer.getByRole("button", { name: "Open design", exact: true })
    ).toHaveCount(0);
    expect((await state()).calls).toHaveLength(initial.calls.length + 4);

    await designer.getByRole("button", { name: "View history" }).click();
    const history = page.getByRole("dialog", {
      name: "Room design history · Target studio",
      exact: true
    });
    const historyEntries = history
      .getByRole("group", { name: "Saved designs" })
      .getByRole("button");
    await expect(historyEntries).toHaveCount(3);
    await historyEntries.first().focus();
    await page.keyboard.press("Enter");
    await expect(history.locator("img")).toHaveAttribute(
      "data-proposal-id",
      fourth.id
    );
    await history.getByRole("button", { name: "Close", exact: true }).click();

    // Reload loses only comparison state. Authorized image delivery is real.
    await page.reload();
    await enter3D(page);
    await selectRoom(page, scene, "lower", "target");
    await page.getByRole("tab", { name: "Designer", exact: true }).click();
    await expect(
      designer.getByRole("button", { name: "Open design", exact: true })
    ).toHaveCount(0);
    await expect(
      designer.getByText("3 saved proposals", { exact: true })
    ).toBeVisible();
    const artifactUrl = `${api}${fourth.artifact.uri}`;
    expect((await request.get(artifactUrl)).status()).toBe(401);
    const artifact = await request.get(artifactUrl, { headers: headers() });
    expect(artifact.status()).toBe(200);
    expect(artifact.headers()["content-type"]).toBe("image/png");
    expect(artifact.headers()["cache-control"]).toBe("private, no-store");
    expect((await artifact.body()).length).toBeGreaterThan(0);
    await designer.getByRole("button", { name: "View history" }).click();
    await historyEntries.first().click();
    await history
      .getByRole("button", { name: "Open design", exact: true })
      .click();
    await expect(review.locator("img")).toHaveAttribute(
      "data-proposal-id",
      fourth.id
    );
    await expect(review.getByText(direction, { exact: true })).toBeVisible();
    await expect(
      review.getByText(`Current Project revision ${canonical.sourceRevision}`, {
        exact: true
      })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await history.getByRole("button", { name: "Close", exact: true }).click();

    // Another Room and a vertically overlapping Level have independent history.
    await selectRoom(page, scene, "lower", "neighbor");
    await expect(
      designer.getByText("0 saved proposals", { exact: true })
    ).toBeVisible();
    await selectRoom(page, scene, "lower", "target");
    await expect(
      designer.getByText("3 saved proposals", { exact: true })
    ).toBeVisible();
    await page.getByRole("button", { name: /^Level:/ }).click();
    await page.getByRole("menuitem", { name: "Upper", exact: true }).click();
    await expect(
      page.getByText("Select a Room to start designing.")
    ).toBeVisible();
    await selectRoom(page, scene, "upper", "overlap");
    await expect(
      designer.getByText("Room: Overlapping studio", { exact: true })
    ).toBeVisible();
    await expect(
      designer.getByText("0 saved proposals", { exact: true })
    ).toBeVisible();
    expect(await list("upper", "overlap")).toEqual([]);

    // A real canonical save advances revision; saved proposals remain historical.
    const edited = structuredClone(canonical.project);
    edited.building.levels[0]!.rooms[0]!.name = "Revised studio";
    const revisionSave = await request.put(
      `${api}/api/v1/projects/${projectId}`,
      {
        headers: headers(),
        data: { baseRevision: canonical.sourceRevision, project: edited }
      }
    );
    expect(revisionSave.ok()).toBe(true);
    const revised = await getProject();
    expect(revised.sourceRevision).toBe(canonical.sourceRevision + 1);
    await page.reload();
    await enter3D(page);
    await selectRoom(page, scene, "lower", "target");
    await page.getByRole("tab", { name: "Designer", exact: true }).click();
    await designer.getByRole("button", { name: "View history" }).click();
    const revisedHistory = page.getByRole("dialog", {
      name: "Room design history · Revised studio",
      exact: true
    });
    await revisedHistory
      .getByRole("group", { name: "Saved designs" })
      .getByRole("button")
      .first()
      .click();
    await revisedHistory
      .getByRole("button", { name: "Open design", exact: true })
      .click();
    await expect(review.getByRole("alert")).toHaveText(
      `Historical design · revision ${canonical.sourceRevision}. Current geometry may differ.`
    );
    await review.getByRole("button", { name: "Delete saved design" }).click();
    const confirmation = page.getByRole("dialog", {
      name: "Delete this saved design?",
      exact: true
    });
    await expect(
      confirmation.getByRole("button", { name: "Cancel", exact: true })
    ).toBeFocused();
    await confirmation
      .getByRole("button", { name: "Delete design", exact: true })
      .click();
    await expect(confirmation).toBeHidden();
    await expect(review).toBeHidden();
    await expect(
      revisedHistory
        .getByRole("group", { name: "Saved designs" })
        .getByRole("button")
    ).toHaveCount(2);
    expect(
      (await request.get(artifactUrl, { headers: headers() })).status()
    ).toBe(404);
    expect(await getProject()).toEqual(revised);
    await page.reload();
    await enter3D(page);
    await selectRoom(page, scene, "lower", "target");
    await page.getByRole("tab", { name: "Designer", exact: true }).click();
    await expect(
      designer.getByText("2 saved proposals", { exact: true })
    ).toBeVisible();
    expect((await list()).some((p) => p.id === fourth.id)).toBe(false);
    expect(generationRequests).toHaveLength(4);
    expect((await state()).calls.length).toBe(initial.calls.length + 4);
    expect((await state()).artifacts).toBe(initial.artifacts + 2);
    expect(errors).toEqual([]);
  } finally {
    if (projectId && authorization) {
      expect(
        (
          await request.delete(`${api}/api/v1/projects/${projectId}`, {
            headers: headers()
          })
        ).status()
      ).toBe(204);
      expect((await state()).artifacts).toBe(initial.artifacts);
      expect((await state()).proposals).toBe(initial.proposals);
    }
  }
});

function createFixture(base: Project): Project {
  const project = structuredClone(base);
  project.building.levels = [
    {
      id: "lower",
      name: "Lower",
      elevation: 0,
      walls: [],
      staircases: [],
      rooms: [
        {
          ...rectangleRoom("target", 0, 0, 480, 360, 0),
          name: "Target studio"
        },
        {
          ...rectangleRoom("neighbor", 620, 0, 980, 360, 0),
          name: "Separate studio"
        }
      ]
    },
    {
      id: "upper",
      name: "Upper",
      elevation: 300,
      walls: [],
      staircases: [],
      rooms: [
        {
          ...rectangleRoom("overlap", 0, 0, 480, 360, 0),
          name: "Overlapping studio"
        }
      ]
    }
  ];
  return project;
}

async function enter3D(page: Page) {
  await page.getByRole("button", { name: "3D workspace", exact: true }).click();
  await expect(page.getByTestId("project-3d-workspace")).toHaveAttribute(
    "data-renderer-status",
    "ready"
  );
  await page.getByRole("button", { name: "Active Level", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Active Level", exact: true })
  ).toHaveAttribute("aria-pressed", "true");
}

async function selectRoom(
  page: Page,
  scene: Locator,
  levelId: string,
  roomId: string
) {
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const key = `${levelId}:room:${roomId}`;
  await expect
    .poll(
      async () =>
        JSON.parse(
          (await scene.getAttribute("data-projected-selection-targets")) || "{}"
        )[key]
    )
    .toBeTruthy();
  const point = JSON.parse(
    (await scene.getAttribute("data-projected-selection-targets")) || "{}"
  )[key];
  const bounds = await scene.locator("canvas").boundingBox();
  if (!bounds) throw new Error("3D canvas has no bounds");
  // Locator input waits for closing dialog backdrops to stop intercepting clicks.
  await scene.locator("canvas").click({
    position: {
      x: ((point.x + 1) * bounds.width) / 2,
      y: ((point.y + 1) * bounds.height) / 2
    }
  });
  await expect(scene).toHaveAttribute("data-selected-entity-id", roomId);
}

async function orbit(page: Page, canvas: Locator) {
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("3D canvas has no bounds");
  await page.mouse.move(
    bounds.x + bounds.width * 0.65,
    bounds.y + bounds.height * 0.45
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width * 0.65 + 60,
    bounds.y + bounds.height * 0.45 + 20,
    { steps: 8 }
  );
  await page.mouse.up();
}
