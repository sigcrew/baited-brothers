import type { RecognitionAnalysis } from "./fishRecognition";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";

export type PendingCatchStatus =
  | "pending_analysis"
  | "analyzing"
  | "needs_confirmation"
  | "pending_upload"
  | "uploading"
  | "failed_retryable"
  | "failed_terminal";

/**
 * job을 지금 누가 다루는지. 포그라운드(record 화면)가 열어 둔 job은 백그라운드
 * 워커가 건드리지 않아야 같은 사진을 두 번 올리거나, 백그라운드가 로컬 파일을
 * 지운 뒤 포그라운드가 "저장 실패"를 띄우는 일이 없다.
 */
export type PendingCatchLockOwner = "foreground" | "background";

export type PendingCatchCandidate = {
  fishId: string;
  confidence: number;
  reason: string;
};

export type PendingCatchJob = {
  localId: string;
  clientRequestId: string;
  userId: string;
  tripId: string | null;
  tripName: string | null;
  localImageUri: string;
  imageWidth: number;
  imageHeight: number;
  mimeType: "image/jpeg" | "image/png";
  captureMethod: "live_camera" | "photo_library";
  analysisRequested: boolean;
  capturedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  locationAccuracyM: number | null;
  locationCapturedAt: string | null;
  selectedFishId: string | null;
  customSpeciesName: string | null;
  candidateFishIds: string[];
  candidates: PendingCatchCandidate[];
  recognitionAnalysis?: RecognitionAnalysis | null;
  sizeCm: number | null;
  memo: string | null;
  status: PendingCatchStatus;
  attemptCount: number;
  lastError: string | null;
  nextRetryAt: string | null;
  lockedBy: PendingCatchLockOwner | null;
  lockedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type PreservePendingCatchInput = {
  userId: string;
  tripId?: string;
  tripName?: string;
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  mimeType: "image/jpeg" | "image/png";
  captureMethod: "live_camera" | "photo_library";
  analysisRequested?: boolean;
  capturedAt?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracyM?: number;
  locationCapturedAt?: string;
};

const STORAGE_KEY = "pending-catch-queue-v1";
/** 앱 강제 종료로 풀리지 않은 포그라운드 잠금은 이 시간이 지나면 무시한다. */
export const PENDING_CATCH_LOCK_TTL_MS = 10 * 60_000;

export const isPendingCatchLockedByForeground = (
  job: Pick<PendingCatchJob, "lockedBy" | "lockedAt">,
  now = Date.now(),
) => {
  if (job.lockedBy !== "foreground" || !job.lockedAt) return false;
  const lockedAt = Date.parse(job.lockedAt);
  return Number.isFinite(lockedAt) && now - lockedAt < PENDING_CATCH_LOCK_TTL_MS;
};
const QUEUE_FOLDER = "pending-catches";
const RETRY_BASE_MS = 15_000;
const RETRY_MAX_MS = 15 * 60_000;
/** 백그라운드 자동 재시도 상한. 넘으면 failed_terminal로 멈추고 사용자가 직접 이어간다. */
export const PENDING_CATCH_MAX_ATTEMPTS = 5;

/**
 * 다시 시도해도 결과가 바뀌지 않는 실패. 자동 재시도는 AI 쿼터만 소진하므로
 * 즉시 failed_terminal로 멈춘다. 메시지는 useFishRecognition / toUserMessage가
 * 만든 사용자 문구 기준이다.
 */
const TERMINAL_ERROR_PATTERNS = [
  /24시간에 30회/, // AI 식별 쿼터 소진
  /사진 용량이 너무 큽니다/, // 413
  /보관된 조과 사진을 찾을 수 없습니다/, // 로컬 파일 유실
];

export const isPendingCatchTerminalError = (message: string | null | undefined) =>
  Boolean(message) && TERMINAL_ERROR_PATTERNS.some((pattern) => pattern.test(message!));

export type PendingCatchFailure = Pick<
  PendingCatchJob,
  "status" | "attemptCount" | "lastError" | "nextRetryAt"
>;

/** 실패 후 큐 상태 결정. attemptCount는 방금 끝난 시도를 포함한 누적 횟수다. */
export const resolvePendingCatchFailure = (
  attemptCount: number,
  message: string,
  now = Date.now(),
): PendingCatchFailure => {
  const attempts = Math.max(1, attemptCount);
  if (attempts >= PENDING_CATCH_MAX_ATTEMPTS || isPendingCatchTerminalError(message)) {
    return {
      status: "failed_terminal",
      attemptCount: attempts,
      lastError: message,
      nextRetryAt: null,
    };
  }
  return {
    status: "failed_retryable",
    attemptCount: attempts,
    lastError: message,
    nextRetryAt: new Date(now + pendingCatchRetryDelayMs(attempts)).toISOString(),
  };
};

let mutationTail: Promise<void> = Promise.resolve();
const queueListeners = new Set<() => void>();

const createLocalId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;

export const pendingCatchRetryDelayMs = (attemptCount: number) =>
  Math.min(
    RETRY_MAX_MS,
    RETRY_BASE_MS * 2 ** Math.max(0, attemptCount - 1),
  );

const isPendingCatchStatus = (value: unknown): value is PendingCatchStatus =>
  value === "pending_analysis" ||
  value === "analyzing" ||
  value === "needs_confirmation" ||
  value === "pending_upload" ||
  value === "uploading" ||
  value === "failed_retryable" ||
  value === "failed_terminal";

export const normalizePendingCatchJobs = (
  value: unknown,
): PendingCatchJob[] => {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const job = item as Partial<PendingCatchJob>;
    const valid =
      typeof job.localId === "string" &&
      typeof job.clientRequestId === "string" &&
      typeof job.userId === "string" &&
      typeof job.localImageUri === "string" &&
      typeof job.imageWidth === "number" &&
      typeof job.imageHeight === "number" &&
      (job.mimeType === "image/jpeg" || job.mimeType === "image/png") &&
      (job.captureMethod === "live_camera" ||
        job.captureMethod === "photo_library") &&
      isPendingCatchStatus(job.status) &&
      typeof job.createdAt === "string" &&
      typeof job.updatedAt === "string";
    if (!valid) return [];
    return [
      {
        ...(job as PendingCatchJob),
        // iOS changes its container path on updates; the Documents-relative
        // location of our preserved photo remains stable.
        localImageUri: `${Paths.document.uri.replace(/\/$/, "")}/${QUEUE_FOLDER}/${job.userId}/${job.localId}.${job.mimeType === "image/png" ? "png" : "jpg"}`,
        analysisRequested: job.analysisRequested !== false,
        customSpeciesName:
          typeof job.customSpeciesName === "string"
            ? job.customSpeciesName
            : null,
        nextRetryAt:
          typeof job.nextRetryAt === "string" ? job.nextRetryAt : null,
        lockedBy:
          job.lockedBy === "foreground" || job.lockedBy === "background"
            ? job.lockedBy
            : null,
        lockedAt: typeof job.lockedAt === "string" ? job.lockedAt : null,
      },
    ];
  });
};

