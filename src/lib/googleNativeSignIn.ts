import { Platform } from "react-native";

/**
 * Android 네이티브 Google 로그인. 기기의 계정 선택 시트에서 ID 토큰을 받아 Supabase에 넘긴다.
 * 모듈이 없는 예전 빌드나 설정 오류처럼 네이티브로 끝낼 수 없으면 "unavailable"을 돌려주고,
 * 호출하는 쪽이 웹 로그인으로 넘어간다.
 *
 * iOS는 웹 로그인만 쓴다. iOS 네이티브 모듈은 ID 토큰에 nonce를 넣지만 그 값을 넘겨주지 않아
 * Supabase의 nonce 검사를 꺼야 하는데, iOS에서 얻는 이득(확인창 도메인)에 비해 보안 비용이 크다.
 * 그래서 iOS 자동 연결에서도 이 모듈을 뺐다(package.json expo.autolinking.ios.exclude).
 *
 * 웹 클라이언트 ID는 공개 값이다. Google Cloud 프로젝트 baited-brothers의 웹 OAuth 클라이언트로,
 * Supabase Google 공급자와 Android ID 토큰의 audience가 된다. Android 클라이언트(Play 서명 키,
 * 업로드 키, 디버그 키)는 패키지와 SHA-1로만 매칭되므로 코드에 넣지 않는다.
 */
export const GOOGLE_WEB_CLIENT_ID =
  "1026787262380-q09347d4li657cskduums4lolkssobhd.apps.googleusercontent.com";

export type NativeGoogleResult =
  | { kind: "token"; idToken: string }
  | { kind: "cancelled" }
  | { kind: "busy" }
  | { kind: "unavailable"; reason: string };

type GoogleSigninModule = typeof import("@react-native-google-signin/google-signin");

let configured = false;

const loadModule = (): GoogleSigninModule | null => {
  if (Platform.OS !== "android") return null;
  try {
    // 네이티브 모듈이 들어 있지 않은 빌드에서는 import 시점에 예외가 난다.
    return require("@react-native-google-signin/google-signin") as GoogleSigninModule;
  } catch {
    return null;
  }
};

const ensureConfigured = (module: GoogleSigninModule) => {
  if (configured) return;
  module.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
  configured = true;
};

export async function requestNativeGoogleIdToken(): Promise<NativeGoogleResult> {
  const module = loadModule();
  if (!module) return { kind: "unavailable", reason: "module-missing" };
  const { GoogleSignin, isCancelledResponse, isErrorWithCode, isSuccessResponse, statusCodes } =
    module;

  try {
    ensureConfigured(module);
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) return { kind: "cancelled" };
    if (isSuccessResponse(response) && response.data.idToken) {
      return { kind: "token", idToken: response.data.idToken };
    }
    return { kind: "unavailable", reason: "no-id-token" };
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return { kind: "cancelled" };
      if (error.code === statusCodes.IN_PROGRESS) return { kind: "busy" };
      return { kind: "unavailable", reason: String(error.code) };
    }
    return {
      kind: "unavailable",
      reason: error instanceof Error ? error.message : "unknown",
    };
  }
}

/** 다음 로그인에서 계정 선택 시트가 다시 뜨도록 기기 쪽 Google 세션도 지운다. */
export async function signOutNativeGoogle(): Promise<void> {
  const module = loadModule();
  if (!module) return;
  try {
    ensureConfigured(module);
    await module.GoogleSignin.signOut();
  } catch {
    // 기기 쪽 정리 실패는 앱 로그아웃을 막지 않는다.
  }
}
