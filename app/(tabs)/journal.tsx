import { useState } from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArchiveTabHeader } from "@/components/design/ArchiveTabHeader";
import { TripFormModal } from "@/components/trips/TripFormModal";
import {
  useFishingTrips,
  type FishingTrip,
  type UpdateTripInput,
} from "@/src/hooks/useFishingTrips";
import {
  useJournalTrips,
  type JournalTripFilter,
} from "@/src/hooks/useJournalTrips";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
  bodySemiBoldFont,
  dateKoreanFont,
  dateNumberFont,
  displayFont,
  monoFont,
} from "@/src/theme/fieldJournal";

type TripFilter = JournalTripFilter;

const FILTERS: { key: TripFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "planned", label: "예정" },
  { key: "done", label: "완료" },
  { key: "canceled", label: "취소" },
];

const STATUS_LABEL: Record<FishingTrip["status"], string> = {
  planned: "예정",
  done: "완료",
  canceled: "취소",
};

const statusColor = (status: FishingTrip["status"]) => {
  if (status === "done") return FIELD_COLORS.teal;
  if (status === "canceled") return FIELD_COLORS.red;
  return FIELD_COLORS.orange;
};

const TripTimelineRow = ({
  compact,
  trip,
  onPress,
}: {
  compact: boolean;
  trip: FishingTrip;
  onPress: () => void;
}) => {
  const date = new Date(trip.scheduled_at);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(date);
  const time = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  const accent = statusColor(trip.status);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={`${trip.spot_name} 출조 상세 보기`}
      onPress={onPress}
      className="relative flex-row border-b bg-white py-7"
      style={{ borderColor: FIELD_COLORS.rule }}
    >
      <View
        className="absolute left-[30px] w-px"
        style={{
          backgroundColor: FIELD_COLORS.rule,
          bottom: -1,
          top: -1,
        }}
      />
      {trip.status === "done" ? (
        <View className="absolute left-[21px] top-[39px] h-[19px] w-[19px] items-center justify-center rounded-full" style={{ backgroundColor: FIELD_COLORS.teal }}>
          <FontAwesome name="check" size={11} color="#fff" />
        </View>
      ) : trip.status === "canceled" ? (
        <View className="absolute left-[21px] top-[39px] h-[19px] w-[19px] items-center justify-center bg-white">
          <FontAwesome name="ban" size={19} color={FIELD_COLORS.red} />
        </View>
      ) : (
        <View
          className="absolute left-[23px] top-[41px] h-[15px] w-[15px] rounded-full border-2 bg-white"
          style={{ borderColor: accent }}
        />
      )}

      <View
        className="items-center"
        style={{
          width: compact ? 108 : 142,
          paddingLeft: compact ? 24 : 32,
          paddingRight: 4,
        }}
      >
        <Text
          style={{
            color: accent,
            fontFamily: dateKoreanFont,
            fontSize: compact ? 16 : 18,
            lineHeight: compact ? 24 : 26,
            paddingTop: 2,
          }}
        >
          {month}월
        </Text>
        <Text
          style={{
            color: accent,
            fontFamily: dateNumberFont,
            fontSize: compact ? 54 : 64,
            lineHeight: compact ? 66 : 76,
            overflow: "visible",
            paddingTop: 2,
          }}
        >
          {day}
        </Text>
        <View className="w-12 border-t" style={{ borderColor: FIELD_COLORS.rule }} />
        <Text
          className="mt-2 text-sm"
          style={{ color: accent, fontFamily: dateKoreanFont }}
        >
          {weekday}요일
        </Text>
      </View>

      <View className="min-w-0 flex-1 flex-row border-l" style={{ borderColor: FIELD_COLORS.rule }}>
        <View
          className="min-w-0 flex-1"
          style={{
            paddingLeft: compact ? 14 : 20,
            paddingRight: compact ? 10 : 16,
          }}
        >
          <View className="min-w-0 flex-1">
            <Text
              numberOfLines={2}
              style={{
                color: FIELD_COLORS.ink,
                fontFamily: bodyExtraBoldFont,
                fontSize: compact ? 20 : 22,
                lineHeight: compact ? 27 : 29,
              }}
            >
              {trip.spot_name}
            </Text>
            <View className="mt-2 flex-row items-center">
              <FontAwesome name="clock-o" size={15} color={FIELD_COLORS.ink} />
              <Text
                className="ml-2 text-xs tracking-[1px]"
                style={{ color: FIELD_COLORS.ink, fontFamily: monoFont }}
              >
                {time}
              </Text>
            </View>
          </View>

          {trip.memo ? (
            <Text
              className="mt-3 text-sm leading-6"
              style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
            >
              {trip.memo}
            </Text>
          ) : (
            <Text
              className="mt-3 text-sm"
              style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
            >
              남겨둔 메모가 없습니다.
            </Text>
          )}

          <Text className="mt-4 text-sm" style={{ color: accent, fontFamily: bodyExtraBoldFont }}>
            {STATUS_LABEL[trip.status]}
          </Text>
        </View>
        <View
          className="items-center justify-center border-l"
          style={{ borderColor: FIELD_COLORS.rule, width: compact ? 48 : 70 }}
        >
          <Text className="text-xs" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>상세</Text>
          <FontAwesome name="long-arrow-right" size={21} color={FIELD_COLORS.ink} style={{ marginTop: 12 }} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const JournalScreen = () => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const compactTimeline = width <= 390;
  const [filter, setFilter] = useState<TripFilter>("all");
  const [formVisible, setFormVisible] = useState(false);
  const {
    isSaving,
    isLoggedIn,
    createTrip,
  } = useFishingTrips({ autoFetch: false });
  const {
    trips,
    counts,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    error,
    loadMoreError,
    refetch,
    loadMore,
  } = useJournalTrips(filter);

  const openCreate = () => {
    if (!isLoggedIn) {
      router.push("/(auth)/login");
      return;
    }
    setFormVisible(true);
  };

  const submitTrip = async (input: UpdateTripInput) => {
    const result = await createTrip(input);
    if (!result.error) await refetch();
    return result.error;
  };

  return (
    <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: FIELD_COLORS.foam }}>
      <FlatList
        showsVerticalScrollIndicator={false}
        data={trips}
        keyExtractor={(trip) => trip.id}
        renderItem={({ item: trip }) => (
          <View
            className="bg-white"
            style={{ paddingHorizontal: compactTimeline ? 20 : 28 }}
          >
            <TripTimelineRow
              compact={compactTimeline}
              trip={trip}
              onPress={() => router.push({ pathname: "/trips/[id]", params: { id: trip.id } })}
            />
          </View>
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.35}
        initialNumToRender={10}
        maxToRenderPerBatch={6}
        windowSize={7}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refetch} tintColor={FIELD_COLORS.teal} />
        }
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
        ListHeaderComponent={(
          <>
            <ArchiveTabHeader
              title="출조 일지"
              backgroundColor={FIELD_COLORS.foam}
              actionLabel="새 출조 +"
              actionAccessibilityLabel="새 출조 추가"
              onAction={openCreate}
            />
            <View className="px-7" style={{ backgroundColor: FIELD_COLORS.foam }}>
              <View className="flex-row items-center py-6">
                <Text className="text-xs tracking-[1.2px]" style={{ color: FIELD_COLORS.ink, fontFamily: monoFont }}>
                  TOTAL {counts.all}
                </Text>
                <View className="mx-4 h-4 w-px" style={{ backgroundColor: FIELD_COLORS.rule }} />
                <Text className="text-xs tracking-[1px]" style={{ color: FIELD_COLORS.ink, fontFamily: monoFont }}>
                  예정 {counts.planned} · 완료 {counts.done} · 취소 {counts.canceled}
                </Text>
              </View>

              <View className="flex-row border-y" style={{ borderColor: FIELD_COLORS.rule }}>
                {FILTERS.map((item) => {
                  const active = item.key === filter;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`${item.label} 출조 ${counts[item.key]}개`}
                      onPress={() => setFilter(item.key)}
                      className="relative flex-1 items-center py-4"
                    >
                      <Text
                        className="text-base"
                        style={{ color: active ? FIELD_COLORS.teal : FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
                      >
                        {item.label}
                      </Text>
                      {active ? <View className="absolute bottom-0 h-[3px] w-full" style={{ backgroundColor: FIELD_COLORS.teal }} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View className="bg-white px-7">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="새 출조 추가"
                onPress={openCreate}
                className="flex-row items-center border-b py-7"
                style={{ borderColor: FIELD_COLORS.rule }}
              >
                <View className="h-[58px] w-[58px] items-center justify-center rounded-full border" style={{ borderColor: FIELD_COLORS.teal, borderStyle: "dashed" }}>
                  <FontAwesome name="plus" size={22} color={FIELD_COLORS.teal} />
                </View>
                <Text className="ml-4 flex-1 text-xl" style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>
                  새 출조 추가
                </Text>
                <FontAwesome name="angle-right" size={38} color={FIELD_COLORS.teal} />
              </TouchableOpacity>
            </View>
          </>
        )}
        ListEmptyComponent={(
          isLoading ? (
            <View className="h-48 items-center justify-center">
              <ActivityIndicator color={FIELD_COLORS.teal} />
            </View>
          ) : error ? (
            <View className="mx-7 items-center border-b px-6 py-14" style={{ borderColor: FIELD_COLORS.rule }}>
              <Text className="text-center text-sm" style={{ color: FIELD_COLORS.orange, fontFamily: bodyFont }}>
                출조 일지를 불러오지 못했습니다.
              </Text>
              <TouchableOpacity onPress={refetch} className="mt-5 px-5 py-3" style={{ backgroundColor: FIELD_COLORS.teal }}>
                <Text className="text-white" style={{ fontFamily: bodyExtraBoldFont }}>다시 불러오기</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="mx-7 items-center border-b px-6 py-16" style={{ borderColor: FIELD_COLORS.rule }}>
              <FontAwesome name="calendar-o" size={30} color={FIELD_COLORS.muted} />
              <Text className="mt-5 text-[25px]" style={{ color: FIELD_COLORS.ink, fontFamily: displayFont }}>
                {filter === "all" ? "아직 남긴 출조가 없습니다" : `${STATUS_LABEL[filter as FishingTrip["status"]]} 출조가 없습니다`}
              </Text>
              <Text className="mt-3 text-center text-sm leading-6" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
                첫 목적지와 날짜를 남기면{`\n`}여기에 출조의 시간이 차곡차곡 쌓입니다.
              </Text>
              <TouchableOpacity onPress={openCreate} className="mt-6 px-6 py-3" style={{ backgroundColor: FIELD_COLORS.teal }}>
                <Text className="text-white" style={{ fontFamily: bodyExtraBoldFont }}>첫 출조 기록하기</Text>
              </TouchableOpacity>
            </View>
          )
        )}
        ListFooterComponent={(
          trips.length ? (
            <View className="items-center py-6">
              {isLoadingMore ? <ActivityIndicator color={FIELD_COLORS.teal} /> : null}
              {loadMoreError ? (
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="다음 출조 기록 다시 불러오기" onPress={loadMore} className="px-5 py-3">
                  <Text className="text-sm" style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>다음 기록 다시 불러오기</Text>
                </TouchableOpacity>
              ) : null}
              {!hasMore && !isLoadingMore ? (
                <Text className="text-[10px] tracking-[1.4px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>END OF FIELD LOG</Text>
              ) : null}
            </View>
          ) : null
        )}
      />

      <TripFormModal
        visible={formVisible}
        trip={null}
        isSaving={isSaving}
        onClose={() => setFormVisible(false)}
        onSubmit={submitTrip}
      />
    </View>
  );
};

export default JournalScreen;
