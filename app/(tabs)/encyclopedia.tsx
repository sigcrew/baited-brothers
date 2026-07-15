import { useMemo, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFishes } from "@/src/hooks/useFishes";
import { useUserCatches } from "@/src/hooks/useUserCatches";
import { useFishingTrips } from "@/src/hooks/useFishingTrips";
import { EncyclopediaPanel } from "@/components/collection/EncyclopediaPanel";
import { BadgesPanel } from "@/components/collection/BadgesPanel";
import { CardsPanel } from "@/components/collection/CardsPanel";
import { ArchiveTabHeader } from "@/components/design/ArchiveTabHeader";
import { FIELD_COLORS } from "@/src/theme/fieldJournal";
import type { UserCatch } from "@/src/hooks/useUserCatches";

type CollectionSegment = "encyclopedia" | "badges" | "cards";

const SEGMENTS: { key: CollectionSegment; label: string }[] = [
  { key: "encyclopedia", label: "도감" },
  { key: "badges", label: "뱃지" },
  { key: "cards", label: "카드" },
];

const CollectionScreen = () => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [segment, setSegment] = useState<CollectionSegment>("encyclopedia");

  const { fishes: allFishes, refetch: refetchFishes } = useFishes(null);
  const {
    catches,
    unlockedFishIds,
    isLoading: catchesLoading,
    isRefreshing: catchesRefreshing,
    isLoggedIn,
    refetch: refetchCatches,
  } = useUserCatches();
  const { trips, refetch: refetchTrips } = useFishingTrips();

  const previewMode = __DEV__ && !isLoggedIn;
  const displayUnlockedFishIds = useMemo(() => previewMode ? new Set(allFishes.slice(0, 2).map((fish) => fish.id)) : unlockedFishIds, [allFishes, previewMode, unlockedFishIds]);
  const displayCatches = useMemo<UserCatch[]>(() => {
    if (!previewMode) return catches;
    return allFishes.slice(0, 4).map((fish, index) => ({
      id: `preview-${fish.id}`,
      user_id: "preview",
      fish_id: fish.id,
      trip_id: null,
      fish,
      image_url: fish.image_url,
      size_cm: [42, 58, 31, 46][index],
      caught_at: new Date(2026, 6 - index, 6 + index).toISOString(),
      location_name: ["대천항", "원산도", "군산", "태안"][index],
      location_lat: null,
      location_lng: null,
      location_captured_at: null,
      memo: null,
      created_at: null,
      updated_at: null,
      candidate_fish_ids: [],
      capture_method: "live_camera",
      id_method: "fallback_catalog",
      verification_status: "verified",
      verification_reason: null,
    }));
  }, [allFishes, catches, previewMode]);
  const unlockedCount = displayUnlockedFishIds.size;
  const totalFishCount = allFishes.length;

  const badgeContext = useMemo(
    () => ({
      catchCount: previewMode ? 5 : catches.length,
      uniqueSpecies: previewMode ? 3 : unlockedFishIds.size,
      completedTrips: previewMode ? 1 : trips.filter((trip) => trip.status === "done").length,
    }),
    [catches.length, previewMode, trips, unlockedFishIds.size]
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
          unlockedFishIds={displayUnlockedFishIds}
          totalFishCount={totalFishCount}
          unlockedCount={unlockedCount}
          onRefreshAll={refreshCollection}
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
        />
      )}
    </View>
  );
};

export default CollectionScreen;
