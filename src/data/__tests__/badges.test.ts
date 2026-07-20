import {
  BADGE_CATALOG,
  createBadgeUnlockContext,
  getBadgeProgress,
  isBadgeUnlocked,
} from "@/src/data/badges";

const catches = Array.from({ length: 60 }, (_, index) => ({
  caught_at: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
  fish_id: `fish-${index + 1}`,
  size_cm: index === 5 ? 52 : 30,
  trip_id: `trip-${Math.min(index + 1, 20)}`,
  verification_status: "verified",
}));

const seasonalDates = [
  "2026-01-01T20:00:00+09:00",
  "2026-04-01T05:00:00+09:00",
  "2026-07-01T09:00:00+09:00",
  "2026-10-01T09:00:00+09:00",
];
const daytimeSeasonalDates = [
  "2026-01-15T09:00:00+09:00",
  "2026-04-15T09:00:00+09:00",
  "2026-07-15T09:00:00+09:00",
  "2026-10-15T09:00:00+09:00",
];

const trips = Array.from({ length: 20 }, (_, index) => ({
  completed_at: `2026-06-${String(index + 1).padStart(2, "0")}T22:00:00+09:00`,
  cover_image_url: index < 5 ? "https://example.com/cover.jpg" : null,
  id: `trip-${index + 1}`,
  memo: index < 5 ? "현장 기록" : null,
  scheduled_at:
    index < seasonalDates.length
      ? seasonalDates[index]
      : daytimeSeasonalDates[index % daytimeSeasonalDates.length],
  spot_name: `낚시터 ${Math.min(index + 1, 5)}`,
  status: "done",
}));

describe("badge unlock context", () => {
  const context = createBadgeUnlockContext(catches, trips);

  it("calculates the new milestone values from catch and trip records", () => {
    expect(context.catchCount).toBe(60);
    expect(context.uniqueSpecies).toBe(60);
    expect(context.completedTrips).toBe(20);
    expect(context.completeFieldNotes).toBe(5);
    expect(context.completedSeasons).toBe(4);
    expect(context.uniqueSpots).toBe(5);
    expect(context.maxCatchSize).toBe(52);
    expect(context.nightTrips).toBe(1);
    expect(context.dawnTrips).toBe(1);
  });

  it.each([
    "trips_10",
    "trips_20",
    "spots_5",
    "night_trip",
    "field_notes_5",
    "seasons_4",
    "catches_10",
    "catches_20",
    "record_catch",
    "species_20",
    "species_30",
    "species_60",
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
