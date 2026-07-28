import Constants from "expo-constants";
import { Platform } from "react-native";

import { supabase } from "@/src/lib/supabase";
import type { Json, TablesInsert } from "@/src/types/database";
import {
  sanitizeAnalyticsProperties,
  type AnalyticsEventName,
  type AnalyticsProperties,
} from "@/src/lib/analyticsPolicy";
const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
const analyticsExclusionCache = new Map<string, boolean>();

const isAnalyticsExcluded = async (userId: string) => {
  const cached = analyticsExclusionCache.get(userId);
  if (cached != null) return cached;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("analytics_excluded")
    .eq("id", userId)
    .maybeSingle();

  // Delivery remains best-effort while a migration is rolling out or the
  // profile row is temporarily unavailable. The database insert policy is the
  // final enforcement layer for excluded accounts.
  if (error) return false;

  const excluded = data?.analytics_excluded === true;
  analyticsExclusionCache.set(userId, excluded);
  return excluded;
};

export const trackAnalyticsEvent = async (
  eventName: AnalyticsEventName,
  properties: AnalyticsProperties = {},
) => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user.id) return false;
    if (await isAnalyticsExcluded(session.user.id)) return false;

    const payload: TablesInsert<"analytics_events"> = {
      user_id: session.user.id,
      session_id: sessionId,
      event_name: eventName,
      properties: sanitizeAnalyticsProperties(properties) as Json,
      app_version: Constants.expoConfig?.version ?? "unknown",
      build_number:
        Constants.expoConfig?.ios?.buildNumber ??
        Constants.expoConfig?.android?.versionCode?.toString() ??
        null,
      platform: Platform.OS,
    };

    const { error } = await supabase.from("analytics_events").insert(payload);
    if (error) throw error;
    return true;
  } catch (error) {
    if (__DEV__) {
      console.warn("[analytics] event delivery failed", eventName, error);
    }
    return false;
  }
};
