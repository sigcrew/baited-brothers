import { useEffect, useState } from "react";
import { Switch, Text, View } from "react-native";
import { SettingsScaffold } from "@/components/settings/SettingsScaffold";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
} from "@/src/theme/fieldJournal";
import { useFishingTrips } from "@/src/hooks/useFishingTrips";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  cancelAllTripReminders,
  getNotificationPreferences,
  saveNotificationPreferences,
  syncTripReminders,
  type NotificationPreferences,
} from "@/src/lib/tripNotifications";

const PreferenceRow = ({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) => (
  <View
    className="flex-row items-center border-b py-5"
    style={{ borderColor: FIELD_COLORS.rule }}
  >
    <View className="min-w-0 flex-1 pr-5">
      <Text
        className="text-base"
        style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
      >
        {title}
      </Text>
      <Text
        className="mt-2 text-xs leading-5"
        style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
      >
        {description}
      </Text>
    </View>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: FIELD_COLORS.locked, true: FIELD_COLORS.teal }}
      thumbColor="#FFFFFF"
    />
  </View>
);

export default function NotificationSettingsScreen() {
  const [preferences, setPreferences] = useState(DEFAULT_NOTIFICATION_PREFERENCES);
  const { plannedTrips } = useFishingTrips();

  useEffect(() => {
    void getNotificationPreferences().then(setPreferences);
  }, []);

  const update = (key: keyof NotificationPreferences, value: boolean) => {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    void saveNotificationPreferences(next).then(() => {
      if (key === "tripReminder") {
        if (value) {
          void syncTripReminders(plannedTrips.map((trip) => ({
            id: trip.id,
            spotName: trip.spot_name,
            scheduledAt: trip.scheduled_at,
          })), true);
        } else {
          void cancelAllTripReminders();
        }
      }
    });
  };

  return (
    <SettingsScaffold
      eyebrow="NOTIFICATION PREFS"
      title="알림 설정"
      description="이 기기에서 받을 앱 알림의 종류를 선택합니다."
    >
      <PreferenceRow
        title="출조 일정 알림"
        description="예정된 출조를 놓치지 않도록 알림을 받을 수 있게 설정합니다."
        value={preferences.tripReminder}
        onChange={(value) => update("tripReminder", value)}
      />
      <PreferenceRow
        title="수집 기록 알림"
        description="새 어종과 배지를 획득했을 때 알림을 받을 수 있게 설정합니다."
        value={preferences.collectionUpdate}
        onChange={(value) => update("collectionUpdate", value)}
      />
      <Text
        className="mt-5 text-xs leading-5"
        style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
      >
        알림 허용 여부는 iPhone 설정에서도 변경할 수 있습니다. 실제 알림 전송은
        배포 빌드의 알림 권한과 연동됩니다. 출조 3시간 전에 알림을 보내며,
        임박한 일정은 15분 전에 알려드립니다.
      </Text>
    </SettingsScaffold>
  );
}
