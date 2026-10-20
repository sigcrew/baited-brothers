import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import NetInfo from "@react-native-community/netinfo";
import { PendingCatchLifecycle } from "../PendingCatchLifecycle";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  listPendingCatches,
  pendingCatchQueueStorageKey,
} from "@/src/lib/pendingCatchQueue";
import { useCreateCatch } from "@/src/hooks/useCreateCatch";
import { useFishRecognition } from "@/src/hooks/useFishRecognition";
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("expo-file-system", () => ({
  Paths: { document: { uri: "file:///Documents/" } },
  File: class {
    exists = true;
    delete() {}
    async base64() {
      return "cGhvdG8=";
    }
  },
}));
jest.mock("@react-native-community/netinfo", () => ({
  addEventListener: jest.fn(),
  fetch: jest.fn(),
}));
jest.mock("@/src/contexts/AuthContext", () => ({
  useAuth: () => ({ session: { user: { id: "qa-user" } } }),
}));
jest.mock("@/src/hooks/useFishes", () => ({
  useFishes: () => ({ fishes: [], isLoading: false }),
}));
jest.mock("@/src/hooks/useCreateCatch", () => ({ useCreateCatch: jest.fn() }));
jest.mock("@/src/hooks/useFishRecognition", () => ({
  useFishRecognition: jest.fn(),
}));
const save = jest.fn(),
  recognize = jest.fn();
let network: (s: any) => void;
let view: ReactTestRenderer;
const job = {
  localId: "photo",
  clientRequestId: "stable",
  userId: "qa-user",
  localImageUri: "file:///Documents/pending-catches/qa-user/photo.jpg",
  imageWidth: 100,
  imageHeight: 100,
  mimeType: "image/jpeg",
  captureMethod: "photo_library",
  analysisRequested: true,
  selectedFishId: null,
  customSpeciesName: "QA fish",
  candidateFishIds: [],
  candidates: [],
  status: "pending_upload",
  attemptCount: 0,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};
const drain = async () => {
  for (let i = 0; i < 30; i++) await Promise.resolve();
};
const signal = async (online: boolean) => {
  await act(async () => {
    network({ isConnected: online, isInternetReachable: online });
    await drain();
  });
};
beforeEach(async () => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (NetInfo.addEventListener as jest.Mock).mockImplementation((fn) => {
    network = fn;
    return () => {};
  });
  (NetInfo.fetch as jest.Mock).mockResolvedValue({
    isConnected: false,
    isInternetReachable: false,
  });
  (useCreateCatch as jest.Mock).mockReturnValue({ createCatch: save });
  (useFishRecognition as jest.Mock).mockReturnValue({ recognize });
  save.mockResolvedValue({ error: null, catchId: "saved" });
  recognize.mockResolvedValue({ error: null, candidates: [], analysis: null });
  await AsyncStorage.setItem(
    pendingCatchQueueStorageKey,
    JSON.stringify([job]),
  );
  await act(async () => {
    view = create(<PendingCatchLifecycle />);
    await drain();
  });
});
afterEach(async () => {
  await act(async () => view.unmount());
  jest.useRealTimers();
});

