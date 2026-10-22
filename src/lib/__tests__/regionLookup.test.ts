jest.mock("@/src/lib/supabase", () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

import { lookupKoreanRegionName } from "@/src/lib/regionLookup";

const { supabase } = jest.requireMock("@/src/lib/supabase") as {
  supabase: { functions: { invoke: jest.Mock } };
};

beforeEach(() => jest.clearAllMocks());

test("asks the reverse-geocode function with the coordinate and returns the trimmed name", async () => {
  supabase.functions.invoke.mockResolvedValue({ data: { name: " 충청남도 보령시 " }, error: null });
  await expect(lookupKoreanRegionName({ latitude: 36.33, longitude: 126.61 })).resolves.toBe("충청남도 보령시");
  expect(supabase.functions.invoke).toHaveBeenCalledWith("reverse-geocode", {
    body: { latitude: 36.33, longitude: 126.61 },
  });
});

test("returns null instead of throwing on errors or empty names", async () => {
  supabase.functions.invoke.mockResolvedValueOnce({ data: null, error: new Error("401") });
  await expect(lookupKoreanRegionName({ latitude: 36, longitude: 126 })).resolves.toBeNull();
  supabase.functions.invoke.mockResolvedValueOnce({ data: { name: null }, error: null });
  await expect(lookupKoreanRegionName({ latitude: 36, longitude: 126 })).resolves.toBeNull();
  supabase.functions.invoke.mockRejectedValueOnce(new Error("offline"));
  await expect(lookupKoreanRegionName({ latitude: 36, longitude: 126 })).resolves.toBeNull();
});
