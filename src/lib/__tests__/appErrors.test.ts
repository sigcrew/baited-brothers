import { toUserMessage, withTimeout } from "../appErrors";

describe("toUserMessage", () => {
  it("turns network errors into actionable Korean copy", () => {
    expect(toUserMessage(new Error("Network request failed"))).toContain(
      "네트워크",
    );
  });

  it("identifies duplicate writes", () => {
    expect(toUserMessage({ code: "23505" })).toBe("이미 저장된 조과입니다.");
  });

  it("keeps a useful server message", () => {
    expect(toUserMessage(new Error("직접 확인이 필요합니다."))).toBe(
      "직접 확인이 필요합니다.",
    );
  });
});

describe("withTimeout", () => {
  it("returns a completed task", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 100)).resolves.toBe("ok");
  });

  it("rejects a slow task", async () => {
    await expect(
      withTimeout(new Promise(() => undefined), 1, "시간 초과"),
    ).rejects.toThrow("시간 초과");
  });
});
