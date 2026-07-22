import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useFishes } from "@/src/hooks/useFishes";
import { useUserCatches } from "@/src/hooks/useUserCatches";
import { useFishingTrips } from "@/src/hooks/useFishingTrips";
import { EncyclopediaPanel } from "@/components/collection/EncyclopediaPanel";
import { BadgesPanel } from "@/components/collection/BadgesPanel";
import { CardsPanel } from "@/components/collection/CardsPanel";
import { ArchiveTabHeader } from "@/components/design/ArchiveTabHeader";
import { createBadgeUnlockContext } from "@/src/data/badges";
import { FIELD_COLORS } from "@/src/theme/fieldJournal";
import type { UserCatch } from "@/src/hooks/useUserCatches";
import { trackAnalyticsEvent } from "@/src/lib/analytics";

type CollectionSegment = "encyclopedia" | "badges" | "cards";

const SEGMENTS: { key: CollectionSegment; label: string }[] = [
  { key: "encyclopedia", label: "도감" },
  { key: "badges", label: "배지" },
  { key: "cards", label: "카드" },
];

const CollectionScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    cardPreview?: string;
    catchId?: string;
    segment?: CollectionSegment;
  }>();
  const [segment, setSegment] = useState<CollectionSegment>(
    params.segment === "cards" || params.segment === "badges"
      ? params.segment
      : "encyclopedia",
  );

  useEffect(() => {
    if (params.segment === "cards" || params.segment === "badges") {
      setSegment(params.segment);
    }
  }, [params.segment]);

  useEffect(() => {
    void trackAnalyticsEvent("collection_viewed", { segment });
  }, [segment]);

  const handleRequestedCatchOpened = useCallback(() => {
    router.setParams({ catchId: "" });
  }, [router]);

  const {
    fishes: allFishes,
    isLoading: fishesLoading,
    isRefreshing: fishesRefreshing,
    error: fishesError,
    refetch: refetchFishes,
    retry: retryFishes,
  } = useFishes(null);
  const {
    catches,
    unlockedFishIds,
    isLoading: catchesLoading,
    isRefreshing: catchesRefreshing,
    isLoggedIn,
    refetch: refetchCatches,
  } = useUserCatches();
  const { trips, refetch: refetchTrips } = useFishingTrips();

  const previewMode =
    __DEV__ && (!isLoggedIn || params.cardPreview === "1");
  const displayUnlockedFishIds = useMemo(() => {
    if (previewMode) return new Set(allFishes.slice(0, 2).map((fish) => fish.id));
    const coreIds = new Set(allFishes.map((fish) => fish.id));
    return new Set([...unlockedFishIds].filter((id) => coreIds.has(id)));
  }, [allFishes, previewMode, unlockedFishIds]);
  const displayCatches = useMemo<UserCatch[]>(() => {
    if (!previewMode) return catches;
    return allFishes.slice(0, 4).map((fish, index) => ({
      id: `preview-${fish.id}`,
      user_id: "preview",
      fish_id: fish.id,
      trip_id: null,
      fish,
      image_path: null,
      image_url: fish.image_url,
      thumbnail_path: null,
      size_cm: [42, 58, 31, 46][index],
      caught_at: new Date(2026, 6 - index, 6 + index).toISOString(),
      location_name: ["대천항", "원산도", "군산", "태안"][index],
      location_lat: null,
      location_lng: null,
      location_captured_at: null,
      memo: [
        "수심 18m, 외수질 채비. 입질은 예민했지만 챔질 후 묵직한 손맛이 좋았다.",
        "오전 들물에 갯바위 가장자리에서 입질. 작은 웜에 반응했다.",
        "해 뜨기 전 방파제에서 기록. 바닥층을 천천히 탐색했다.",
        "잔잔한 물때에 연속 입질. 다음 출조에도 같은 채비를 준비할 것.",
      ][index],
      created_at: null,
      updated_at: null,
      candidate_fish_ids: [],
      capture_method: "live_camera",
      client_request_id: null,
      conditions_snapshot: null,
      id_method: "fallback_catalog",
      verification_status: "verified",
      verification_reason: null,
    }));
  }, [allFishes, catches, previewMode]);
  const unlockedCount = displayUnlockedFishIds.size;
  const totalFishCount = allFishes.length;

  const badgeContext = useMemo(
    () => {
      if (previewMode) {
        return {
          catchCount: 5,
          uniqueSpecies: 3,
          completedTrips: 5,
          completeFieldNotes: 1,
          dawnTrips: 1,
          nightTrips: 0,
          completedSeasons: 2,
          uniqueSpots: 4,
          maxCatchSize: 58,
          acquiredAt: {
            trip_first: "2026-03-16T05:30:00.000Z",
            trips_5: "2026-07-06T06:20:00.000Z",
            field_note: "2026-05-24T05:10:00.000Z",
            dawn_trip: "2026-04-12T04:40:00.000Z",
            first_catch: "2026-03-16T07:12:00.000Z",
            catches_5: "2026-07-06T08:05:00.000Z",
            record_catch: "2026-06-08T06:45:00.000Z",
            species_3: "2026-06-08T06:45:00.000Z",
          },
        };
      }

      return createBadgeUnlockContext(catches, trips);
    },
    [catches, previewMode, trips]
  );

  const refreshCollection = () => {
    refetchFishes();
    refetchCatches();
    refetchTrips();
  };

  return (
    <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: FIELD_COLORS.foam }}>
      <ArchiveTabHeader
        title="수집"
        actionLabel="기록하기"
        backgroundColor={FIELD_COLORS.foam}
        onAction={() => router.push("/record")}
      />
      <View className="px-7 pb-0" style={{ backgroundColor: FIELD_COLORS.foam }}>
        <View className="mt-3 flex-row justify-between">
          {SEGMENTS.map(({ key, label }) => {
            const isActive = segment === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setSegment(key)}
                className="min-w-[30%] items-center pb-4"
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  className="text-base font-semibold"
                  style={{ color: isActive ? FIELD_COLORS.teal : "#4B4F50" }}
                >
                  {label}
                </Text>
                {isActive ? (
                  <View className="absolute bottom-0 left-0 right-0 h-[3px]" style={{ backgroundColor: FIELD_COLORS.teal }} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
        <View className="h-px" style={{ backgroundColor: FIELD_COLORS.rule }} />
      </View>

      {segment === "encyclopedia" && (
        <EncyclopediaPanel
          insetsBottom={insets.bottom}
          allFishes={allFishes}
          isLoading={fishesLoading}
          isRefreshing={fishesRefreshing}
          error={fishesError}
          unlockedFishIds={displayUnlockedFishIds}
          totalFishCount={totalFishCount}
          unlockedCount={unlockedCount}
          onRefreshAll={refreshCollection}
          onRetry={retryFishes}
          onOpenFish={(fishId) => router.push(`/fishes/${fishId}`)}
        />
      )}
      {segment === "badges" && (
        <BadgesPanel
          insetsBottom={insets.bottom}
          unlockContext={badgeContext}
          isRefreshing={catchesRefreshing}
          onRefresh={refreshCollection}
        />
      )}
      {segment === "cards" && (
        <CardsPanel
          insetsBottom={insets.bottom}
          catches={displayCatches}
          isLoading={catchesLoading}
          isRefreshing={catchesRefreshing}
          isLoggedIn={isLoggedIn || previewMode}
          onRefresh={refetchCatches}
          onLoginPress={() => router.push("/(auth)/login")}
          requestedCatchId={params.catchId}
          onRequestedCatchOpened={handleRequestedCatchOpened}
        />
      )}
    </View>
  );
};

export default CollectionScreen;