const readJobs = async () => {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    return normalizePendingCatchJobs(JSON.parse(stored));
  } catch {
    return [];
  }
};

const writeJobs = async (jobs: PendingCatchJob[]) => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
  queueListeners.forEach((listener) => listener());
};

const mutateJobs = <T>(
  mutation: (jobs: PendingCatchJob[]) => Promise<{
    jobs: PendingCatchJob[];
    result: T;
  }>,
) => {
  const operation = mutationTail.then(async () => {
    const current = await readJobs();
    const { jobs, result } = await mutation(current);
    await writeJobs(jobs);
    return result;
  });
  mutationTail = operation.then(
    () => undefined,
    () => undefined,
  );
  return operation;
};

const getUserDirectory = (userId: string) => {
  const directory = new Directory(Paths.document, QUEUE_FOLDER, userId);
  directory.create({ intermediates: true, idempotent: true });
  return directory;
};

const deleteLocalImage = (uri: string) => {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // The queue entry is authoritative. Orphan cleanup can run separately.
  }
};

export const preservePendingCatch = async (
  input: PreservePendingCatchInput,
): Promise<PendingCatchJob> => {
  const localId = createLocalId();
  const clientRequestId = createLocalId();
  const extension = input.mimeType === "image/png" ? "png" : "jpg";
  const destination = new File(
    getUserDirectory(input.userId),
    `${localId}.${extension}`,
  );
  const source = new File(input.imageUri);
  source.copy(destination);

  const now = new Date().toISOString();
  const job: PendingCatchJob = {
    localId,
    clientRequestId,
    userId: input.userId,
    tripId: input.tripId ?? null,
    tripName: input.tripName ?? null,
    localImageUri: destination.uri,
    imageWidth: input.imageWidth,
    imageHeight: input.imageHeight,
    mimeType: input.mimeType,
    captureMethod: input.captureMethod,
    analysisRequested: input.analysisRequested ?? true,
    capturedAt: input.capturedAt ?? null,
    latitude: input.latitude ?? null,
    longitude: input.longitude ?? null,
    locationAccuracyM: input.locationAccuracyM ?? null,
    locationCapturedAt: input.locationCapturedAt ?? null,
    selectedFishId: null,
    customSpeciesName: null,
    candidateFishIds: [],
    candidates: [],
    sizeCm: null,
    memo: null,
    status: "pending_analysis",
    attemptCount: 0,
    lastError: null,
    nextRetryAt: null,
    lockedBy: null,
    lockedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  try {
    return await mutateJobs(async (jobs) => ({
      jobs: [...jobs, job],
      result: job,
    }));
  } catch (error) {
    deleteLocalImage(destination.uri);
    throw error;
  }
};

export const listPendingCatches = async (userId: string) => {
  await mutationTail;
  const jobs = await readJobs();
  return jobs
    .filter((job) => job.userId === userId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
};

export const getPendingCatch = async (
  userId: string,
  localId: string,
) => {
  const jobs = await listPendingCatches(userId);
  return jobs.find((job) => job.localId === localId) ?? null;
};

export const updatePendingCatch = async (
  userId: string,
  localId: string,
  patch: Partial<
    Pick<
      PendingCatchJob,
      | "candidateFishIds"
      | "candidates"
      | "recognitionAnalysis"
      | "selectedFishId"
      | "customSpeciesName"
      | "sizeCm"
      | "memo"
      | "status"
      | "attemptCount"
      | "lastError"
      | "nextRetryAt"
      | "lockedBy"
      | "lockedAt"
    >
  >,
) =>
  mutateJobs(async (jobs) => {
    let updated: PendingCatchJob | null = null;
    const next = jobs.map((job) => {
      if (job.userId !== userId || job.localId !== localId) return job;
      updated = {
        ...job,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });
    return { jobs: next, result: updated };
  });

export const lockPendingCatch = (
  userId: string,
  localId: string,
  owner: PendingCatchLockOwner,
) =>
  updatePendingCatch(userId, localId, {
    lockedBy: owner,
    lockedAt: new Date().toISOString(),
  });

/** 자기 잠금만 푼다. 다른 주체가 그 사이 잠갔다면 건드리지 않는다. */
export const unlockPendingCatch = (
  userId: string,
  localId: string,
  owner: PendingCatchLockOwner,
) =>
  mutateJobs(async (jobs) => ({
    jobs: jobs.map((job) =>
      job.userId === userId && job.localId === localId && job.lockedBy === owner
        ? { ...job, lockedBy: null, lockedAt: null, updatedAt: new Date().toISOString() }
        : job,
    ),
    result: undefined,
  }));

export const removePendingCatch = async (
  userId: string,
  localId: string,
) => {
  const removed = await mutateJobs(async (jobs) => {
    const job =
      jobs.find(
        (candidate) =>
          candidate.userId === userId && candidate.localId === localId,
      ) ?? null;
    return {
      jobs: jobs.filter(
        (candidate) =>
          candidate.userId !== userId || candidate.localId !== localId,
      ),
      result: job,
    };
  });
  if (removed) deleteLocalImage(removed.localImageUri);
  return removed;
};

export const readPendingCatchBase64 = async (job: PendingCatchJob) => {
  const file = new File(job.localImageUri);
  if (!file.exists) {
    throw new Error("보관된 조과 사진을 찾을 수 없습니다.");
  }
  return file.base64();
};

export const pendingCatchQueueStorageKey = STORAGE_KEY;

export const subscribePendingCatchQueue = (listener: () => void) => {
  queueListeners.add(listener);
  return () => queueListeners.delete(listener);
};
