import { describe, expect, it } from "vitest";

import {
  formatEditorMeasurement,
  normalizeEditorMeasurement
} from "./editor-measurement";

describe("editor measurement precision", () => {
  it.each([
    [120, 120, "120"],
    [120.5, 120.5, "120.5"],
    [120.126, 120.13, "120.13"],
    [120.124, 120.12, "120.12"],
    [80.0000000003, 80, "80"]
  ])("normalizes and formats %s", (source, normalized, formatted) => {
    expect(normalizeEditorMeasurement(source)).toBe(normalized);
    expect(formatEditorMeasurement(source)).toBe(formatted);
  });
});
