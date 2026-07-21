const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function base64UrlEncode(value: string | Uint8Array): string {
  const bytes = typeof value === "string" ? encoder.encode(value) : value;
  return bytesToBase64(bytes)
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");
  return base64ToBytes(padded);
}

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

function getAllowedClientIds(): string[] {
  return [...new Set([
    Deno.env.get("APPLE_SERVICES_ID")?.trim(),
    Deno.env.get("APPLE_NATIVE_CLIENT_ID")?.trim(),
    Deno.env.get("APPLE_CLIENT_ID")?.trim(),
  ].filter((value): value is string => Boolean(value)))];
}

export function getAppleClientId(requestedClientId?: string): string {
  const allowedClientIds = getAllowedClientIds();
  if (!allowedClientIds.length) throw new Error("Apple client IDs are not configured");

  const clientId = requestedClientId?.trim()
    || Deno.env.get("APPLE_NATIVE_CLIENT_ID")?.trim()
    || Deno.env.get("APPLE_CLIENT_ID")?.trim()
    || Deno.env.get("APPLE_SERVICES_ID")?.trim();
  if (!clientId || !allowedClientIds.includes(clientId)) {
    throw new Error("Unsupported Apple client ID");
  }
  return clientId;
}

async function importEncryptionKey(): Promise<CryptoKey> {
  const keyBytes = base64ToBytes(getRequiredEnv("APPLE_TOKEN_ENCRYPTION_KEY"));
  if (keyBytes.byteLength !== 32) {
    throw new Error("APPLE_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface EncryptedAppleToken {
  ciphertext: string;
  iv: string;
}

export async function encryptAppleRefreshToken(
  refreshToken: string,
): Promise<EncryptedAppleToken> {
  const key = await importEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(refreshToken),
  );
  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
  };
}

export async function decryptAppleRefreshToken(
  token: EncryptedAppleToken,
): Promise<string> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(token.iv) },
    await importEncryptionKey(),
    base64ToBytes(token.ciphertext),
  );
  return decoder.decode(plaintext);
}

async function importApplePrivateKey(): Promise<CryptoKey> {
  const pem = getRequiredEnv("APPLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const der = base64ToBytes(
    pem
      .replace("-----BEGIN PRIVATE KEY-----", "")
      .replace("-----END PRIVATE KEY-----", "")
      .replace(/\s/g, ""),
  );
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

export async function createAppleClientSecret(clientId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: getRequiredEnv("APPLE_KEY_ID") };
  const payload = {
    iss: getRequiredEnv("APPLE_TEAM_ID"),
    iat: now,
    exp: now + 5 * 60,
    aud: "https://appleid.apple.com",
    sub: clientId,
  };
  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    await importApplePrivateKey(),
    encoder.encode(signingInput),
  );
  if (signature.byteLength !== 64) {
    throw new Error("Apple client secret signature has an invalid length");
  }
  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

interface AppleTokenResponse {
  access_token?: string;
  id_token?: string;
  refresh_token?: string;
}

function readAppleSubject(idToken?: string): string | undefined {
  if (!idToken) return undefined;
  try {
    const payloadPart = idToken.split(".")[1];
    if (!payloadPart) return undefined;
    const payload = JSON.parse(decoder.decode(base64UrlDecode(payloadPart))) as {
      sub?: unknown;
    };
    return typeof payload.sub === "string" ? payload.sub : undefined;
  } catch {
    return undefined;
  }
}

async function requestAppleToken(body: URLSearchParams): Promise<AppleTokenResponse> {
  const response = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await response.json().catch(() => ({})) as AppleTokenResponse & {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(
      `Apple token validation failed (${response.status}): ${payload.error ?? "unknown_error"}`,
    );
  }
  return payload;
}

export async function exchangeAppleAuthorizationCode(params: {
  authorizationCode: string;
  clientId: string;
}): Promise<{ refreshToken: string; subject: string }> {
  const payload = await requestAppleToken(new URLSearchParams({
    client_id: params.clientId,
    client_secret: await createAppleClientSecret(params.clientId),
    code: params.authorizationCode,
    grant_type: "authorization_code",
  }));
  const subject = readAppleSubject(payload.id_token);
  if (!payload.refresh_token || !subject) {
    throw new Error("Apple token response did not include a refresh token and subject");
  }
  return { refreshToken: payload.refresh_token, subject };
}

export async function revokeAppleRefreshToken(params: {
  clientId: string;
  refreshToken: string;
}): Promise<void> {
  const response = await fetch("https://appleid.apple.com/auth/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: await createAppleClientSecret(params.clientId),
      token: params.refreshToken,
      token_type_hint: "refresh_token",
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(
      `Apple token revocation failed (${response.status})${detail ? `: ${detail}` : ""}`,
    );
  }
}

export function getAppleIdentitySubject(user: {
  identities?: Array<{
    id?: string;
    identity_data?: { sub?: unknown } | null;
    provider?: string;
  }> | null;
}): string | undefined {
  const identity = user.identities?.find((item) => item.provider === "apple");
  const metadataSubject = identity?.identity_data?.sub;
  return typeof metadataSubject === "string" ? metadataSubject : identity?.id;
}

export function isAppleUser(user: {
  app_metadata?: { provider?: string; providers?: string[] };
  identities?: Array<{ provider?: string }> | null;
}): boolean {
  return user.app_metadata?.provider === "apple"
    || user.app_metadata?.providers?.includes("apple") === true
    || user.identities?.some((identity) => identity.provider === "apple") === true;
}
