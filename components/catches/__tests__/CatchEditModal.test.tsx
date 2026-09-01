import React, { act } from "react";
import { TextInput } from "react-native";
import TestRenderer from "react-test-renderer";

import { CatchEditModal } from "@/components/catches/CatchEditModal";
import type { UserCatch } from "@/src/hooks/useUserCatches";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("@/components/record/FishCatalogSheet", () => ({
  FishCatalogSheet: () => null,
}));

const testCatch = {
  id: "catch-1",
  user_id: "user-1",
  fish_id: "fish-1",
  custom_species_name: null,
  size_cm: 42,
  memo: "입력 보존 테스트",
  caught_at: "2026-08-01T00:00:00.000Z",
} as UserCatch;

const fishes = [
  {
    id: "fish-1",
    name: "Olive flounder",
    name_ko: "넙치",
  },
] as never[];

const findByLabel = (root: TestRenderer.ReactTestInstance, label: string) =>
  root.findByProps({ accessibilityLabel: label });

describe("CatchEditModal", () => {
  it("저장 연속 터치를 한 번만 실행하고 실패 후 입력과 재시도를 유지한다", async () => {
    const onSave = jest
      .fn()
      .mockResolvedValueOnce(new Error("Network request failed"))
      .mockResolvedValueOnce(null);
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <CatchEditModal
          item={testCatch}
          fishes={fishes}
          isSaving={false}
          onClose={jest.fn()}
          onSave={onSave}
        />,
      );
    });

    const root = renderer!.root;
    const sizeInput = findByLabel(root, "조과 크기");
    act(() => sizeInput.props.onChangeText("43"));

    const save = findByLabel(root, "조과 수정 저장");
    await act(async () => {
      const first = save.props.onPress();
      const second = save.props.onPress();
      await Promise.all([first, second]);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(findByLabel(root, "조과 크기").props.value).toBe("43");
    expect(
      findByLabel(root, "조과 수정 저장 다시 시도"),
    ).toBeTruthy();
    expect(
      root.findAllByType(TextInput).some((input) => input.props.value === "43"),
    ).toBe(true);

    await act(async () => {
      await findByLabel(root, "조과 수정 저장 다시 시도").props.onPress();
    });
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it("0 이하 크기는 서버 요청 전에 차단한다", async () => {
    const onSave = jest.fn().mockResolvedValue(null);
    let renderer: TestRenderer.ReactTestRenderer;

    await act(async () => {
      renderer = TestRenderer.create(
        <CatchEditModal
          item={testCatch}
          fishes={fishes}
          isSaving={false}
          onClose={jest.fn()}
          onSave={onSave}
        />,
      );
    });

    const root = renderer!.root;
    act(() => findByLabel(root, "조과 크기").props.onChangeText("0"));
    await act(async () => findByLabel(root, "조과 수정 저장").props.onPress());

    expect(onSave).not.toHaveBeenCalled();
    expect(
      root.findAll(
        (node) => node.props.children === "크기는 0보다 큰 숫자로 입력해 주세요.",
      ),
    ).not.toHaveLength(0);
  });
});
