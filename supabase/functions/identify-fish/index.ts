import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import {
  expandSuggestedGroups,
  getAdjacentGroups,
  normalizeQualityGate,
  normalizeScore,
  type QualityGateResult,
} from "./quality-policy.ts";

type CatalogFish = {
  id: string;
  nameKo: string;
  scientificName: string;
  group: string;
  identificationFeatures?: string | null;
  similarSpeciesNotes?: string | null;
};

const MODEL = "claude-sonnet-5";

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
    .filter((part): part is { type: string; text: string } =>
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

const qualityGateSchema = (groups: string[]) => ({
  type: "object",
  properties: {
    subject_present: { type: "boolean" },
    subject_type: {
      type: "string",
      enum: ["finfish", "cephalopod", "other"],
    },
    image_quality: { type: "number" },
    subject_size: {
      type: "string",
      enum: ["large", "medium", "small", "tiny"],
    },
    visible_features: {
      type: "object",
      properties: {
        head: { type: "boolean" },
        body: { type: "boolean" },
        fins_or_arms: { type: "boolean" },
        tail_or_mantle: { type: "boolean" },
      },
      required: ["head", "body", "fins_or_arms", "tail_or_mantle"],
      additionalProperties: false,
    },
    quality_issues: {
      type: "array",
      items: {
        type: "string",
        enum: [
          "blurred",
          "dark",
          "overexposed",
          "pixelated",
          "cropped",
          "occluded",
          "tiny_subject",
        ],
      },
    },
    suggested_groups: {
      type: "array",
      items: { type: "string", enum: groups },
    },
    needs_retake: { type: "boolean" },
    note: { type: "string" },
  },
  required: [
    "subject_present",
    "subject_type",
    "image_quality",
    "subject_size",
    "visible_features",
    "quality_issues",
    "suggested_groups",
    "needs_retake",
    "note",
  ],
  additionalProperties: false,
});

const classificationSchema = (candidateCount: number) => ({
  type: "object",
  properties: {
    candidates: {
      type: "array",
      minItems: candidateCount,
      maxItems: candidateCount,
      items: {
        type: "object",
        properties: {
          fish_id: { type: "string" },
          confidence: { type: "number" },
          reason: { type: "string" },
        },
        required: ["fish_id", "confidence", "reason"],
        additionalProperties: false,
      },
    },
    needs_retake: { type: "boolean", enum: [false] },
    note: { type: "string" },
  },
  required: ["candidates", "needs_retake", "note"],
  additionalProperties: false,
});

const callClaude = async ({
  apiKey,
  imageBase64,
  mimeType,
  prompt,
  schema,
  maxTokens,
}: {
  apiKey: string;
  imageBase64: string;
  mimeType: "image/jpeg" | "image/png";
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens: number;
}) => {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: maxTokens,
          system:
            "당신은 한국 연안 낚시 어종 식별 보조자입니다. 사진에서 확인할 수 없는 특징은 추측하지 말고, 재촬영이 필요한 사진을 억지로 식별하지 마세요. " +
            "판단 결과는 반드시 submit_identification 도구로 제출하세요.",
          tools: [
            {
              name: "submit_identification",
              description:
                "사진 품질 검사 또는 폐쇄형 도감 어종 판별 결과를 제출합니다.",
              input_schema: schema,
            },
          ],
          tool_choice: {
            type: "tool",
            name: "submit_identification",
          },
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
                { type: "text", text: prompt },
              ],
            },
          ],
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        console.error("Anthropic request failed", response.status);
        if (
          attempt === 0 &&
          (response.status === 429 || response.status >= 500)
        ) {
          continue;
        }
        const apiMessage =
          body &&
          typeof body === "object" &&
          "error" in body &&
          body.error &&
          typeof body.error === "object" &&
          "message" in body.error &&
          typeof body.error.message === "string"
            ? body.error.message
            : null;
        throw new Error(
          `Anthropic request failed with ${response.status}` +
            `${apiMessage ? `: ${apiMessage.slice(0, 160)}` : ""}`,
        );
      }

      const content = Array.isArray(body.content) ? body.content : [];
      const toolUse = content.find(
        (part: unknown) =>
          part &&
          typeof part === "object" &&
          (part as { type?: unknown }).type === "tool_use" &&
          (part as { name?: unknown }).name === "submit_identification",
      ) as { input?: unknown } | undefined;
      if (toolUse?.input && typeof toolUse.input === "object") {
        return toolUse.input;
      }

      const outputText = extractClaudeText(body);
      if (!outputText) throw new Error("Claude returned no result");
      return parseClaudeJson(outputText);
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }

  throw new Error("Claude request failed");
};

