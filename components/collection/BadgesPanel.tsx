import FontAwesome from "@expo/vector-icons/FontAwesome";
import { FlatList, RefreshControl, Text, View } from "react-native";
import { BADGE_CATALOG, isBadgeUnlocked, type BadgeUnlockContext } from "@/src/data/badges";
import { FIELD_COLORS, monoFont } from "@/src/theme/fieldJournal";

type Props = { insetsBottom: number; unlockContext: BadgeUnlockContext; isRefreshing?: boolean; onRefresh?: () => void };

const ICONS: Record<string, React.ComponentProps<typeof FontAwesome>["name"]> = {
  first_catch: "flag",
  species_3: "book",
  species_10: "compass",
  catches_5: "hand-paper-o",
  trip_first: "anchor",
  season_ready: "calendar-o",
};

export const BadgesPanel = ({ insetsBottom, unlockContext, isRefreshing = false, onRefresh }: Props) => {
  const unlockedCount = BADGE_CATALOG.filter((badge) => isBadgeUnlocked(badge.id, unlockContext)).length;
  return <FlatList
    data={BADGE_CATALOG}
    keyExtractor={(item) => item.id}
    numColumns={2}
    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insetsBottom + 28 }}
    refreshControl={onRefresh ? <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={FIELD_COLORS.teal} /> : undefined}
    ListHeaderComponent={<View className="border-b py-5" style={{ borderColor: FIELD_COLORS.rule }}><Text className="text-lg font-black" style={{ color: FIELD_COLORS.ink }}>획득한 뱃지 <Text style={{ color: FIELD_COLORS.teal }}>{unlockedCount} / {BADGE_CATALOG.length}</Text></Text><Text className="mt-5 text-[12px] tracking-[1.6px]" style={{ color: FIELD_COLORS.ink, fontFamily: monoFont }}>FIELD MARKS 01</Text></View>}
    columnWrapperStyle={{ borderBottomWidth: 1, borderBottomColor: FIELD_COLORS.rule }}
    renderItem={({ item, index }) => {
      const unlocked = isBadgeUnlocked(item.id, unlockContext);
      return <View className={`flex-1 px-3 py-6 ${index % 2 ? "border-l" : ""}`} style={{ borderColor: FIELD_COLORS.rule }}>
        <View className="mx-auto h-28 w-28 items-center justify-center rounded-full border-[3px]" style={{ borderColor: unlocked ? FIELD_COLORS.teal : FIELD_COLORS.rule, backgroundColor: unlocked ? (index % 3 === 0 ? FIELD_COLORS.teal : FIELD_COLORS.ink) : "#EEF2F1" }}>
          <View className="h-20 w-20 items-center justify-center rounded-full border" style={{ borderColor: unlocked ? "#F4F7F6" : FIELD_COLORS.rule }}><FontAwesome name={ICONS[item.id] ?? "circle-o"} size={34} color={unlocked ? "#F4F7F6" : "#AAB8B9"} /></View>
        </View>
        <View className="mt-4 flex-row items-center"><Text className="text-[17px] font-black" style={{ color: unlocked ? FIELD_COLORS.ink : FIELD_COLORS.muted }}>{item.title}</Text>{unlocked ? null : <FontAwesome name="lock" size={13} color={FIELD_COLORS.muted} style={{ marginLeft: 8 }} />}</View>
        <Text className="mt-1 min-h-[36px] text-xs leading-5" style={{ color: FIELD_COLORS.muted }}>{unlocked ? item.description : item.id === "season_ready" ? "첫 시즌이 열리면 공개됩니다" : "아직 잠겨 있어요"}</Text>
        <Text className="mt-3 text-[10px]" style={{ color: "#9CB0B3", fontFamily: monoFont }}>MRK-{String(index + 1).padStart(3, "0")}</Text>
      </View>;
    }}
  />;
};
