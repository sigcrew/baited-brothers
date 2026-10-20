jest.mock('expo-file-system',()=>({Paths:{document:{uri:'file:///current/Documents/'}}}));
jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

import {
  PENDING_CATCH_LOCK_TTL_MS,
  PENDING_CATCH_MAX_ATTEMPTS,
  isPendingCatchLockedByForeground,
  normalizePendingCatchJobs,
  pendingCatchRetryDelayMs,
  resolvePendingCatchFailure,
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

  it("defaults lock fields for records written before locking existed", () => {
    expect(normalizePendingCatchJobs([validJob])[0]).toEqual(
      expect.objectContaining({ lockedBy: null, lockedAt: null }),
    );
    expect(
      normalizePendingCatchJobs([{ ...validJob, lockedBy: "someone-else", lockedAt: 5 }])[0],
    ).toEqual(expect.objectContaining({ lockedBy: null, lockedAt: null }));
  });

  describe("isPendingCatchLockedByForeground", () => {
    const now = Date.parse("2026-10-20T00:30:00.000Z");
    it("honours a fresh foreground lock", () => {
      expect(
        isPendingCatchLockedByForeground(
          { lockedBy: "foreground", lockedAt: new Date(now - 60_000).toISOString() },
          now,
        ),
      ).toBe(true);
    });
    it("ignores a lock older than the TTL (app was killed) and non-foreground locks", () => {
      expect(
        isPendingCatchLockedByForeground(
          { lockedBy: "foreground", lockedAt: new Date(now - PENDING_CATCH_LOCK_TTL_MS - 1).toISOString() },
          now,
        ),
      ).toBe(false);
      expect(isPendingCatchLockedByForeground({ lockedBy: "background", lockedAt: new Date(now).toISOString() }, now)).toBe(false);
      expect(isPendingCatchLockedByForeground({ lockedBy: null, lockedAt: null }, now)).toBe(false);
    });
  });

  it("keeps failed_terminal records instead of dropping them as unknown", () => {
    expect(
      normalizePendingCatchJobs([{ ...validJob, status: "failed_terminal" }]),
    ).toHaveLength(1);
  });

  describe("resolvePendingCatchFailure", () => {
    it("schedules a retry for transient errors below the attempt cap", () => {
      const now = Date.parse("2026-10-20T00:00:00.000Z");
      expect(
        resolvePendingCatchFailure(2, "네트워크 연결을 확인한 뒤 다시 시도해 주세요.", now),
      ).toEqual({
        status: "failed_retryable",
        attemptCount: 2,
        lastError: "네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
        nextRetryAt: new Date(now + 30_000).toISOString(),
      });
    });

    it("stops retrying once the attempt cap is reached", () => {
      const failure = resolvePendingCatchFailure(
        PENDING_CATCH_MAX_ATTEMPTS,
        "네트워크 연결을 확인한 뒤 다시 시도해 주세요.",
      );
      expect(failure.status).toBe("failed_terminal");
      expect(failure.nextRetryAt).toBeNull();
    });

    it.each([
      "AI 추천은 24시간에 30회까지 사용할 수 있어요. 도감에서 직접 선택해 기록할 수 있습니다.",
      "사진 용량이 너무 큽니다. 더 작은 사진으로 다시 시도해 주세요.",
      "보관된 조과 사진을 찾을 수 없습니다.",
    ])("stops immediately on a non-recoverable error (%s)", (message) => {
      const failure = resolvePendingCatchFailure(1, message);
      expect(failure).toEqual({
        status: "failed_terminal",
        attemptCount: 1,
        lastError: message,
        nextRetryAt: null,
      });
    });
  });
});

test('rebases a preserved photo to the current app container after an iOS update',()=>{
 const [job]=normalizePendingCatchJobs([{...validJob,localImageUri:'file:///old-container/Documents/pending-catches/user-1/local-1.jpg'}]);
 expect(job.localImageUri).toBe('file:///current/Documents/pending-catches/user-1/local-1.jpg');
});
