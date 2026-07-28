import { getCatchVerificationStatus } from "@/src/lib/catchVerification";

describe("getCatchVerificationStatus", () => {
  it("leaves complete live camera evidence pending for the server", () => {
    expect(
      getCatchVerificationStatus({
        captureMethod: "live_camera",
        latitude: 36.2,
        longitude: 126.5,
        capturedAt: "2026-07-27T00:00:00.000Z",
      }),
    ).toBe("pending");
  });

  it("keeps a location-free live camera catch unverified", () => {
    expect(
      getCatchVerificationStatus({
        captureMethod: "live_camera",
      }),
    ).toBe("general_record");
  });

  it("does not verify partial location evidence", () => {
    expect(
      getCatchVerificationStatus({
        captureMethod: "live_camera",
        latitude: 36.2,
        longitude: 126.5,
      }),
    ).toBe("general_record");
  });

  it("never rewards a development upload on the client", () => {
    expect(
      getCatchVerificationStatus({
        captureMethod: "development_upload",
      }),
    ).toBe("general_record");
  });
});
