import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../../app/App";
import { CasaStudioApiClient } from "../../../core/api/CasaStudioApiClient";
import type { AuthClient } from "../../../core/auth/auth-client";
import { demoProjectFixture } from "../../../test/demo-project-fixture";
import { createGeometrySnapshotFixture } from "../../../test/geometry-snapshot-fixture";

const authClient: AuthClient = {
  initialize: vi.fn().mockResolvedValue({
    authenticated: true,
    user: { subject: "user-1", username: "user", roles: ["casastudio-user"] }
  }),
  login: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  getAccessToken: vi.fn().mockResolvedValue("token")
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Projects workspace", () => {
  it("renders the full-width card library without an Inspector", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(
      Response.json({
        projects: [summary("Casa"), summary("Loft", "project-loft")]
      })
    ) as typeof fetch;
    const { container } = render(
      <App
        initialEntries={["/app"]}
        authClient={authClient}
        apiClient={createApi(fetchImplementation)}
      />
    );

    await screen.findByRole("heading", { name: "Casa" });
    expect(
      screen.queryByRole("complementary", { name: "Inspector" })
    ).toBeNull();
    expect(
      container.querySelector(".app-shell__layout--without-inspector")
    ).toBeTruthy();
    expect(container.querySelectorAll(".project-card")).toHaveLength(2);
    expect(container.querySelectorAll("svg.project-card__plan")).toHaveLength(
      2
    );
    expect(screen.getAllByText("2 Levels · 8 Rooms")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Open Casa" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Actions for Casa" })
    ).toBeTruthy();
  });

  it("filters immediately by trimmed, case-insensitive name without more requests", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(
      Response.json({
        projects: [summary("Casa"), summary("Lake Loft", "project-loft")]
      })
    ) as typeof fetch;
    render(
      <App
        initialEntries={["/app"]}
        authClient={authClient}
        apiClient={createApi(fetchImplementation)}
      />
    );

    await screen.findByRole("heading", { name: "Casa" });
    fireEvent.change(screen.getByLabelText("Search projects"), {
      target: { value: "  lAkE  " }
    });
    expect(screen.queryByRole("heading", { name: "Casa" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Lake Loft" })).toBeTruthy();
    expect(fetchImplementation).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText("Search projects"), {
      target: { value: "missing" }
    });
    expect(
      screen.getByRole("heading", { name: 'No projects match "missing"' })
    ).toBeTruthy();
    expect(fetchImplementation).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Clear search" })[0]!
    );
    expect(screen.getByRole("heading", { name: "Casa" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Lake Loft" })).toBeTruthy();
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("uses an intentional empty-plan placeholder without editor overlays", async () => {
    const empty = { ...summary("Empty Casa"), preview: undefined };
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(Response.json({ projects: [empty] })) as typeof fetch;
    const { container } = render(
      <App
        initialEntries={["/app"]}
        authClient={authClient}
        apiClient={createApi(fetchImplementation)}
      />
    );

    await screen.findByRole("heading", { name: "Empty Casa" });
    expect(screen.getByText("Empty plan")).toBeTruthy();
    expect(container.querySelector(".geometry-label")).toBeNull();
    expect(container.querySelector(".geometry-dimension")).toBeNull();
    expect(container.querySelector(".geometry-selection-overlay")).toBeNull();
  });

  it("exposes restrained Project actions without changing the Open link", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(
        Response.json({ projects: [summary("Casa")] })
      ) as typeof fetch;
    render(
      <App
        initialEntries={["/app"]}
        authClient={authClient}
        apiClient={createApi(fetchImplementation)}
      />
    );

    await screen.findByRole("heading", { name: "Casa" });
    expect(
      screen.getByRole("link", { name: "Open Casa" }).getAttribute("href")
    ).toBe("/app/projects/project-casa");
    fireEvent.click(screen.getByRole("button", { name: "Actions for Casa" }));
    const deleteItem = await screen.findByRole("menuitem", {
      name: "Delete project"
    });
    expect(deleteItem).toBeTruthy();
    expect(fetchImplementation).toHaveBeenCalledTimes(1);

    fireEvent.click(deleteItem);
    expect(
      await screen.findByRole("dialog", { name: "Delete project?" })
    ).toBeTruthy();
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("cancels deletion without sending DELETE or changing the list", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(
        Response.json({ projects: [summary("Casa")] })
      ) as typeof fetch;
    render(
      <App
        initialEntries={["/app"]}
        authClient={authClient}
        apiClient={createApi(fetchImplementation)}
      />
    );

    await openDeleteDialog("Casa");
    const dialog = screen.getByRole("dialog", { name: "Delete project?" });
    expect(dialog.textContent).toContain(
      '"Casa" and all of its project data will be permanently deleted.'
    );
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Delete project?" })
      ).toBeNull()
    );
    expect(screen.getByRole("heading", { name: "Casa" })).toBeTruthy();
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("waits for DELETE, prevents duplicates, then refetches the authoritative list", async () => {
    let resolveDelete: ((response: Response) => void) | undefined;
    let deleted = false;
    const fetchImplementation = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === "DELETE") {
          return new Promise<Response>((resolve) => {
            resolveDelete = (response) => {
              deleted = true;
              resolve(response);
            };
          });
        }
        if (url.endsWith("/api/v1/projects")) {
          return Response.json({
            projects: deleted
              ? [summary("Loft", "project-loft")]
              : [summary("Casa"), summary("Loft", "project-loft")]
          });
        }
        return Response.json({});
      }
    );
    render(
      <App
        initialEntries={["/app"]}
        authClient={authClient}
        apiClient={createApi(fetchImplementation as typeof fetch)}
      />
    );

    await openDeleteDialog("Casa");
    const dialog = screen.getByRole("dialog", { name: "Delete project?" });
    const confirm = within(dialog).getByRole("button", {
      name: "Delete project"
    });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect((await within(dialog).findByRole("status")).textContent).toContain(
      "Deleting project…"
    );
    expect(
      screen.getByRole("heading", { name: "Casa", hidden: true })
    ).toBeTruthy();
    expect(
      fetchImplementation.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === "DELETE"
      )
    ).toHaveLength(1);
    expect(fetchImplementation).toHaveBeenCalledWith(
      "http://api.test/api/v1/projects/project-casa",
      expect.objectContaining({ method: "DELETE" })
    );

    resolveDelete?.(new Response(null, { status: 204 }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Delete project?" })
      ).toBeNull()
    );
    expect(screen.queryByRole("heading", { name: "Casa" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Loft" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Projects" })).toBeTruthy();
  });

  it("shows the existing empty state after deleting the final Project", async () => {
    let deleted = false;
    const fetchImplementation = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "DELETE") {
          deleted = true;
          return new Response(null, { status: 204 });
        }
        return Response.json({ projects: deleted ? [] : [summary("Casa")] });
      }
    ) as typeof fetch;
    render(
      <App
        initialEntries={["/app"]}
        authClient={authClient}
        apiClient={createApi(fetchImplementation)}
      />
    );

    await openDeleteDialog("Casa");
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "Delete project"
      })
    );
    expect(
      await screen.findByRole("heading", { name: "No projects yet" })
    ).toBeTruthy();
  });

  it.each(["server", "network"] as const)(
    "keeps the Project and permits retry after a %s deletion failure",
    async (failureKind) => {
      let deleteAttempts = 0;
      let deleted = false;
      const fetchImplementation = vi.fn(
        async (_input: RequestInfo | URL, init?: RequestInit) => {
          if (init?.method === "DELETE") {
            deleteAttempts += 1;
            if (deleteAttempts === 1) {
              if (failureKind === "network") {
                throw new TypeError("offline");
              }
              return new Response("failure", { status: 500 });
            }
            deleted = true;
            return new Response(null, { status: 204 });
          }
          return Response.json({
            projects: deleted ? [] : [summary("Casa")]
          });
        }
      ) as typeof fetch;
      render(
        <App
          initialEntries={["/app"]}
          authClient={authClient}
          apiClient={createApi(fetchImplementation)}
        />
      );

      await openDeleteDialog("Casa");
      const dialog = screen.getByRole("dialog", { name: "Delete project?" });
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Delete project" })
      );
      expect(
        await within(dialog).findByText(
          "The project could not be deleted. Please try again."
        )
      ).toBeTruthy();
      expect(
        screen.getByRole("heading", { name: "Casa", hidden: true })
      ).toBeTruthy();
      const retry = within(dialog).getByRole("button", {
        name: "Delete project"
      });
      expect(retry.hasAttribute("disabled")).toBe(false);

      fireEvent.click(retry);
      expect(
        await screen.findByRole("heading", { name: "No projects yet" })
      ).toBeTruthy();
      expect(deleteAttempts).toBe(2);
    }
  );

  it("distinguishes loading, empty, and list failure states", async () => {
    let resolveList: ((value: Response) => void) | undefined;
    const fetchImplementation = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveList = resolve;
      })
    ) as typeof fetch;
    const view = render(
      <App
        initialEntries={["/app"]}
        authClient={authClient}
        apiClient={createApi(fetchImplementation)}
      />
    );
    expect(
      (await screen.findAllByText("Loading projects…")).length
    ).toBeGreaterThan(0);
    resolveList?.(Response.json({ projects: [] }));
    expect(
      await screen.findByRole("heading", { name: "No projects yet" })
    ).toBeTruthy();
    view.unmount();

    render(
      <App
        initialEntries={["/app"]}
        authClient={authClient}
        apiClient={createApi(
          vi
            .fn()
            .mockResolvedValue(
              new Response("failure", { status: 500 })
            ) as typeof fetch
        )}
      />
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Projects could not be loaded"
    );
  });

  it("blocks normalized duplicates before POST", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(
        Response.json({ projects: [summary("Casa")] })
      ) as typeof fetch;
    render(
      <App
        initialEntries={["/app"]}
        authClient={authClient}
        apiClient={createApi(fetchImplementation)}
      />
    );
    await screen.findByRole("heading", { name: "Casa" });
    fireEvent.click(screen.getByRole("button", { name: "New Project" }));
    fireEvent.change(screen.getByLabelText(/Project name/), {
      target: { value: "  CASA  " }
    });
    expect(
      screen.getByText("A project with this name already exists.")
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Create" }).hasAttribute("disabled")
    ).toBe(true);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("keeps the dialog open when the backend wins a duplicate-name race", async () => {
    const problem = {
      type: "/problems/project-name-conflict",
      title: "Project name conflict",
      status: 409,
      detail: "Conflict",
      code: "PROJECT_NAME_CONFLICT"
    };
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ projects: [] }))
      .mockResolvedValueOnce(
        Response.json(problem, { status: 409 })
      ) as typeof fetch;
    render(
      <App
        initialEntries={["/app"]}
        authClient={authClient}
        apiClient={createApi(fetchImplementation)}
      />
    );
    await screen.findByRole("heading", { name: "No projects yet" });
    fireEvent.click(screen.getAllByRole("button", { name: "New Project" })[0]!);
    fireEvent.change(screen.getByLabelText(/Project name/), {
      target: { value: "Casa" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(
      await screen.findByText("A project with this name already exists.")
    ).toBeTruthy();
    expect(screen.getByDisplayValue("Casa")).toBeTruthy();
  });

  it("keeps entered values and shows generic feedback for a write failure", async () => {
    const problem = {
      type: "/problems/project-write-failed",
      title: "Project write failed",
      status: 500,
      detail: "The Project could not be persisted.",
      code: "PROJECT_WRITE_FAILED"
    };
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ projects: [] }))
      .mockResolvedValueOnce(
        Response.json(problem, { status: 500 })
      ) as typeof fetch;
    render(
      <App
        initialEntries={["/app"]}
        authClient={authClient}
        apiClient={createApi(fetchImplementation)}
      />
    );
    await screen.findByRole("heading", { name: "No projects yet" });
    fireEvent.click(screen.getAllByRole("button", { name: "New Project" })[0]!);
    fireEvent.change(screen.getByLabelText(/Project name/), {
      target: { value: "Casa" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(
      await screen.findByText("The project could not be created. Try again.")
    ).toBeTruthy();
    expect(
      screen.queryByText("A project with this name already exists.")
    ).toBeNull();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByDisplayValue("Casa")).toBeTruthy();
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it("creates a trimmed Project and opens a clean Ground Floor 2D edit session", async () => {
    const created = {
      ...demoProjectFixture,
      id: "project-new",
      name: "New Casa",
      building: { ...demoProjectFixture.building, name: "New Casa" },
      revision: 1
    };
    const fetchImplementation = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/v1/projects") && init?.method === "GET")
          return Response.json({ projects: [] });
        if (url.endsWith("/api/v1/projects") && init?.method === "POST")
          return Response.json(
            { project: created, sourceRevision: 1 },
            { status: 201 }
          );
        if (url.endsWith("/geometry"))
          return Response.json(createGeometrySnapshotFixture(created.id, 1));
        return Response.json({ project: created, sourceRevision: 1 });
      }
    ) as typeof fetch;
    render(
      <App
        initialEntries={["/app"]}
        authClient={authClient}
        apiClient={createApi(fetchImplementation)}
      />
    );
    await screen.findByRole("heading", { name: "No projects yet" });
    fireEvent.click(screen.getAllByRole("button", { name: "New Project" })[0]!);
    fireEvent.change(screen.getByLabelText(/Project name/), {
      target: { value: "  New Casa  " }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(
      await screen.findByRole("heading", { name: "New Casa" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Back to project" })
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Edit plan" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Level: Ground Floor" })
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "2D workspace" })
        .getAttribute("aria-pressed")
    ).toBe("true");
    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty(
      "disabled",
      true
    );
    expect(screen.getByText("No unsaved changes")).toBeTruthy();
    await waitFor(() =>
      expect(fetchImplementation).toHaveBeenCalledWith(
        "http://api.test/api/v1/projects",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "New Casa" })
        })
      )
    );
  });
});

async function openDeleteDialog(projectName: string) {
  await screen.findByRole("heading", { name: projectName });
  fireEvent.click(
    screen.getByRole("button", { name: `Actions for ${projectName}` })
  );
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Delete project" })
  );
  await screen.findByRole("dialog", { name: "Delete project?" });
}

function summary(name: string, id = "project-casa") {
  return {
    id,
    name,
    revision: 1,
    updatedAt: "2026-08-16T00:00:00.000Z",
    ownedByCurrentUser: true,
    levelCount: 2,
    roomCount: 8,
    preview: {
      levelId: "ground",
      elevation: 0,
      walls: [
        {
          id: `${id}-wall`,
          start: { x: 0, z: 0 },
          end: { x: 500, z: 0 },
          thickness: 20
        }
      ]
    }
  };
}

function createApi(fetchImplementation: typeof fetch) {
  return new CasaStudioApiClient({
    baseUrl: "http://api.test",
    getAccessToken: async () => "token",
    fetchImplementation
  });
}
