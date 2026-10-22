import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// 지도에서 고른 좌표의 행정구역 이름(예: "충청남도 보령시")을 카카오 로컬 API로 돌려준다.
// Android 기기 지오코더는 위치 권한이 없으면 동작하지 않아서, 앱이 기기 조회에 실패했을 때 쓴다.
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

const isKoreanCoordinate = (latitude: number, longitude: number) =>
  latitude >= 32.5 && latitude <= 39 && longitude >= 124 && longitude <= 132.5;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "Authentication required" }, 401);
  try {
    const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
    });
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return json({ error: "Invalid session" }, 401);
    let body;
    try {
      const raw = await req.text();
      if (raw.length > 512) return json({ error: "Request too large" }, 413);
      body = JSON.parse(raw);
    } catch { return json({ error: "Invalid request" }, 400); }
    const latitude = Number(body?.latitude);
    const longitude = Number(body?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return json({ error: "Invalid coordinate" }, 400);
    }
    if (!isKoreanCoordinate(latitude, longitude)) return json({ name: null });

    const key = Deno.env.get("KAKAO_REST_API_KEY");
    if (!key) return json({ error: "Lookup unavailable" }, 503);
    const url = new URL("https://dapi.kakao.com/v2/local/geo/coord2regioncode.json");
    url.searchParams.set("x", String(longitude));
    url.searchParams.set("y", String(latitude));
    const response = await fetch(url, {
      headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return json({ error: "Lookup unavailable" }, response.status === 429 ? 429 : 503);
    const result = await response.json();
    if (!Array.isArray(result.documents)) return json({ error: "Invalid lookup response" }, 502);
    // 법정동(B)을 먼저 쓰고, 없으면 행정동(H)을 쓴다. 시·도와 시·군·구까지만 이름에 넣는다.
    const documents = result.documents as Array<Record<string, unknown>>;
    const region = documents.find((d) => d.region_type === "B") ?? documents[0];
    const parts = [region?.region_1depth_name, region?.region_2depth_name]
      .map((part) => (typeof part === "string" ? part.trim() : ""))
      .filter(Boolean);
    return json({ name: parts.length ? parts.join(" ") : null });
  } catch { return json({ error: "Lookup unavailable" }, 503); }
});
