jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import {
  normalizePendingCatchJobs,
  pendingCatchRetryDelayMs,
} from "@/src/lib/pendingCatchQueue";

const validJob = {
  localId: "local-1",
  clientRequestId: "request-1",
  userId: "user-1",
  tripId: null,
  tripName: null,
  localImageUri: "file:///pending/local-1.jpg",
  imageWidth: 1200,
  imageHeight: 900,
  mimeType: "image/jpeg",
  captureMethod: "live_camera",
  capturedAt: "2026-07-30T01:00:00.000Z",
  latitude: 36.1,
  longitude: 126.5,
  locationAccuracyM: 12,
  locationCapturedAt: "2026-07-30T01:00:00.000Z",
  selectedFishId: null,
  candidateFishIds: [],
  candidates: [],
  sizeCm: null,
  memo: null,
  status: "pending_analysis",
  attemptCount: 0,
  lastError: null,
  createdAt: "2026-07-30T01:00:00.000Z",
  updatedAt: "2026-07-30T01:00:00.000Z",
};

describe("pending catch queue", () => {
  it("restores defaults when older queue records lack new retry fields", () => {
    expect(normalizePendingCatchJobs([validJob])).toEqual([
      expect.objectContaining({
        localId: "local-1",
        analysisRequested: true,
        nextRetryAt: null,
      }),
    ]);
  });

  it("drops malformed or unsupported queue records", () => {
    expect(
      normalizePendingCatchJobs([
        validJob,
        { ...validJob, localId: null },
        { ...validJob, status: "completed" },
        null,
      ]),
    ).toHaveLength(1);
  });

  it("backs off retries and caps them at fifteen minutes", () => {
    expect(pendingCatchRetryDelayMs(1)).toBe(15_000);
    expect(pendingCatchRetryDelayMs(2)).toBe(30_000);
    expect(pendingCatchRetryDelayMs(20)).toBe(15 * 60_000);
  });
});
