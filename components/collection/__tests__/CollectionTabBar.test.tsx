import React, { act } from "react";
import TestRenderer from "react-test-renderer";
import { StyleSheet } from "react-native";
import CollectionScreen from "@/app/(tabs)/encyclopedia";
import { CardsPanel } from "@/components/collection/CardsPanel";

let mockOptions: Record<string, any> = {};
const mockNavigation = { setOptions: (options: object) => Object.assign(mockOptions, options) };
const mockRouter = { push: jest.fn(), setParams: jest.fn() };
jest.mock("expo-router", () => ({
  useNavigation: () => mockNavigation,
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ segment: "cards" }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
}));
jest.mock("@/src/hooks/useFishes", () => ({ useFishes: () => ({ fishes: [] }) }));
jest.mock("@/src/hooks/useUserCatches", () => ({
  useUserCatches: () => ({ catches: [], unlockedFishIds: new Set(), isLoggedIn: true }),
}));
jest.mock("@/src/hooks/useFishingTrips", () => ({ useFishingTrips: () => ({ trips: [] }) }));
jest.mock("@/src/lib/analytics", () => ({ trackAnalyticsEvent: jest.fn() }));
jest.mock("@/components/collection/EncyclopediaPanel", () => ({ EncyclopediaPanel: () => null }));
jest.mock("@/components/collection/BadgesPanel", () => ({ BadgesPanel: () => null }));
jest.mock("@/components/collection/CardsPanel", () => ({ CardsPanel: () => null }));
jest.mock("@/components/catches/CatchEditModal", () => ({ CatchEditModal: () => null }));
jest.mock("@/components/design/ArchiveTabHeader", () => ({ ArchiveTabHeader: () => null }));

test("collection retains tab bar geometry on entry and after closing an overlay", () => {
  let screen: TestRenderer.ReactTestRenderer;
  act(() => { screen = TestRenderer.create(<CollectionScreen />); });
  try {
    const original = StyleSheet.flatten(mockOptions.tabBarStyle);
    expect(original).toEqual(expect.objectContaining({ height: 98, paddingBottom: 40 }));
    act(() => screen.root.findByType(CardsPanel).props.onOverlayVisibilityChange(true));
    expect(StyleSheet.flatten(mockOptions.tabBarStyle).display).toBe("none");
    act(() => screen.root.findByType(CardsPanel).props.onOverlayVisibilityChange(false));
    expect(StyleSheet.flatten(mockOptions.tabBarStyle)).toEqual(original);
  } finally {
    act(() => screen!.unmount());
  }
});
