import { countOverdueTrips, formatCountdown, isTripOverdue, pickNextTrip, tripCountdown } from "@/src/lib/tripSchedule";

const now = new Date(2026, 9, 21, 10, 30); // 2026-10-21 10:30 local

describe("tripCountdown", () => {
  it("counts calendar days, not elapsed hours", () => {
    expect(tripCountdown(new Date(2026, 9, 24, 6, 0), now)).toEqual({ kind: "upcoming", daysAway: 3 });
    expect(tripCountdown(new Date(2026, 9, 21, 23, 59), now)).toEqual({ kind: "today" });
    expect(tripCountdown(new Date(2026, 9, 21, 0, 0), now)).toEqual({ kind: "today" });
  });

  it("reports overdue trips instead of clamping to zero", () => {
    expect(tripCountdown(new Date(2026, 8, 11, 6, 0), now)).toEqual({ kind: "overdue", daysOverdue: 40 });
    expect(isTripOverdue(new Date(2026, 8, 11, 6, 0), now)).toBe(true);
    expect(isTripOverdue(new Date(2026, 9, 22), now)).toBe(false);
  });

  it("accepts ISO strings", () => {
    expect(tripCountdown(new Date(2026, 9, 23).toISOString(), now)).toEqual({ kind: "upcoming", daysAway: 2 });
  });
});

describe("formatCountdown", () => {
  it("formats the three states", () => {
    expect(formatCountdown({ kind: "upcoming", daysAway: 3 })).toBe("D-3");
    expect(formatCountdown({ kind: "today" })).toBe("D-DAY");
    expect(formatCountdown({ kind: "overdue", daysOverdue: 40 })).toBe("D+40");
  });
});

describe("pickNextTrip", () => {
  const trip = (scheduled: Date, id: string) => ({ id, scheduled_at: scheduled.toISOString() });

  it("prefers the earliest trip that is today or later", () => {
    const planned = [trip(new Date(2026, 8, 11), "past"), trip(new Date(2026, 10, 2), "later"), trip(new Date(2026, 9, 25), "soon")];
    expect(pickNextTrip(planned, now)).toEqual({ trip: planned[2], overdueCount: 1 });
  });

  it("falls back to the most recent overdue trip so it can be tidied up", () => {
    const planned = [trip(new Date(2026, 7, 1), "older"), trip(new Date(2026, 8, 11), "newer")];
    expect(pickNextTrip(planned, now)).toEqual({ trip: planned[1], overdueCount: 2 });
  });

  it("returns null with no planned trips", () => {
    expect(pickNextTrip([], now)).toBeNull();
  });
});

describe("countOverdueTrips", () => {
  it("counts only trips scheduled before today", () => {
    const planned = [{ scheduled_at: new Date(2026, 8, 11).toISOString() }, { scheduled_at: new Date(2026, 9, 21).toISOString() }];
    expect(countOverdueTrips(planned, now)).toBe(1);
  });
});
