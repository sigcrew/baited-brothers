import { parseGoogleAuthCallback } from "../googleAuthCallback";

describe("parseGoogleAuthCallback", () => {
  it("prefers the PKCE authorization code from the callback query", () => {
    expect(
      parseGoogleAuthCallback("baited-brothers://google-auth?code=abc-123"),
    ).toEqual({ kind: "code", code: "abc-123", error: null });
  });

  it("accepts a bare code parameter string", () => {
    expect(parseGoogleAuthCallback("code=abc-123")).toEqual({
      kind: "code",
      code: "abc-123",
      error: null,
    });
  });

  it("still parses legacy implicit-flow tokens from a complete callback URL", () => {
    expect(
      parseGoogleAuthCallback(
        "baited-brothers://google-auth#access_token=access&refresh_token=refresh",
      ),
    ).toEqual({
      kind: "tokens",
      accessToken: "access",
      refreshToken: "refresh",
      error: null,
    });
  });

  it("parses the fragment Expo Router exposes as the # parameter", () => {
    expect(
      parseGoogleAuthCallback(
        "access_token=access&refresh_token=refresh&expires_in=3600",
      ),
    ).toEqual({
      kind: "tokens",
      accessToken: "access",
      refreshToken: "refresh",
      error: null,
    });
  });

  it("returns the provider error instead of creating a session", () => {
    const result = parseGoogleAuthCallback(
      "baited-brothers://google-auth?error=access_denied&error_description=Login%20cancelled",
    );
    expect(result.kind).toBe("error");
    expect(result.error?.message).toBe("Login cancelled");
  });

  it("fails when neither a code nor a token pair is present", () => {
    const result = parseGoogleAuthCallback("baited-brothers://google-auth?state=x");
    expect(result.kind).toBe("error");
  });
});
