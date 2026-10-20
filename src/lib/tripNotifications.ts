import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

export const NOTIFICATION_PREFERENCES_KEY = "baited-brothers:notification-preferences";
/** 구버전이 알림 id를 저장하던 키. 첫 동기화 때 정리하고 더는 쓰지 않는다. */
const LEGACY_TRIP_NOTIFICATION_IDS_KEY = "baited-brothers:trip-notification-ids";
const TRIP_REMINDER_PREFIX = "trip-reminder:";

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

/**
 * 알림 identifier는 출조 id에서 결정적으로 만든다. 그래서 별도 id 맵이 필요 없고,
 * 어느 화면에서 취소하든 같은 identifier를 지우면 된다. (예전에는 AsyncStorage 맵을
 * 락 없이 읽고 써서 동시 sync가 서로의 기록을 덮어쓰고, 삭제된 출조의 알림이
 * 남는 문제가 있었다.)
 */
export const tripReminderIdentifier = (tripId: string) =>
  `${TRIP_REMINDER_PREFIX}${tripId}`;

const tripIdFromIdentifier = (identifier: string) =>
  identifier.startsWith(TRIP_REMINDER_PREFIX)
    ? identifier.slice(TRIP_REMINDER_PREFIX.length)
    : null;

/**
 * 출조 알림 트리거 시각. 3시간 전이 아직 1분 이상 남았으면 3시간 전, 아니면 15분 전.
 * 둘 다 지났거나 날짜가 잘못됐으면 null.
 */
export const resolveTripReminderTriggerAt = (
  scheduledAt: string | Date,
  now = Date.now(),
) => {
  const tripAt = new Date(scheduledAt).getTime();
  if (Number.isNaN(tripAt)) return null;
  const threeHoursBefore = tripAt - 3 * 60 * 60 * 1_000;
  const fifteenMinutesBefore = tripAt - 15 * 60 * 1_000;
  const triggerAt = threeHoursBefore > now + 60_000 ? threeHoursBefore : fifteenMinutesBefore;
  return triggerAt <= now + 60_000 ? null : triggerAt;
};

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

const cancelNotification = (identifier: string) =>
  Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined);

const listScheduledTripReminderIds = async () => {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync().catch(
    () => [] as Notifications.NotificationRequest[],
  );
  return scheduled
    .map((request) => request.identifier)
    .filter((identifier) => tripIdFromIdentifier(identifier) !== null);
};

/** 구버전 id 맵에 남은 알림을 한 번 지우고 키를 제거한다. 실패해도 무시. */
const cancelLegacyTripReminders = async () => {
  try {
    const stored = await AsyncStorage.getItem(LEGACY_TRIP_NOTIFICATION_IDS_KEY);
    if (!stored) return;
    const ids = JSON.parse(stored) as Record<string, string>;
    await Promise.all(Object.values(ids).map(cancelNotification));
    await AsyncStorage.removeItem(LEGACY_TRIP_NOTIFICATION_IDS_KEY);
  } catch {
    // 레거시 정리는 best effort.
  }
};

export const cancelTripReminder = async (tripId: string) => {
  if (Platform.OS === "web") return;
  await cancelNotification(tripReminderIdentifier(tripId));
};

export const cancelAllTripReminders = async () => {
  if (Platform.OS === "web") return;
  const identifiers = await listScheduledTripReminderIds();
  await Promise.all(identifiers.map(cancelNotification));
  await cancelLegacyTripReminders();
};

export const scheduleTripReminder = async (
  trip: TripReminderInput,
  requestPermission = true,
) => {
  const preferences = await getNotificationPreferences();
  if (!preferences.tripReminder || Platform.OS === "web") return false;
  if (!await notificationPermissionGranted(requestPermission)) return false;

  const identifier = tripReminderIdentifier(trip.id);
  const triggerAt = resolveTripReminderTriggerAt(trip.scheduledAt);
  if (triggerAt === null) {
    // 이미 지난 출조: 남아 있을 수 있는 예약만 지운다.
    await cancelNotification(identifier);
    return false;
  }

  // 같은 identifier로 다시 예약하면 OS가 기존 요청을 교체하지만, 플랫폼 차이를
  // 피하려고 명시적으로 먼저 지운다.
  await cancelNotification(identifier);
  await Notifications.scheduleNotificationAsync({
    identifier,
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
  return true;
};

let syncTail: Promise<void> = Promise.resolve();

/**
 * 예정 출조 목록과 OS 예약을 맞춘다. 여러 화면이 동시에 불러도 한 번에 하나씩
 * 실행되도록 직렬화한다.
 */
export const syncTripReminders = (
  trips: TripReminderInput[],
  requestPermission = false,
) => {
  const run = syncTail.then(async () => {
    if (Platform.OS === "web") return;
    const preferences = await getNotificationPreferences();
    if (!preferences.tripReminder) {
      await cancelAllTripReminders();
      return;
    }
    if (!await notificationPermissionGranted(requestPermission)) return;

    await cancelLegacyTripReminders();
    const activeIds = new Set(trips.map((trip) => trip.id));
    const scheduledIds = await listScheduledTripReminderIds();
    await Promise.all(
      scheduledIds
        .filter((identifier) => !activeIds.has(tripIdFromIdentifier(identifier) ?? ""))
        .map(cancelNotification),
    );

    for (const trip of trips) await scheduleTripReminder(trip, false);
  });
  syncTail = run.catch(() => undefined);
  return run;
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
