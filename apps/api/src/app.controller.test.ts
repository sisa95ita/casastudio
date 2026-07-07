import { describe, expect, it } from "vitest";

import { AppController } from "./app.controller";

describe("AppController", () => {
  it("returns API status", () => {
    expect(new AppController().getStatus()).toEqual({
      name: "CasaStudio API",
      status: "ready"
    });
  });
});
