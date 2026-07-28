export type GoogleAuthCallbackResult =
  | {
      accessToken: string;
      refreshToken: string;
      error: null;
    }
  | {
      accessToken: null;
      refreshToken: null;
      error: Error;
    };

export const parseGoogleAuthCallback = (
  callbackUrlOrFragment: string,
): GoogleAuthCallbackResult => {
  const hashStart = callbackUrlOrFragment.indexOf("#");
  const rawFragment =
    hashStart >= 0
      ? callbackUrlOrFragment.slice(hashStart + 1)
      : callbackUrlOrFragment.replace(/^[?#]/, "");
  const params = new URLSearchParams(rawFragment);
  const providerError =
    params.get("error_description") ?? params.get("error");

  if (providerError) {
    return {
      accessToken: null,
      refreshToken: null,
      error: new Error(providerError),
    };
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken || !refreshToken) {
    return {
      accessToken: null,
      refreshToken: null,
      error: new Error("로그인 세션을 가져올 수 없습니다."),
    };
  }

  return { accessToken, refreshToken, error: null };
};
