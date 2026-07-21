import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/src/contexts/AuthContext";
import { trackAnalyticsEvent } from "@/src/lib/analytics";

const NEW_VISIT_AFTER_MS = 30 * 60 * 1000;

export const AnalyticsLifecycle = () => {
  const { session, isLoading } = useAuth();
  const lastTrackedAt = useRef(0);

  const trackVisit = useCallback(() => {
    if (isLoading || !session?.user.id) return;
    const now = Date.now();
    if (now - lastTrackedAt.current < NEW_VISIT_AFTER_MS) return;
    lastTrackedAt.current = now;
    void trackAnalyticsEvent("app_opened");
  }, [isLoading, session?.user.id]);

  useEffect(() => {
    trackVisit();
  }, [trackVisit]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") trackVisit();
    });
    return () => subscription.remove();
  }, [trackVisit]);

  return null;
};
