import { getCatchVerificationStatus } from "@/src/lib/catchVerification";

describe("getCatchVerificationStatus", () => {
  it("verifies a live camera catch with complete capture location", () => {
    expect(
      getCatchVerificationStatus({
        captureMethod: "live_camera",
        latitude: 36.2,
        longitude: 126.5,
        locationCapturedAt: "2026-07-27T00:00:00.000Z",
      }),
    ).toBe("verified");
  });

  it("keeps a location-free live camera catch unverified", () => {
    expect(
      getCatchVerificationStatus({
        captureMethod: "live_camera",
      }),
    ).toBe("unverified");
  });

  it("does not verify partial location evidence", () => {
    expect(
      getCatchVerificationStatus({
        captureMethod: "live_camera",
        latitude: 36.2,
        longitude: 126.5,
      }),
    ).toBe("unverified");
  });

  it("preserves the existing development upload verification path", () => {
    expect(
      getCatchVerificationStatus({
        captureMethod: "development_upload",
      }),
    ).toBe("verified");
  });
});
