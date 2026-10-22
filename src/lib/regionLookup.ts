import { withTimeout } from "./appErrors";
import { supabase } from "./supabase";

type Coordinate = {
  latitude: number;
  longitude: number;
};

/**
 * 서버(카카오 로컬 API)로 국내 좌표의 시·도와 시·군·구 이름을 조회한다.
 * 기기 지오코더가 쓸 수 없을 때(Android에서 위치 권한이 없을 때 등) 쓰는 대체 경로라서
 * 실패하면 예외 없이 null을 돌려준다.
 */
export async function lookupKoreanRegionName(coordinate: Coordinate): Promise<string | null> {
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke<{ name: string | null }>("reverse-geocode", {
        body: { latitude: coordinate.latitude, longitude: coordinate.longitude },
      }),
      8000,
      "지역명 조회 시간이 초과되었습니다.",
    );
    if (error || typeof data?.name !== "string") return null;
    const name = data.name.trim();
    return name || null;
  } catch {
    return null;
  }
}
