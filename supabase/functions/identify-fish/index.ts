import { createDetailImage } from "./detail-image.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import {
  expandSuggestedGroups,
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

type IdentificationQuota = {
  allowed: boolean;
  remaining: number;
  reset_at: string | null;
};

const MODEL = "claude-sonnet-5";
const EVIDENCE_COMPARISON_ENABLED = Deno.env.get("FISH_EVIDENCE_COMPARISON") === "true";
const AUTO_DETAIL_ENABLED = Deno.env.get("FISH_AUTO_DETAIL") === "true";

const RECOGNITION_METADATA = { model: MODEL, version: "field60-v31" + (AUTO_DETAIL_ENABLED ? "+auto-detail-v1" : "") + (EVIDENCE_COMPARISON_ENABLED ? "+evidence-v1" : "") };

/**
 * 클라이언트에는 안정적인 코드만 돌려준다. 내부 오류 문구(Anthropic 메시지 등)는
 * 로그에만 남긴다.
 */
type IdentificationErrorCode =
  | "anthropic_unavailable"
  | "anthropic_rejected"
  | "output_truncated"
  | "invalid_result";

class IdentificationError extends Error {
  constructor(
    readonly code: IdentificationErrorCode,
    readonly retryable: boolean,
    message: string,
  ) {
    super(message);
    this.name = "IdentificationError";
  }
}

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

