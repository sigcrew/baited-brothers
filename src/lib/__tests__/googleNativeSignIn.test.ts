import { Platform } from "react-native";

const mockSignIn = jest.fn();
const mockConfigure = jest.fn();
const mockHasPlayServices = jest.fn();
const mockSignOut = jest.fn();

jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: (...args: unknown[]) => mockConfigure(...args),
    signIn: (...args: unknown[]) => mockSignIn(...args),
    hasPlayServices: (...args: unknown[]) => mockHasPlayServices(...args),
    signOut: (...args: unknown[]) => mockSignOut(...args),
  },
  statusCodes: { SIGN_IN_CANCELLED: "-5", IN_PROGRESS: "-4", PLAY_SERVICES_NOT_AVAILABLE: "-3" },
  isErrorWithCode: (error: unknown) =>
    typeof error === "object" && error !== null && "code" in error,
  isCancelledResponse: (response: { type: string }) => response.type === "cancelled",
  isSuccessResponse: (response: { type: string }) => response.type === "success",
}));

const originalOS = Platform.OS;
const setOS = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, "OS", { configurable: true, get: () => os });
};

const load = () => {
  let mod!: typeof import("@/src/lib/googleNativeSignIn");
  jest.isolateModules(() => {
    mod = require("@/src/lib/googleNativeSignIn");
  });
  return mod;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockHasPlayServices.mockResolvedValue(true);
});

afterEach(() => setOS(originalOS));

test("on Android returns the ID token after checking Play services, configuring once", async () => {
  setOS("android");
  const { requestNativeGoogleIdToken, GOOGLE_WEB_CLIENT_ID } = load();
  mockSignIn.mockResolvedValue({ type: "success", data: { idToken: "id-token" } });
  await expect(requestNativeGoogleIdToken()).resolves.toEqual({ kind: "token", idToken: "id-token" });
  await requestNativeGoogleIdToken();
  expect(mockConfigure).toHaveBeenCalledTimes(1);
  expect(mockConfigure).toHaveBeenCalledWith({ webClientId: GOOGLE_WEB_CLIENT_ID });
  expect(mockHasPlayServices).toHaveBeenCalledWith({ showPlayServicesUpdateDialog: true });
});

test("maps a cancelled response and the cancel error code to cancelled", async () => {
  setOS("android");
  const { requestNativeGoogleIdToken } = load();
  mockSignIn.mockResolvedValueOnce({ type: "cancelled", data: null });
  await expect(requestNativeGoogleIdToken()).resolves.toEqual({ kind: "cancelled" });
  mockSignIn.mockRejectedValueOnce(Object.assign(new Error("cancel"), { code: "-5" }));
  await expect(requestNativeGoogleIdToken()).resolves.toEqual({ kind: "cancelled" });
});

test("reports configuration errors as unavailable so the caller can use the web flow", async () => {
  setOS("android");
  const { requestNativeGoogleIdToken } = load();
  mockSignIn.mockRejectedValueOnce(Object.assign(new Error("DEVELOPER_ERROR"), { code: "10" }));
  await expect(requestNativeGoogleIdToken()).resolves.toEqual({ kind: "unavailable", reason: "10" });
  mockSignIn.mockResolvedValueOnce({ type: "success", data: { idToken: null } });
  await expect(requestNativeGoogleIdToken()).resolves.toEqual({ kind: "unavailable", reason: "no-id-token" });
});

test.each(["ios", "web"] as const)("is never used on %s, which keeps the web flow", async (os) => {
  setOS(os);
  const { requestNativeGoogleIdToken, signOutNativeGoogle } = load();
  await expect(requestNativeGoogleIdToken()).resolves.toEqual({ kind: "unavailable", reason: "module-missing" });
  await signOutNativeGoogle();
  expect(mockConfigure).not.toHaveBeenCalled();
  expect(mockSignIn).not.toHaveBeenCalled();
  expect(mockSignOut).not.toHaveBeenCalled();
});
