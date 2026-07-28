import {
  ANALYTICS_EVENT_NAMES,
  sanitizeAnalyticsProperties,
} from "@/src/lib/analyticsPolicy";

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

  it("keeps the record and photo-save funnels in the strict event allow-list", () => {
    expect(ANALYTICS_EVENT_NAMES).toEqual(
      expect.arrayContaining([
        "catch_flow_started",
        "photo_captured",
        "analysis_result_viewed",
        "catch_save_started",
        "catch_save_succeeded",
        "catch_save_failed",
        "photo_library_save_succeeded",
        "photo_library_save_failed",
        "permission_result",
      ]),
    );
  });
});
