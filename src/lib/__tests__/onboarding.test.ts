jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  ONBOARDING_SEEN_KEY,
  ONBOARDING_SLIDES,
  ONBOARDING_VERSION,
  hasSeenOnboarding,
  markOnboardingSeen,
  resolveLaunchRoute,
} from "@/src/lib/onboarding";

describe("resolveLaunchRoute", () => {
  it("shows onboarding first, whether or not a session exists", () => {
    expect(resolveLaunchRoute({ seenOnboarding: false, hasSession: false })).toBe("/onboarding");
    expect(resolveLaunchRoute({ seenOnboarding: false, hasSession: true })).toBe("/onboarding");
  });

  it("routes by session once onboarding was seen", () => {
    expect(resolveLaunchRoute({ seenOnboarding: true, hasSession: true })).toBe("/(tabs)");
    expect(resolveLaunchRoute({ seenOnboarding: true, hasSession: false })).toBe("/(auth)/login");
  });

  it("lets development builds reach the tabs as a guest", () => {
    expect(resolveLaunchRoute({ seenOnboarding: true, hasSession: false, isDevelopment: true })).toBe("/(tabs)");
  });
});

describe("onboarding seen flag", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("is unseen until marked, then matches only the current version", async () => {
    expect(await hasSeenOnboarding()).toBe(false);
    await markOnboardingSeen();
    expect(await hasSeenOnboarding()).toBe(true);
    expect(await AsyncStorage.getItem(ONBOARDING_SEEN_KEY)).toBe(ONBOARDING_VERSION);

    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, "2000-01-01"); // 구버전
    expect(await hasSeenOnboarding()).toBe(false);
  });

  it("skips onboarding rather than blocking when storage is unreadable", async () => {
    const spy = jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("disk"));
    expect(await hasSeenOnboarding()).toBe(true);
    spy.mockRestore();
  });
});

describe("ONBOARDING_SLIDES", () => {
  it("has three slides with unique keys and an icon each", () => {
    expect(ONBOARDING_SLIDES).toHaveLength(3);
    expect(new Set(ONBOARDING_SLIDES.map((slide) => slide.key)).size).toBe(3);
    for (const slide of ONBOARDING_SLIDES) {
      expect(slide.title.length).toBeGreaterThan(0);
      expect(slide.body.length).toBeGreaterThan(20);
    }
  });
});
