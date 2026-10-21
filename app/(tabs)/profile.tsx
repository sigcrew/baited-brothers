import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Image, ScrollView, Text, View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/contexts/AuthContext";
import { useUserCatches } from "@/src/hooks/useUserCatches";
import { useFishingTrips } from "@/src/hooks/useFishingTrips";
import { useUserAvatar } from "@/src/hooks/useUserAvatar";
import { useFieldNotice } from "@/src/contexts/FieldNoticeContext";
import { ArchiveRule } from "@/components/design/ArchiveRule";
import { ArchiveTabHeader } from "@/components/design/ArchiveTabHeader";
import {
  BADGE_CATALOG,
  createBadgeUnlockContext,
  isBadgeUnlocked,
} from "@/src/data/badges";
import { formatMemberSince, pickDisplayName } from "@/src/lib/userProfile";
import { FIELD_COLORS, bodyExtraBoldFont, bodyFont, bodySemiBoldFont, monoFont } from "@/src/theme/fieldJournal";

const PROFILE_IMAGE = require("@/assets/images/adaptive-icon-baited.png");

const ProfileRow = ({ icon, label, color = FIELD_COLORS.ink, onPress }: { icon: React.ComponentProps<typeof FontAwesome>["name"]; label: string; color?: string; onPress?: () => void }) => (
  <TouchableOpacity onPress={onPress} disabled={!onPress} className="flex-row items-center border-b px-3 py-4" style={{ borderColor: FIELD_COLORS.rule }}>
    <View className="h-7 w-9 items-center justify-center">
      <FontAwesome name={icon} size={22} color={color} style={{ transform: [{ translateY: -1 }] }} />
    </View>
    <Text className="flex-1 text-[16px] leading-6" style={{ color, fontFamily: bodySemiBoldFont }}>{label}</Text>
    <View className="h-7 w-7 items-center justify-center">
      <FontAwesome name="long-arrow-right" size={21} color={color} style={{ transform: [{ translateY: -1 }] }} />
    </View>
  </TouchableOpacity>
);

/** 게스트에게 보여 주는 로그인 안내. 가짜 이름·통계 대신 왜 로그인하는지 말한다. */
const GuestLoginCard = ({ onLogin, onSignUp }: { onLogin: () => void; onSignUp: () => void }) => (
  <View className="my-6 border bg-white px-5 py-5" style={{ borderColor: FIELD_COLORS.rule }}>
    <Text className="text-[11px] tracking-[2px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>GUEST · 둘러보는 중</Text>
    <Text className="mt-2 text-xl" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>로그인하면 기록이 한 계정에 모입니다</Text>
    <Text className="mt-2 text-sm leading-6" style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont }}>
      출조 계획, 현장 조과, 도감과 배지는 계정에 저장됩니다. 지도의 수온·물때도 로그인 후 볼 수 있습니다.
    </Text>
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel="로그인"
      onPress={onLogin}
      className="mt-4 flex-row items-center justify-center py-3"
      style={{ backgroundColor: FIELD_COLORS.teal }}
    >
      <FontAwesome name="sign-in" size={16} color="#FFFFFF" />
      <Text className="ml-2 text-[15px] text-white" style={{ fontFamily: bodyExtraBoldFont }}>로그인</Text>
    </TouchableOpacity>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="회원가입" onPress={onSignUp} className="mt-3 items-center">
      <Text className="text-[13px]" style={{ color: FIELD_COLORS.teal, fontFamily: bodySemiBoldFont }}>아직 계정이 없다면 회원가입</Text>
    </TouchableOpacity>
  </View>
);

