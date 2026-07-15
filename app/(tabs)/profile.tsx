import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Alert, Image, ScrollView, Text, View, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/contexts/AuthContext";
import { useUserCatches } from "@/src/hooks/useUserCatches";
import { useFishingTrips } from "@/src/hooks/useFishingTrips";
import { ArchiveRule } from "@/components/design/ArchiveRule";
import { ArchiveTabHeader } from "@/components/design/ArchiveTabHeader";
import { FIELD_COLORS, bodySemiBoldFont, monoFont } from "@/src/theme/fieldJournal";

const HARBOR_IMAGE = require("@/assets/images/design/daecheon-harbor.png");
const PROFILE_IMAGE = require("@/assets/images/design/profile-angler.png");

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

const ProfileScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { catches, unlockedFishIds } = useUserCatches();
  const { trips } = useFishingTrips();

  const email = session?.user?.email;
  const displayName =
    session?.user?.user_metadata?.display_name ??
    session?.user?.user_metadata?.full_name ??
    null;

  const handleSignOut = () => Alert.alert("로그아웃", "현재 계정에서 로그아웃할까요?", [{ text: "취소", style: "cancel" }, { text: "로그아웃", style: "destructive", onPress: async () => { await signOut(); router.replace("/(auth)/login"); } }]);

  const handleGoLogin = () => {
    router.push("/(auth)/login");
  };

  const doneTrips = trips.filter((trip) => trip.status === "done").length;
  const name = displayName ?? email?.split("@")[0] ?? "바다형제";

  return <ScrollView className="flex-1" style={{ paddingTop: insets.top, backgroundColor: FIELD_COLORS.foam }} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
    <ArchiveTabHeader title="프로필" actionLabel="설정" backgroundColor={FIELD_COLORS.foam} />
    <View className="px-7">
      <View className="flex-row items-center py-7">
        <Image
          source={PROFILE_IMAGE}
          resizeMode="cover"
          style={{ width: 96, height: 96, borderRadius: 48 }}
        />
        <View className="ml-5 flex-1"><Text className="text-2xl font-black" style={{ color: FIELD_COLORS.ink }}>{name}</Text><Text className="mt-1 text-sm" style={{ color: FIELD_COLORS.ink, fontFamily: monoFont }}>@{email?.split("@")[0] ?? "baited_brother"}</Text><Text className="mt-3 text-[11px] tracking-[2px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>LOG OWNER 019</Text></View>
      </View>
      <ArchiveRule />
      <View className="flex-row py-5">{[["수집 어종", unlockedFishIds.size], ["조과 기록", catches.length], ["완료 출조", doneTrips]].map(([label, value], index) => <View key={String(label)} className={`flex-1 items-center ${index ? "border-l" : ""}`} style={{ borderColor: FIELD_COLORS.rule }}><Text className="text-sm font-semibold" style={{ color: FIELD_COLORS.ink }}>{label}</Text><Text className="mt-1 text-[40px] font-black" style={{ color: FIELD_COLORS.ink }}>{value}</Text></View>)}</View>
      <ArchiveRule />
      <Text className="mb-1 mt-6 text-xl font-black" style={{ color: FIELD_COLORS.ink }}>나의 기록</Text>
      <ProfileRow icon="address-card-o" label="내 조과 카드" />
      <ProfileRow icon="calendar-check-o" label="완료한 출조" onPress={() => router.push("/(tabs)/journal")} />
      <ProfileRow icon="map-marker" label="저장한 장소" />
      <Text className="mb-1 mt-7 text-xl font-black" style={{ color: FIELD_COLORS.ink }}>계정</Text>
      <ProfileRow icon="user-o" label="프로필 수정" />
      <ProfileRow icon="bell-o" label="알림 설정" />
      {session ? <ProfileRow icon="sign-out" label="로그아웃" color={FIELD_COLORS.orange} onPress={handleSignOut} /> : <ProfileRow icon="sign-in" label="로그인" color={FIELD_COLORS.teal} onPress={handleGoLogin} />}
      <Text className="mt-8 text-[11px] tracking-[1.5px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>LAST FIELD NOTE · 2026.07.06 · 대천항</Text>
      <View className="mt-3 overflow-hidden rounded-lg">
        <Image
          source={HARBOR_IMAGE}
          resizeMode="cover"
          style={{ width: "100%", height: 128 }}
        />
      </View>
    </View>
  </ScrollView>;
};

export default ProfileScreen;
