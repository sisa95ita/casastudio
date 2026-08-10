import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import type { AuthClient, AuthSession } from "./auth/auth-client";
import { geometryPlaygroundProject } from "./geometry-playground/geometry-playground-fixture";

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:3000");
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

function createAuthClient(session: AuthSession, accessToken: string | null = null): AuthClient {
  return {
    initialize: vi.fn().mockResolvedValue(session),
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    getAccessToken: vi.fn().mockResolvedValue(accessToken)
  };
}

const authenticatedSession: AuthSession = {
  authenticated: true,
  user: {
    subject: "user-1",
    username: "demo",
    email: "demo@casastudio.local",
    roles: ["casastudio-user"]
  }
};

describe("App authentication and routing", () => {
  it("shows initialization state before mounting application routes", async () => {
    let finishInitialization: ((session: AuthSession) => void) | undefined;
    const authClient = createAuthClient({ authenticated: false });
    vi.mocked(authClient.initialize).mockReturnValue(
      new Promise((resolve) => {
        finishInitialization = resolve;
      })
    );

    render(<App initialEntries={["/"]} authClient={authClient} />);

    expect(screen.getByRole("status").textContent).toContain("Checking authentication");
    expect(screen.queryByRole("heading", { name: "Plan spaces with confidence" })).toBeNull();

    finishInitialization?.({ authenticated: false });

    expect(
      await screen.findByRole("heading", { name: "Plan spaces with confidence" })
    ).toBeTruthy();
  });

  it("keeps the public route accessible while unauthenticated", async () => {
    render(
      <App
        initialEntries={["/"]}
        authClient={createAuthClient({ authenticated: false })}
      />
    );

    expect(
      await screen.findByRole("heading", { name: "Plan spaces with confidence" })
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });

  it("shows an explicit login action for an unauthenticated protected route", async () => {
    render(
      <App
        initialEntries={["/app"]}
        authClient={createAuthClient({ authenticated: false })}
      />
    );

    expect(await screen.findByRole("heading", { name: "Sign in to CasaStudio" })).toBeTruthy();
    expect(screen.queryByRole("main")).toBeNull();
  });

  it("delegates the protected-route login action to the auth client", async () => {
    const authClient = createAuthClient({ authenticated: false });
    render(<App initialEntries={["/app"]} authClient={authClient} />);

    fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));

    expect(authClient.login).toHaveBeenCalledOnce();
  });

  it("renders the authenticated application shell at /app", async () => {
    render(
      <App
        initialEntries={["/app"]}
        authClient={createAuthClient(authenticatedSession)}
      />
    );

    expect((await screen.findByRole("banner")).textContent).toContain("CasaStudio");
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeTruthy();
    expect(screen.getByRole("main").textContent).toContain("Technical application foundation");
    expect(screen.getByText("demo")).toBeTruthy();
  });

  it("creates the default API client for authenticated project routes", async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) =>
      Response.json(
        String(input).endsWith("/geometry")
          ? {
              sourceProjectId: geometryPlaygroundProject.id,
              sourceRevision: geometryPlaygroundProject.revision,
              geometry: {
                id: "geometry-demo",
                units: { length: "cm", angle: "deg" },
                levels: []
              }
            }
          : {
              project: geometryPlaygroundProject,
              sourceRevision: geometryPlaygroundProject.revision
            }
      )
    ) as typeof fetch;
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <App
        initialEntries={[`/app/projects/${geometryPlaygroundProject.id}`]}
        authClient={createAuthClient(authenticatedSession, "access-token")}
      />
    );

    expect(await screen.findByRole("heading", { name: geometryPlaygroundProject.name })).toBeTruthy();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    expect(fetchSpy).toHaveBeenCalledWith(
      `http://localhost:3000/api/v1/projects/${geometryPlaygroundProject.id}`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer access-token"
        })
      })
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `http://localhost:3000/api/v1/projects/${geometryPlaygroundProject.id}/geometry`,
      expect.any(Object)
    );
  });

  it("delegates logout from the authenticated shell to the auth client", async () => {
    const authClient = createAuthClient(authenticatedSession);
    render(<App initialEntries={["/app"]} authClient={authClient} />);

    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));

    expect(authClient.logout).toHaveBeenCalledOnce();
  });

  it("renders the protected geometry playground route", async () => {
    render(
      <App
        initialEntries={["/app/geometry-playground"]}
        authClient={createAuthClient(authenticatedSession)}
      />
    );

    expect(await screen.findByRole("heading", { name: "Geometry Playground" })).toBeTruthy();
    expect(screen.getByRole("main").textContent).toContain("SVG Technical Viewer");
  });

  it("uses client-side navigation inside the protected shell", async () => {
    render(
      <App
        initialEntries={["/app"]}
        authClient={createAuthClient(authenticatedSession)}
      />
    );

    const homeLink = await screen.findByRole("link", { name: "Home" });
    const geometryLink = screen.getByRole("link", { name: "Geometry Playground" });

    expect(homeLink.getAttribute("aria-current")).toBe("page");
    fireEvent.click(geometryLink);

    expect(await screen.findByRole("heading", { name: "Geometry Playground" })).toBeTruthy();
    expect(geometryLink.getAttribute("aria-current")).toBe("page");
  });

  it("renders the application not-found route behind authentication", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    render(
      <App
        initialEntries={["/app/missing-workspace"]}
        authClient={createAuthClient(authenticatedSession)}
      />
    );

    expect(await screen.findByRole("heading", { name: "Route not found" })).toBeTruthy();
    expect(screen.getByRole("main").textContent).toContain("CasaStudio does not have a workspace");

    consoleWarnSpy.mockRestore();
  });
});
