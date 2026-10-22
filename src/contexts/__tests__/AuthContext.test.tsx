import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { AppState } from "react-native";

jest.mock("@/src/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      signInWithIdToken: jest.fn(),
      signInWithOAuth: jest.fn(),
      exchangeCodeForSession: jest.fn(),
      setSession: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
    functions: { invoke: jest.fn() },
  },
}));
jest.mock("@/src/lib/sharedResource", () => ({ clearAllSharedResources: jest.fn() }));
jest.mock("@/src/lib/googleNativeSignIn", () => ({
  requestNativeGoogleIdToken: jest.fn(),
  signOutNativeGoogle: jest.fn(),
}));
jest.mock("expo-constants", () => ({ __esModule: true, default: { expoConfig: { scheme: "baited-brothers" } } }));
jest.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

import * as WebBrowser from "expo-web-browser";
import { clearAllSharedResources } from "@/src/lib/sharedResource";
import { AuthProvider, useAuth } from "@/src/contexts/AuthContext";
import { requestNativeGoogleIdToken, signOutNativeGoogle } from "@/src/lib/googleNativeSignIn";

const mockNativeGoogle = requestNativeGoogleIdToken as jest.Mock;

const { supabase: mockSupabase } = jest.requireMock("@/src/lib/supabase") as {
  supabase: { auth: Record<string, jest.Mock>; functions: { invoke: jest.Mock } };
};
const mockAuth = mockSupabase.auth;
const mockFunctions = mockSupabase.functions;

type AuthApi = ReturnType<typeof useAuth>;

let authStateListener: ((event: string, session: unknown) => void) | null = null;
let appStateListener: ((state: string) => void) | null = null;
let api: AuthApi | null = null;
let view: ReactTestRenderer;

const Probe = () => {
  api = useAuth();
  return null;
};

const drain = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};

beforeEach(async () => {
  jest.clearAllMocks();
  api = null;
  authStateListener = null;
  appStateListener = null;
  mockAuth.getSession.mockResolvedValue({ data: { session: null } });
  mockAuth.onAuthStateChange.mockImplementation((listener) => {
    authStateListener = listener;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  });
  mockAuth.signOut.mockResolvedValue({ error: null });
  mockNativeGoogle.mockResolvedValue({ kind: "unavailable", reason: "module-missing" });
  jest.spyOn(AppState, "addEventListener").mockImplementation(((_type: string, listener: (state: string) => void) => {
    appStateListener = listener;
    return { remove: jest.fn() };
  }) as never);
  await act(async () => {
    view = create(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await drain();
  });
});

afterEach(async () => {
  await act(async () => view.unmount());
  jest.restoreAllMocks();
});

test("token auto-refresh follows AppState: on while active, off in the background", () => {
  expect(appStateListener).not.toBeNull();
  mockAuth.startAutoRefresh.mockClear();
  mockAuth.stopAutoRefresh.mockClear();
  appStateListener?.("active");
  expect(mockAuth.startAutoRefresh).toHaveBeenCalledTimes(1);
  expect(mockAuth.stopAutoRefresh).not.toHaveBeenCalled();
  appStateListener?.("background");
  expect(mockAuth.stopAutoRefresh).toHaveBeenCalledTimes(1);
  appStateListener?.("inactive");
  expect(mockAuth.stopAutoRefresh).toHaveBeenCalledTimes(2);
});

test("a SIGNED_OUT event clears every shared resource cache and drops the session", async () => {
  await act(async () => {
    authStateListener?.("SIGNED_IN", { user: { id: "u1" } });
    await drain();
  });
  expect(api?.session).toEqual({ user: { id: "u1" } });
  await act(async () => {
    authStateListener?.("SIGNED_OUT", null);
    await drain();
  });
  expect(clearAllSharedResources).toHaveBeenCalledTimes(1);
  expect(api?.session).toBeNull();
});

test("Apple sign-in signs out globally when the refresh-token store fails", async () => {
  mockAuth.signInWithIdToken.mockResolvedValue({ error: null });
  mockFunctions.invoke.mockResolvedValue({ error: new Error("store failed") });
  const result = await api!.signInWithApple("id-token", "auth-code");
  expect(result.error?.message).toMatch(/Apple 계정 연결 정보/);
  expect(mockAuth.signOut).toHaveBeenCalledWith({ scope: "global" });
});

test("Google sign-in exchanges the PKCE code returned by the browser session", async () => {
  mockAuth.signInWithOAuth.mockResolvedValue({ data: { url: "https://accounts.google.com/o/oauth" }, error: null });
  (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
    type: "success",
    url: "baited-brothers://google-auth?code=pkce-code-1",
  });
  mockAuth.exchangeCodeForSession.mockResolvedValue({ error: null });
  const result = await api!.signInWithGoogle();
  expect(result.error).toBeNull();
  expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith(
    expect.objectContaining({
      provider: "google",
      options: expect.objectContaining({ redirectTo: "baited-brothers://google-auth", skipBrowserRedirect: true }),
    }),
  );
  expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith("pkce-code-1");
  expect(mockAuth.setSession).not.toHaveBeenCalled();
});

