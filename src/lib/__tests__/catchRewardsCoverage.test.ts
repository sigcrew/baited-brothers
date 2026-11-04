import { summarizeCollectionCoverage } from "@/src/lib/catchRewards";

describe("summarizeCollectionCoverage", () => {
  it("unlocks every FIELD 60 species whether or not its location was verified", () => {
    const coverage = summarizeCollectionCoverage([
      { fish_id: "a" },
      { fish_id: "b" },
      { fish_id: "b" },
      { fish_id: null },
    ]);
    expect([...coverage.unlockedFishIds].sort()).toEqual(["a", "b"]);
  });

  it("is empty for no catches", () => {
    expect(summarizeCollectionCoverage([])).toEqual({ unlockedFishIds: new Set() });
  });
});
