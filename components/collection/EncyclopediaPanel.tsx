import { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
  Image,
  ScrollView,
} from "react-native";
import { useFishes, type Fish, CATEGORY_LABELS } from "@/src/hooks/useFishes";
import { FishThumb } from "@/components/collection/FishThumb";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { FIELD_COLORS, monoFont } from "@/src/theme/fieldJournal";

const CATEGORIES: (Fish["category"] | null)[] = [
  null,
  "flatfish",
  "rockfish",
  "seabass",
  "bream",
  "mackerel",
  "mullet",
  "cutlassfish",
  "eel",
  "pufferfish",
  "other",
];

type EncyclopediaPanelProps = {
  insetsBottom: number;
  unlockedFishIds: Set<string>;
  totalFishCount: number;
  unlockedCount: number;
  onRefreshAll?: () => void;
};

const FishRow = ({
  fish,
  unlocked,
  onPress,
}: {
  fish: Fish;
  unlocked: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.75}
    className="flex-row border-b py-4"
    style={{ borderColor: FIELD_COLORS.rule }}
  >
    <View className="h-36 w-[52%] overflow-hidden rounded-lg" style={{ backgroundColor: FIELD_COLORS.locked }}>
      {unlocked && fish.image_url ? <Image source={{ uri: fish.image_url }} className="h-full w-full" resizeMode="cover" /> : <View className="flex-1 items-center justify-center"><View className="h-14 w-28 rounded-[50%]" style={{ backgroundColor: "#A9B8B9" }} />{!unlocked ? <FontAwesome name="lock" size={16} color={FIELD_COLORS.muted} style={{ position: "absolute", bottom: 12, right: 12 }} /> : null}</View>}
    </View>
    <View className="flex-1 justify-center pl-5 py-2">
      <View>
        <Text
          className="text-2xl font-black"
          style={{ color: unlocked ? FIELD_COLORS.ink : FIELD_COLORS.muted }}
          numberOfLines={1}
        >
          {unlocked ? (fish.name_ko ?? fish.name) : "미확인 어종"}
        </Text>
      </View>
      <Text className="mt-2 text-[11px] tracking-[1px]" style={{ color: FIELD_COLORS.teal, fontFamily: monoFont }} numberOfLines={1}>
        {unlocked ? fish.name.toUpperCase() : "LOCKED SPECIMEN"}
      </Text>
      <View className="mt-3 h-px w-20" style={{ backgroundColor: FIELD_COLORS.rule }} />
      <Text className="mt-3 text-xs leading-5" style={{ color: FIELD_COLORS.muted }}>{unlocked ? `${CATEGORY_LABELS[fish.category]} · ${fish.min_size_cm ? `최소 ${fish.min_size_cm}cm` : "현장 발견"}` : "현장에서 발견하면\n정보가 열립니다"}</Text>
    </View>
  </TouchableOpacity>
);

