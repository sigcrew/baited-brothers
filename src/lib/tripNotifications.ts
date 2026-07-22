import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const NOTIFICATION_PREFERENCES_KEY = "baited-brothers:notification-preferences";
const TRIP_NOTIFICATION_IDS_KEY = "baited-brothers:trip-notification-ids";

export type NotificationPreferences = {
  tripReminder: boolean;
  collectionUpdate: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  tripReminder: true,
  collectionUpdate: true,
};

export type TripReminderInput = {
  id: string;
  spotName: string;
  scheduledAt: string | Date;
};

type NotificationIdMap = Record<string, string>;

const readNotificationIds = async (): Promise<NotificationIdMap> => {
  try {
    const stored = await AsyncStorage.getItem(TRIP_NOTIFICATION_IDS_KEY);
    return stored ? JSON.parse(stored) as NotificationIdMap : {};
  } catch {
    return {};
  }
};

const writeNotificationIds = (ids: NotificationIdMap) =>
  AsyncStorage.setItem(TRIP_NOTIFICATION_IDS_KEY, JSON.stringify(ids));

export const getNotificationPreferences = async () => {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_PREFERENCES_KEY);
    return stored
      ? { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(stored) } as NotificationPreferences
      : DEFAULT_NOTIFICATION_PREFERENCES;
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
};

export const saveNotificationPreferences = (preferences: NotificationPreferences) =>
  AsyncStorage.setItem(NOTIFICATION_PREFERENCES_KEY, JSON.stringify(preferences));

const notificationPermissionGranted = async (requestIfNeeded: boolean) => {
  if (Platform.OS === "web") return false;
  let permission = await Notifications.getPermissionsAsync();
  const isAllowed = () => permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!isAllowed() && requestIfNeeded && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
  }
  return isAllowed();
};

export const cancelTripReminder = async (tripId: string) => {
  if (Platform.OS === "web") return;
  const ids = await readNotificationIds();
  const notificationId = ids[tripId];
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
  delete ids[tripId];
  await writeNotificationIds(ids);
};

export const cancelAllTripReminders = async () => {
  if (Platform.OS === "web") return;
  const ids = await readNotificationIds();
  await Promise.all(
    Object.values(ids).map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)),
  );
  await writeNotificationIds({});
};

export const scheduleTripReminder = async (
  trip: TripReminderInput,
  requestPermission = true,
) => {
  const preferences = await getNotificationPreferences();
  if (!preferences.tripReminder || Platform.OS === "web") return false;
  if (!await notificationPermissionGranted(requestPermission)) return false;

  await cancelTripReminder(trip.id);
  const tripAt = new Date(trip.scheduledAt);
  const threeHoursBefore = tripAt.getTime() - 3 * 60 * 60 * 1_000;
  const fifteenMinutesBefore = tripAt.getTime() - 15 * 60 * 1_000;
  const triggerAt = threeHoursBefore > Date.now() + 60_000
    ? threeHoursBefore
    : fifteenMinutesBefore;
  if (Number.isNaN(tripAt.getTime()) || triggerAt <= Date.now() + 60_000) return false;

  const identifier = await Notifications.scheduleNotificationAsync({
    identifier: `trip-reminder:${trip.id}`,
    content: {
      title: "곧 출조할 시간입니다",
      body: `${trip.spotName} 출조 준비물과 현지 날씨를 확인해 보세요.`,
      sound: "default",
      data: { tripId: trip.id, url: `/trips/${trip.id}` },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(triggerAt),
    },
  });
  const ids = await readNotificationIds();
  ids[trip.id] = identifier;
  await writeNotificationIds(ids);
  return true;
};

export const syncTripReminders = async (
  trips: TripReminderInput[],
  requestPermission = false,
) => {
  const preferences = await getNotificationPreferences();
  if (!preferences.tripReminder) {
    await cancelAllTripReminders();
    return;
  }
  if (!await notificationPermissionGranted(requestPermission)) return;

  const ids = await readNotificationIds();
  const activeIds = new Set(trips.map((trip) => trip.id));
  await Promise.all(
    Object.entries(ids)
      .filter(([tripId]) => !activeIds.has(tripId))
      .map(([, notificationId]) =>
        Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined)),
  );
  const nextIds = Object.fromEntries(
    Object.entries(ids).filter(([tripId]) => activeIds.has(tripId)),
  );
  await writeNotificationIds(nextIds);

  for (const trip of trips) await scheduleTripReminder(trip, false);
};

export const configureNotificationPresentation = () => {
  if (Platform.OS === "web") return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
};
