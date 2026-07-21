export const ANALYTICS_EVENT_NAMES = [
  "app_opened",
  "collection_viewed",
  "fish_detail_viewed",
  "catch_card_opened",
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
