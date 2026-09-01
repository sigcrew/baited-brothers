import React, { act } from "react";
import { Text } from "react-native";
import TestRenderer from "react-test-renderer";

import { CardsPanel } from "@/components/collection/CardsPanel";
import type { UserCatch } from "@/src/hooks/useUserCatches";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("@/src/lib/analytics", () => ({
  trackAnalyticsEvent: jest.fn(),
}));

jest.mock("@/components/collection/CatchArchiveCard", () => {
  const ReactModule = require("react") as typeof React;
  const {
    Text: MockText,
    TouchableOpacity: MockTouchableOpacity,
    View: MockView,
  } = require("react-native") as typeof import("react-native");

  return {
    CatchArchiveCard: ({ onMorePress }: { onMorePress?: () => void }) =>
      ReactModule.createElement(
        MockView,
        null,
        ReactModule.createElement(MockText, null, "테스트 조과 카드"),
        onMorePress
          ? ReactModule.createElement(MockTouchableOpacity, {
              accessibilityRole: "button",
              accessibilityLabel: "조과 카드 더보기",
              onPress: onMorePress,
            })
          : null,
      ),
  };
});

jest.mock("@/components/share/ShareCatchCardModal", () => {
  const ReactModule = require("react") as typeof React;
  const { Text: MockText } =
    require("react-native") as typeof import("react-native");

  return {
    ShareCatchCardModal: ({ visible }: { visible: boolean }) =>
      visible
        ? ReactModule.createElement(MockText, null, "공유 카드 모달")
        : null,
  };
});

const testCatch = {
  id: "catch-1",
  user_id: "user-1",
  fish_id: "fish-1",
  custom_species_name: null,
  fish: {
    id: "fish-1",
    name: "Olive flounder",
    name_ko: "넙치",
    image_url: null,
    category: "flatfish",
    catalog_sort_order: 1,
  },
  caught_at: "2026-08-01T00:00:00.000Z",
} as UserCatch;

const findByLabel = (root: TestRenderer.ReactTestInstance, label: string) =>
  root.findByProps({ accessibilityLabel: label });

describe("CardsPanel", () => {
  it("상세 메뉴에서 수정 연속 터치를 한 번만 전달하고 상세를 닫는다", () => {
    const onEditCatch = jest.fn();
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <CardsPanel
          insetsBottom={0}
          catches={[testCatch]}
          isLoading={false}
          isRefreshing={false}
          isLoggedIn
          onRefresh={jest.fn()}
          onEditCatch={onEditCatch}
        />,
      );
    });

    const root = renderer!.root;
    act(() => findByLabel(root, "넙치 조과 카드 열기").props.onPress());
    act(() => findByLabel(root, "조과 카드 더보기").props.onPress());

    const edit = findByLabel(root, "조과 기록 수정");
    act(() => {
      edit.props.onPress();
      edit.props.onPress();
    });

    expect(onEditCatch).toHaveBeenCalledTimes(1);
    expect(onEditCatch).toHaveBeenCalledWith(testCatch);
    expect(
      root.findAllByProps({ accessibilityLabel: "카드 상세 닫기" }),
    ).toHaveLength(0);
    act(() => renderer!.unmount());
  });

  it("공유 연속 터치를 한 번만 처리하고 공유 모달로 전환한다", () => {
    let renderer: TestRenderer.ReactTestRenderer;

    act(() => {
      renderer = TestRenderer.create(
        <CardsPanel
          insetsBottom={0}
          catches={[testCatch]}
          isLoading={false}
          isRefreshing={false}
          isLoggedIn
          onRefresh={jest.fn()}
        />,
      );
    });

    const root = renderer!.root;
    act(() => findByLabel(root, "넙치 조과 카드 열기").props.onPress());
    act(() => findByLabel(root, "조과 카드 더보기").props.onPress());

    const share = findByLabel(root, "공유 카드 만들기");
    act(() => {
      share.props.onPress();
      share.props.onPress();
    });

    expect(root.findAllByType(Text).some((node) => node.props.children === "공유 카드 모달")).toBe(true);
    expect(
      root.findAllByProps({ accessibilityLabel: "카드 상세 닫기" }),
    ).toHaveLength(0);
    act(() => renderer!.unmount());
  });
});
