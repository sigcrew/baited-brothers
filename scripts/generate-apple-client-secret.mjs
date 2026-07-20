import { createPrivateKey, sign } from "node:crypto";
import { pathToFileURL } from "node:url";

const APPLE_AUDIENCE = "https://appleid.apple.com";
const DEFAULT_LIFETIME_DAYS = 150;
const MAX_LIFETIME_DAYS = 180;

const base64urlJson = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const required = (value, name) => {
  if (!value?.trim()) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
};

export const generateAppleClientSecret = ({
  privateKey,
  keyId,
  teamId,
  clientId,
  now = Math.floor(Date.now() / 1000),
  lifetimeDays = DEFAULT_LIFETIME_DAYS,
}) => {
  const normalizedLifetimeDays = Number(lifetimeDays);
  if (
    !Number.isInteger(normalizedLifetimeDays) ||
    normalizedLifetimeDays < 1 ||
    normalizedLifetimeDays > MAX_LIFETIME_DAYS
  ) {
    throw new Error(
      `APPLE_CLIENT_SECRET_LIFETIME_DAYS must be an integer between 1 and ${MAX_LIFETIME_DAYS}.`,
    );
  }

  const header = {
    alg: "ES256",
    kid: required(keyId, "APPLE_KEY_ID"),
    typ: "JWT",
  };
  const payload = {
    iss: required(teamId, "APPLE_TEAM_ID"),
    iat: now,
    exp: now + normalizedLifetimeDays * 24 * 60 * 60,
    aud: APPLE_AUDIENCE,
    sub: required(clientId, "APPLE_CLIENT_ID"),
  };
  const signingInput = `${base64urlJson(header)}.${base64urlJson(payload)}`;
  const signature = sign("sha256", Buffer.from(signingInput), {
    key: createPrivateKey(required(privateKey, "APPLE_PRIVATE_KEY_BASE64")),
    dsaEncoding: "ieee-p1363",
  }).toString("base64url");

  return `${signingInput}.${signature}`;
};

const run = () => {
  const privateKeyBase64 = required(
    process.env.APPLE_PRIVATE_KEY_BASE64,
    "APPLE_PRIVATE_KEY_BASE64",
  );
  const privateKey = Buffer.from(privateKeyBase64, "base64").toString("utf8");
  const clientSecret = generateAppleClientSecret({
    privateKey,
    keyId: process.env.APPLE_KEY_ID,
    teamId: process.env.APPLE_TEAM_ID,
    clientId: process.env.APPLE_CLIENT_ID,
    lifetimeDays:
      process.env.APPLE_CLIENT_SECRET_LIFETIME_DAYS ??
      DEFAULT_LIFETIME_DAYS,
  });

  process.stdout.write(clientSecret);
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

