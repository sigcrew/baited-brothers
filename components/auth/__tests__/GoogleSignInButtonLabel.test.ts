import { Platform } from "react-native";

jest.mock("@/src/contexts/AuthContext", () => ({ useAuth: () => ({}) }));
jest.mock("@/src/contexts/FieldNoticeContext", () => ({ useFieldNotice: () => ({}) }));
jest.mock("expo-router", () => ({ router: {} }));
jest.mock("@expo/vector-icons/FontAwesome", () => "FontAwesome");

import { fieldJournalGoogleLabelStyle } from "@/components/auth/GoogleSignInButton";

const originalOS = Platform.OS;
const setOS = (os: typeof Platform.OS) => {
  Object.defineProperty(Platform, "OS", { configurable: true, get: () => os });
};

afterEach(() => setOS(originalOS));

describe("fieldJournalGoogleLabelStyle", () => {
  it("matches the system Apple button on iOS", () => {
    setOS("ios");
    const style = fieldJournalGoogleLabelStyle();
    expect(style).toMatchObject({ color: "#000000", fontSize: 20 });
    expect(style).not.toHaveProperty("fontFamily");
  });

  it("keeps the app font on Android", () => {
    setOS("android");
    expect(fieldJournalGoogleLabelStyle()).toMatchObject({ fontFamily: "NotoSansKR_600SemiBold", fontSize: 16, lineHeight: 24 });
  });
});
