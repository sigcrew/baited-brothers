import { stampFullDateTime, stampShortDateTime, stampTime } from "@/src/lib/stampDate";

const date = new Date(2026, 8, 11, 6, 0); // 2026-09-11 (금) 06:00 local

describe("stampDate", () => {
  it("formats 24-hour times with padding", () => {
    expect(stampTime(date)).toBe("06:00");
    expect(stampTime(new Date(2026, 9, 21, 22, 5))).toBe("22:05");
  });

  it("formats short and full stamps with English weekdays", () => {
    expect(stampShortDateTime(date)).toBe("09.11 FRI 06:00");
    expect(stampFullDateTime(date)).toBe("2026.09.11 FRI 06:00");
  });

  it("never contains Hangul so it renders in SpaceMono", () => {
    for (const text of [stampTime(date), stampShortDateTime(date), stampFullDateTime(date.toISOString())]) {
      expect(text).not.toMatch(/[가-힣]/);
    }
  });
});
