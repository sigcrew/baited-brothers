import { summarizeCollectionCoverage } from "@/src/lib/catchRewards";

const row = (fish_id: string | null, verification_status: string | null) => ({ fish_id, verification_status });

describe("summarizeCollectionCoverage", () => {
  it("separates verified species from general records", () => {
    const coverage = summarizeCollectionCoverage([
      row("a", "field_verified"),
      row("b", "general_record"),
      row("c", "general_record"),
      row("c", "metadata_verified"),
      row(null, "general_record"),
    ]);
    expect([...coverage.unlockedFishIds].sort()).toEqual(["a", "c"]);
    expect(coverage.generalRecordCount).toBe(3);
    // c는 나중에 인증됐으므로 '일반 기록만' 목록에서 빠진다.
    expect([...coverage.generalRecordOnlyFishIds]).toEqual(["b"]);
  });

  it("treats pending and unverified as not yet counting", () => {
    const coverage = summarizeCollectionCoverage([row("a", "pending"), row("a", "unverified")]);
    expect(coverage.unlockedFishIds.size).toBe(0);
    expect(coverage.generalRecordCount).toBe(2);
    expect(coverage.generalRecordOnlyFishIds.has("a")).toBe(true);
  });

  it("is empty for no catches", () => {
    expect(summarizeCollectionCoverage([])).toEqual({
      unlockedFishIds: new Set(),
      generalRecordCount: 0,
      generalRecordOnlyFishIds: new Set(),
    });
  });
});
