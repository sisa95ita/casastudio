import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import type { AuthClient, AuthSession } from "./auth/auth-client";
import { demoProjectEntry } from "./development/demo-project-entry";
import { demoProjectFixture } from "./test/demo-project-fixture";
import { createGeometrySnapshotFixture } from "./test/geometry-snapshot-fixture";

beforeEach(() => {
  vi.stubEnv("VITE_API_BASE_URL", "http://localhost:3000");
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
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
    expect(screen.queryByRole("heading", { name: "Design spaces with confidence" })).toBeNull();

    finishInitialization?.({ authenticated: false });

    expect(
      await screen.findByRole("heading", { name: "Design spaces with confidence" })
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
      await screen.findByRole("heading", { name: "Design spaces with confidence" })
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });

  it("starts Keycloak login automatically for an anonymous protected route", async () => {
    const authClient = createAuthClient({ authenticated: false });
    render(<App initialEntries={["/app"]} authClient={authClient} />);

    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("Opening secure sign in")
    );
    await waitFor(() => expect(authClient.login).toHaveBeenCalledOnce());
    expect(screen.queryByRole("heading", { name: "Sign in to CasaStudio" })).toBeNull();
    expect(screen.queryByRole("main")).toBeNull();
  });

  it("does not repeat automatic login during Strict Mode effect replay or rerender", async () => {
    const authClient = createAuthClient({ authenticated: false });
    const view = render(
      <StrictMode>
        <App initialEntries={["/app"]} authClient={authClient} />
      </StrictMode>
    );

    await waitFor(() => expect(authClient.login).toHaveBeenCalledOnce());
    view.rerender(
      <StrictMode>
        <App initialEntries={["/app"]} authClient={authClient} />
      </StrictMode>
    );
    await waitFor(() => expect(authClient.login).toHaveBeenCalledOnce());
  });

  it("does not expose Sign In while protected-route SSO restoration is pending", async () => {
    let finishRestoration: ((session: AuthSession) => void) | undefined;
    const authClient = createAuthClient({ authenticated: false });
    vi.mocked(authClient.initialize).mockReturnValue(
      new Promise((resolve) => {
        finishRestoration = resolve;
      })
    );

    render(<App initialEntries={["/app"]} authClient={authClient} />);

    expect(screen.getByRole("status").textContent).toContain("Checking authentication");
    expect(screen.queryByRole("heading", { name: "Sign in to CasaStudio" })).toBeNull();
    expect(authClient.login).not.toHaveBeenCalled();

    finishRestoration?.(authenticatedSession);
    expect(await screen.findByRole("heading", { name: "Projects" })).toBeTruthy();
  });

  it("stops on initialization failure without starting a login loop", async () => {
    const authClient = createAuthClient({ authenticated: false });
    vi.mocked(authClient.initialize).mockRejectedValue(new Error("identity provider unavailable"));

    render(<App initialEntries={["/app"]} authClient={authClient} />);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "CasaStudio could not initialize authentication"
    );
    expect(authClient.login).not.toHaveBeenCalled();
  });

  it("restores a valid SSO session on protected-route startup", async () => {
    const authClient = createAuthClient(authenticatedSession);
    render(
      <App
        initialEntries={["/app"]}
        authClient={authClient}
      />
    );

    expect((await screen.findByRole("banner")).textContent).toContain("CasaStudio");
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeTruthy();
    expect(screen.getByRole("main").textContent).toContain("Projects");
    expect(screen.getByRole("heading", { name: demoProjectEntry.name })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open project" }).getAttribute("href")).toBe(
      `/app/projects/${demoProjectEntry.id}`
    );
    expect(screen.queryByRole("link", { name: "Geometry Playground" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Sign in to CasaStudio" })).toBeNull();
    expect(screen.getByText("demo")).toBeTruthy();
    expect(authClient.initialize).toHaveBeenCalledOnce();
  });

  it("restores a valid SSO session after a fresh application mount", async () => {
    const firstMount = render(
      <App initialEntries={["/app"]} authClient={createAuthClient(authenticatedSession)} />
    );
    expect(await screen.findByRole("heading", { name: "Projects" })).toBeTruthy();
    firstMount.unmount();

    const restoredClient = createAuthClient(authenticatedSession);
    render(<App initialEntries={["/app"]} authClient={restoredClient} />);

    expect(await screen.findByRole("heading", { name: "Projects" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Sign in to CasaStudio" })).toBeNull();
    expect(restoredClient.initialize).toHaveBeenCalledOnce();
  });

  it("creates the default API client for authenticated project routes", async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) =>
      Response.json(
        String(input).endsWith("/geometry")
          ? createGeometrySnapshotFixture(
              demoProjectFixture.id,
              demoProjectFixture.revision
            )
          : {
              project: demoProjectFixture,
              sourceRevision: demoProjectFixture.revision
            }
      )
    ) as typeof fetch;
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <App
        initialEntries={[`/app/projects/${demoProjectFixture.id}`]}
        authClient={createAuthClient(authenticatedSession, "access-token")}
      />
    );

    expect(await screen.findByRole("heading", { name: demoProjectFixture.name })).toBeTruthy();
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    expect(fetchSpy).toHaveBeenCalledWith(
      `http://localhost:3000/api/v1/projects/${demoProjectFixture.id}`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer access-token"
        })
      })
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      `http://localhost:3000/api/v1/projects/${demoProjectFixture.id}/geometry`,
      expect.any(Object)
    );
  });

  it("opens the Demo Project from the Projects home", async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) =>
      Response.json(
        String(input).endsWith("/geometry")
          ? createGeometrySnapshotFixture(demoProjectFixture.id, demoProjectFixture.revision)
          : { project: demoProjectFixture, sourceRevision: demoProjectFixture.revision }
      )
    ) as typeof fetch;
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <App
        initialEntries={["/app"]}
        authClient={createAuthClient(authenticatedSession, "access-token")}
      />
    );

    fireEvent.click(await screen.findByRole("link", { name: "Open project" }));

    expect(await screen.findByRole("img", { name: /interactive 2d geometry viewer/i })).toBeTruthy();
    expect(screen.getByRole("heading", { name: demoProjectFixture.name })).toBeTruthy();
  });

  it("opens the real Project Viewer from primary project navigation", async () => {
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) =>
      Response.json(
        String(input).endsWith("/geometry")
          ? createGeometrySnapshotFixture(demoProjectFixture.id, demoProjectFixture.revision)
          : { project: demoProjectFixture, sourceRevision: demoProjectFixture.revision }
      )
    ) as typeof fetch;
    vi.stubGlobal("fetch", fetchSpy);

    render(
      <App
        initialEntries={["/app"]}
        authClient={createAuthClient(authenticatedSession, "access-token")}
      />
    );

    fireEvent.click(await screen.findByRole("link", { name: "Project viewer" }));

    expect(await screen.findByRole("img", { name: /interactive 2d geometry viewer/i })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Geometry Playground" })).toBeNull();
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

  it("keeps the Geometry Playground out of primary navigation", async () => {
    render(
      <App
        initialEntries={["/app"]}
        authClient={createAuthClient(authenticatedSession)}
      />
    );

    const projectsLink = await screen.findByRole("link", { name: "Projects" });
    expect(projectsLink.getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("link", { name: "Geometry Playground" })).toBeNull();
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
