import { createSharedResource } from "@/src/lib/sharedResource";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createSharedResource", () => {
  it("merges concurrent loads for the same key into one request", async () => {
    const load = jest.fn(async (key: string) => `data:${key}`);
    const resource = createSharedResource<string>({ name: "t", load });
    await Promise.all([resource.ensure("u1"), resource.ensure("u1"), resource.refetch("u1")]);
    expect(load).toHaveBeenCalledTimes(1);
    expect(resource.peek("u1")?.data).toBe("data:u1");
  });

  it("does not reload fresh data on ensure, but does after staleAfterMs", async () => {
    let now = 1_000;
    jest.spyOn(Date, "now").mockImplementation(() => now);
    const load = jest.fn(async () => "x");
    const resource = createSharedResource<string>({ name: "t", load, staleAfterMs: 500 });
    await resource.ensure("u1");
    await resource.ensure("u1");
    expect(load).toHaveBeenCalledTimes(1);
    now += 600;
    await resource.ensure("u1");
    expect(load).toHaveBeenCalledTimes(2);
    (Date.now as jest.Mock).mockRestore();
  });

  it("keeps existing data while a refresh fails, and clears it when a first load fails", async () => {
    const load = jest
      .fn<Promise<string>, [string]>()
      .mockResolvedValueOnce("first")
      .mockRejectedValueOnce(new Error("offline"))
      .mockRejectedValueOnce(new Error("offline"));
    const resource = createSharedResource<string>({ name: "t", load });
    await resource.ensure("u1");
    await resource.refetch("u1");
    expect(resource.peek("u1")?.data).toBe("first");
    expect(resource.peek("u1")?.error?.message).toBe("offline");
    await resource.ensure("u2");
    expect(resource.peek("u2")?.data).toBeNull();
  });

  it("invalidate refetches every key under the prefix that something is using", async () => {
    const load = jest.fn(async (key: string) => `v:${key}`);
    const resource = createSharedResource<string>({ name: "t", load });
    await resource.ensure("u1|");
    await resource.ensure("u1|trip-9");
    await resource.ensure("u2|");
    load.mockClear();
    await resource.invalidate("u1|");
    expect(load.mock.calls.map(([key]) => key).sort()).toEqual(["u1|", "u1|trip-9"]);
  });

  it("mutate and mutateAll update data in place and notify subscribers", async () => {
    const load = jest.fn(async () => [1, 2, 3]);
    const resource = createSharedResource<number[]>({ name: "t", load });
    await resource.ensure("u1|");
    await resource.ensure("u1|trip");
    const listener = jest.fn();
    resource.subscribe("u1|", listener);
    resource.mutate("u1|", (current) => (current ?? []).filter((n) => n !== 2));
    expect(resource.peek("u1|")?.data).toEqual([1, 3]);
    expect(listener).toHaveBeenCalledTimes(1);
    resource.mutateAll("u1|", (current) => current.map((n) => n * 10));
    expect(resource.peek("u1|")?.data).toEqual([10, 30]);
    expect(resource.peek("u1|trip")?.data).toEqual([10, 20, 30]);
    await flush();
  });

  it("clear drops everything so the next user starts cold", async () => {
    const load = jest.fn(async () => "x");
    const resource = createSharedResource<string>({ name: "t", load });
    await resource.ensure("u1");
    resource.clear();
    expect(resource.peek("u1")).toBeNull();
    await resource.ensure("u1");
    expect(load).toHaveBeenCalledTimes(2);
  });
});
