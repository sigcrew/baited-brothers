jest.mock(
  "@react-native-async-storage/async-storage",
  () =>
    require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
const mockSecure = new Map<string, string>();
jest.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK: "AFTER_FIRST_UNLOCK",
  getItemAsync: jest.fn(async (key: string) => mockSecure.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    if (value.length > 2048) throw new Error("value too large");
    mockSecure.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecure.delete(key);
  }),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { secureSessionStorage } from "@/src/lib/secureSessionStorage";

const KEY = "sb-project-auth-token";
const bigSession = JSON.stringify({
  access_token: "a".repeat(2_500),
  refresh_token: "r".repeat(300),
  user: { id: "u1" },
});

beforeEach(async () => {
  mockSecure.clear();
  await AsyncStorage.clear();
});

describe("secureSessionStorage", () => {
  it("round-trips values larger than the 2KB SecureStore limit by chunking", async () => {
    await secureSessionStorage.setItem(KEY, bigSession);
    expect(mockSecure.size).toBeGreaterThan(2);
    expect(await secureSessionStorage.getItem(KEY)).toBe(bigSession);
  });

  it("migrates a legacy plaintext AsyncStorage session once and deletes the original", async () => {
    await AsyncStorage.setItem(KEY, bigSession);
    expect(await secureSessionStorage.getItem(KEY)).toBe(bigSession);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
    expect(mockSecure.size).toBeGreaterThan(0);
  });

  it("returns null when nothing is stored anywhere", async () => {
    expect(await secureSessionStorage.getItem(KEY)).toBeNull();
  });

  it("removes every chunk and any plaintext copy", async () => {
    await AsyncStorage.setItem(KEY, "stale");
    await secureSessionStorage.setItem(KEY, bigSession);
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
    await secureSessionStorage.removeItem(KEY);
    expect(mockSecure.size).toBe(0);
    expect(await secureSessionStorage.getItem(KEY)).toBeNull();
  });

  it("drops stale trailing chunks when a shorter value overwrites a longer one", async () => {
    await secureSessionStorage.setItem(KEY, bigSession);
    await secureSessionStorage.setItem(KEY, "short");
    expect(await secureSessionStorage.getItem(KEY)).toBe("short");
    expect(mockSecure.size).toBe(2); // count + one chunk
  });
});
