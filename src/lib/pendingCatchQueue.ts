import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";

export type PendingCatchStatus =
  | "pending_analysis"
  | "analyzing"
  | "needs_confirmation"
  | "pending_upload"
  | "uploading"
  | "failed_retryable";

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
  sizeCm: number | null;
  memo: string | null;
  status: PendingCatchStatus;
  attemptCount: number;
  lastError: string | null;
  nextRetryAt: string | null;
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
const QUEUE_FOLDER = "pending-catches";
const RETRY_BASE_MS = 15_000;
const RETRY_MAX_MS = 15 * 60_000;

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
  value === "failed_retryable";

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
        analysisRequested: job.analysisRequested !== false,
        customSpeciesName:
          typeof job.customSpeciesName === "string"
            ? job.customSpeciesName
            : null,
        nextRetryAt:
          typeof job.nextRetryAt === "string" ? job.nextRetryAt : null,
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
      | "selectedFishId"
      | "customSpeciesName"
      | "sizeCm"
      | "memo"
      | "status"
      | "attemptCount"
      | "lastError"
      | "nextRetryAt"
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
