import { createHash, randomUUID, webcrypto } from "node:crypto";

jest.mock("expo-crypto", () => {
  const { createHash: nodeCreateHash, randomUUID: nodeRandomUUID, webcrypto: nodeWebcrypto } =
    jest.requireActual<typeof import("node:crypto")>("node:crypto");
  const names: Record<string, string> = { SHA1: "sha1", SHA256: "sha256", SHA384: "sha384", SHA512: "sha512" };
  return {
    CryptoDigestAlgorithm: { SHA1: "SHA1", SHA256: "SHA256", SHA384: "SHA384", SHA512: "SHA512" },
    digest: async (algorithm: string, data: ArrayBufferView | ArrayBuffer) => {
      const bytes = ArrayBuffer.isView(data)
        ? Buffer.from(data.buffer, data.byteOffset, data.byteLength)
        : Buffer.from(data);
      const hash = nodeCreateHash(names[algorithm]).update(bytes).digest();
      return hash.buffer.slice(hash.byteOffset, hash.byteOffset + hash.byteLength);
    },
    getRandomValues: (array: ArrayBufferView) => nodeWebcrypto.getRandomValues(array as Uint8Array<ArrayBuffer>),
    randomUUID: () => nodeRandomUUID(),
  };
});

import { installWebCryptoPolyfill } from "@/src/lib/webCryptoPolyfill";

const toHex = (buffer: ArrayBuffer) => Buffer.from(buffer).toString("hex");
const SHA256_ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";

describe("installWebCryptoPolyfill", () => {
  it("adds subtle.digest when the runtime has crypto.getRandomValues but no WebCrypto", async () => {
    const target: { crypto?: any } = { crypto: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) } };

    expect(installWebCryptoPolyfill(target)).toBe("installed-subtle");

    const digest = await target.crypto.subtle.digest("SHA-256", new TextEncoder().encode("abc"));
    expect(toHex(digest)).toBe(SHA256_ABC);
    // 기존 getRandomValues는 유지된다.
    expect(target.crypto.getRandomValues).toBe(target.crypto.getRandomValues);
  });

  it("creates the whole crypto global when none exists", async () => {
    const target: { crypto?: any } = {};

    expect(installWebCryptoPolyfill(target)).toBe("installed-crypto");

    const digest = await target.crypto.subtle.digest({ name: "sha-256" }, new TextEncoder().encode("abc"));
    expect(toHex(digest)).toBe(SHA256_ABC);
    expect(typeof target.crypto.getRandomValues).toBe("function");
    expect(typeof target.crypto.randomUUID()).toBe("string");
  });

  it("leaves an existing WebCrypto implementation untouched", () => {
    const digest = jest.fn();
    const target = { crypto: { subtle: { digest } } };

    expect(installWebCryptoPolyfill(target as never)).toBe("already-present");
    expect(target.crypto.subtle.digest).toBe(digest);
  });

  it("rejects algorithms expo-crypto cannot hash", async () => {
    const target: { crypto?: any } = {};
    installWebCryptoPolyfill(target);
    await expect(target.crypto.subtle.digest("MD5", new Uint8Array(1))).rejects.toThrow(/Unsupported/);
  });

  it("produces the same challenge auth-js would compute with real WebCrypto", async () => {
    const target: { crypto?: any } = {};
    installWebCryptoPolyfill(target);
    const verifier = "test-verifier-" + randomUUID();
    const expected = createHash("sha256").update(verifier).digest();
    const actual = await target.crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    expect(toHex(actual)).toBe(expected.toString("hex"));
  });
});
