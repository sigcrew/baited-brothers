import React, { act } from "react";
import { Platform } from "react-native";
import TestRenderer from "react-test-renderer";

const mockOpen = jest.fn();
const mockDismiss = jest.fn();

jest.mock("@react-native-community/datetimepicker", () => {
  const ReactModule = require("react");
  const { View } = require("react-native");
  const Picker = () => ReactModule.createElement(View, { testID: "inline-picker" });
  return {
    __esModule: true,
    default: Picker,
    DateTimePickerAndroid: { open: (...args: unknown[]) => mockOpen(...args), dismiss: (...args: unknown[]) => mockDismiss(...args) },
  };
});

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

import { TripDateTimePickerModal } from "@/components/trips/TripDateTimePickerModal";

const value = new Date(2026, 8, 11, 6, 0);
const originalOS = Platform.OS;

const setOS = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, "OS", { configurable: true, get: () => os });
};

afterEach(() => {
  setOS(originalOS);
  mockOpen.mockReset();
  mockDismiss.mockReset();
});

describe("TripDateTimePickerModal on Android", () => {
  it("opens only the system dialog, without the in-app sheet", () => {
    setOS("android");
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <TripDateTimePickerModal visible mode="time" value={value} onClose={jest.fn()} onConfirm={jest.fn()} />,
      );
    });
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(mockOpen.mock.calls[0][0]).toMatchObject({ mode: "time", display: "spinner", minuteInterval: 5 });
    expect(renderer.toJSON()).toBeNull();
  });

  it("confirms on set and closes on dismiss", () => {
    setOS("android");
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    act(() => {
      TestRenderer.create(
        <TripDateTimePickerModal visible mode="time" value={value} onClose={onClose} onConfirm={onConfirm} />,
      );
    });
    const { onChange } = mockOpen.mock.calls[0][0];
    const picked = new Date(2026, 8, 11, 5, 30);
    onChange({ type: "set" }, picked);
    expect(onConfirm).toHaveBeenCalledWith(picked);
    onChange({ type: "dismissed" }, undefined);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("TripDateTimePickerModal on iOS", () => {
  it("shows the in-app sheet with a correctly particled confirm label", () => {
    setOS("ios");
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <TripDateTimePickerModal visible mode="time" value={value} onClose={jest.fn()} onConfirm={jest.fn()} />,
      );
    });
    expect(mockOpen).not.toHaveBeenCalled();
    const text = JSON.stringify(renderer.toJSON());
    expect(text).toContain("이 시간으로 선택");
    expect(renderer.root.findAllByProps({ testID: "inline-picker" }).length).toBeGreaterThan(0);
  });
});
