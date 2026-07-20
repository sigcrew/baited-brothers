import {
  BADGE_CATALOG,
  createBadgeUnlockContext,
  getBadgeProgress,
  isBadgeUnlocked,
} from "@/src/data/badges";

const catches = Array.from({ length: 20 }, (_, index) => ({
  caught_at: `2026-07-${String(index + 1).padStart(2, "0")}T09:00:00+09:00`,
  fish_id: `fish-${index + 1}`,
  size_cm: index === 5 ? 52 : 30,
  trip_id: `trip-${Math.min(index + 1, 10)}`,
  verification_status: "verified",
}));

const trips = Array.from({ length: 10 }, (_, index) => ({
  completed_at: `2026-06-${String(index + 1).padStart(2, "0")}T22:00:00+09:00`,
  cover_image_url: index === 0 ? "https://example.com/cover.jpg" : null,
  id: `trip-${index + 1}`,
  memo: index === 0 ? "현장 기록" : null,
  scheduled_at:
    index === 0
      ? "2026-06-01T20:00:00+09:00"
      : index === 1
        ? "2026-06-02T05:00:00+09:00"
        : `2026-06-${String(index + 1).padStart(2, "0")}T09:00:00+09:00`,
  spot_name: `낚시터 ${Math.min(index + 1, 5)}`,
  status: "done",
}));

describe("badge unlock context", () => {
  const context = createBadgeUnlockContext(catches, trips);

  it("calculates the new milestone values from catch and trip records", () => {
    expect(context.catchCount).toBe(20);
    expect(context.uniqueSpecies).toBe(20);
    expect(context.completedTrips).toBe(10);
    expect(context.uniqueSpots).toBe(5);
    expect(context.maxCatchSize).toBe(52);
    expect(context.nightTrips).toBe(1);
    expect(context.dawnTrips).toBe(1);
  });

  it.each([
    "trips_10",
    "spots_5",
    "night_trip",
    "catches_10",
    "record_catch",
    "species_20",
  ])("unlocks %s when its requirement is met", (badgeId) => {
    expect(isBadgeUnlocked(badgeId, context)).toBe(true);
    expect(context.acquiredAt[badgeId]).toBeDefined();
  });

  it("keeps every catalog badge connected to progress logic", () => {
    for (const badge of BADGE_CATALOG) {
      const progress = getBadgeProgress(badge.id, context);
      expect(progress.target).toBeGreaterThan(0);
      expect(progress.label).not.toBe("진행도");
    }
  });
});
