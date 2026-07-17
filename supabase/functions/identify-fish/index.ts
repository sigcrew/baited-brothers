import { createClient } from "npm:@supabase/supabase-js@2.49.1";

type CatalogFish = {
  id: string;
  nameKo: string;
  scientificName: string;
  group: string;
  identificationFeatures?: string | null;
  similarSpeciesNotes?: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const extractClaudeText = (response: Record<string, unknown>) => {
  const content = Array.isArray(response.content) ? response.content : [];
  const text = content
    .filter(
      (part): part is { type: string; text: string } =>
        Boolean(
          part &&
            typeof part === "object" &&
            (part as { type?: unknown }).type === "text" &&
            typeof (part as { text?: unknown }).text === "string",
        ),
    )
    .map((part) => part.text)
    .join("\n")
    .trim();

  return text || null;
};

const parseClaudeJson = (text: string) => {
  const withoutFence = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");

  if (start < 0 || end < start) {
    throw new Error("Claude response did not contain a JSON object.");
  }

  return JSON.parse(withoutFence.slice(start, end + 1));
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
  const model =
    Deno.env.get("ANTHROPIC_VISION_MODEL") || "claude-sonnet-5";
  const authorization = req.headers.get("Authorization");

  if (!supabaseUrl || !supabaseAnonKey || !anthropicApiKey) {
    return json({ error: "Server secrets are not configured." }, 500);
  }
  if (!authorization) return json({ error: "Authentication required." }, 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Invalid session." }, 401);

  let payload: {
    imageBase64?: string;
    mimeType?: string;
    catalog?: CatalogFish[];
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }

  const imageBase64 = payload.imageBase64?.replace(/^data:[^;]+;base64,/, "");
  const mimeType = payload.mimeType === "image/png" ? "image/png" : "image/jpeg";
  const catalog = (payload.catalog ?? [])
    .filter(
      (fish) =>
        fish &&
        typeof fish.id === "string" &&
        typeof fish.nameKo === "string" &&
        typeof fish.scientificName === "string",
    )
    .slice(0, 80);

  if (!imageBase64 || imageBase64.length > 14_000_000) {
    return json({ error: "A smaller captured image is required." }, 413);
  }
  if (catalog.length < 2) {
    return json({ error: "The fish catalog is unavailable." }, 400);
  }

  const catalogText = catalog
    .map(
      (fish) =>
        `${fish.id} | ${fish.nameKo} | ${fish.scientificName} | ${fish.group}` +
        `${fish.identificationFeatures ? ` | 특징: ${fish.identificationFeatures}` : ""}` +
        `${fish.similarSpeciesNotes ? ` | 유사종: ${fish.similarSpeciesNotes}` : ""}`,
    )
    .join("\n");

  const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicApiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      system:
        "당신은 한국 연안 낚시 어종 식별 보조자입니다. 제공된 폐쇄형 도감 목록 안에서만 후보를 선택하고, 반드시 마크다운 없이 JSON 객체 하나만 출력하세요.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text:
                "사진 속 대상의 체형, 입과 머리, 지느러미 배치, 꼬리, 무늬와 색을 관찰하세요. " +
                "아래 폐쇄형 도감 목록에 있는 어종만 후보로 선택하고, 가장 가능성 높은 순서로 최대 3개를 반환하세요. " +
                "사진에 물고기·두족류가 없거나 식별 특징이 부족하면 후보를 억지로 만들지 말고 needs_retake를 true로 설정하세요. " +
                "confidence는 후보 간 상대 점수가 아니라 각 후보의 식별 확신도 0~1입니다. 이유는 사용자가 비교할 수 있게 한국어 한 문장으로 작성하세요. " +
                '출력 형식은 {"candidates":[{"fish_id":"도감 UUID","confidence":0.0,"reason":"비교 근거"}],"needs_retake":false,"note":"짧은 안내"} 입니다.\n\n' +
                `도감 목록:\n${catalogText}`,
            },
          ],
        },
      ],
    }),
  });

  const claudeBody = await claudeResponse.json();
  if (!claudeResponse.ok) {
    console.error("Anthropic request failed", claudeResponse.status);
    return json({ error: "AI identification is temporarily unavailable." }, 502);
  }

  const outputText = extractClaudeText(claudeBody);
  if (!outputText) return json({ error: "AI returned no result." }, 502);

  try {
    const result = parseClaudeJson(outputText);
    const allowedIds = new Set(catalog.map((fish) => fish.id));
    result.candidates = (Array.isArray(result.candidates) ? result.candidates : [])
      .filter(
        (candidate: { fish_id?: unknown }) =>
          typeof candidate?.fish_id === "string" &&
          allowedIds.has(candidate.fish_id),
      )
      .slice(0, 3);
    return json(result);
  } catch {
    return json({ error: "AI result could not be parsed." }, 502);
  }
});
