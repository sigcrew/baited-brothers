import { parseGoogleAuthCallback } from "../googleAuthCallback";

describe("parseGoogleAuthCallback", () => {
  it("parses tokens from a complete callback URL", () => {
    expect(
      parseGoogleAuthCallback(
        "baited-brothers://google-auth#access_token=access&refresh_token=refresh",
      ),
    ).toEqual({
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
      accessToken: "access",
      refreshToken: "refresh",
      error: null,
    });
  });

  it("returns the provider error instead of creating a session", () => {
    const result = parseGoogleAuthCallback(
      "error=access_denied&error_description=Login%20cancelled",
    );

    expect(result.error?.message).toBe("Login cancelled");
    expect(result.accessToken).toBeNull();
    expect(result.refreshToken).toBeNull();
  });
});
