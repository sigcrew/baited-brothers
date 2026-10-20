jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
jest.mock("expo-notifications", () => ({
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DATE: "date" },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import {
  cancelTripReminder,
  resolveTripReminderTriggerAt,
  scheduleTripReminder,
  syncTripReminders,
  tripReminderIdentifier,
} from "@/src/lib/tripNotifications";

const scheduled = new Map<string, unknown>();
const NOW = Date.parse("2026-10-20T03:00:00.000Z");

beforeEach(async () => {
  jest.clearAllMocks();
  jest.spyOn(Date, "now").mockReturnValue(NOW);
  await AsyncStorage.clear();
  scheduled.clear();
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
  (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockImplementation(
    async () => Array.from(scheduled.keys()).map((identifier) => ({ identifier })),
  );
  (Notifications.scheduleNotificationAsync as jest.Mock).mockImplementation(
    async (request: { identifier: string }) => {
      scheduled.set(request.identifier, request);
      return request.identifier;
    },
  );
  (Notifications.cancelScheduledNotificationAsync as jest.Mock).mockImplementation(
    async (identifier: string) => {
      scheduled.delete(identifier);
    },
  );
});

afterEach(() => {
  (Date.now as jest.Mock).mockRestore?.();
});

const hoursFromNow = (hours: number) => new Date(NOW + hours * 3_600_000).toISOString();

describe("resolveTripReminderTriggerAt", () => {
  it("fires three hours before when there is time, otherwise fifteen minutes before", () => {
    expect(resolveTripReminderTriggerAt(hoursFromNow(5), NOW)).toBe(NOW + 2 * 3_600_000);
    expect(resolveTripReminderTriggerAt(hoursFromNow(1), NOW)).toBe(NOW + 45 * 60_000);
  });

  it("returns null for past trips, trips too close to start, and invalid dates", () => {
    expect(resolveTripReminderTriggerAt(hoursFromNow(-1), NOW)).toBeNull();
    expect(resolveTripReminderTriggerAt(new Date(NOW + 10 * 60_000), NOW)).toBeNull();
    expect(resolveTripReminderTriggerAt("not-a-date", NOW)).toBeNull();
  });
});

describe("trip reminders", () => {
  it("schedules with a deterministic identifier derived from the trip id", async () => {
    await scheduleTripReminder({ id: "t1", spotName: "부산", scheduledAt: hoursFromNow(6) });
    expect(scheduled.has(tripReminderIdentifier("t1"))).toBe(true);
  });

  it("cancels by identifier without depending on any stored id map", async () => {
    await scheduleTripReminder({ id: "t1", spotName: "부산", scheduledAt: hoursFromNow(6) });
    await AsyncStorage.clear(); // 어떤 로컬 상태도 남아 있지 않아도
    await cancelTripReminder("t1");
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      tripReminderIdentifier("t1"),
    );
    expect(scheduled.size).toBe(0);
  });

  it("skips past trips and clears any leftover reminder for them", async () => {
    scheduled.set(tripReminderIdentifier("old"), {});
    const result = await scheduleTripReminder({
      id: "old",
      spotName: "여수",
      scheduledAt: hoursFromNow(-2),
    });
    expect(result).toBe(false);
    expect(scheduled.size).toBe(0);
  });

  it("sync removes reminders for trips that no longer exist and keeps active ones", async () => {
    scheduled.set(tripReminderIdentifier("deleted"), {});
    scheduled.set("unrelated-notification", {});
    await syncTripReminders([
      { id: "keep", spotName: "거제", scheduledAt: hoursFromNow(8) },
    ]);
    expect(Array.from(scheduled.keys()).sort()).toEqual([
      tripReminderIdentifier("keep"),
      "unrelated-notification",
    ]);
  });

  it("serialises concurrent syncs so a stale sync cannot resurrect a deleted trip", async () => {
    const trip = { id: "t1", spotName: "포항", scheduledAt: hoursFromNow(8) };
    const first = syncTripReminders([trip]);
    const second = syncTripReminders([]);
    await Promise.all([first, second]);
    expect(scheduled.has(tripReminderIdentifier("t1"))).toBe(false);
  });

  it("cancels reminders recorded by the legacy id map once and removes the key", async () => {
    scheduled.set("legacy-uuid", {});
    await AsyncStorage.setItem(
      "baited-brothers:trip-notification-ids",
      JSON.stringify({ gone: "legacy-uuid" }),
    );
    await syncTripReminders([]);
    expect(scheduled.has("legacy-uuid")).toBe(false);
    expect(await AsyncStorage.getItem("baited-brothers:trip-notification-ids")).toBeNull();
  });
});
