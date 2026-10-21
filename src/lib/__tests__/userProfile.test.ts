import { formatMemberSince, pickDisplayName } from "@/src/lib/userProfile";

describe("pickDisplayName", () => {
  it("returns the first non-blank candidate", () => {
    expect(pickDisplayName(undefined, "  ", "바다형제", "other")).toBe("바다형제");
    expect(pickDisplayName(null, "")).toBeNull();
  });
});

describe("formatMemberSince", () => {
  it("formats the join month as SINCE YYYY.MM", () => {
    // 시간대에 따라 7월 말/8월 초로 갈릴 수 있는 값은 피한다.
    expect(formatMemberSince("2026-07-15T08:41:41.448411+00:00")).toBe("SINCE 2026.07");
  });

  it("returns null when the timestamp is missing or invalid", () => {
    expect(formatMemberSince(null)).toBeNull();
    expect(formatMemberSince(undefined)).toBeNull();
    expect(formatMemberSince("not a date")).toBeNull();
  });
});