test("offline photos stay preserved and resume uploading when connection returns", async () => {
  expect(await listPendingCatches("qa-user")).toHaveLength(1);
  expect(save).not.toHaveBeenCalled();
  await signal(true);
  expect(await listPendingCatches("qa-user")).toHaveLength(0);
  expect(save.mock.calls[0][0].clientRequestId).toBe("stable");
});
test("a failed upload survives restart and retries with the same request identity", async () => {
  save.mockResolvedValueOnce({
    error: new Error("Network request failed"),
    catchId: null,
  });
  await signal(true);
  const [failed] = await listPendingCatches("qa-user");
  expect(failed.status).toBe("failed_retryable");
  expect(failed.localImageUri).toContain("/photo.jpg");
  await act(async () => {
    view.unmount();
    await drain();
    view = create(<PendingCatchLifecycle />);
    await drain();
  });
  await act(async () => {
    jest.advanceTimersByTime(16000);
    await drain();
  });
  await signal(true);
  expect(await listPendingCatches("qa-user")).toHaveLength(0);
  expect(save.mock.calls.map(([p]) => p.clientRequestId)).toEqual([
    "stable",
    "stable",
  ]);
});
test("an interrupted uploading job is recovered after the app remounts", async () => {
  await act(async () => view.unmount());
  await AsyncStorage.setItem(
    pendingCatchQueueStorageKey,
    JSON.stringify([{ ...job, status: "uploading" }]),
  );
  await act(async () => {
    view = create(<PendingCatchLifecycle />);
    await drain();
  });
  await signal(true);
  expect(await listPendingCatches("qa-user")).toHaveLength(0);
});
test("analysis failures preserve the photo and recover into confirmation without auto-saving", async () => {
  await AsyncStorage.setItem(
    pendingCatchQueueStorageKey,
    JSON.stringify([
      { ...job, customSpeciesName: null, status: "pending_analysis" },
    ]),
  );
  recognize.mockResolvedValueOnce({
    error: new Error("Network request failed"),
    candidates: [],
    analysis: null,
  });
  await signal(true);
  expect((await listPendingCatches("qa-user"))[0].status).toBe(
    "failed_retryable",
  );
  await act(async () => {
    jest.advanceTimersByTime(16000);
    await drain();
  });
  await signal(true);
  expect((await listPendingCatches("qa-user"))[0].status).toBe(
    "needs_confirmation",
  );
  expect(save).not.toHaveBeenCalled();
});

test("analysis stops retrying after the attempt cap and keeps the failed analysis", async () => {
  await AsyncStorage.setItem(
    pendingCatchQueueStorageKey,
    JSON.stringify([
      {
        ...job,
        customSpeciesName: null,
        status: "failed_retryable",
        attemptCount: 4,
      },
    ]),
  );
  const analysis = { id: "a1", status: "failed", candidates: [] };
  recognize.mockResolvedValue({
    error: new Error("Network request failed"),
    candidates: [],
    analysis,
  });
  await signal(true);
  const [terminal] = await listPendingCatches("qa-user");
  expect(terminal.status).toBe("failed_terminal");
  expect(terminal.attemptCount).toBe(5);
  expect(terminal.nextRetryAt).toBeNull();
  expect(terminal.recognitionAnalysis).toEqual(analysis);
  expect(recognize).toHaveBeenCalledTimes(1);
  await act(async () => {
    jest.advanceTimersByTime(16 * 60_000);
    await drain();
  });
  await signal(true);
  expect(recognize).toHaveBeenCalledTimes(1);
  expect(save).not.toHaveBeenCalled();
});
test("a quota error stops background analysis on the first attempt", async () => {
  await AsyncStorage.setItem(
    pendingCatchQueueStorageKey,
    JSON.stringify([
      { ...job, customSpeciesName: null, status: "pending_analysis" },
    ]),
  );
  recognize.mockResolvedValueOnce({
    error: new Error(
      "AI 추천은 24시간에 30회까지 사용할 수 있어요. 도감에서 직접 선택해 기록할 수 있습니다.",
    ),
    candidates: [],
    analysis: null,
  });
  await signal(true);
  const [stopped] = await listPendingCatches("qa-user");
  expect(stopped.status).toBe("failed_terminal");
  expect(stopped.attemptCount).toBe(1);
  await act(async () => {
    jest.advanceTimersByTime(16 * 60_000);
    await drain();
  });
  await signal(true);
  expect(recognize).toHaveBeenCalledTimes(1);
});

test("a job the record screen holds (fresh foreground lock) is left alone by the worker", async () => {
  await AsyncStorage.setItem(
    pendingCatchQueueStorageKey,
    JSON.stringify([
      { ...job, lockedBy: "foreground", lockedAt: new Date().toISOString() },
    ]),
  );
  await signal(true);
  expect(save).not.toHaveBeenCalled();
  expect(await listPendingCatches("qa-user")).toHaveLength(1);
});
test("a stale foreground lock (app killed) does not block recovery", async () => {
  await AsyncStorage.setItem(
    pendingCatchQueueStorageKey,
    JSON.stringify([
      {
        ...job,
        lockedBy: "foreground",
        lockedAt: new Date(Date.now() - 11 * 60_000).toISOString(),
      },
    ]),
  );
  await signal(true);
  expect(save).toHaveBeenCalledTimes(1);
  expect(await listPendingCatches("qa-user")).toHaveLength(0);
});
