import React, { act } from "react";
import TestRenderer from "react-test-renderer";

import { ShareCatchCardModal } from "@/components/share/ShareCatchCardModal";
import type { ShareCatchData } from "@/src/lib/shareCard";

const mockCapture = jest.fn();
const mockShareOpen = jest.fn();
const mockAlert = jest.fn();

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("react-native-view-shot", () => {
  const ReactModule = require("react") as typeof React;
  const { View } = require("react-native") as typeof import("react-native");

  return {
    __esModule: true,
    default: ReactModule.forwardRef(
      ({ children }: { children: React.ReactNode }, ref) => {
        ReactModule.useImperativeHandle(ref, () => ({
          capture: mockCapture,
        }));
        return <View>{children}</View>;
      },
    ),
  };
});

jest.mock("react-native-share", () => ({
  default: { open: (...args: unknown[]) => mockShareOpen(...args) },
  open: (...args: unknown[]) => mockShareOpen(...args),
}));

jest.mock("@/components/share/ShareCatchCard", () => {
  const ReactModule = require("react") as typeof React;
  const { Text: MockText } =
    require("react-native") as typeof import("react-native");

  return {
    ShareCatchCard: () =>
      ReactModule.createElement(MockText, null, "공유 카드 이미지"),
  };
});

jest.mock("@/src/contexts/FieldNoticeContext", () => ({
  useFieldNotice: () => ({ alert: mockAlert }),
}));

jest.mock("@/src/lib/analytics", () => ({
  trackAnalyticsEvent: jest.fn(),
}));

const item = {
  id: "catch-1",
  imageSource: { uri: "https://example.com/fish.png" },
  fishName: "넙치",
  scientificName: "Paralichthys olivaceus",
  sizeCm: 42,
  caughtAt: "2026-08-01T00:00:00.000Z",
  regionLabel: "충남",
  verificationStatus: "verified",
} satisfies ShareCatchData;

describe("ShareCatchCardModal", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("공유 버튼 연속 터치에도 캡처와 시스템 공유를 한 번만 실행한다", async () => {
    mockCapture.mockResolvedValue("file:///tmp/share.png");
    mockShareOpen.mockResolvedValue({ success: true });
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <ShareCatchCardModal
          item={item}
          visible
          onClose={jest.fn()}
          source="archive"
        />,
      );
    });

    const share = renderer!.root.findByProps({
      accessibilityLabel: "이미지로 공유하기",
    });
    await act(async () => {
      let first: Promise<void>;
      let second: Promise<void>;
      first = share.props.onPress();
      second = share.props.onPress();
      await Promise.all([first, second]);
    });
    expect(mockCapture).toHaveBeenCalledTimes(1);
    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockShareOpen).toHaveBeenCalledTimes(1);
    act(() => renderer!.unmount());
  });
});
