import {
  HERO_FALLBACK_TITLE,
  antonNumberWidth,
  pickSeasonalSpecies,
  seasonalHeroTitle,
} from "@/src/lib/homeHero";

const fish = (name_ko: string, peak_seasons: number[], catalog_sort_order: number) => ({
  name_ko,
  peak_seasons,
  catalog_sort_order,
});

const catalog = [
  fish("고등어", [6, 7, 8, 9, 10, 11], 31),
  fish("조피볼락", [3, 4, 5, 10, 11, 12], 7),
  fish("감성돔", [4, 5, 6, 9, 10, 11], 17),
  fish("말쥐치", [6, 7, 8, 9, 10], 44), // 대표 어종이 아니라 제외
  fish("보구치", [5, 6, 7, 8, 9, 10], 25), // 제외
];

describe("pickSeasonalSpecies", () => {
  it("only picks well-known species in season, using anglers' names", () => {
    const names = new Set<string>();
    for (let day = 1; day <= 31; day += 1) {
      const pick = pickSeasonalSpecies(catalog, new Date(2026, 9, day));
      expect(pick?.month).toBe(10);
      names.add(pick!.name);
    }
    expect([...names].sort()).toEqual(["감성돔", "고등어", "우럭"]);
  });

  it("is stable within a day and rotates across days", () => {
    const morning = pickSeasonalSpecies(catalog, new Date(2026, 9, 21, 6));
    const night = pickSeasonalSpecies(catalog, new Date(2026, 9, 21, 23));
    const tomorrow = pickSeasonalSpecies(catalog, new Date(2026, 9, 22, 6));
    expect(morning).toEqual(night);
    expect(tomorrow).not.toEqual(morning);
  });

  it("returns null when no headline species is in season", () => {
    expect(pickSeasonalSpecies(catalog, new Date(2026, 0, 10))).toBeNull();
    expect(pickSeasonalSpecies([fish("말쥐치", [10], 44)], new Date(2026, 9, 10))).toBeNull();
  });
});

describe("seasonalHeroTitle", () => {
  it("formats the headline or falls back", () => {
    expect(seasonalHeroTitle(catalog, new Date(2026, 9, 21))).toMatch(/^10월, (고등어|우럭|감성돔) 시즌입니다$/);
    expect(seasonalHeroTitle(catalog, new Date(2026, 0, 10))).toBe(HERO_FALLBACK_TITLE);
  });
});

describe("antonNumberWidth", () => {
  it("uses the narrow width for 1 so 11 is not padded like 88", () => {
    expect(antonNumberWidth("11", 100)).toBeLessThan(antonNumberWidth("88", 100));
    expect(antonNumberWidth("11", 100)).toBe(Math.ceil(2 + (0.6612 + 0.1) * 100));
    expect(antonNumberWidth("9", 100)).toBe(Math.ceil(2 + (0.4941 + 0.1) * 100));
  });
});