const catalogToText = (catalog: CatalogFish[]) =>
  catalog
    .map(
      (fish) =>
        `${fish.id} | ${fish.nameKo} | ${fish.scientificName} | ${fish.group}` +
        `${fish.identificationFeatures ? ` | 특징: ${fish.identificationFeatures}` : ""}` +
        `${fish.similarSpeciesNotes ? ` | 유사종: ${fish.similarSpeciesNotes}` : ""}`,
    )
    .join("\n");

const classifyCatalog = async ({
  apiKey,
  imageBase64,
  mimeType,
  catalog,
  groupLabel,
  maxCandidates,
}: {
  apiKey: string;
  imageBase64: string;
  mimeType: "image/jpeg" | "image/png";
  catalog: CatalogFish[];
  groupLabel: string;
  maxCandidates: number;
}) => {
  const candidateCount = Math.min(maxCandidates, catalog.length);
  const result = await callClaude({
    apiKey,
    imageBase64,
    mimeType,
    maxTokens: 900,
    schema: classificationSchema(candidateCount),
    prompt:
      `품질 검사를 통과한 사진을 ${groupLabel} 후보 안에서 판별합니다. ` +
      "아래 폐쇄형 후보 목록 밖의 종은 선택하지 마세요. 목록 순서는 가능성 순서가 아니므로 모든 항목을 동등하게 비교하세요. " +
      "체형과 몸의 두께, 입과 머리, 지느러미 또는 팔의 배치, 꼬리 또는 외투막, 무늬와 색을 종별 특징과 유사종 설명에 대조하세요. " +
      `가장 가능성 높은 순서로 정확히 ${candidateCount}개를 반환하고 confidence는 해당 종 자체에 대한 식별 확신도 0~1로 평가하세요. ` +
      "사진은 이미 품질 검사를 통과했으므로 최소 1개의 후보를 반드시 반환하고 needs_retake=false로 설정하세요. fish_id는 아래 UUID를 정확히 복사하세요.\n\n" +
      `도감 후보:\n${catalogToText(catalog)}`,
  });
  const allowedIds = new Set(catalog.map((fish) => fish.id));
  const candidates = (
    result.needs_retake === true
      ? []
      : Array.isArray(result.candidates)
        ? result.candidates
        : []
  )
    .filter(
      (candidate: { fish_id?: unknown }) =>
        typeof candidate?.fish_id === "string" &&
        allowedIds.has(candidate.fish_id),
    )
    .map(
      (candidate: {
        fish_id: string;
        confidence?: unknown;
        reason?: unknown;
      }) => ({
        fish_id: candidate.fish_id,
        confidence: normalizeScore(candidate.confidence),
        reason:
          typeof candidate.reason === "string" && candidate.reason.trim()
            ? candidate.reason.trim()
            : "사진의 체형과 무늬를 도감 특징에 비교했습니다.",
      }),
    )
    .slice(0, maxCandidates);

  return {
    candidates,
    note:
      typeof result.note === "string" && result.note.trim()
        ? result.note.trim()
        : null,
  };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const anthropicApiKey = Deno.env.get("ANTHROPIC_API_KEY");
  const authorization = req.headers.get("Authorization");

  if (!supabaseUrl || !supabaseAnonKey || !anthropicApiKey) {
    return json({ error: "Server secrets are not configured." }, 500);
  }
  if (!authorization) return json({ error: "Authentication required." }, 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
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
  const mimeType: "image/png" | "image/jpeg" =
    payload.mimeType === "image/png" ? "image/png" : "image/jpeg";
  const catalog = (payload.catalog ?? [])
    .filter(
      (fish) =>
        fish &&
        typeof fish.id === "string" &&
        typeof fish.nameKo === "string" &&
        typeof fish.scientificName === "string" &&
        typeof fish.group === "string" &&
        fish.group.length > 0,
    )
    .slice(0, 80);

  if (!imageBase64 || imageBase64.length > 14_000_000) {
    return json({ error: "A smaller captured image is required." }, 413);
  }
  if (catalog.length < 2) {
    return json({ error: "The fish catalog is unavailable." }, 400);
  }

  try {
    const groups = [...new Set(catalog.map((fish) => fish.group))].sort();
    const allowedGroups = new Set(groups);
    const qualityResult = await callClaude({
      apiKey: anthropicApiKey,
      imageBase64,
      mimeType,
      maxTokens: 700,
      schema: qualityGateSchema(groups),
      prompt:
        "이 요청은 식별 전 품질 검사입니다. 사진에 물고기 또는 두족류가 실제로 있는지 먼저 판단하세요. " +
        "음식, 낚시 장비, 풍경, 사람, 반려동물은 other입니다. 대상이 화면에서 차지하는 크기와 머리·몸통·지느러미 또는 팔·꼬리 또는 외투막이 실제로 구분되는지 평가하세요. " +
        "작은 피사체, 픽셀화, 심한 흐림, 과도한 어둠·노출, 주요 부위 잘림이나 가림은 구체적으로 quality_issues에 기록하세요. " +
        "식별에 사용할 수 있는 도감 그룹을 가능성 순서로 최대 3개 제안하세요. 그룹 목록: " +
        groups.join(", ") +
        ". 핵심 특징을 두 가지 이상 비교할 수 없으면 needs_retake=true로 판단하세요.",
    });
    const gate = normalizeQualityGate(qualityResult, allowedGroups);

    if (gate.needsRetake) {
      return json({
        subject_present: gate.subjectPresent,
        subject_type: gate.subjectType,
        image_quality: gate.imageQuality,
        subject_size: gate.subjectSize,
        quality_issues: gate.qualityIssues,
        candidates: [],
        needs_retake: true,
        note: gate.note,
      });
    }

    const evaluatedGroups = expandSuggestedGroups(
      gate.suggestedGroups,
      allowedGroups,
    );
    const shortlistedCatalog =
      evaluatedGroups.length > 0
        ? catalog.filter((fish) => evaluatedGroups.includes(fish.group))
        : catalog;
    const primaryResult = await classifyCatalog({
      apiKey: anthropicApiKey,
      imageBase64,
      mimeType,
      catalog: shortlistedCatalog,
      groupLabel:
        evaluatedGroups.length > 0
          ? evaluatedGroups.join("·")
          : "전체 도감",
      maxCandidates: 3,
    });
    let candidates = primaryResult.candidates;
    const catalogById = new Map(catalog.map((fish) => [fish.id, fish]));
    const representedGroups = new Set(
      candidates
        .map((candidate) => catalogById.get(candidate.fish_id)?.group)
        .filter((group): group is string => Boolean(group)),
    );
    const primaryGroup =
      representedGroups.size === 1 ? [...representedGroups][0] : undefined;
    const rescueGroup =
      candidates.length > 0 && primaryGroup
        ? [
            ...getAdjacentGroups(primaryGroup),
            ...evaluatedGroups,
          ].find(
            (group, index, groups) =>
              groups.indexOf(group) === index &&
              allowedGroups.has(group) &&
              !representedGroups.has(group),
          )
        : undefined;

    if (rescueGroup) {
      const rescueCatalog = catalog.filter(
        (fish) => fish.group === rescueGroup,
      );
      if (rescueCatalog.length > 0) {
        try {
          const rescueResult = await classifyCatalog({
            apiKey: anthropicApiKey,
            imageBase64,
            mimeType,
            catalog: rescueCatalog,
            groupLabel: `${rescueGroup} 보조 검증`,
            maxCandidates: 2,
          });
          const rescueCandidates = rescueResult.candidates
            .filter(
              (rescueCandidate) =>
                !candidates.some(
                  (candidate) =>
                    candidate.fish_id === rescueCandidate.fish_id,
                ),
            )
            .slice(0, 2);
          if (rescueCandidates.length > 0) {
            candidates = [
              ...candidates.slice(0, 1),
              ...rescueCandidates,
            ].slice(0, 3);
          }
        } catch (error) {
          console.error("Adjacent group rescue failed", error);
        }
      }
    }

    const needsRetake = candidates.length === 0;

    return json({
      subject_present: gate.subjectPresent,
      subject_type: gate.subjectType,
      image_quality: gate.imageQuality,
      subject_size: gate.subjectSize,
      quality_issues: gate.qualityIssues,
      evaluated_groups: evaluatedGroups,
      candidates: needsRetake ? [] : candidates,
      needs_retake: needsRetake,
      note: primaryResult.note ?? gate.note,
    });
  } catch (error) {
    console.error("Fish identification failed", error);
    return json(
      {
        error: "AI identification is temporarily unavailable.",
        error_code:
          error instanceof Error
            ? error.message.slice(0, 120)
            : "Unknown identification error",
      },
      502,
    );
  }
});
