import { countsForRanking, isVerifiedCatch } from "@/src/lib/catchRewards";

describe("catch reward policy", () => {
  it.each(["field_verified", "metadata_verified"] as const)(
    "marks %s as a location-verified catch",
    (status) => {
      expect(isVerifiedCatch(status)).toBe(true);
    },
  );

  it("keeps metadata-verified library photos out of rankings", () => {
    expect(countsForRanking("metadata_verified")).toBe(false);
    expect(countsForRanking("field_verified")).toBe(true);
  });

  it.each(["pending", "general_record"] as const)(
    "does not mark %s as verified or ranked",
    (status) => {
      expect(isVerifiedCatch(status)).toBe(false);
      expect(countsForRanking(status)).toBe(false);
    },
  );
});
