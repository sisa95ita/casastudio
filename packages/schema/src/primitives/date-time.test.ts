import { describe, expect, it } from "vitest";

import { IsoDateTimeSchema } from "./date-time";

describe("IsoDateTimeSchema", () => {
  it("accepts ISO 8601 date-times with an offset", () => {
    expect(IsoDateTimeSchema.parse("2026-07-11T15:30:00+02:00")).toBe("2026-07-11T15:30:00+02:00");
  });

  it("rejects date-only values", () => {
    expect(IsoDateTimeSchema.safeParse("2026-07-11").success).toBe(false);
  });
});
