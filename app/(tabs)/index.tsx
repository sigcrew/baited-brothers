import { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  ImageBackground,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  useFishingTrips,
  type UpdateTripInput,
} from "@/src/hooks/useFishingTrips";
import { useUserCatches } from "@/src/hooks/useUserCatches";
import { useFishes } from "@/src/hooks/useFishes";
import { HERO_FALLBACK_TITLE, HERO_SUBTITLE, pickSeasonalSpecies } from "@/src/lib/homeHero";
import { FieldDateLine } from "@/components/design/FieldDateLine";
import { stampShortDateTime } from "@/src/lib/stampDate";
import { useImageContrast } from "@/src/hooks/useImageContrast";
import { useAuth } from "@/src/contexts/AuthContext";
import {
  listPendingCatches,
  removePendingCatch,
  subscribePendingCatchQueue,
  type PendingCatchJob,
} from "@/src/lib/pendingCatchQueue";
import { ArchiveTabHeader } from "@/components/design/ArchiveTabHeader";
import { TripCoverActionSheet } from "@/components/trips/TripCoverActionSheet";
import { TripFormModal } from "@/components/trips/TripFormModal";
import { useFieldNotice } from "@/src/contexts/FieldNoticeContext";
import { formatCountdown, pickNextTrip, tripCountdown } from "@/src/lib/tripSchedule";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodySemiBoldFont,
  dateNumberFont,
  displayFont,
  monoFont,
  bodyFont,
} from "@/src/theme/fieldJournal";

const DEFAULT_HERO_IMAGE = require("@/assets/images/design/first-trip-cover-v1.png");
/** 히어로 타이포 기준 폭 (큰 기기에서 현재 룩이 맞는 너비) */
const HERO_TYPE_BASE_WIDTH = 430;
const HERO_HORIZONTAL_PADDING = 56; // px-7 * 2

// D-day 카운트다운의 "+"/"-" 막대. 오프셋은 iPhone 16 Pro 스크린샷에서 "D" 글리프
// 중앙과 막대 중앙의 차이를 재서 정했다.
const COUNTDOWN_SIGN_SIZE = 14;
const COUNTDOWN_SIGN_STROKE = 4;
const COUNTDOWN_SIGN_OFFSET_Y = -4;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** Anton 숫자는 RN Text ascent 클리핑이 있어 SVG + 상단 여유로 그림 */
const pendingCatchStatusLabel = (pending: PendingCatchJob) => {
  if (pending.status === "needs_confirmation") return "어종 확인 필요";
  if (pending.status === "pending_upload" || pending.status === "uploading") {
    return "업로드 대기";
  }
  if (pending.status === "failed_retryable") return "다시 시도 필요";
  if (pending.status === "failed_terminal") return "자동 재시도 중단 · 직접 이어가기";
  if (pending.status === "analyzing") return "AI 분석 중";
  return "AI 분석 대기";
};

const HomeScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();
  const heroTypeScale = clamp(
    (windowWidth - HERO_HORIZONTAL_PADDING) / (HERO_TYPE_BASE_WIDTH - HERO_HORIZONTAL_PADDING),
    0.72,
    1,
  );
  const heroDateNumberSize = Math.round(82 * heroTypeScale);
  const heroDateUnitSize = Math.round(39 * heroTypeScale);
  const heroDateWeekdaySize = Math.round(47 * heroTypeScale);
  const heroTitleSize = Math.round(44 * heroTypeScale);
  const heroTitleLineHeight = Math.round(54 * heroTypeScale);
  const heroSpotSize = Math.round(25 * heroTypeScale);
  const heroSpotLineHeight = Math.round(34 * heroTypeScale);
  const [addVisible, setAddVisible] = useState(false);
  const [coverActionsVisible, setCoverActionsVisible] = useState(false);
  const [pendingCatches, setPendingCatches] = useState<PendingCatchJob[]>([]);
  const { alert, confirm } = useFieldNotice();
  const { session } = useAuth();
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
    markDone,
  } = useFishingTrips({ syncReminders: true });
  const { catches } = useUserCatches();
  const { fishes: catalogFishes } = useFishes();
  const heroSeason = pickSeasonalSpecies(catalogFishes);

  const refreshPendingCatches = useCallback(async () => {
    const userId = session?.user.id;
    if (!userId) {
      setPendingCatches([]);
      return;
    }
    setPendingCatches(await listPendingCatches(userId));
  }, [session?.user.id]);

  useFocusEffect(
    useCallback(() => {
      void refreshPendingCatches();
    }, [refreshPendingCatches]),
  );

  useFocusEffect(
    useCallback(() => {
      const unsubscribe = subscribePendingCatchQueue(() => {
        void refreshPendingCatches();
      });
      return unsubscribe;
    }, [refreshPendingCatches]),
  );

  const handleCreate = async (input: UpdateTripInput) => {
    const { error: createError } = await createTrip(input);
    return createError;
  };

  // 오늘 이후 예정 출조가 우선. 전부 지났으면 가장 최근 것을 보여 주고 정리를 유도한다.
  const nextTripPick = pickNextTrip(plannedTrips);
  const nextTrip = nextTripPick?.trip;
  const nextTripCountdown = nextTrip ? tripCountdown(nextTrip.scheduled_at) : null;
  const nextTripOverdue = nextTripCountdown?.kind === "overdue";
  // 히어로는 앞으로 갈 출조만 보여 준다. 지난 예정 출조는 아래 "정리할 출조" 칸에서만 다룬다.
  const heroTrip = nextTripOverdue ? undefined : nextTrip;
  const overdueTripCount = nextTripPick?.overdueCount ?? 0;
  const handleMarkNextTripDone = async () => {
    if (!nextTrip) return;
    const confirmed = await confirm({
      eyebrow: "FIELD LOG · COMPLETE",
      title: "출조를 완료로 표시할까요?",
      message: `${nextTrip.spot_name} 출조의 예정일이 지났습니다. 완료로 표시하면 일지와 배지에 반영됩니다.`,
      confirmLabel: "완료로 표시",
      cancelLabel: "나중에",
    });
    if (!confirmed) return;
    const { error: doneError } = await markDone(nextTrip.id);
    if (doneError) alert({ eyebrow: "FIELD LOG · ERROR", title: "완료 처리에 실패했습니다", message: "잠시 후 다시 시도해 주세요." });
  };
  const latestDoneTrip = recentDoneTrips[0];
  const hasTripHistory = Boolean(latestDoneTrip);
  const heroSource = heroTrip?.cover_image_url
    ? { uri: heroTrip.cover_image_url }
    : latestDoneTrip?.cover_image_url
      ? { uri: latestDoneTrip.cover_image_url }
      : DEFAULT_HERO_IMAGE;
  const isDarkHero = useImageContrast(heroSource);
  const heroTextColor = isDarkHero ? FIELD_COLORS.paper : FIELD_COLORS.ink;
  const heroRuleColor = isDarkHero ? "rgba(255,255,255,0.72)" : FIELD_COLORS.rule;
  const nextDate = heroTrip ? new Date(heroTrip.scheduled_at) : null;
  const dateMonth = nextDate ? String(nextDate.getMonth() + 1) : "";
  const dateDay = nextDate ? String(nextDate.getDate()) : "";
  const dateWeekday = nextDate
    ? new Intl.DateTimeFormat("ko-KR", { weekday: "long" }).format(nextDate)
    : "";
  const countdownLabel = nextTripCountdown ? formatCountdown(nextTripCountdown) : "";
  // "D", 부호, 숫자를 따로 그린다. 오늘은 숫자 대신 DAY.
  const countdownSign = nextTripCountdown?.kind === "overdue" ? "+" : "-";
  const countdownValue =
    nextTripCountdown?.kind === "upcoming"
      ? String(nextTripCountdown.daysAway)
      : nextTripCountdown?.kind === "overdue"
        ? String(nextTripCountdown.daysOverdue)
        : "DAY";
  const handleRecord = () => isLoggedIn ? router.push("/record") : router.push("/(auth)/login");
  const handleAddTrip = () => isLoggedIn ? setAddVisible(true) : router.push("/(auth)/login");
  const discardPendingCatch = async (pending: PendingCatchJob) => {
    const userId = session?.user.id;
    if (!userId) return;
    const confirmed = await confirm({
      eyebrow: "LOCAL RECORD · DELETE",
      title: "미완료 기록을 삭제할까요?",
      message: "기기에 보관된 사진과 촬영 정보가 함께 삭제됩니다.\n삭제한 기록은 복구할 수 없습니다.",
      cancelLabel: "취소",
      confirmLabel: "삭제",
      destructive: true,
    });
    if (!confirmed) return;
    await removePendingCatch(userId, pending.localId);
    await refreshPendingCatches();
  };
  const handleChangeCover = () => {
    if (!heroTrip || isSaving) return;
    setCoverActionsVisible(true);
  };

  return (
    <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: FIELD_COLORS.foam }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={refetch} tintColor={FIELD_COLORS.teal} />}
      >
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
          <View className="px-7 pt-12">
            {isLoading ? (
              <View className="h-28 items-start justify-center">
                <ActivityIndicator color={heroTextColor} />
              </View>
            ) : heroTrip ? (
              <>
                <FieldDateLine
                  color={heroTextColor}
                  numberSize={heroDateNumberSize}
                  unitSize={heroDateUnitSize}
                  weekdaySize={heroDateWeekdaySize}
                  style={{ marginTop: 4 }}
                  parts={[
                    { kind: "number", value: dateMonth },
                    { kind: "unit", value: "월 " },
                    { kind: "number", value: dateDay },
                    { kind: "unit", value: "일, " },
                    { kind: "weekday", value: dateWeekday },
                  ]}
                />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                  allowFontScaling={false}
                  className="mt-1"
                  style={{
                    color: heroTextColor,
                    fontFamily: displayFont,
                    fontSize: heroSpotSize,
                    lineHeight: heroSpotLineHeight,
                  }}
                >
                  다음 출조는 {heroTrip.spot_name}입니다.
                </Text>
                <Text className="mt-4 text-[15px]" style={{ color: heroTextColor, fontFamily: bodySemiBoldFont }}>
                  {nextDate?.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })} 출조 예정
                </Text>
              </>
            ) : (
              <View className="pt-3">
                {heroSeason ? (
                  <>
                    {/* 다가오는 출조 히어로와 같은 모양: 큰 숫자 날짜 줄 + 한 줄 제목 */}
                    <FieldDateLine
                      color={heroTextColor}
                      numberSize={heroDateNumberSize}
                      unitSize={heroDateUnitSize}
                      style={{ marginTop: 4 }}
                      parts={[
                        { kind: "number", value: String(heroSeason.month) },
                        { kind: "unit", value: "월," },
                      ]}
                    />
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.65}
                      allowFontScaling={false}
                      className="mt-1"
                      style={{
                        color: heroTextColor,
                        fontFamily: displayFont,
                        fontSize: heroSpotSize,
                        lineHeight: heroSpotLineHeight,
                      }}
                    >
                      {heroSeason.name} 시즌입니다.
                    </Text>
                  </>
                ) : (
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                    allowFontScaling={false}
                    className="max-w-[580px] tracking-[-1.5px]"
                    style={{
                      color: heroTextColor,
                      fontFamily: displayFont,
                      fontSize: heroTitleSize,
                      lineHeight: heroTitleLineHeight,
                    }}
                  >
                    {HERO_FALLBACK_TITLE}
                  </Text>
                )}
                <Text className="mt-4 text-[15px]" style={{ color: heroTextColor, fontFamily: bodySemiBoldFont }}>
                  {HERO_SUBTITLE}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={hasTripHistory || nextTripOverdue ? "새 출조 추가하기" : "첫 출조 추가하기"}
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
                    {hasTripHistory || nextTripOverdue ? "새 출조 추가하기" : "첫 출조 추가하기"}
                  </Text>
                  <FontAwesome name="long-arrow-right" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
          {heroTrip && isLoggedIn ? (
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
        {pendingCatches.length > 0 ? (
          <View className="mt-3 bg-white px-4 py-5">
            <View className="flex-row items-end justify-between border-b pb-3" style={{ borderColor: FIELD_COLORS.rule }}>
              <View>
                <Text className="text-lg" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
                  미완료 현장 기록
                </Text>
                <Text className="mt-1 text-xs" style={{ color: FIELD_COLORS.muted, fontFamily: bodySemiBoldFont }}>
                  사진은 이 기기에 안전하게 보관되어 있습니다.
                </Text>
              </View>
              <Text className="text-[11px] tracking-[1px]" style={{ color: FIELD_COLORS.orange, fontFamily: monoFont }}>
                {String(pendingCatches.length).padStart(2, "0")} PENDING
              </Text>
            </View>
            {pendingCatches.slice(0, 3).map((pending) => (
              <View
                key={pending.localId}
                className="flex-row items-center border-b py-4"
                style={{ borderColor: FIELD_COLORS.rule }}
              >
                <View className="min-w-0 flex-1 pr-3">
                  <Text style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
                    {pending.tripName ?? "출조 미연결 기록"}
                  </Text>
                  <Text className="mt-1 text-xs" style={{ color: FIELD_COLORS.muted, fontFamily: bodySemiBoldFont }}>
                    {pendingCatchStatusLabel(pending)}
                  </Text>
                </View>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="미완료 조과 기록 이어가기"
                  onPress={() =>
                    router.push({
                      pathname: "/record",
                      params: { pendingId: pending.localId },
                    })
                  }
                  className="px-3 py-2"
                  style={{ backgroundColor: FIELD_COLORS.teal }}
                >
                  <Text className="text-sm text-white" style={{ fontFamily: bodyExtraBoldFont }}>
                    이어가기
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="미완료 조과 기록 삭제"
                  onPress={() => void discardPendingCatch(pending)}
                  className="ml-2 px-2 py-2"
                >
                  <FontAwesome name="trash-o" size={18} color={FIELD_COLORS.muted} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}
        <View className="mt-3 bg-white px-4 py-6">
          <View className="flex-row items-center justify-between">
            <Text className="text-xl" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>{nextTripOverdue ? "정리할 출조" : "다가오는 출조"}</Text>
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
                  {stampShortDateTime(nextTrip.scheduled_at)}
                </Text>
              </View>
              <View
                className="flex-row items-center"
                accessible
                accessibilityLabel={nextTripOverdue ? `예정일 ${countdownValue}일 지남` : countdownLabel}
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
                {/* "+"와 "-"를 같은 굵기의 막대로 그리고 "D" 글자의 세로 중앙에 맞춘다.
                    Anton 글자는 줄 상자 중앙보다 약 4pt 위에 그려지므로 그만큼 올린다. */}
                <View
                  style={{
                    width: COUNTDOWN_SIGN_SIZE,
                    height: COUNTDOWN_SIGN_SIZE,
                    marginHorizontal: 5,
                    alignItems: "center",
                    justifyContent: "center",
                    transform: [{ translateY: COUNTDOWN_SIGN_OFFSET_Y }],
                  }}
                >
                  <View style={{ width: COUNTDOWN_SIGN_SIZE, height: COUNTDOWN_SIGN_STROKE, backgroundColor: FIELD_COLORS.orange }} />
                  {countdownSign === "+" ? (
                    <View
                      style={{
                        position: "absolute",
                        width: COUNTDOWN_SIGN_STROKE,
                        height: COUNTDOWN_SIGN_SIZE,
                        backgroundColor: FIELD_COLORS.orange,
                      }}
                    />
                  ) : null}
                </View>
                <Text
                  style={{
                    color: FIELD_COLORS.orange,
                    fontFamily: dateNumberFont,
                    fontSize: countdownValue === "DAY" ? 30 : 48,
                    lineHeight: 62,
                    overflow: "visible",
                    paddingTop: 2,
                  }}
                >
                  {countdownValue}
                </Text>
              </View>
            </TouchableOpacity>
          ) : null}
          {nextTrip && nextTripOverdue ? (
            <View className="flex-row items-center justify-between border-b py-3" style={{ borderColor: FIELD_COLORS.rule }}>
              <Text className="flex-1 text-xs leading-5" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
                {overdueTripCount > 1 ? `지난 예정 출조가 ${overdueTripCount}건 있습니다. ` : ""}다녀왔다면 완료로, 못 갔다면 상세에서 취소로 표시해 주세요.
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={`${nextTrip.spot_name} 출조 완료로 표시`}
                onPress={() => void handleMarkNextTripDone()}
                disabled={isSaving}
                className="ml-3 px-3 py-2"
                style={{ backgroundColor: FIELD_COLORS.teal }}
              >
                <Text className="text-[13px] text-white" style={{ fontFamily: bodyExtraBoldFont }}>완료로 표시</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {!isLoading && !nextTrip ? (
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
          ) : null}
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
                  accessibilityLabel={`${item.fish?.name_ko ?? item.custom_species_name ?? "어종"} 조과 카드 열기`}
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
                  {item.thumbnail_url ?? item.image_url ? (
                    <Image
                      source={{ uri: item.thumbnail_url ?? item.image_url! }}
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
                      {item.fish?.name_ko ?? item.custom_species_name ?? "어종"}
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
        hasCover={Boolean(heroTrip?.cover_image_url)}
        visible={coverActionsVisible}
        isBusy={isSaving}
        onClose={() => setCoverActionsVisible(false)}
        onSelect={async (image) => {
          if (!heroTrip) return;
          const { error: coverError } = await updateTripCover(heroTrip.id, image);
          if (coverError) void alert({ eyebrow: "TRIP COVER · ERROR", title: "사진 변경 실패", message: coverError.message });
        }}
        onRemove={async () => {
          if (!heroTrip) return;
          const { error: coverError } = await removeTripCover(heroTrip.id);
          if (coverError) void alert({ eyebrow: "TRIP COVER · ERROR", title: "커버 초기화 실패", message: coverError.message });
        }}
      />
    </View>
  );
};

export default HomeScreen;
