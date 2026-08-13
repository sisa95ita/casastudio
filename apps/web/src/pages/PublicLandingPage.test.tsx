import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import type { AuthClient } from "../auth/auth-client";

const anonymousAuthClient: AuthClient = {
  initialize: vi.fn().mockResolvedValue({ authenticated: false }),
  login: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  getAccessToken: vi.fn().mockResolvedValue(null)
};

afterEach(() => cleanup());

describe("PublicLandingPage", () => {
  it("renders the supplied product visuals with delivery hints", async () => {
    render(<App initialEntries={["/"]} authClient={anonymousAuthClient} />);

    const hero = await screen.findByRole("img", {
      name: "A floor plan progressing into a warm three-dimensional interior concept"
    });
    const workflow = screen.getByRole("img", {
      name: "A detailed project plan paired with a three-dimensional interior visualization"
    });
    const ai = screen.getByRole("img", {
      name: "An interior scene surrounded by material palettes and AI-assisted design variations"
    });

    expect(hero.getAttribute("src")).toContain("landing-hero.webp");
    expect(hero.getAttribute("fetchpriority")).toBe("high");
    expect(workflow.getAttribute("src")).toContain("product-workflow.webp");
    expect(workflow.getAttribute("loading")).toBe("lazy");
    expect(workflow.getAttribute("sizes")).toContain("340px");
    expect(workflow.closest("figure")?.getAttribute("data-responsive-visual")).toBe("workflow");
    expect(ai.getAttribute("src")).toContain("ai-design-assistant.webp");
    expect(ai.getAttribute("loading")).toBe("lazy");
    expect(ai.getAttribute("sizes")).toContain("620px");
    expect(ai.closest("figure")?.getAttribute("data-responsive-visual")).toBe("ai-design");
  });

  it("sends the primary call to action into the authenticated application flow", async () => {
    render(<App initialEntries={["/"]} authClient={anonymousAuthClient} />);

    fireEvent.click((await screen.findAllByRole("link", { name: "Open workspace" }))[0]!);

    await waitFor(() => expect(anonymousAuthClient.login).toHaveBeenCalled());
    expect(screen.getByRole("status").textContent).toContain("Opening secure sign in");
    expect(screen.queryByRole("heading", { name: "Sign in to CasaStudio" })).toBeNull();
  });
});
