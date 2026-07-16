import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useState } from "react";
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from "react-native";
import { BadgeDetailModal } from "@/components/badges/BadgeDetailModal";
import { FieldBadgeAsset } from "@/components/badges/FieldBadgeAsset";
import { BADGE_CATALOG, isBadgeUnlocked, type BadgeUnlockContext } from "@/src/data/badges";
import { FIELD_COLORS, monoFont } from "@/src/theme/fieldJournal";

type Props = { insetsBottom: number; unlockContext: BadgeUnlockContext; isRefreshing?: boolean; onRefresh?: () => void };

export const BadgesPanel = ({ insetsBottom, unlockContext, isRefreshing = false, onRefresh }: Props) => {
  const [selectedBadgeIndex, setSelectedBadgeIndex] = useState<number | null>(null);
  const unlockedCount = BADGE_CATALOG.filter((badge) => isBadgeUnlocked(badge.id, unlockContext)).length;
  const selectedBadge = selectedBadgeIndex === null ? null : BADGE_CATALOG[selectedBadgeIndex];

  return <View className="flex-1">
    <FlatList
      data={BADGE_CATALOG}
      keyExtractor={(item) => item.id}
      numColumns={2}
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insetsBottom + 28 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={FIELD_COLORS.teal} /> : undefined}
      ListHeaderComponent={<View className="border-b py-5" style={{ borderColor: FIELD_COLORS.rule }}><Text className="text-lg font-black" style={{ color: FIELD_COLORS.ink }}>획득한 뱃지 <Text style={{ color: FIELD_COLORS.teal }}>{unlockedCount} / {BADGE_CATALOG.length}</Text></Text><Text className="mt-5 text-[12px] tracking-[1.6px]" style={{ color: FIELD_COLORS.ink, fontFamily: monoFont }}>FIELD MARKS 01</Text></View>}
      columnWrapperStyle={{ borderBottomWidth: 1, borderBottomColor: FIELD_COLORS.rule }}
      renderItem={({ item, index }) => {
        const unlocked = isBadgeUnlocked(item.id, unlockContext);
        return <TouchableOpacity
          accessibilityRole={unlocked ? "button" : undefined}
          accessibilityLabel={unlocked ? `${item.title} 배지 상세 보기` : `${item.title} 배지 잠김`}
          accessibilityState={{ disabled: !unlocked }}
          activeOpacity={0.72}
          disabled={!unlocked}
          onPress={unlocked ? () => setSelectedBadgeIndex(index) : undefined}
          className={`flex-1 px-3 py-6 ${index % 2 ? "border-l" : ""}`}
          style={{ borderColor: FIELD_COLORS.rule }}
        >
          <View className="mx-auto h-[148px] w-[148px] items-center justify-center"><FieldBadgeAsset badgeId={item.id} unlocked={unlocked} label={item.title} /></View>
          <View className="mt-2 flex-row items-center"><Text className="text-[17px] font-black" style={{ color: unlocked ? FIELD_COLORS.ink : FIELD_COLORS.muted }}>{item.title}</Text>{unlocked ? null : <FontAwesome name="lock" size={13} color={FIELD_COLORS.muted} style={{ marginLeft: 8 }} />}</View>
          <Text className="mt-1 min-h-[36px] text-xs leading-5" style={{ color: FIELD_COLORS.muted }}>{unlocked ? item.description : "아직 잠겨 있어요"}</Text>
          <Text className="mt-3 text-[10px]" style={{ color: "#9CB0B3", fontFamily: monoFont }}>MRK-{String(index + 1).padStart(3, "0")}</Text>
        </TouchableOpacity>;
      }}
    />
    {selectedBadge && isBadgeUnlocked(selectedBadge.id, unlockContext) ? <BadgeDetailModal
      badge={selectedBadge}
      badgeNumber={selectedBadgeIndex! + 1}
      context={unlockContext}
      unlocked={isBadgeUnlocked(selectedBadge.id, unlockContext)}
      visible
      onClose={() => setSelectedBadgeIndex(null)}
    /> : null}
  </View>;
};
