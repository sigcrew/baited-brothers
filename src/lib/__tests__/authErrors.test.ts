import { authErrorMessage } from "@/src/lib/authErrors";

describe("authErrorMessage", () => {
  it.each([
    ["Invalid login credentials", /올바르지 않습니다/],
    ["Email not confirmed", /이메일 인증/],
    ["User already registered", /이미 가입된/],
    ["Password should be at least 6 characters", /6자/],
    ["Unable to validate email address: invalid format", /형식/],
    ["Request rate limit reached", /잦습니다/],
    ["Network request failed", /네트워크/],
  ])("maps %p to Korean guidance", (message, expected) => {
    expect(authErrorMessage({ message })).toMatch(expected);
  });

  it("never leaks an unknown server message", () => {
    expect(authErrorMessage({ message: "pq: relation does not exist" })).toBe(
      "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    expect(authErrorMessage(null, "로그인하지 못했습니다.")).toBe("로그인하지 못했습니다.");
  });

  it("treats HTTP 429 as rate limiting even without a message", () => {
    expect(authErrorMessage({ status: 429 })).toMatch(/잦습니다/);
  });
});