const qualityGateSchema = (groups: string[], locateSubject = false) => ({
  type: "object",
  properties: {
    ...(locateSubject ? { subject_box: {
      type: ["object", "null"],
      description: "가장 크게 선명하게 보이는 물고기 한 마리 전체의 경계. 위치가 불확실하면 null. 좌상단 원점, 이미지 폭/높이를 1로 정규화.",
      properties: Object.fromEntries(["x", "y", "width", "height", "confidence"].map(key => [key, { type: "number", minimum: 0, maximum: 1 }])),
      required: ["x", "y", "width", "height", "confidence"], additionalProperties: false,
    } } : {}),
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
    ...(locateSubject ? ["subject_box"] : []),
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
    observations: {
      type: "string",
      description: "주 피사체에서 실제 보이는 형태·무늬와 가려져 확인할 수 없는 특징. 종명 없이 먼저 기록합니다.",
    },
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
  required: ["observations", "candidates", "needs_retake", "note"],
  additionalProperties: false,
});

const callClaude = async ({
  apiKey,
  imageBase64,
  mimeType,
  prompt,
  schema,
  maxTokens,
  detailImageBase64,
}: {
  apiKey: string;
  imageBase64: string;
  mimeType: "image/jpeg" | "image/png";
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens: number;
  detailImageBase64?: string;
}) => {
  // 일시적 실패(429·5xx·네트워크)만 한 번 더 시도한다. 400이나 응답 파싱 실패처럼
  // 다시 보내도 같은 결과인 오류는 재시도하면 토큰만 두 배로 쓴다.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      let response: Response;
      try {
        response = await fetch("https://api.anthropic.com/v1/messages", {
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
                ...(detailImageBase64 ? [
                  { type: "image", source: { type: "base64", media_type: "image/jpeg", data: detailImageBase64 } },
                  { type: "text", text: "첫 사진은 전체 장면이고 두 번째는 같은 사진에서 주 피사체를 자른 확대 보기입니다. 같은 개체의 특징만 비교하세요. 확대는 새 디테일을 만들지 않습니다. 잘린 부위는 원본에서 확인하고, 확대 위치가 틀리면 원본을 기준으로 판단하세요." },
                ] : []),
                { type: "text", text: prompt },
              ],
            },
          ],
        }),
        });
      } catch (networkError) {
        throw new IdentificationError(
          "anthropic_unavailable",
          true,
          networkError instanceof Error ? networkError.message : "network error",
        );
      }

      const body = await response.json();
      if (!response.ok) {
        console.error("Anthropic request failed", response.status);
        const retryable = response.status === 429 || response.status >= 500;
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
        throw new IdentificationError(
          retryable ? "anthropic_unavailable" : "anthropic_rejected",
          retryable,
          `Anthropic request failed with ${response.status}` +
            `${apiMessage ? `: ${apiMessage.slice(0, 160)}` : ""}`,
        );
      }

      if (body.stop_reason === "max_tokens") {
        throw new IdentificationError("output_truncated", false, "Claude response exceeded output limit");
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
      if (!outputText) throw new IdentificationError("invalid_result", false, "Claude returned no result");
      try {
        return parseClaudeJson(outputText);
      } catch (parseError) {
        throw new IdentificationError(
          "invalid_result",
          false,
          parseError instanceof Error ? parseError.message : "unparseable result",
        );
      }
    } catch (error) {
      const retryable = error instanceof IdentificationError && error.retryable;
      if (attempt === 1 || !retryable) throw error;
    }
  }

  throw new IdentificationError("anthropic_unavailable", true, "Claude request failed");
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
  detailImageBase64,
}: {
  apiKey: string;
  imageBase64: string;
  mimeType: "image/jpeg" | "image/png";
  catalog: CatalogFish[];
  groupLabel: string;
  maxCandidates: number;
  detailImageBase64?: string;
}) => {
  const candidateCount = Math.min(maxCandidates, catalog.length);
  const result = await callClaude({
    apiKey,
    imageBase64,
    mimeType,
    maxTokens: 1200,
    detailImageBase64,
    schema: classificationSchema(candidateCount),
    prompt:
      `품질 검사를 통과한 사진을 ${groupLabel} 후보 안에서 판별합니다. ` +
      "아래 폐쇄형 후보 목록 밖의 종은 선택하지 마세요. 목록 순서는 가능성 순서가 아니므로 모든 항목을 동등하게 비교하세요. " +
      "먼저 화면에서 가장 크게 선명하게 보이는 주 피사체 하나의 관찰 특징을 observations에 종명 없이 기록하세요. 여러 마리가 겹치면 서로 다른 개체의 특징을 섞지 마세요. " +
      "사진의 회전·촬영 각도·좌우 반전을 고려하세요. 화면상의 좌우를 물고기의 해부학적 좌우로 간주하지 마세요. 눈이 몰린 방향을 확실히 판단할 수 없다면 좌안·우안을 근거로 종을 제외하지 마세요. " +
      "조명과 수중 환경 때문에 달라질 수 있는 색보다 입 크기·체형·지느러미·무늬 등 실제 관찰한 특징을 종합하세요. 작은 반점이나 꼬리 테두리가 안 보이는 것과 실제로 없는 것을 구분하세요. " +
      "체형과 몸의 두께, 입과 머리, 지느러미 또는 팔의 배치, 꼬리 또는 외투막, 무늬와 색을 종별 특징과 유사종 설명에 대조하세요. " +
      (EVIDENCE_COMPARISON_ENABLED ? (
      "응답은 간결하게 쓰세요. observations는 180자 이내, 각 reason은 80자 이내, note는 100자 이내로 작성하세요. " +
      "후보를 정하기 전에 가장 닮은 종들 사이의 구별점을 대조하세요. 각 구별점이 이 사진에서 실제 확인됨·가려짐·해상도 부족 중 어느 상태인지 observations에 짧게 명시하세요. 관찰되지 않는 구별점은 특정 종을 지지하거나 제외하는 근거가 아닙니다. " +
      "후보 reason에는 공통 특징만 나열하지 말고 해당 후보를 다른 유사종보다 앞 또는 뒤에 둔 관찰 근거와 아직 확인할 수 없는 핵심 특징을 함께 쓰세요. 위치·흔한 정도·목록 순서·전반적 인상만으로 우선순위를 정하지 마세요. 핵심 구별점이 보이지 않아 여러 종을 가를 수 없으면 confidence를 낮추고 note에 확인이 필요한 부위를 설명하세요. "
      ) : "") +
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

  const useAutoDetail = AUTO_DETAIL_ENABLED;
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

  const { data: quotaRows, error: quotaError } = await supabase.rpc(
    "consume_ai_identification_quota",
  );
  if (quotaError) {
    console.error("AI identification quota check failed", quotaError);
    return json(
      {
        error: "AI identification is temporarily unavailable.",
        error_code: "quota_check_failed",
      },
      503,
    );
  }
  const quota = (Array.isArray(quotaRows) ? quotaRows[0] : quotaRows) as
    | IdentificationQuota
    | null;
  if (!quota?.allowed) {
    return json(
      {
        error: "AI identification request limit reached.",
        error_code: "ai_identification_quota_exceeded",
        remaining: 0,
        reset_at: quota?.reset_at ?? null,
      },
      429,
    );
  }

  try {
    const groups = [...new Set(catalog.map((fish) => fish.group))].sort();
    const allowedGroups = new Set(groups);
    const qualityResult = await callClaude({
      apiKey: anthropicApiKey,
      imageBase64,
      mimeType,
      maxTokens: 700,
      schema: qualityGateSchema(groups, useAutoDetail),
      prompt:
        (useAutoDetail ? "주 피사체 한 마리의 머리부터 꼬리·지느러미 또는 팔 끝까지 포함하는 경계를 subject_box에 기록하세요. 여러 개체를 한 영역에 묶지 마세요. 위치 확신이 없으면 null입니다. " : "") +
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
        metadata: RECOGNITION_METADATA,
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
    const detailImageBase64 = useAutoDetail
      ? await createDetailImage(imageBase64, qualityResult.subject_box)
      : undefined;
    const primaryResult = await classifyCatalog({
      detailImageBase64,
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
    // Adjacent groups already participate in the same ranking above.
    // Do not replace ranked candidates with results from a restricted second call.
    const candidates = primaryResult.candidates;

    const needsRetake = candidates.length === 0;

    return json({
      metadata: RECOGNITION_METADATA,
      subject_present: gate.subjectPresent,
      subject_type: gate.subjectType,
      image_quality: gate.imageQuality,
      subject_size: gate.subjectSize,
      quality_issues: gate.qualityIssues,
      evaluated_groups: evaluatedGroups,
      candidates: needsRetake ? [] : candidates,
      needs_retake: needsRetake,
      note: primaryResult.note ?? gate.note,
      quota: {
        remaining: quota.remaining,
        reset_at: quota.reset_at,
      },
    });
  } catch (error) {
    console.error("Fish identification failed", error);
    return json(
      {
        error: "AI identification is temporarily unavailable.",
        metadata: RECOGNITION_METADATA,
        error_code: error instanceof IdentificationError ? error.code : "identification_failed",
      },
      502,
    );
  }
});
