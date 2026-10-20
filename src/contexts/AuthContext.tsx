import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { AppState, Platform } from "react-native";
import { supabase } from "@/src/lib/supabase";
import { parseGoogleAuthCallback } from "@/src/lib/googleAuthCallback";
import { clearAllSharedResources } from "@/src/lib/sharedResource";

WebBrowser.maybeCompleteAuthSession();

type AuthContextType = {
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null; session: Session | null }>;
  signInWithApple: (
    identityToken: string,
    authorizationCode: string,
  ) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  completeGoogleSignIn: (
    callbackUrlOrFragment: string,
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  deleteAccount: () => Promise<{
    appleRevocation: AppleRevocationStatus;
    error: Error | null;
  }>;
};

export type AppleRevocationStatus =
  | "not_applicable"
  | "revoked"
  | "manual_action_required";

type DeleteAccountResult = {
  appleRevocation: AppleRevocationStatus;
  deleted: boolean;
};

const APPLE_NATIVE_CLIENT_ID = "com.sigcrew.baitedbrothers";

const AuthContext = createContext<AuthContextType | undefined>(undefined);
let pendingGoogleCompletion: Promise<{ error: Error | null }> | null = null;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") clearAllSharedResources();
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 네이티브에서는 타이머가 백그라운드에서 멈추므로, Supabase 권장대로 앱이 활성일 때만
  // 토큰 자동 갱신을 돌린다. 이게 없으면 오래 백그라운드에 있다가 돌아온 첫 요청이
  // 만료된 JWT로 나가 간헐적인 401이 난다.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const applyAppState = (state: string) => {
      if (state === "active") {
        void supabase.auth.startAutoRefresh();
      } else {
        void supabase.auth.stopAutoRefresh();
      }
    };
    applyAppState(AppState.currentState);
    const subscription = AppState.addEventListener("change", applyAppState);
    return () => {
      subscription.remove();
      void supabase.auth.stopAutoRefresh();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ?? null };
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { error: error ?? null, session: data.session ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  // 재설정 메일의 링크는 PKCE 코드를 싣고 baited-brothers://reset-password로 돌아온다.
  // (Supabase 대시보드 Redirect URLs에 이 주소가 등록돼 있어야 한다.)
  const requestPasswordReset = async (email: string) => {
    const scheme = Constants.expoConfig?.scheme ?? "baited-brothers";
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${scheme}://reset-password`,
    });
    return { error: error ?? null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error ?? null };
  };

  const deleteAccount = async () => {
    const { data, error } = await supabase.functions.invoke<DeleteAccountResult>(
      "delete-account",
      { body: { confirm: true } },
    );
    if (error) {
      return { appleRevocation: "not_applicable" as const, error };
    }
    await supabase.auth.signOut({ scope: "local" });
    return {
      appleRevocation: data?.appleRevocation ?? "not_applicable",
      error: null,
    };
  };

  const signInWithApple = async (
    identityToken: string,
    authorizationCode: string,
  ) => {
    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: identityToken,
    });
    if (error) return { error };

    const { error: tokenStorageError } = await supabase.functions.invoke(
      "store-apple-token",
      {
        body: {
          authorizationCode,
          clientId: APPLE_NATIVE_CLIENT_ID,
        },
      },
    );
    if (tokenStorageError) {
      // 서버에 남은 리프레시 토큰까지 무효화한다. local scope만 지우면 사용자는
      // 거부됐다고 믿는 계정의 세션이 서버에 살아 있게 된다.
      await supabase.auth.signOut({ scope: "global" }).catch(() => undefined);
      return {
        error: new Error(
          "Apple 계정 연결 정보를 안전하게 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        ),
      };
    }

    return { error: null };
  };

  const signInWithGoogle = async () => {
    const scheme = Constants.expoConfig?.scheme ?? "baited-brothers";
    const redirectUrl = `${scheme}://google-auth`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) return { error };

    const authUrl = data?.url;
    if (!authUrl) return { error: new Error("OAuth URL을 가져올 수 없습니다.") };

    const result = await WebBrowser.openAuthSessionAsync(
      authUrl,
      redirectUrl,
      { showInRecents: true }
    );

    if (result.type !== "success" || !result.url) {
      return { error: new Error("Google 로그인이 취소되었습니다.") };
    }

    return completeGoogleSignIn(result.url);
  };

  const completeGoogleSignIn = useCallback(
    (callbackUrlOrFragment: string) => {
      if (pendingGoogleCompletion) return pendingGoogleCompletion;

      pendingGoogleCompletion = (async () => {
        const {
          data: { session: existingSession },
        } = await supabase.auth.getSession();
        if (existingSession) return { error: null };

        const parsed = parseGoogleAuthCallback(callbackUrlOrFragment);
        if (parsed.kind === "error") return { error: parsed.error };

        if (parsed.kind === "code") {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(parsed.code);
          return { error: exchangeError ?? null };
        }

        // 구버전 implicit 콜백 하위 호환.
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: parsed.accessToken,
          refresh_token: parsed.refreshToken,
        });

        return { error: sessionError ?? null };
      })().finally(() => {
        pendingGoogleCompletion = null;
      });

      return pendingGoogleCompletion;
    },
    [],
  );

  const value: AuthContextType = {
    session,
    isLoading,
    signIn,
    signUp,
    signInWithApple,
    signInWithGoogle,
    completeGoogleSignIn,
    signOut,
    requestPasswordReset,
    updatePassword,
    deleteAccount,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
