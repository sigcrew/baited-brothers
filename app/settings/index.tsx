import { useRouter } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import {
  SettingsLinkRow,
  SettingsScaffold,
} from "@/components/settings/SettingsScaffold";
import { FIELD_COLORS } from "@/src/theme/fieldJournal";

export default function SettingsScreen() {
  const router = useRouter();
  const { session } = useAuth();

  return (
    <SettingsScaffold
      eyebrow="ACCOUNT & APP"
      title="설정"
      description="프로필과 알림, 개인정보 설정을 관리합니다."
    >
      <SettingsLinkRow
        icon="user-o"
        label="프로필 수정"
        value={session?.user.email ?? "로그인이 필요합니다"}
        onPress={() => router.push("/settings/profile")}
      />
      <SettingsLinkRow
        icon="bell-o"
        label="알림 설정"
        onPress={() => router.push("/settings/notifications")}
      />
      <SettingsLinkRow
        icon="shield"
        label="개인정보 처리방침"
        onPress={() => router.push("/privacy")}
      />
      {session ? (
        <SettingsLinkRow
          icon="user-times"
          label="계정 탈퇴"
          color={FIELD_COLORS.red}
          onPress={() => router.push("/account/delete")}
        />
      ) : null}
    </SettingsScaffold>
  );
}
