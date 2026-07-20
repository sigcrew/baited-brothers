import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Constants from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/src/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

type AuthContextType = {
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string
  ) => Promise<{ error: Error | null; session: Session | null }>;
  signInWithApple: (identityToken: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  deleteAccount: (
    appleAuthorizationCode?: string,
  ) => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
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

  const deleteAccount = async (appleAuthorizationCode?: string) => {
    const { error } = await supabase.functions.invoke("delete-account", {
      body: { confirm: true, appleAuthorizationCode },
    });
    if (error) return { error };
    await supabase.auth.signOut({ scope: "local" });
    return { error: null };
  };

  const signInWithApple = async (identityToken: string) => {
    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: identityToken,
    });
    return { error: error ?? null };
  };

  const signInWithGoogle = async () => {
    const scheme = Constants.expoConfig?.scheme ?? "baited-brothers";
    const redirectUrl = `${scheme}://google-auth`;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
        queryParams: { prompt: "consent" },
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

    const hashStart = result.url.indexOf("#");
    const params = new URLSearchParams(
      hashStart >= 0 ? result.url.slice(hashStart + 1) : ""
    );
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (!accessToken || !refreshToken) {
      return { error: new Error("로그인 세션을 가져올 수 없습니다.") };
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    return { error: sessionError ?? null };
  };

  const value: AuthContextType = {
    session,
    isLoading,
    signIn,
    signUp,
    signInWithApple,
    signInWithGoogle,
    signOut,
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
