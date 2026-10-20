import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

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
      if (raw.length > 2048) return json({ error: "Request too large" }, 413);
      body = JSON.parse(raw);
    } catch { return json({ error: "Invalid request" }, 400); }
    if (typeof body?.query !== "string" || !body.query.trim() || body.query.trim().length > 100) {
      return json({ error: "Invalid query" }, 400);
    }
    const key = Deno.env.get("KAKAO_REST_API_KEY");
    if (!key) return json({ error: "Search unavailable" }, 503);
    const url = new URL("https://dapi.kakao.com/v2/local/search/keyword.json");
    url.searchParams.set("query", body.query.trim());
    url.searchParams.set("size", "15");
    const response = await fetch(url, {
      headers: { Authorization: `KakaoAK ${key}` }, signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return json({ error: "Search unavailable" }, response.status === 429 ? 429 : 503);
    const result = await response.json();
    if (!Array.isArray(result.documents)) return json({ error: "Invalid search response" }, 502);
    const places = result.documents.flatMap((p: Record<string, unknown>) => {
      const latitude = Number(p.y), longitude = Number(p.x);
      if (typeof p.id !== "string" || typeof p.place_name !== "string" || !p.place_name.trim() ||
          !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
          latitude < 32.5 || latitude > 39 || longitude < 124 || longitude > 132.5) return [];
      return [{ id: p.id, name: p.place_name, address: String(p.road_address_name || p.address_name || ""), latitude, longitude }];
    });
    return json({ places });
  } catch { return json({ error: "Search unavailable" }, 503); }
});
