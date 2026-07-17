import { describe, expect, it } from "vitest";

import { DesignBriefSchema } from "./design-brief";

const validDesignBrief = {
  id: "warm-industrial-living",
  name: "Warm Industrial Living Room",
  description: "Living room design exploration.",
  promptText: "Design a warm industrial living room with a calm and contemporary atmosphere.",
  style: "warm industrial",
  constraints: ["Preserve all wall geometry", "Preserve the staircase"],
  palette: ["warm white", "black metal", "natural wood"],
  referenceAssetRefs: ["assets/references/moodboard-001.jpg"],
  notes: "Keep the TV wall visually clean and avoid oversized furniture."
};

describe("DesignBriefSchema", () => {
  it("accepts a valid structured DesignBrief", () => {
    expect(DesignBriefSchema.parse(validDesignBrief)).toEqual(validDesignBrief);
  });

  it("accepts a valid minimal DesignBrief", () => {
    const minimalDesignBrief = {
      id: "minimal-brief",
      promptText: "Update the living room design.",
      constraints: [],
      palette: [],
      referenceAssetRefs: []
    };

    expect(DesignBriefSchema.parse(minimalDesignBrief)).toEqual(minimalDesignBrief);
  });

  it("accepts empty constraints array", () => {
    expect(DesignBriefSchema.parse({ ...validDesignBrief, constraints: [] }).constraints).toEqual([]);
  });

  it("accepts empty palette array", () => {
    expect(DesignBriefSchema.parse({ ...validDesignBrief, palette: [] }).palette).toEqual([]);
  });

  it("accepts empty referenceAssetRefs array", () => {
    expect(DesignBriefSchema.parse({ ...validDesignBrief, referenceAssetRefs: [] }).referenceAssetRefs).toEqual([]);
  });

  it("rejects empty promptText", () => {
    expect(DesignBriefSchema.safeParse({ ...validDesignBrief, promptText: "" }).success).toBe(false);
  });

  it("rejects empty string inside constraints", () => {
    expect(DesignBriefSchema.safeParse({ ...validDesignBrief, constraints: [""] }).success).toBe(false);
  });

  it("rejects empty string inside palette", () => {
    expect(DesignBriefSchema.safeParse({ ...validDesignBrief, palette: [""] }).success).toBe(false);
  });

  it("rejects empty string inside referenceAssetRefs", () => {
    expect(DesignBriefSchema.safeParse({ ...validDesignBrief, referenceAssetRefs: [""] }).success).toBe(false);
  });

  it("rejects undocumented fields", () => {
    expect(DesignBriefSchema.safeParse({ ...validDesignBrief, providerPrompt: "provider payload" }).success).toBe(
      false
    );
  });
});
