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

export const trackAnalyticsEvent = async (
  eventName: AnalyticsEventName,
  properties: AnalyticsProperties = {},
) => {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user.id) return false;

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