test("native Google sign-in hands the ID token to Supabase without opening the browser", async () => {
  mockNativeGoogle.mockResolvedValue({ kind: "token", idToken: "google-id-token" });
  mockAuth.signInWithIdToken.mockResolvedValue({ error: null });
  const result = await api!.signInWithGoogle();
  expect(result.error).toBeNull();
  expect(mockAuth.signInWithIdToken).toHaveBeenCalledWith({ provider: "google", token: "google-id-token" });
  expect(mockAuth.signInWithOAuth).not.toHaveBeenCalled();
  expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
});

test("cancelling the native account picker does not fall back to the web flow", async () => {
  mockNativeGoogle.mockResolvedValue({ kind: "cancelled" });
  const result = await api!.signInWithGoogle();
  expect(result.error?.message).toContain("취소");
  expect(mockAuth.signInWithOAuth).not.toHaveBeenCalled();
});

test("a native token Supabase rejects falls back to the web flow", async () => {
  jest.spyOn(console, "warn").mockImplementation(() => undefined);
  mockNativeGoogle.mockResolvedValue({ kind: "token", idToken: "bad-audience" });
  mockAuth.signInWithIdToken.mockResolvedValue({ error: new Error("Unacceptable audience") });
  mockAuth.signInWithOAuth.mockResolvedValue({ data: { url: "https://accounts.google.com/o/oauth" }, error: null });
  (WebBrowser.openAuthSessionAsync as jest.Mock).mockResolvedValue({
    type: "success",
    url: "baited-brothers://google-auth?code=pkce-code-2",
  });
  mockAuth.exchangeCodeForSession.mockResolvedValue({ error: null });
  const result = await api!.signInWithGoogle();
  expect(result.error).toBeNull();
  expect(mockAuth.signInWithOAuth).toHaveBeenCalledTimes(1);
  expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith("pkce-code-2");
});

test("signing out also clears the device Google session", async () => {
  await api!.signOut();
  expect(mockAuth.signOut).toHaveBeenCalled();
  expect(signOutNativeGoogle).toHaveBeenCalledTimes(1);
});

test("concurrent Google completions share one in-flight exchange", async () => {
  let resolveExchange: (value: { error: null }) => void = () => undefined;
  mockAuth.exchangeCodeForSession.mockReturnValue(
    new Promise((resolve) => {
      resolveExchange = resolve;
    }),
  );
  const first = api!.completeGoogleSignIn("code=abc");
  const second = api!.completeGoogleSignIn("code=abc");
  expect(first).toBe(second);
  resolveExchange({ error: null });
  await first;
  expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
});

test("password reset sends the app's reset-password deep link as redirect", async () => {
  mockAuth.resetPasswordForEmail.mockResolvedValue({ error: null });
  const result = await api!.requestPasswordReset("angler@example.com");
  expect(result.error).toBeNull();
  expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith("angler@example.com", {
    redirectTo: "baited-brothers://reset-password",
  });
});
