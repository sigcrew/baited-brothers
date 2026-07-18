import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  ImageBackground,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  useFishingTrips,
  type UpdateTripInput,
} from "@/src/hooks/useFishingTrips";
import { useUserCatches } from "@/src/hooks/useUserCatches";
import { useImageContrast } from "@/src/hooks/useImageContrast";
import { ArchiveTabHeader } from "@/components/design/ArchiveTabHeader";
import { TripCoverActionSheet } from "@/components/trips/TripCoverActionSheet";
import { TripFormModal } from "@/components/trips/TripFormModal";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodySemiBoldFont,
  dateKoreanFont,
  dateNumberFont,
  displayFont,
  monoFont,
} from "@/src/theme/fieldJournal";

const DEFAULT_HERO_IMAGE = require("@/assets/images/design/first-trip-cover-v1.png");

const formatTripDate = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleString("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [addVisible, setAddVisible] = useState(false);
  const [coverActionsVisible, setCoverActionsVisible] = useState(false);
  const {
    trips,
    plannedTrips,
    recentDoneTrips,
    isLoading,
    isRefreshing,
    isSaving,
    error,
    isLoggedIn,
    refetch,
    createTrip,
    updateTripCover,
    removeTripCover,
  } = useFishingTrips();
  const { catches } = useUserCatches();

  const handleCreate = async (input: UpdateTripInput) => {
    const { error: createError } = await createTrip(input);
    return createError;
  };

  const nextTrip = plannedTrips[0];
  const latestDoneTrip = recentDoneTrips[0];
  const hasTripHistory = Boolean(latestDoneTrip);
  const heroSource = nextTrip?.cover_image_url
    ? { uri: nextTrip.cover_image_url }
    : latestDoneTrip?.cover_image_url
      ? { uri: latestDoneTrip.cover_image_url }
      : DEFAULT_HERO_IMAGE;
  const isDarkHero = useImageContrast(heroSource);
  const heroTextColor = isDarkHero ? FIELD_COLORS.paper : FIELD_COLORS.ink;
  const heroRuleColor = isDarkHero ? "rgba(255,255,255,0.72)" : FIELD_COLORS.rule;
  const nextDate = nextTrip ? new Date(nextTrip.scheduled_at) : null;
  const dateMonth = nextDate ? String(nextDate.getMonth() + 1) : "";
  const dateDay = nextDate ? String(nextDate.getDate()) : "";
  const dateWeekday = nextDate
    ? new Intl.DateTimeFormat("ko-KR", { weekday: "long" }).format(nextDate)
    : "";
  const daysAway = nextDate
    ? Math.max(0, Math.ceil((nextDate.getTime() - Date.now()) / 86400000))
    : 0;
  const handleRecord = () => isLoggedIn ? router.push("/record") : router.push("/(auth)/login");
  const handleAddTrip = () => isLoggedIn ? setAddVisible(true) : router.push("/(auth)/login");
  const handleChangeCover = () => {
    if (!nextTrip || isSaving) return;
    setCoverActionsVisible(true);
  };

  return (
    <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: FIELD_COLORS.foam }}>
      <ScrollView refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refetch} tintColor={FIELD_COLORS.teal} />}>
        <ImageBackground
          source={heroSource}
          resizeMode="cover"
          style={{ width: "100%", height: 650 }}
        >
          <ArchiveTabHeader
            title="낚시당한 녀석들"
            backgroundColor="transparent"
            foregroundColor={heroTextColor}
            ruleColor={heroRuleColor}
            leadingSlot={(
              <View
                accessibilityRole="image"
                accessibilityLabel="낚시당한 녀석들 앱 아이콘"
                style={{ width: 34, height: 44, overflow: "hidden" }}
              >
                <Image
                  source={require("@/assets/images/card-app-icon-transparent.png")}
                  resizeMode="contain"
                  style={{
                    position: "absolute",
                    width: 72,
                    height: 72,
                    left: -19,
                    top: -20,
                  }}
                />
              </View>
            )}
            rightSlot={(
              <Text
                accessibilityLabel={`누적 일지 ${trips.length}개`}
                className="text-[10px] tracking-[1.5px]"
                style={{ color: heroTextColor, fontFamily: monoFont }}
              >
                FIELD LOG {String(trips.length).padStart(3, "0")}
              </Text>
            )}
          />
          <View className="px-7 pt-10">
            {isLoading ? (
              <View className="h-28 items-start justify-center">
                <ActivityIndicator color={heroTextColor} />
              </View>
            ) : nextTrip ? (
              <>
                <View className="min-h-[96px] flex-row items-end">
                  <Text style={{ color: heroTextColor, fontFamily: dateNumberFont, fontSize: 82, lineHeight: 96, overflow: "visible", paddingTop: 4 }}>{dateMonth}</Text>
                  <Text style={{ color: heroTextColor, fontFamily: dateKoreanFont, fontSize: 39, lineHeight: 64 }}>월 </Text>
                  <Text style={{ color: heroTextColor, fontFamily: dateNumberFont, fontSize: 82, lineHeight: 96, overflow: "visible", paddingTop: 4 }}>{dateDay}</Text>
                  <Text style={{ color: heroTextColor, fontFamily: dateKoreanFont, fontSize: 39, lineHeight: 64 }}>일, </Text>
                  <Text style={{ color: heroTextColor, fontFamily: dateKoreanFont, fontSize: 47, lineHeight: 68 }}>{dateWeekday}</Text>
                </View>
                <Text className="mt-1 text-[25px] leading-[34px]" style={{ color: heroTextColor, fontFamily: displayFont }}>다음 출조는 {nextTrip.spot_name}입니다.</Text>
                <Text className="mt-4 text-[15px] tracking-[1.6px]" style={{ color: heroTextColor, fontFamily: bodySemiBoldFont }}>새벽 5:30 · 우럭 목표</Text>
              </>
            ) : hasTripHistory ? (
              <View className="pt-3">
                <Text
                  className="max-w-[580px] text-[44px] leading-[54px] tracking-[-1.5px]"
                  style={{ color: heroTextColor, fontFamily: displayFont }}
                >
                  다음 출조를 계획해볼까요
                </Text>
                <Text
                  className="mt-4 text-lg tracking-[-0.3px]"
                  style={{ color: heroTextColor, fontFamily: bodySemiBoldFont }}
                >
                  지난 기록을 이어 새로운 일지를 시작해보세요
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="새 출조 추가하기"
                  accessibilityHint="낚시터와 출조 날짜를 입력하는 화면을 엽니다"
                  onPress={handleAddTrip}
                  className="mt-6 w-full max-w-[280px] flex-row items-center px-5 py-4"
                  style={{ backgroundColor: FIELD_COLORS.teal }}
                >
                  <FontAwesome name="calendar-plus-o" size={21} color="#fff" />
                  <Text
                    className="ml-3 flex-1 text-[17px] text-white"
                    style={{ fontFamily: bodyExtraBoldFont }}
                  >
                    새 출조 추가하기
                  </Text>
                  <FontAwesome name="long-arrow-right" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View className="pt-3">
                <Text className="max-w-[580px] text-[44px] leading-[54px] tracking-[-1.5px]" style={{ color: heroTextColor, fontFamily: displayFont }}>첫 출조를 기다리는 중</Text>
                <Text className="mt-4 text-lg tracking-[-0.3px]" style={{ color: heroTextColor, fontFamily: bodySemiBoldFont }}>어디로 떠날지 기록해보세요</Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="첫 출조 추가하기"
                  accessibilityHint="낚시터와 출조 날짜를 입력하는 화면을 엽니다"
                  onPress={handleAddTrip}
                  className="mt-6 w-full max-w-[280px] flex-row items-center px-5 py-4"
                  style={{ backgroundColor: FIELD_COLORS.teal }}
                >
                  <FontAwesome name="calendar-plus-o" size={21} color="#fff" />
                  <Text className="ml-3 flex-1 text-[17px] text-white" style={{ fontFamily: bodyExtraBoldFont }}>첫 출조 추가하기</Text>
                  <FontAwesome name="long-arrow-right" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
          {nextTrip && isLoggedIn ? (
            <TouchableOpacity
              accessibilityLabel="출조 커버 사진 변경"
              onPress={handleChangeCover}
              disabled={isSaving}
              className="absolute bottom-4 right-4 flex-row items-center bg-black/55 px-3 py-2"
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <FontAwesome name="camera" size={14} color="#fff" />
              )}
              <Text className="ml-2 text-xs font-semibold text-white">커버 변경</Text>
            </TouchableOpacity>
          ) : null}
        </ImageBackground>
        <View className="bg-white px-4 py-4">
          <TouchableOpacity
            onPress={handleRecord}
            className="flex-row items-center px-5 py-5"
            style={{ backgroundColor: FIELD_COLORS.teal }}
          >
            <FontAwesome name="camera" size={26} color="white" />
            <Text className="ml-4 flex-1 text-xl text-white" style={{ fontFamily: bodyExtraBoldFont }}>현장에서 기록하기</Text>
            <FontAwesome name="long-arrow-right" size={28} color="white" />
          </TouchableOpacity>
        </View>
        <View className="mt-3 bg-white px-4 py-6">
          <View className="flex-row items-center justify-between">
            <Text className="text-xl" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>다가오는 출조</Text>
            {nextTrip ? (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="출조 일지 전체 보기" onPress={() => router.push("/(tabs)/journal")}>
                <Text className="text-[11px] tracking-[1px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>ALL LOGS →</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {isLoading ? (
            <View className="mt-3 h-24 items-center justify-center border-y" style={{ borderColor: FIELD_COLORS.rule }}>
              <ActivityIndicator color={FIELD_COLORS.teal} />
            </View>
          ) : nextTrip ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`${nextTrip.spot_name} 출조 상세 보기`}
              accessibilityHint="선택한 출조의 일정과 현장 기록을 엽니다"
              activeOpacity={0.72}
              onPress={() =>
                router.push({
                  pathname: "/trips/[id]",
                  params: { id: nextTrip.id },
                })
              }
              className="mt-3 flex-row items-center border-y py-4"
              style={{ borderColor: FIELD_COLORS.rule }}
            >
              <FontAwesome name="map-signs" size={25} color={FIELD_COLORS.teal} />
              <View className="ml-4 flex-1">
                <Text
                  className="text-lg"
                  style={{
                    color: FIELD_COLORS.ink,
                    fontFamily: bodyExtraBoldFont,
                  }}
                >
                  {nextTrip.spot_name}
                </Text>
                <Text
                  className="mt-1 text-[11px] tracking-[1px]"
                  style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}
                >
                  {formatTripDate(nextTrip.scheduled_at)} · 우럭 목표
                </Text>
              </View>
              <View
                className="flex-row items-center"
                accessible
                accessibilityLabel={`D-${daysAway}`}
              >
                <Text
                  style={{
                    color: FIELD_COLORS.orange,
                    fontFamily: dateNumberFont,
                    fontSize: 48,
                    lineHeight: 62,
                    overflow: "visible",
                    paddingTop: 2,
                  }}
                >
                  D
                </Text>
                <View
                  style={{
                    width: 14,
                    height: 4,
                    marginHorizontal: 5,
                    backgroundColor: FIELD_COLORS.orange,
                  }}
                />
                <Text
                  style={{
                    color: FIELD_COLORS.orange,
                    fontFamily: dateNumberFont,
                    fontSize: 48,
                    lineHeight: 62,
                    overflow: "visible",
                    paddingTop: 2,
                  }}
                >
                  {daysAway}
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={hasTripHistory ? "새 출조 추가" : "첫 출조 추가"}
              accessibilityHint="낚시터와 출조 날짜를 입력하는 화면을 엽니다"
              onPress={handleAddTrip}
              className="mt-3 flex-row items-center px-5 py-6"
              style={{ backgroundColor: FIELD_COLORS.teal }}
            >
              <FontAwesome name="calendar-plus-o" size={24} color="#fff" />
              <Text className="ml-4 flex-1 text-[22px] text-white" style={{ fontFamily: bodyExtraBoldFont }}>
                {hasTripHistory ? "새 출조 추가하기" : "첫 출조 추가하기"}
              </Text>
              <FontAwesome name="long-arrow-right" size={25} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        <View className="mt-3 bg-white px-4 py-6">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-baseline">
              <Text
                className="text-xl"
                style={{
                  color: FIELD_COLORS.ink,
                  fontFamily: bodyExtraBoldFont,
                }}
              >
                최근 조과
              </Text>
              <Text
                className="ml-2 text-[10px] tracking-[1px]"
                style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}
              >
                최대 3개
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="전체 조과 카드 보기"
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/encyclopedia",
                  params: { segment: "cards" },
                })
              }
            >
              <Text
                className="text-[11px] tracking-[1px]"
                style={{ color: FIELD_COLORS.teal, fontFamily: monoFont }}
              >
                ALL CARDS →
              </Text>
            </TouchableOpacity>
          </View>
          <View
            className="mt-3 flex-row border-t pt-3"
            style={{ borderColor: FIELD_COLORS.rule }}
          >
            {catches.length ? (
              catches.slice(0, 3).map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.fish?.name_ko ?? "어종"} 조과 카드 열기`}
                  activeOpacity={0.84}
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/encyclopedia",
                      params: { segment: "cards", catchId: item.id },
                    })
                  }
                  className="flex-1 overflow-hidden border"
                  style={{
                    marginRight: index < Math.min(catches.length, 3) - 1 ? 8 : 0,
                    borderColor: FIELD_COLORS.rule,
                  }}
                >
                  {item.image_url ? (
                    <Image
                      source={{ uri: item.image_url }}
                      resizeMode="cover"
                      style={{ width: "100%", height: 96 }}
                    />
                  ) : (
                    <View
                      className="h-24 items-center justify-center"
                      style={{ backgroundColor: FIELD_COLORS.locked }}
                    >
                      <FontAwesome
                        name="image"
                        size={24}
                        color={FIELD_COLORS.muted}
                      />
                    </View>
                  )}
                  <View className="bg-white p-2">
                    <Text
                      numberOfLines={1}
                      style={{
                        color: FIELD_COLORS.ink,
                        fontFamily: bodyExtraBoldFont,
                      }}
                    >
                      {item.fish?.name_ko ?? "어종"}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View
                className="flex-1 items-center justify-center border"
                style={{
                  minHeight: 126,
                  borderColor: FIELD_COLORS.rule,
                  backgroundColor: FIELD_COLORS.locked,
                }}
              >
                <FontAwesome
                  name="camera"
                  size={22}
                  color={FIELD_COLORS.muted}
                />
                <Text
                  className="mt-2 text-xs font-semibold"
                  style={{ color: FIELD_COLORS.muted }}
                >
                  첫 조과를 기록하세요
                </Text>
              </View>
            )}
          </View>
          {error ? <Text className="mt-4 text-xs" style={{ color: FIELD_COLORS.orange }}>{error.message}</Text> : null}
        </View>
      </ScrollView>

      <TripFormModal
        visible={addVisible}
        trip={null}
        onClose={() => setAddVisible(false)}
        onSubmit={handleCreate}
        isSaving={isSaving}
      />
      <TripCoverActionSheet
        hasCover={Boolean(nextTrip?.cover_image_url)}
        visible={coverActionsVisible}
        isBusy={isSaving}
        onClose={() => setCoverActionsVisible(false)}
        onSelect={async (image) => {
          if (!nextTrip) return;
          const { error: coverError } = await updateTripCover(nextTrip.id, image);
          if (coverError) Alert.alert("사진 변경 실패", coverError.message);
        }}
        onRemove={async () => {
          if (!nextTrip) return;
          const { error: coverError } = await removeTripCover(nextTrip.id);
          if (coverError) Alert.alert("커버 초기화 실패", coverError.message);
        }}
      />
    </View>
  );
};

export default HomeScreen;
