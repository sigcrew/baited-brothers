import { formatSeasonRanges, getFishCardGuide, getLockedFishHint, scientificBinomial } from "@/src/lib/fishCardGuide";

const fish = (overrides: Partial<Parameters<typeof getLockedFishHint>[0]> = {}) => ({
  collection_group: "flatfish",
  recommended_baits: [] as string[],
  min_size_cm: null,
  peak_seasons: [] as number[],
  habitat_regions: [] as string[],
  habitat_environment: null,
  ...overrides,
});

describe("formatSeasonRanges", () => {
  it("collapses consecutive months into ranges", () => {
    expect(formatSeasonRanges([3, 4, 5, 9, 10, 11])).toBe("3–5·9–11월");
    expect(formatSeasonRanges([11, 3, 3, 4])).toBe("3–4·11월");
    expect(formatSeasonRanges([])).toBeNull();
  });
});

describe("getFishCardGuide", () => {
  it("prefers the legal minimum size when known", () => {
    expect(getFishCardGuide(fish({ min_size_cm: 35, recommended_baits: ["섀드웜"] }))).toBe("금지체장 35cm · 미끼 섀드웜");
  });

  it("falls back to the group season and bait", () => {
    expect(getFishCardGuide(fish())).toBe("제철 3–5·9–11월 · 미끼 웜");
  });
});

describe("getLockedFishHint", () => {
  it("gives a tactic line from species data and a where line from habitat", () => {
    const hint = getLockedFishHint(
      fish({
        peak_seasons: [5, 6, 7],
        recommended_baits: ["크릴"],
        habitat_regions: ["남해", "제주", "동해", "서해"],
        habitat_environment: "갯바위",
      }),
    );
    expect(hint.tactic).toBe("제철 5–7월 · 미끼 크릴");
    expect(hint.where).toBe("남해·제주·동해 · 갯바위");
  });

  it("uses group defaults and omits the where line when habitat is unknown", () => {
    const hint = getLockedFishHint(fish({ collection_group: "squid" }));
    expect(hint.tactic).toBe("제철 4–6·9–12월 · 미끼 에기");
    expect(hint.where).toBeNull();
  });

  it("drops a sentence-length habitat description but keeps the regions", () => {
    const hint = getLockedFishHint(
      fish({ habitat_regions: ["서해", "동해"], habitat_environment: "여름에는 얕은 연안과 하구로 올라온다" }),
    );
    expect(hint.where).toBe("서해·동해");
  });

  it("never leaks the species name or size", () => {
    const hint = getLockedFishHint(fish({ min_size_cm: 35 }));
    expect(hint.tactic).not.toMatch(/35/);
  });
});

describe("scientificBinomial", () => {
  it("drops the authority and year but keeps the binomial", () => {
    expect(scientificBinomial("Paralichthys olivaceus (Temminck & Schlegel, 1846)")).toBe("Paralichthys olivaceus");
    expect(scientificBinomial("Sebastes schlegelii Hilgendorf, 1880")).toBe("Sebastes schlegelii Hilgendorf");
    expect(scientificBinomial("Pleuronichthys cornutus")).toBe("Pleuronichthys cornutus");
  });
});
