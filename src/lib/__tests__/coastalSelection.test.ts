import { evaluateCoastalSelection } from "@/src/lib/coastalSelection";

describe("evaluateCoastalSelection", () => {
  it.each([
    ["서울 도심", 37.5665, 126.978],
    ["대전 도심", 36.3504, 127.3845],
  ])("%s처럼 해안에서 먼 내륙을 차단한다", (_name, latitude, longitude) => {
    const result = evaluateCoastalSelection(latitude, longitude);
    expect(result.isOnLand).toBe(true);
    expect(result.allowed).toBe(false);
    expect(result.coastDistanceKm).toBeGreaterThan(3);
  });

  it("부산항처럼 해안에 인접한 육지는 허용한다", () => {
    const latitude = 35.103;
    const longitude = 129.04;
    const result = evaluateCoastalSelection(latitude, longitude);
    expect(result.isOnLand).toBe(true);
    expect(result.allowed).toBe(true);
    expect(result.coastDistanceKm).toBeLessThanOrEqual(3);
  });

  it("인천항 관측 지점처럼 항만 안쪽의 수면은 허용한다", () => {
    expect(evaluateCoastalSelection(37.4519, 126.5922)).toEqual({
      allowed: true,
      isOnLand: false,
      coastDistanceKm: null,
    });
  });

  it("대한민국 서해의 바다 좌표를 허용한다", () => {
    expect(evaluateCoastalSelection(37.3, 126.2)).toEqual({
      allowed: true,
      isOnLand: false,
      coastDistanceKm: null,
    });
  });
});
