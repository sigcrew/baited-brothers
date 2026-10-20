import { captureLocationLabel, parseOptionalSize } from "@/src/lib/recordFlow";

describe("parseOptionalSize", () => {
  it("treats an empty value as not entered", () => {
    expect(parseOptionalSize("")).toEqual({ isValid: true, sizeCm: undefined, error: null });
    expect(parseOptionalSize("   ")).toEqual({ isValid: true, sizeCm: undefined, error: null });
  });

  it("accepts decimals with a dot or a comma", () => {
    expect(parseOptionalSize("32.5").sizeCm).toBe(32.5);
    expect(parseOptionalSize("32,5").sizeCm).toBe(32.5);
    expect(parseOptionalSize(" 40 ").sizeCm).toBe(40);
  });

  it("rejects zero, negatives, exponent and hex notation", () => {
    for (const raw of ["0", "-3", "1e3", "0x10", "abc", "32.5.1"]) {
      expect(parseOptionalSize(raw).isValid).toBe(false);
    }
  });

  it("rejects implausibly large sizes", () => {
    const result = parseOptionalSize("1200");
    expect(result.isValid).toBe(false);
    expect(result.error).toMatch(/500cm/);
  });
});

describe("captureLocationLabel", () => {
  it("describes camera captures by GPS availability", () => {
    expect(captureLocationLabel({ source: "camera", latitude: 35, longitude: 129, capturedAt: null })).toMatch(/GPS 확보/);
    expect(captureLocationLabel({ source: "camera", latitude: null, longitude: null, capturedAt: null })).toMatch(/위치 미인증/);
  });

  it("requires both position and capture time for library photos", () => {
    expect(captureLocationLabel({ source: "photo_library", latitude: 35, longitude: 129, capturedAt: "2026-10-20T00:00:00Z" })).toMatch(/심사 대상/);
    expect(captureLocationLabel({ source: "photo_library", latitude: 35, longitude: 129, capturedAt: null })).toMatch(/일반 기록/);
  });
});
