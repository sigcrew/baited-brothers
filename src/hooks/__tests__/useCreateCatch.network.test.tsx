import React from "react";
import { act, create, ReactTestRenderer } from "react-test-renderer";
import { useCreateCatch } from "../useCreateCatch";
import { supabase } from "@/src/lib/supabase";
import { removeUserMedia, uploadUserPhotoVariants } from "@/src/lib/userMedia";

jest.mock("@/src/lib/supabase", () => ({
  supabase: { from: jest.fn(), functions: { invoke: jest.fn() } },
}));
jest.mock("@/src/contexts/AuthContext", () => ({
  useAuth: () => ({ session: { user: { id: "qa-user" } } }),
}));
jest.mock("@/src/lib/userMedia", () => ({
  uploadUserPhotoVariants: jest.fn(),
  removeUserMedia: jest.fn(),
}));
jest.mock("@/src/lib/analytics", () => ({ trackAnalyticsEvent: jest.fn() }));
jest.mock("@/src/lib/catchConditions", () => ({
  captureCatchConditions: jest.fn(),
}));

let hook: ReturnType<typeof useCreateCatch>;
let view: ReactTestRenderer;
function Probe() {
  hook = useCreateCatch();
  return null;
}
const input = {
  imageUri: "file:///preserved.jpg",
  imageWidth: 100,
  imageHeight: 100,
  mimeType: "image/jpeg" as const,
  customSpeciesName: "QA 테스트 어종",
  clientRequestId: "stable-request-id",
};
const paths = {
  imagePath: "qa-user/catches/new/detail.jpg",
  thumbnailPath: "qa-user/catches/new/thumbnail.jpg",
};
let insertResponse: any;
let lookupResponse: any;
let discoveryResponse: any;
let insertedPayloads: any[];

beforeEach(async () => {
  jest.clearAllMocks();
  insertResponse = { data: { id: "saved-catch" }, error: null };
  lookupResponse = { data: null, error: null };
  discoveryResponse = { data: [], error: null };
  insertedPayloads = [];
  (uploadUserPhotoVariants as jest.Mock).mockResolvedValue(paths);
  (removeUserMedia as jest.Mock).mockResolvedValue(undefined);
  (supabase.from as jest.Mock).mockImplementation(() => {
    let inserting = false;
    const q: any = {
      select: () => q,
      eq: () => q,
      in: () => Promise.resolve(discoveryResponse),
      insert: (payload: any) => {
        inserting = true;
        insertedPayloads.push(payload);
        return q;
      },
      single: () => Promise.resolve(insertResponse),
      maybeSingle: () =>
        Promise.resolve(
          typeof lookupResponse === "function"
            ? lookupResponse()
            : lookupResponse,
        ),
      abortSignal: () => q,
      then: (resolve: any, reject: any) =>
        Promise.resolve(inserting ? insertResponse : lookupResponse).then(
          resolve,
          reject,
        ),
    };
    return q;
  });
  await act(async () => {
    view = create(<Probe />);
  });
});
afterEach(async () => {
  await act(async () => view.unmount());
  jest.useRealTimers();
});

test("an upload failure remains retryable and a retry retains the request identity", async () => {
  (uploadUserPhotoVariants as jest.Mock).mockRejectedValueOnce(
    new TypeError("Network request failed"),
  );
  let failed: any, recovered: any;
  await act(async () => {
    failed = await hook.createCatch(input);
  });
  expect(failed.error).toBeInstanceOf(Error);
  expect(hook.isSaving).toBe(false);
  await act(async () => {
    recovered = await hook.createCatch(input);
  });
  expect(recovered.catchId).toBe("saved-catch");
  expect(insertedPayloads.map((p) => p.client_request_id)).toEqual([
    "stable-request-id",
  ]);
});

test("a lost insert response must not delete photos that may belong to a committed catch", async () => {
  insertResponse = {
    data: null,
    error: { message: "TypeError: Network request failed", code: "" },
  };
  let result: any;
  await act(async () => {
    result = await hook.createCatch(input);
  });
  expect(result.error).toBeInstanceOf(Error);
  expect(removeUserMedia).not.toHaveBeenCalled();
});

test("a duplicate retry with failed lookup must not report success and discard the local photo", async () => {
  insertResponse = {
    data: null,
    error: { code: "23505", message: "duplicate key" },
  };
  lookupResponse = { data: null, error: { message: "Network request failed" } };
  let result: any;
  await act(async () => {
    result = await hook.createCatch(input);
  });
  expect(result.error).toBeInstanceOf(Error);
  expect(result.catchId).toBeNull();
});

test("a confirmed duplicate recovers the original catch without creating a second record", async () => {
  insertResponse = {
    data: null,
    error: { code: "23505", message: "duplicate key" },
  };
  lookupResponse = {
    data: {
      id: "original-catch",
      verification_status: "general_record",
      verification_reason: "species_outside_catalog",
    },
    error: null,
  };
  let result: any;
  await act(async () => {
    result = await hook.createCatch(input);
  });
  expect(result.error).toBeNull();
  expect(result.catchId).toBe("original-catch");
  expect(uploadUserPhotoVariants).not.toHaveBeenCalled();
});

test.each(["discovery", "insert"])(
  "a stalled %s request releases saving state and remains retryable",
  async (stage) => {
    jest.useFakeTimers();
    if (stage === "discovery") discoveryResponse = new Promise(() => {});
    else insertResponse = new Promise(() => {});
    let settled = false,
      result: any;
    let pending: Promise<any>;
    await act(async () => {
      pending = hook.createCatch(input).then((r) => {
        result = r;
        settled = true;
      });
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });
    await act(async () => {
      jest.advanceTimersByTime(46000);
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });
    expect(settled).toBe(true);
    expect(result.error).toBeInstanceOf(Error);
    expect(hook.isSaving).toBe(false);
    expect(removeUserMedia).not.toHaveBeenCalled();
  },
);

test("a foreground retry recovers a background-saved catch even after its local photo was removed", async () => {
  lookupResponse = {
    data: {
      id: "background-saved",
      verification_status: "general_record",
      verification_reason: "photo_library",
    },
    error: null,
  };
  (uploadUserPhotoVariants as jest.Mock).mockRejectedValue(
    new Error("Local photo is no longer readable"),
  );
  let result: any;
  await act(async () => {
    result = await hook.createCatch(input);
  });
  expect(result.error).toBeNull();
  expect(result.catchId).toBe("background-saved");
  expect(insertedPayloads).toHaveLength(0);
});

test("a catch saved between preflight and insert is recovered after duplicate rejection", async () => {
  insertResponse = {
    data: null,
    error: { code: "23505", message: "duplicate key" },
  };
  lookupResponse = jest
    .fn()
    .mockReturnValueOnce({ data: null, error: null })
    .mockReturnValue({
      data: {
        id: "concurrent-catch",
        verification_status: "general_record",
        verification_reason: null,
      },
      error: null,
    });
  let result: any;
  await act(async () => {
    result = await hook.createCatch(input);
  });
  expect(result.error).toBeNull();
  expect(result.catchId).toBe("concurrent-catch");
  expect(insertedPayloads).toHaveLength(1);
  expect(removeUserMedia).toHaveBeenCalledWith([
    paths.imagePath,
    paths.thumbnailPath,
  ]);
});
