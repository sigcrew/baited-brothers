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

  const unlockedCount = unlockedFishIds.size;
  const totalFishCount = allFishes.length;

  const badgeContext = useMemo(
    () => ({
      catchCount: catches.length,
      uniqueSpecies: unlockedFishIds.size,
      completedTrips: trips.filter((trip) => trip.status === "done").length,
    }),
    [catches.length, unlockedFishIds.size, trips]
  );

  const refreshCollection = () => {
    refetchFishes();
    refetchCatches();
    refetchTrips();
  };

  return (
    <View className="flex-1 bg-[#F4F7F8]" style={{ paddingTop: insets.top }}>
      <View className="border-b border-slate-200/80 bg-white px-4 pb-0 pt-2">
        <Text className="text-sm font-medium text-teal-800">낚시당한 녀석들</Text>
        <Text className="mt-0.5 text-2xl font-bold text-slate-900">수집</Text>
        <View className="mt-4 flex-row">
          {SEGMENTS.map(({ key, label }) => {
            const isActive = segment === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setSegment(key)}
                className="mr-6 pb-3"
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  className={`text-base font-semibold ${
                    isActive ? "text-slate-900" : "text-slate-400"
                  }`}
                >
                  {label}
                </Text>
                {isActive ? (
                  <View className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-700" />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {segment === "encyclopedia" && (
        <EncyclopediaPanel
          insetsBottom={insets.bottom}
          unlockedFishIds={unlockedFishIds}
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
          catches={catches}
          isLoading={catchesLoading}
          isRefreshing={catchesRefreshing}
          isLoggedIn={isLoggedIn}
          onRefresh={refetchCatches}
          onLoginPress={() => router.push("/(auth)/login")}
        />
      )}
    </View>
  );
};

export default CollectionScreen;