const FishDetailModal = ({
  fish,
  unlocked,
  visible,
  onClose,
}: {
  fish: Fish | null;
  unlocked: boolean;
  visible: boolean;
  onClose: () => void;
}) => {
  if (!fish) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable
        onPress={onClose}
        className="flex-1 items-center justify-center bg-slate-950/50 px-4"
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full max-w-sm overflow-hidden rounded-2xl bg-white"
        >
          <View className="items-center bg-slate-100 py-8">
            {unlocked && fish.image_url ? (
              <Image
                source={{ uri: fish.image_url }}
                className="h-36 w-36 rounded-xl bg-slate-200"
                resizeMode="cover"
              />
            ) : (
              <FishThumb
                imageUrl={fish.image_url}
                unlocked={unlocked}
                size={120}
              />
            )}
            <Text className="mt-4 text-xl font-bold text-slate-900">
              {unlocked ? (fish.name_ko ?? fish.name) : "미확인 어종"}
            </Text>
            {unlocked && (
              <Text className="mt-1 text-sm text-slate-500">{fish.name}</Text>
            )}
            <View className="mt-2 rounded-md bg-slate-200/80 px-2.5 py-1">
              <Text className="text-xs font-medium text-slate-600">
                {CATEGORY_LABELS[fish.category]}
              </Text>
            </View>
          </View>
          <View className="p-5">
            {!unlocked ? (
              <Text className="text-center text-sm leading-5 text-slate-500">
                현장에서 카메라로 기록하면 이 칸이 해금됩니다.
              </Text>
            ) : (
              <>
                {fish.min_size_cm != null && (
                  <View className="mb-4">
                    <Text className="text-xs font-medium text-slate-400">
                      최소 크기
                    </Text>
                    <Text className="mt-0.5 text-lg font-semibold text-slate-900">
                      {fish.min_size_cm}cm
                    </Text>
                  </View>
                )}
                <Text className="text-xs font-medium text-slate-400">설명</Text>
                <Text className="mt-1 text-[15px] leading-6 text-slate-700">
                  {fish.description?.trim() || "정보가 아직 없어요."}
                </Text>
              </>
            )}
          </View>
          <TouchableOpacity
            onPress={onClose}
            className="mx-4 mb-4 rounded-xl bg-slate-900 py-3.5 active:bg-slate-800"
          >
            <Text className="text-center font-medium text-white">닫기</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export const EncyclopediaPanel = ({
  insetsBottom,
  unlockedFishIds,
  totalFishCount,
  unlockedCount,
  onRefreshAll,
}: EncyclopediaPanelProps) => {
  const [selectedCategory, setSelectedCategory] = useState<
    Fish["category"] | null
  >(null);
  const [selectedFish, setSelectedFish] = useState<Fish | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const { fishes, isLoading, isRefreshing, error, refetch, retry } =
    useFishes(selectedCategory);

  const progressLabel = useMemo(() => {
    if (totalFishCount <= 0) return "도감을 불러오는 중";
    return `${unlockedCount} / ${totalFishCount}`;
  }, [unlockedCount, totalFishCount]);

  const progressRatio =
    totalFishCount > 0 ? Math.min(unlockedCount / totalFishCount, 1) : 0;

  const handleRefresh = () => {
    refetch();
    onRefreshAll?.();
  };

  return (
    <>
      <View className="px-5 pb-3 pt-5" style={{ backgroundColor: FIELD_COLORS.foam }}>
        <View className="flex-row items-end justify-between">
          <View>
            <Text className="text-[36px] font-black" style={{ color: FIELD_COLORS.ink }}>
              {progressLabel}
            </Text>
          </View>
          <Text className="text-[10px] tracking-[1px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>{fishes.length} SPECIMENS</Text>
        </View>
        <View className="mt-3 h-[2px] bg-slate-200">
          <View
            className="h-full"
            style={{ width: `${progressRatio * 100}%`, backgroundColor: FIELD_COLORS.teal }}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-5 -mx-5"
          contentContainerStyle={{ paddingHorizontal: 20 }}
        >
          {CATEGORIES.map((item) => {
            const label = item ? CATEGORY_LABELS[item] : "전체";
            const isSelected = selectedCategory === item;
            return (
              <TouchableOpacity
                key={item ?? "all"}
                onPress={() => setSelectedCategory(item)}
                className="mr-6 border-b-2 pb-2"
                style={{ borderColor: isSelected ? FIELD_COLORS.teal : "transparent" }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{ color: isSelected ? FIELD_COLORS.teal : FIELD_COLORS.muted }}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View className="flex-1 px-5">
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#0f766e" />
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-4">
            <Text className="text-center text-slate-600">
              도감을 불러오지 못했습니다.
            </Text>
            <TouchableOpacity
              onPress={retry}
              className="mt-4 rounded-lg bg-slate-200 px-4 py-2"
            >
              <Text className="font-medium text-slate-700">다시 시도</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={fishes}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const unlocked = unlockedFishIds.has(item.id);
              return (
                <FishRow
                  fish={item}
                  unlocked={unlocked}
                  onPress={() => {
                    setSelectedFish(item);
                    setDetailVisible(true);
                  }}
                />
              );
            }}
            ListHeaderComponent={<View className="border-b py-5" style={{ borderColor: FIELD_COLORS.rule }}><Text className="text-[12px] tracking-[1.5px]" style={{ color: FIELD_COLORS.ink, fontFamily: monoFont }}>01  {selectedCategory ? CATEGORY_LABELS[selectedCategory].toUpperCase() : "ALL SPECIMENS"}</Text></View>}
            contentContainerStyle={{ paddingBottom: insetsBottom + 28 }}
            ListEmptyComponent={
              <View className="items-center py-16">
                <Text className="text-slate-500">이 카테고리에 어종이 없어요.</Text>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor="#0f766e"
              />
            }
          />
        )}
      </View>

      <FishDetailModal
        fish={selectedFish}
        unlocked={
          selectedFish ? unlockedFishIds.has(selectedFish.id) : false
        }
        visible={detailVisible}
        onClose={() => {
          setDetailVisible(false);
          setSelectedFish(null);
        }}
      />
    </>
  );
};
