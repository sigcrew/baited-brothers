import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

import { configureNotificationPresentation } from "@/src/lib/tripNotifications";

configureNotificationPresentation();

export const NotificationLifecycle = () => {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === "web") return;
    const openTrip = (response: Notifications.NotificationResponse) => {
      const tripId = response.notification.request.content.data?.tripId;
      if (typeof tripId === "string") {
        router.push({ pathname: "/trips/[id]", params: { id: tripId } });
        Notifications.clearLastNotificationResponse();
      }
    };
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) openTrip(lastResponse);
    const subscription = Notifications.addNotificationResponseReceivedListener(openTrip);
    return () => subscription.remove();
  }, [router]);

  return null;
};
