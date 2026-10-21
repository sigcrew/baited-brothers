import React, { act } from "react";
import { Text } from "react-native";
import TestRenderer from "react-test-renderer";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));

import { AuthPolicyNotice } from "@/components/auth/FieldJournalAuth";

describe("AuthPolicyNotice", () => {
  it("renders the whole notice as one wrapping sentence with an inline link", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(<AuthPolicyNotice action="로그인하면" />);
    });
    // 최상위가 Text 하나여야 문장 전체가 자연스럽게 줄바꿈된다.
    const root = renderer.root.findAllByType(Text)[0];
    expect(root.parent?.type).not.toBe(Text);
    const tree = renderer.toJSON() as TestRenderer.ReactTestRendererJSON;
    expect(tree.type).toBe("Text");
    const text = (tree.children ?? [])
      .map((child) => (typeof child === "string" ? child : (child.children ?? []).join("")))
      .join("");
    expect(text).toBe("로그인하면 낚시당한 녀석들의 개인정보 처리방침에 동의하게 됩니다.");

    const link = renderer.root.findAll((node) => node.props.accessibilityRole === "link" && typeof node.props.onPress === "function")[0];
    act(() => link.props.onPress());
    expect(mockPush).toHaveBeenCalledWith("/privacy");
  });
});
