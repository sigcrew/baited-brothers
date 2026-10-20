/**
 * Google OAuth 콜백 파싱.
 *
 * 기본 경로는 PKCE다: Supabase가 `baited-brothers://google-auth?code=...`로 돌아오고
 * 앱은 code를 exchangeCodeForSession에 넘긴다. 토큰이 URL에 실리지 않으므로 Android에서
 * 같은 스킴을 등록한 다른 앱이 가로채도 세션을 얻을 수 없다.
 *
 * 구버전(implicit flow)이 fragment에 access_token/refresh_token을 실어 보내던 형식은
 * 하위 호환으로만 남긴다.
 */
export type GoogleAuthCallbackResult =
  | { kind: "code"; code: string; error: null }
  | { kind: "tokens"; accessToken: string; refreshToken: string; error: null }
  | { kind: "error"; error: Error };

const paramsFrom = (raw: string) => {
  try {
    return new URLSearchParams(raw);
  } catch {
    return new URLSearchParams();
  }
};

export const parseGoogleAuthCallback = (
  callbackUrlOrFragment: string,
): GoogleAuthCallbackResult => {
  const hashStart = callbackUrlOrFragment.indexOf("#");
  const queryStart = callbackUrlOrFragment.indexOf("?");
  const fragment = hashStart >= 0 ? callbackUrlOrFragment.slice(hashStart + 1) : "";
  const query =
    queryStart >= 0
      ? callbackUrlOrFragment.slice(
          queryStart + 1,
          hashStart > queryStart ? hashStart : undefined,
        )
      : "";
  // 스킴 없이 "code=..." 또는 "access_token=..."만 넘어오는 경우(expo-router의 `#` 파라미터)
  const bare =
    hashStart < 0 && queryStart < 0 ? callbackUrlOrFragment.replace(/^[?#]/, "") : "";

  const params = new URLSearchParams([
    ...paramsFrom(query).entries(),
    ...paramsFrom(fragment).entries(),
    ...paramsFrom(bare).entries(),
  ]);

  const providerError = params.get("error_description") ?? params.get("error");
  if (providerError) {
    return { kind: "error", error: new Error(providerError) };
  }

  const code = params.get("code");
  if (code) {
    return { kind: "code", code, error: null };
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    return { kind: "tokens", accessToken, refreshToken, error: null };
  }

  return { kind: "error", error: new Error("로그인 세션을 가져올 수 없습니다.") };
};
