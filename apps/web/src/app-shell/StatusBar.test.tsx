import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import rootPackage from "../../../../package.json";
import { StatusBar } from "./StatusBar";

afterEach(cleanup);

describe("StatusBar", () => {
  it("keeps contextual status on the left and shows the product version on the right", () => {
    render(<StatusBar>Saved · Level ground-floor · Revision 3</StatusBar>);

    const statusBar = screen.getByRole("status", { name: "Status bar" });
    const context = statusBar.querySelector(".workspace-status__context");
    const version = statusBar.querySelector(".workspace-status__version");

    expect(context).not.toBeNull();
    expect(version).not.toBeNull();
    expect(within(context as HTMLElement).getByText(/Saved/)).toBeTruthy();
    expect(within(version as HTMLElement).getByText(`v${rootPackage.version}`)).toBeTruthy();
    expect(context?.nextElementSibling).toBe(version);
  });
});
