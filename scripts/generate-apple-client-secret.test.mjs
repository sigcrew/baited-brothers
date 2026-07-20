import {
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  verify,
} from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import { generateAppleClientSecret } from "./generate-apple-client-secret.mjs";

const decodeJson = (value) =>
  JSON.parse(Buffer.from(value, "base64url").toString("utf8"));

test("generates a valid ES256 Apple client secret", () => {
  const { privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const privateKeyPem = privateKey.export({
    type: "pkcs8",
    format: "pem",
  });
  const now = 1_800_000_000;
  const token = generateAppleClientSecret({
    privateKey: privateKeyPem,
    keyId: "TESTKEY123",
    teamId: "TESTTEAM12",
    clientId: "com.example.app",
    now,
    lifetimeDays: 150,
  });
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");

  assert.deepEqual(decodeJson(encodedHeader), {
    alg: "ES256",
    kid: "TESTKEY123",
    typ: "JWT",
  });
  assert.deepEqual(decodeJson(encodedPayload), {
    iss: "TESTTEAM12",
    iat: now,
    exp: now + 150 * 24 * 60 * 60,
    aud: "https://appleid.apple.com",
    sub: "com.example.app",
  });
  assert.equal(
    verify(
      "sha256",
      Buffer.from(`${encodedHeader}.${encodedPayload}`),
      {
        key: createPublicKey(createPrivateKey(privateKeyPem)),
        dsaEncoding: "ieee-p1363",
      },
      Buffer.from(encodedSignature, "base64url"),
    ),
    true,
  );
});

test("rejects client secrets longer than Apple's six-month limit", () => {
  const { privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const privateKeyPem = privateKey.export({
    type: "pkcs8",
    format: "pem",
  });

  assert.throws(
    () =>
      generateAppleClientSecret({
        privateKey: privateKeyPem,
        keyId: "TESTKEY123",
        teamId: "TESTTEAM12",
        clientId: "com.example.app",
        lifetimeDays: 181,
      }),
    /between 1 and 180/,
  );
});

