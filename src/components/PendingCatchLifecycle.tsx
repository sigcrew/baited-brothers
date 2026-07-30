import NetInfo from "@react-native-community/netinfo";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/src/contexts/AuthContext";
import { useCreateCatch } from "@/src/hooks/useCreateCatch";
import { useFishes } from "@/src/hooks/useFishes";
import { useFishRecognition } from "@/src/hooks/useFishRecognition";
import {
  listPendingCatches,
  pendingCatchRetryDelayMs,
  readPendingCatchBase64,
  removePendingCatch,
  updatePendingCatch,
  type PendingCatchJob,
} from "@/src/lib/pendingCatchQueue";

const isDue = (job: PendingCatchJob) =>
  !job.nextRetryAt || Date.parse(job.nextRetryAt) <= Date.now();

export const PendingCatchLifecycle = () => {
  const { session } = useAuth();
  const { fishes, isLoading: fishesLoading } = useFishes(null, "core");
  const { recognize } = useFishRecognition();
  const { createCatch } = useCreateCatch();
  const processing = useRef(false);
  const online = useRef(false);
  const mountedAt = useRef(Date.now());

  const markRetry = useCallback(
    async (job: PendingCatchJob, message: string) => {
      const attemptCount = Math.max(1, job.attemptCount);
      await updatePendingCatch(job.userId, job.localId, {
        status: "failed_retryable",
        attemptCount,
        lastError: message,
        nextRetryAt: new Date(
          Date.now() + pendingCatchRetryDelayMs(attemptCount),
        ).toISOString(),
      });
    },
    [],
  );

  const processAnalysis = useCallback(
    async (job: PendingCatchJob) => {
      if (!job.analysisRequested) {
        await updatePendingCatch(job.userId, job.localId, {
          status: "needs_confirmation",
          lastError: null,
          nextRetryAt: null,
        });
        return;
      }
      const attemptCount = job.attemptCount + 1;
      await updatePendingCatch(job.userId, job.localId, {
        status: "analyzing",
        attemptCount,
        lastError: null,
        nextRetryAt: null,
      });
      try {
        const imageBase64 = await readPendingCatchBase64(job);
        const result = await recognize({
          imageBase64,
          mimeType: job.mimeType,
          fishes,
        });
        if (result.error) {
          await markRetry({ ...job, attemptCount }, result.error.message);
          return;
        }
        await updatePendingCatch(job.userId, job.localId, {
          candidates: result.candidates,
          candidateFishIds: result.candidates.map(
            (candidate) => candidate.fishId,
          ),
          status: "needs_confirmation",
          lastError: null,
          nextRetryAt: null,
        });
      } catch (error) {
        await markRetry(
          { ...job, attemptCount },
          error instanceof Error
            ? error.message
            : "AI 후보를 준비하지 못했습니다.",
        );
      }
    },
    [fishes, markRetry, recognize],
  );

  const processUpload = useCallback(
    async (job: PendingCatchJob) => {
      if (!job.selectedFishId && !job.customSpeciesName) return;
      const attemptCount = job.attemptCount + 1;
      await updatePendingCatch(job.userId, job.localId, {
        status: "uploading",
        attemptCount,
        lastError: null,
        nextRetryAt: null,
      });
      const result = await createCatch({
        tripId: job.tripId ?? undefined,
        fishId: job.selectedFishId ?? undefined,
        customSpeciesName: job.customSpeciesName ?? undefined,
        imageUri: job.localImageUri,
        mimeType: job.mimeType,
        imageWidth: job.imageWidth,
        imageHeight: job.imageHeight,
        latitude: job.latitude ?? undefined,
        longitude: job.longitude ?? undefined,
        capturedAt: job.capturedAt ?? undefined,
        locationAccuracyM: job.locationAccuracyM ?? undefined,
        locationCapturedAt: job.locationCapturedAt ?? undefined,
        captureMethod: job.captureMethod,
        sizeCm: job.sizeCm ?? undefined,
        memo: job.memo ?? undefined,
        candidateFishIds: job.candidateFishIds,
        idMethod:
          job.selectedFishId &&
          job.candidateFishIds.includes(job.selectedFishId)
          ? "closed_set_candidates"
          : "fallback_catalog",
        clientRequestId: job.clientRequestId,
      });
      if (result.error) {
        await markRetry(
          { ...job, attemptCount },
          result.error.message,
        );
        return;
      }
      await removePendingCatch(job.userId, job.localId);
    },
    [createCatch, markRetry],
  );

  const processQueue = useCallback(async () => {
    const userId = session?.user.id;
    if (
      !userId ||
      !online.current ||
      processing.current ||
      fishesLoading
    ) {
      return;
    }
    processing.current = true;
    try {
      const jobs = await listPendingCatches(userId);
      const recoverable = jobs
        .filter(isDue)
        .filter((job) => {
          if (job.status === "pending_analysis") return true;
          if (job.status === "pending_upload") return true;
          if (job.status === "failed_retryable") return true;
          if (
            (job.status === "analyzing" || job.status === "uploading") &&
            Date.parse(job.updatedAt) < mountedAt.current
          ) {
            return true;
          }
          return false;
        })
        .slice(0, 3);

      for (const job of recoverable) {
        if (job.selectedFishId || job.customSpeciesName) {
          await processUpload(job);
        } else {
          await processAnalysis(job);
        }
      }
    } finally {
      processing.current = false;
    }
  }, [
    fishesLoading,
    processAnalysis,
    processUpload,
    session?.user.id,
  ]);

  useEffect(() => {
    const updateNetworkState = (isConnected: boolean) => {
      online.current = isConnected;
      if (isConnected) void processQueue();
    };
    const unsubscribeNetwork = NetInfo.addEventListener((state) => {
      updateNetworkState(
        state.isConnected === true && state.isInternetReachable !== false,
      );
    });
    void NetInfo.fetch().then((state) => {
      updateNetworkState(
        state.isConnected === true && state.isInternetReachable !== false,
      );
    });
    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active") void processQueue();
      },
    );
    const interval = setInterval(() => {
      if (AppState.currentState === "active") void processQueue();
    }, 30_000);

    return () => {
      unsubscribeNetwork();
      appStateSubscription.remove();
      clearInterval(interval);
    };
  }, [processQueue]);

  return null;
};
