import { buildAppleNameUpdate } from "@/src/lib/appleName";
import { pickDisplayName } from "@/src/lib/userProfile";

describe("buildAppleNameUpdate", () => {
  it("writes the name on first sign-in", () => {
    expect(
      buildAppleNameUpdate({ givenName: "용현", familyName: "유" }),
    ).toEqual({ full_name: "용현 유", given_name: "용현", family_name: "유" });
  });

  it("does not overwrite an existing name when Apple returns an all-null fullName on re-login", () => {
    expect(buildAppleNameUpdate({ givenName: null, familyName: null })).toBeNull();
    expect(buildAppleNameUpdate({ givenName: "  ", familyName: "" })).toBeNull();
    expect(buildAppleNameUpdate(null)).toBeNull();
  });
});

describe("pickDisplayName", () => {
  it("skips empty and whitespace-only names left by the old Apple overwrite", () => {
    expect(pickDisplayName("", "  ", "바다형제")).toBe("바다형제");
    expect(pickDisplayName(undefined, null)).toBeNull();
    expect(pickDisplayName(" 유용현 ")).toBe("유용현");
  });
});
