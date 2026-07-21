import { sanitizeAnalyticsProperties } from "@/src/lib/analyticsPolicy";

describe("sanitizeAnalyticsProperties", () => {
  it("keeps small non-sensitive measurement properties", () => {
    expect(
      sanitizeAnalyticsProperties({
        candidate_count: 3,
        duration_ms: 2100,
        source: "camera",
        has_trip: true,
      }),
    ).toEqual({
      candidate_count: 3,
      duration_ms: 2100,
      source: "camera",
      has_trip: true,
    });
  });

  it("drops sensitive or content-bearing properties", () => {
    expect(
      sanitizeAnalyticsProperties({
        email: "angler@example.com",
        image_base64: "secret",
        latitude: 36.1,
        memo: "private note",
        candidate_count: 2,
      }),
    ).toEqual({ candidate_count: 2 });
  });
});