const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { catches, unlockedFishIds, generalRecordCount } = useUserCatches();
  const { trips } = useFishingTrips();
  const avatarUrl = useUserAvatar();
  const { confirm } = useFieldNotice();

  const email = session?.user?.email;
  const displayName = pickDisplayName(
    session?.user?.user_metadata?.display_name,
    session?.user?.user_metadata?.full_name,
  );
  const handleSignOut = async () => {
    const confirmed = await confirm({
      eyebrow: "ACCOUNT · SIGN OUT",
      title: "로그아웃할까요?",
      message: "현재 계정의 기록 동기화를 종료하고 로그인 화면으로 이동합니다.",
      confirmLabel: "로그아웃",
      cancelLabel: "취소",
      destructive: true,
    });
    if (!confirmed) return;
    await signOut();
    router.replace("/(auth)/login");
  };

  const handleGoLogin = () => {
    router.push("/(auth)/login");
  };

  const badgeContext = createBadgeUnlockContext(catches, trips);
  const acquiredBadgeCount = BADGE_CATALOG.filter((badge) =>
    isBadgeUnlocked(badge.id, badgeContext)
  ).length;
  const name = displayName ?? pickDisplayName(email?.split("@")[0]) ?? "바다형제";
  const memberSince = formatMemberSince(session?.user?.created_at);
  const profileStats = [
    { label: "수집 어종", value: unlockedFishIds.size, segment: "encyclopedia" },
    { label: "획득 배지", value: acquiredBadgeCount, segment: "badges" },
    { label: "조과 카드", value: catches.length, segment: "cards" },
  ] as const;

  return <ScrollView showsVerticalScrollIndicator={false} className="flex-1" style={{ paddingTop: insets.top, backgroundColor: FIELD_COLORS.foam }} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
    <ArchiveTabHeader
      title="프로필"
      backgroundColor={FIELD_COLORS.foam}
    />
    <View className="px-7">
      {session ? (
        <View className="flex-row items-center py-7">
          <Image
            source={avatarUrl ? { uri: avatarUrl } : PROFILE_IMAGE}
            resizeMode="cover"
            style={{ width: 96, height: 96, borderRadius: 48 }}
          />
          <View className="ml-5 flex-1">
            <Text className="text-2xl font-black" style={{ color: FIELD_COLORS.ink }}>{name}</Text>
            {email ? (
              <Text className="mt-1 text-sm" style={{ color: FIELD_COLORS.ink, fontFamily: monoFont }}>@{email.split("@")[0]}</Text>
            ) : null}
            {memberSince ? (
              <Text className="mt-3 text-[11px] tracking-[2px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>{memberSince}</Text>
            ) : null}
          </View>
        </View>
      ) : (
        <GuestLoginCard onLogin={handleGoLogin} onSignUp={() => router.push("/(auth)/signup")} />
      )}
      <ArchiveRule />
      {session ? (
      <View className="flex-row py-5">
        {profileStats.map(({ label, value, segment }, index) => (
          <TouchableOpacity
            key={label}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${value}, 수집 화면에서 보기`}
            className={`flex-1 items-center ${index ? "border-l" : ""}`}
            style={{ borderColor: FIELD_COLORS.rule }}
            onPress={() =>
              router.push({
                pathname: "/(tabs)/encyclopedia",
                params: { segment },
              })
            }
          >
            <Text className="text-sm font-semibold" style={{ color: FIELD_COLORS.ink }}>{label}</Text>
            <Text className="mt-1 text-[40px] font-black" style={{ color: FIELD_COLORS.ink }}>{value}</Text>
          </TouchableOpacity>
        ))}
      </View>
      ) : null}
      {session && generalRecordCount > 0 ? (
        <Text className="mb-4 text-[11px] leading-4" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
          위치가 확인된 조과만 수집 어종과 배지에 반영됩니다 · 일반 기록 {generalRecordCount}건은 조과 카드에만 남아 있어요
        </Text>
      ) : null}
      {session ? <ArchiveRule /> : null}
      {session ? (
      <>
      <Text className="mb-1 mt-6 text-xl font-black" style={{ color: FIELD_COLORS.ink }}>나의 기록</Text>
      <ProfileRow
        icon="address-card-o"
        label="내 조과 카드"
        onPress={() =>
          router.push({
            pathname: "/(tabs)/encyclopedia",
            params: { segment: "cards" },
          })
        }
      />
      <ProfileRow icon="calendar-check-o" label="완료한 출조" onPress={() => router.push("/(tabs)/journal")} />
      <ProfileRow icon="map-marker" label="저장한 장소" onPress={() => router.push("/places")} />
      </>
      ) : null}
      <Text className="mb-1 mt-7 text-xl font-black" style={{ color: FIELD_COLORS.ink }}>{session ? "계정" : "앱 정보"}</Text>
      {session ? (
        <>
          <ProfileRow icon="user-o" label="프로필 수정" onPress={() => router.push("/settings/profile")} />
          <ProfileRow icon="bell-o" label="알림 설정" onPress={() => router.push("/settings/notifications")} />
          <ProfileRow icon="picture-o" label="사진 제공 관리" onPress={() => router.push("/settings/photo-contributions" as never)} />
        </>
      ) : null}
      <ProfileRow icon="shield" label="개인정보 처리방침" onPress={() => router.push("/privacy")} />
      {session ? <ProfileRow icon="sign-out" label="로그아웃" color={FIELD_COLORS.orange} onPress={() => void handleSignOut()} /> : null}
      {session ? <ProfileRow icon="user-times" label="계정 탈퇴" color={FIELD_COLORS.red} onPress={() => router.push("/account/delete")} /> : null}
    </View>
  </ScrollView>;
};

export default ProfileScreen;
