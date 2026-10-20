import {
  passwordResetErrorMessage,
  validateNewPassword,
  validateResetEmail,
} from "@/src/lib/passwordReset";

describe("validateResetEmail", () => {
  it("accepts a normal address and trims whitespace", () => {
    expect(validateResetEmail("  angler@example.com ")).toBeNull();
  });
  it("rejects empty and malformed addresses", () => {
    expect(validateResetEmail("")).toMatch(/입력/);
    expect(validateResetEmail("not-an-email")).toMatch(/형식/);
  });
});

describe("validateNewPassword", () => {
  it("requires both fields, a minimum length, and a match", () => {
    expect(validateNewPassword("", "")).toMatch(/두 번/);
    expect(validateNewPassword("12345", "12345")).toMatch(/6자/);
    expect(validateNewPassword("abcdef", "abcdeg")).toMatch(/일치/);
    expect(validateNewPassword("abcdef", "abcdef")).toBeNull();
  });
});

describe("passwordResetErrorMessage", () => {
  it("maps Supabase errors to Korean guidance", () => {
    expect(passwordResetErrorMessage({ message: "New password should be different from the old password." })).toMatch(/이전과 다른/);
    expect(passwordResetErrorMessage({ message: "Email link is invalid or has expired" })).toMatch(/만료/);
    expect(passwordResetErrorMessage({ message: "Request rate limit reached" })).toMatch(/잦습니다/);
    expect(passwordResetErrorMessage({ message: "Network request failed" })).toMatch(/네트워크/);
    expect(passwordResetErrorMessage(null)).toMatch(/변경하지 못했습니다/);
  });
});
