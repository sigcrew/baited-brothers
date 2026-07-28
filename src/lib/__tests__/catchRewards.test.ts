import {
  countsForCollectionRewards,
  countsForRanking,
} from "@/src/lib/catchRewards";

describe("catch reward policy", () => {
  it.each(["field_verified", "metadata_verified"] as const)(
    "allows %s to unlock collection rewards",
    (status) => {
      expect(countsForCollectionRewards(status)).toBe(true);
    },
  );

  it("keeps metadata-verified library photos out of rankings", () => {
    expect(countsForRanking("metadata_verified")).toBe(false);
    expect(countsForRanking("field_verified")).toBe(true);
  });

  it.each(["pending", "general_record"] as const)(
    "does not reward %s records",
    (status) => {
      expect(countsForCollectionRewards(status)).toBe(false);
      expect(countsForRanking(status)).toBe(false);
    },
  );
});
