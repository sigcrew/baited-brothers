import { View, Text, FlatList, RefreshControl } from "react-native";
import {
  BADGE_CATALOG,
  isBadgeUnlocked,
  type BadgeUnlockContext,
} from "@/src/data/badges";

type BadgesPanelProps = {
  insetsBottom: number;
  unlockContext: BadgeUnlockContext;
  isRefreshing?: boolean;
  onRefresh?: () => void;
};

export const BadgesPanel = ({
  insetsBottom,
  unlockContext,
  isRefreshing = false,
  onRefresh,
}: BadgesPanelProps) => {
  const unlockedCount = BADGE_CATALOG.filter((badge) =>
    isBadgeUnlocked(badge.id, unlockContext)
  ).length;

  return (
    <FlatList
      data={BADGE_CATALOG}
      keyExtractor={(item) => item.id}
      numColumns={2}
      columnWrapperStyle={{ gap: 10 }}
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: insetsBottom + 28,
        gap: 10,
      }}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#0f766e"
          />
        ) : undefined
      }
      ListHeaderComponent={
        <View className="mb-3">
          <Text className="text-xs font-medium text-teal-800">획득</Text>
          <Text className="mt-0.5 text-base font-semibold text-slate-900">
            {unlockedCount} / {BADGE_CATALOG.length}
          </Text>
          <Text className="mt-1 text-sm text-slate-500">
            조과와 출조로 뱃지를 모아요. 시즌 뱃지는 나중에 열려요.
          </Text>
        </View>
      }
      renderItem={({ item }) => {
        const unlocked = isBadgeUnlocked(item.id, unlockContext);
        return (
          <View
            className={`min-h-[148px] flex-1 overflow-hidden rounded-xl border px-3.5 py-4 ${
              unlocked
                ? "border-teal-200 bg-white"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <View
              className="mb-3 h-11 w-11 items-center justify-center rounded-full"
              style={{
                backgroundColor: unlocked ? `${item.accent}22` : "#E2E8F0",
              }}
            >
              <View
                className="h-5 w-5 rounded-full"
                style={{
                  backgroundColor: unlocked ? item.accent : "#94A3B8",
                }}
              />
            </View>
            <Text
              className={`text-[15px] font-semibold ${
                unlocked ? "text-slate-900" : "text-slate-500"
              }`}
            >
              {item.title}
            </Text>
            <Text
              className={`mt-1 text-xs leading-4 ${
                unlocked ? "text-slate-600" : "text-slate-400"
              }`}
            >
              {unlocked ? item.description : "아직 잠겨 있어요"}
            </Text>
            <Text
              className={`mt-3 text-[11px] font-semibold ${
                unlocked ? "text-teal-700" : "text-slate-400"
              }`}
            >
              {unlocked ? "획득함" : "미획득"}
            </Text>
          </View>
        );
      }}
    />
  );
};
