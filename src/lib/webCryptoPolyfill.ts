import * as ExpoCrypto from "expo-crypto";

/**
 * React Native(Hermes)에는 `crypto.subtle`이 없다. @supabase/auth-js는 그 경우
 * PKCE 코드 챌린지를 sha256 대신 plain(= verifier 그대로)으로 보내 버리므로,
 * Supabase 클라이언트가 만들어지기 전에 `crypto.subtle.digest`를 expo-crypto로
 * 채워 둔다. 이미 WebCrypto가 있는 환경(웹)은 건드리지 않는다.
 */

type DigestAlgorithm = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

type SubtleDigest = (
  algorithm: AlgorithmIdentifier,
  data: BufferSource,
) => Promise<ArrayBuffer>;

type CryptoLike = {
  getRandomValues?: unknown;
  randomUUID?: unknown;
  subtle?: { digest?: SubtleDigest } & Record<string, unknown>;
};

export type WebCryptoImplementation = {
  digest: (algorithm: ExpoCrypto.CryptoDigestAlgorithm, data: BufferSource) => Promise<ArrayBuffer>;
  getRandomValues: typeof ExpoCrypto.getRandomValues;
  randomUUID: typeof ExpoCrypto.randomUUID;
};

const ALGORITHMS: Record<DigestAlgorithm, ExpoCrypto.CryptoDigestAlgorithm> = {
  "SHA-1": ExpoCrypto.CryptoDigestAlgorithm.SHA1,
  "SHA-256": ExpoCrypto.CryptoDigestAlgorithm.SHA256,
  "SHA-384": ExpoCrypto.CryptoDigestAlgorithm.SHA384,
  "SHA-512": ExpoCrypto.CryptoDigestAlgorithm.SHA512,
};

const resolveAlgorithm = (algorithm: AlgorithmIdentifier) => {
  const name = (typeof algorithm === "string" ? algorithm : algorithm.name).toUpperCase();
  const resolved = ALGORITHMS[name as DigestAlgorithm];
  if (!resolved) throw new Error(`Unsupported digest algorithm: ${name}`);
  return resolved;
};

export type PolyfillResult = "already-present" | "installed-subtle" | "installed-crypto";

/**
 * `target.crypto.subtle.digest`가 없으면 채운다. 반환값은 무엇을 설치했는지다.
 * 테스트에서 가짜 전역과 구현을 넘길 수 있도록 인자로 받는다.
 */
export const installWebCryptoPolyfill = (
  target: { crypto?: CryptoLike } = globalThis as unknown as { crypto?: CryptoLike },
  implementation: WebCryptoImplementation = ExpoCrypto,
): PolyfillResult => {
  // 알고리즘 오류도 WebCrypto처럼 reject로 돌려준다(동기 throw 금지).
  const digest: SubtleDigest = async (algorithm, data) =>
    implementation.digest(resolveAlgorithm(algorithm), data);

  const existing = target.crypto;
  if (!existing) {
    target.crypto = {
      getRandomValues: implementation.getRandomValues,
      randomUUID: implementation.randomUUID,
      subtle: { digest },
    };
    return "installed-crypto";
  }
  if (typeof existing.subtle?.digest === "function") return "already-present";

  if (typeof existing.getRandomValues !== "function") {
    existing.getRandomValues = implementation.getRandomValues;
  }
  if (typeof existing.randomUUID !== "function") {
    existing.randomUUID = implementation.randomUUID;
  }
  existing.subtle = { ...(existing.subtle ?? {}), digest };
  return "installed-subtle";
};

installWebCryptoPolyfill();
