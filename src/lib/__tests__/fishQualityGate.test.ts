import {
  expandSuggestedGroups,
  getAdjacentGroups,
  normalizeQualityGate,
} from "../../../supabase/functions/identify-fish/quality-policy";

const groups = new Set(["flatfish", "rockfish", "octopus"]);

const validGate = {
  subject_present: true,
  subject_type: "finfish",
  image_quality: 0.85,
  subject_size: "medium",
  visible_features: {
    head: true,
    body: true,
    fins_or_arms: true,
    tail_or_mantle: true,
  },
  quality_issues: [],
  suggested_groups: ["flatfish", "unknown", "rockfish"],
  needs_retake: false,
  note: "판별 가능",
};

describe("normalizeQualityGate", () => {
  it("accepts a clear subject and limits groups to the closed catalog", () => {
    const result = normalizeQualityGate(validGate, groups);

    expect(result.needsRetake).toBe(false);
    expect(result.suggestedGroups).toEqual(["flatfish", "rockfish"]);
  });

  it.each([
    ["tiny subject", { subject_size: "tiny" }],
    ["pixelated image", { quality_issues: ["pixelated"] }],
    ["low quality", { image_quality: 0.61 }],
    [
      "insufficient visible features",
      {
        visible_features: {
          head: false,
          body: true,
          fins_or_arms: false,
          tail_or_mantle: false,
        },
      },
    ],
    [
      "missing fish head",
      {
        visible_features: {
          head: false,
          body: true,
          fins_or_arms: true,
          tail_or_mantle: true,
        },
      },
    ],
    ["non-fish subject", { subject_type: "other" }],
  ])("requires a retake for %s", (_label, override) => {
    const result = normalizeQualityGate({ ...validGate, ...override }, groups);

    expect(result.needsRetake).toBe(true);
  });
});

describe("expandSuggestedGroups", () => {
  it("adds visually adjacent fish groups for a single coarse prediction", () => {
    const broadGroups = new Set([
      "rockfish",
      "seabass_croaker",
      "bream",
      "coastal",
    ]);

    expect(expandSuggestedGroups(["rockfish"], broadGroups)).toEqual([
      "rockfish",
      "seabass_croaker",
      "bream",
    ]);
  });

  it("keeps flatfish classification narrow", () => {
    expect(expandSuggestedGroups(["flatfish"], groups)).toEqual(["flatfish"]);
  });
});

describe("getAdjacentGroups", () => {
  it("prioritizes grouper-like candidates next to rockfish", () => {
    expect(getAdjacentGroups("rockfish")).toEqual([
      "seabass_croaker",
      "bream",
    ]);
  });
});
