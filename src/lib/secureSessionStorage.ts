import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

/**
 * Supabase 세션(리프레시 토큰 포함)을 Keychain/Keystore에 보관하는 스토리지 어댑터.
 *
 * SecureStore는 값 하나가 2KB를 넘으면 iOS에서 경고하고 일부 Android 기기에서는
 * 실패하므로, 값을 청크로 나눠 `${key}.n` 키에 저장하고 `${key}.count`에 개수를 둔다.
 * 예전 버전은 세션을 평문 AsyncStorage에 두었기 때문에, SecureStore에 값이 없고
 * AsyncStorage에 있으면 한 번 옮기고 원본을 지운다(사용자가 로그아웃되지 않게).
 */
const CHUNK_SIZE = 1_800;
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  // 잠금 해제 후에는 백그라운드 토큰 갱신이 가능해야 한다.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

// SecureStore 키는 영숫자, ".", "-", "_"만 허용한다.
const sanitizeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, "_");
const countKey = (key: string) => `${sanitizeKey(key)}.count`;
const chunkKey = (key: string, index: number) => `${sanitizeKey(key)}.${index}`;

const readSecure = async (key: string): Promise<string | null> => {
  const count = Number(await SecureStore.getItemAsync(countKey(key), SECURE_OPTIONS));
  if (!Number.isInteger(count) || count <= 0) return null;
  const chunks = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      SecureStore.getItemAsync(chunkKey(key, index), SECURE_OPTIONS),
    ),
  );
  if (chunks.some((chunk) => chunk === null)) return null;
  return chunks.join("");
};

const deleteSecure = async (key: string) => {
  const count = Number(await SecureStore.getItemAsync(countKey(key), SECURE_OPTIONS));
  const total = Number.isInteger(count) && count > 0 ? count : 0;
  await Promise.all([
    SecureStore.deleteItemAsync(countKey(key), SECURE_OPTIONS),
    ...Array.from({ length: total }, (_, index) =>
      SecureStore.deleteItemAsync(chunkKey(key, index), SECURE_OPTIONS),
    ),
  ]);
};

const writeSecure = async (key: string, value: string) => {
  const chunks: string[] = [];
  for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
    chunks.push(value.slice(offset, offset + CHUNK_SIZE));
  }
  const previousCount = Number(await SecureStore.getItemAsync(countKey(key), SECURE_OPTIONS));
  await Promise.all(
    chunks.map((chunk, index) =>
      SecureStore.setItemAsync(chunkKey(key, index), chunk, SECURE_OPTIONS),
    ),
  );
  await SecureStore.setItemAsync(countKey(key), String(chunks.length), SECURE_OPTIONS);
  // 값이 짧아졌으면 남는 청크를 지운다.
  if (Number.isInteger(previousCount) && previousCount > chunks.length) {
    await Promise.all(
      Array.from({ length: previousCount - chunks.length }, (_, offset) =>
        SecureStore.deleteItemAsync(chunkKey(key, chunks.length + offset), SECURE_OPTIONS),
      ),
    );
  }
};

const migrateFromAsyncStorage = async (key: string) => {
  const legacy = await AsyncStorage.getItem(key);
  if (legacy === null) return null;
  await writeSecure(key, legacy);
  await AsyncStorage.removeItem(key);
  return legacy;
};

export const secureSessionStorage = {
  getItem: async (key: string) => {
    try {
      const stored = await readSecure(key);
      if (stored !== null) return stored;
      return await migrateFromAsyncStorage(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    await writeSecure(key, value);
    // 더 이상 평문 사본을 남기지 않는다.
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },
  removeItem: async (key: string) => {
    await Promise.all([
      deleteSecure(key),
      AsyncStorage.removeItem(key).catch(() => undefined),
    ]);
  },
};
