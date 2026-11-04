export const ANALYTICS_EVENT_NAMES = [
  "app_opened",
  "collection_viewed",
  "fish_detail_viewed",
  "catch_card_opened",
  "share_card_previewed",
  "share_card_location_changed",
  "share_sheet_opened",
  "share_card_failed",
  "catch_flow_started",
  "location_choice_selected",
  "camera_opened",
  "photo_captured",
  "analysis_result_viewed",
  "catch_save_started",
  "catch_save_succeeded",
  "catch_save_failed",
  "photo_upload_failed",
  "photo_library_save_succeeded",
  "photo_library_save_failed",
  "permission_prompted",
  "permission_result",
  "ai_analysis_started",
  "ai_analysis_succeeded",
  "ai_analysis_rejected",
  "ai_analysis_failed",
  "ai_candidate_confirmed",
  "manual_species_confirmed",
  "catch_created",
  "catch_updated",
  "catch_deleted",
  "trip_created",
  "trip_updated",
  "trip_completed",
  "trip_canceled",
  "trip_deleted",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];
export type AnalyticsPropertyValue = string | number | boolean | null;
export type AnalyticsProperties = Record<string, AnalyticsPropertyValue | undefined>;

const MAX_PROPERTY_STRING_LENGTH = 120;
const MAX_PROPERTIES_BYTES = 4096;
const BLOCKED_PROPERTY_KEY =
  /(email|photo|image|base64|latitude|longitude|location|memo|token|authorization|address)/i;

export const sanitizeAnalyticsProperties = (
  properties: AnalyticsProperties = {},
): Record<string, AnalyticsPropertyValue> => {
  const sanitized: Record<string, AnalyticsPropertyValue> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (value === undefined || BLOCKED_PROPERTY_KEY.test(key)) continue;
    sanitized[key] =
      typeof value === "string"
        ? value.slice(0, MAX_PROPERTY_STRING_LENGTH)
        : value;
  }

  if (new TextEncoder().encode(JSON.stringify(sanitized)).length > MAX_PROPERTIES_BYTES) {
    return {};
  }

  return sanitized;
};

type FailureLike = {
  name?: unknown;
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
  context?: { status?: unknown } | null;
};

/**
 * 실패 이벤트에 붙이는 진단 정보. 오류 메시지 원문은 사용자 정보가 섞일 수 있어
 * 오류 종류, 코드, HTTP 상태만 남긴다.
 */
export const failureDiagnostics = (
  error: unknown,
): Record<"error_name" | "error_code" | "http_status", AnalyticsPropertyValue> => {
  const failure = (error && typeof error === "object" ? error : {}) as FailureLike;
  const rawStatus = failure.status ?? failure.statusCode ?? failure.context?.status;
  const status = typeof rawStatus === "string" ? Number(rawStatus) : rawStatus;
  return {
    error_name: typeof failure.name === "string" ? failure.name.slice(0, 40) : null,
    error_code:
      typeof failure.code === "string" || typeof failure.code === "number"
        ? String(failure.code).slice(0, 40)
        : null,
    http_status: typeof status === "number" && Number.isFinite(status) ? status : null,
  };
};
