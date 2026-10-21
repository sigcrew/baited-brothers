import React, { act } from "react";
import TestRenderer, { type ReactTestRenderer } from "react-test-renderer";

import { FieldNoticeProvider, type NoticeChoice, useFieldNotice } from "@/src/contexts/FieldNoticeContext";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

type NoticeApi = ReturnType<typeof useFieldNotice>;

const Capture = ({ onReady }: { onReady: (api: NoticeApi) => void }) => {
  onReady(useFieldNotice());
  return null;
};

const mount = () => {
  let api: NoticeApi | null = null;
  let renderer: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <FieldNoticeProvider>
        <Capture onReady={(value) => { api = value; }} />
      </FieldNoticeProvider>,
    );
  });
  return { api: () => api!, renderer: renderer! };
};

const pressByLabel = (renderer: ReactTestRenderer, label: string) => {
  const target = renderer.root.findAll(
    (node) => node.props.accessibilityLabel === label && typeof node.props.onPress === "function",
  )[0];
  expect(target).toBeDefined();
  act(() => {
    target.props.onPress();
  });
};

const options = {
  title: "기록을 그만둘까요?",
  message: "테스트",
  cancelLabel: "계속 작성",
  secondaryLabel: "삭제",
  secondaryDestructive: true,
  confirmLabel: "임시 보관",
};

describe("FieldNoticeContext.choose", () => {
  it.each<[string, NoticeChoice]>([
    ["임시 보관", "confirm"],
    ["삭제", "secondary"],
    ["계속 작성", "cancel"],
  ])("resolves %s as %s", async (label, expected) => {
    const { api, renderer } = mount();
    let result: Promise<NoticeChoice>;
    act(() => {
      result = api().choose(options);
    });
    pressByLabel(renderer, label);
    await expect(result!).resolves.toBe(expected);
  });

  it("treats tapping the backdrop as cancel so the user stays on the screen", async () => {
    const { api, renderer } = mount();
    let result: Promise<NoticeChoice>;
    act(() => {
      result = api().choose(options);
    });
    pressByLabel(renderer, "안내 닫기");
    await expect(result!).resolves.toBe("cancel");
  });

  it("keeps confirm() boolean and two-button", async () => {
    const { api, renderer } = mount();
    let result: Promise<boolean>;
    act(() => {
      result = api().confirm({ title: "t", message: "m", confirmLabel: "확인", cancelLabel: "취소" });
    });
    expect(renderer.root.findAll((node) => node.props.accessibilityLabel === "삭제")).toHaveLength(0);
    pressByLabel(renderer, "확인");
    await expect(result!).resolves.toBe(true);
  });
});
