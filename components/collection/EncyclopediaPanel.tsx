import { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  ScrollView,
} from "react-native";
import {
  CATALOG_GROUPS,
  CATEGORY_LABELS,
  type CatalogGroup,
  type Fish,
} from "@/src/hooks/useFishes";
import { getField60Illustration } from "@/src/data/field60Illustrations";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import Svg, { Circle, Path } from "react-native-svg";
import { getFishCardGuide, getLockedFishHint, scientificBinomial } from "@/src/lib/fishCardGuide";
import { FIELD_COLORS, monoFont } from "@/src/theme/fieldJournal";

const CATEGORIES: (CatalogGroup | null)[] = [null, ...CATALOG_GROUPS];

const LockedFishOutline = () => (
  <View className="flex-1 items-center justify-center">
    <Svg width="72%" height="62%" viewBox="0 0 180 92" fill="none">
      <Path
        d="M13 46c16-24 43-36 76-34 24 1 45 9 61 22l22-14-6 26 6 26-22-14C134 71 113 79 89 80 56 82 29 70 13 46Z"
        stroke={FIELD_COLORS.muted}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M76 13C86 2 99-2 114 1c-5 8-6 15-3 22M76 79c10 11 23 15 38 12-5-8-6-15-3-22"
        stroke={FIELD_COLORS.muted}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="44" cy="40" r="4" fill={FIELD_COLORS.muted} />
    </Svg>
    <FontAwesome
      name="lock"
      size={14}
      color={FIELD_COLORS.muted}
      style={{ position: "absolute", bottom: 12, right: 12 }}
    />
  </View>
);

const LockedFishMetadata = ({ fish, hasGeneralRecord = false }: { fish: Fish; hasGeneralRecord?: boolean }) => {
  const category =
    CATEGORY_LABELS[fish.collection_group as CatalogGroup] ?? "연안 어종";
  const hint = getLockedFishHint(fish);

  return (
    <View
      className="min-w-0 flex-1 justify-center py-2 pl-4"
      accessibilityLabel={`${category} 미확인 어종. ${hint.tactic}${hint.where ? `. ${hint.where}` : ""}. 발견하면 이름과 상세 공개`}
    >
      <Text
        className="text-[10px] tracking-[1px]"
        style={{ color: FIELD_COLORS.teal, fontFamily: monoFont }}
        numberOfLines={1}
      >
        {category.toUpperCase()}
      </Text>
      <View className="mt-2 flex-row items-center">
        <FontAwesome name="lock" size={13} color={FIELD_COLORS.ink} />
        <Text
          className="ml-2 text-[22px] font-black"
          style={{ color: FIELD_COLORS.ink }}
          numberOfLines={1}
        >
          미확인 어종
        </Text>
      </View>
      <Text
        className="mt-2 text-[9px] tracking-[1px]"
        style={{ color: hasGeneralRecord ? FIELD_COLORS.orange : FIELD_COLORS.teal, fontFamily: monoFont }}
        numberOfLines={1}
      >
        {hasGeneralRecord ? "일반 기록만 있음 · 위치 인증 시 발견" : "발견하면 이름과 상세 공개"}
      </Text>
      <View className="mt-3 h-px w-full" style={{ backgroundColor: FIELD_COLORS.rule }} />
      <Text
        className="mt-3 text-xs leading-5"
        style={{ color: FIELD_COLORS.ink }}
        numberOfLines={1}
      >
        {hint.tactic}
      </Text>
      <Text
        className="text-[11px] leading-4"
        style={{ color: FIELD_COLORS.muted }}
        numberOfLines={1}
      >
        {hint.where ?? "금어기·금지체장은 발견 후 공개"}
      </Text>
    </View>
  );
};

type EncyclopediaPanelProps = {
  insetsBottom: number;
  allFishes: Fish[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  unlockedFishIds: Set<string>;
  totalFishCount: number;
  unlockedCount: number;
  /** 인증되지 않아 도감에 안 들어간 일반 기록 수. 0이면 안내를 숨긴다. */
  generalRecordCount?: number;
  /** 일반 기록으로만 잡힌 어종. 잠긴 카드에 "기록은 있음"을 표시한다. */
  generalRecordOnlyFishIds?: Set<string>;
  onRefreshAll?: () => void;
  onRetry: () => void;
  onOpenFish: (fishId: string) => void;
};

const FishRow = ({
  fish,
  unlocked,
  hasGeneralRecord = false,
  onPress,
}: {
  fish: Fish;
  unlocked: boolean;
  hasGeneralRecord?: boolean;
  onPress: () => void;
}) => {
  const localIllustration = getField60Illustration(
    fish.catalog_sort_order,
    unlocked ? "color" : "outline",
  );
  const imageSource =
    localIllustration ??
    (unlocked && fish.image_url ? { uri: fish.image_url } : null);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      className="flex-row border-b py-4"
      style={{ borderColor: FIELD_COLORS.rule }}
      accessibilityRole="button"
      accessibilityLabel={
        unlocked
          ? `${fish.name_ko ?? fish.name} 도감 상세 보기`
          : "미확인 어종 잠금 화면 보기"
      }
      accessibilityHint={
        unlocked
          ? "발견 기록이 있는 어종입니다"
          : "아직 발견 기록이 없는 어종입니다"
      }
    >
      <View className="h-36 w-[48%] overflow-hidden rounded-lg" style={{ backgroundColor: FIELD_COLORS.locked }}>
        {imageSource ? (
          <Image
            source={imageSource}
            style={{ width: "100%", height: "100%" }}
            resizeMode="contain"
            accessibilityLabel={
              unlocked
                ? `${fish.name_ko ?? fish.name} 컬러 일러스트`
                : "미확인 어종 점선 실루엣"
            }
          />
        ) : unlocked ? (
          <View className="flex-1 items-center justify-center">
            <FontAwesome name="image" size={28} color={FIELD_COLORS.muted} />
            <Text
              className="mt-2 text-[9px] tracking-[1px]"
              style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}
            >
              IMAGE PENDING
            </Text>
          </View>
        ) : (
          <LockedFishOutline />
        )}
        <View
          className="absolute bottom-2 left-2 flex-row items-center px-2 py-1"
          style={{ backgroundColor: unlocked ? FIELD_COLORS.teal : "rgba(5, 31, 40, 0.78)" }}
        >
          <FontAwesome
            name={unlocked ? "check" : "lock"}
            size={10}
            color="white"
          />
          <Text className="ml-1 text-[9px] text-white" style={{ fontFamily: monoFont }}>
            {unlocked ? "발견 완료" : "미확인"}
          </Text>
        </View>
      </View>
      {unlocked ? (
        <View className="min-w-0 flex-1 justify-center py-2 pl-4">
          <View>
            <Text
              className="text-2xl font-black"
              style={{ color: FIELD_COLORS.ink }}
              numberOfLines={1}
            >
              {fish.name_ko ?? fish.name}
            </Text>
          </View>
          <Text
            className="mt-2 text-[10px] leading-[15px] tracking-[0.7px]"
            style={{ color: FIELD_COLORS.teal, fontFamily: monoFont }}
            numberOfLines={1}
          >
            {scientificBinomial(fish.name).toUpperCase()}
          </Text>
          <View className="mt-3 h-px w-20" style={{ backgroundColor: FIELD_COLORS.rule }} />
          <Text
            className="mt-3 text-xs leading-5"
            style={{ color: FIELD_COLORS.muted }}
            numberOfLines={2}
          >
            {getFishCardGuide(fish)}
          </Text>
        </View>
      ) : (
        <LockedFishMetadata fish={fish} hasGeneralRecord={hasGeneralRecord} />
      )}
    </TouchableOpacity>
  );
};

export const EncyclopediaPanel = ({
  insetsBottom,
  allFishes,
  isLoading,
  isRefreshing,
  error,
  unlockedFishIds,
  totalFishCount,
  unlockedCount,
  generalRecordCount = 0,
  generalRecordOnlyFishIds,
  onRefreshAll,
  onRetry,
  onOpenFish,
}: EncyclopediaPanelProps) => {
  const [selectedCategory, setSelectedCategory] = useState<CatalogGroup | null>(null);

  const fishes = useMemo(
    () => selectedCategory
      ? allFishes.filter((fish) => fish.collection_group === selectedCategory)
      : allFishes,
    [allFishes, selectedCategory]
  );

  const progressLabel = useMemo(() => {
    if (totalFishCount <= 0) return "도감을 불러오는 중";
    return `${unlockedCount} / ${totalFishCount}`;
  }, [unlockedCount, totalFishCount]);

  const progressRatio =
    totalFishCount > 0 ? Math.min(unlockedCount / totalFishCount, 1) : 0;

  const handleRefresh = () => {
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
          <Text className="text-[10px] tracking-[1px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>국내 연안 60종</Text>
        </View>
        <View className="mt-3 h-[2px] bg-slate-200">
          <View
            className="h-full"
            style={{ width: `${progressRatio * 100}%`, backgroundColor: FIELD_COLORS.teal }}
          />
        </View>
        {generalRecordCount > 0 ? (
          <Text className="mt-2 text-[11px] leading-4" style={{ color: FIELD_COLORS.muted }}>
            위치가 확인된 조과만 도감에 반영됩니다 · 일반 기록 {generalRecordCount}건은 카드에만 남아 있어요
          </Text>
        ) : null}

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
                accessibilityRole="tab"
                accessibilityLabel={`${label} 어종 분류`}
                accessibilityState={{ selected: isSelected }}
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
        ) : error && fishes.length === 0 ? (
          <View className="flex-1 items-center justify-center px-4">
            <Text className="text-center text-slate-600">
              도감을 불러오지 못했습니다.
            </Text>
            <TouchableOpacity
              onPress={onRetry}
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
                  hasGeneralRecord={!unlocked && Boolean(generalRecordOnlyFishIds?.has(item.id))}
                  onPress={() => onOpenFish(item.id)}
                />
              );
            }}
            ListHeaderComponent={<View className="border-b py-5" style={{ borderColor: FIELD_COLORS.rule }}><Text className="text-[12px] tracking-[1.5px]" style={{ color: FIELD_COLORS.ink, fontFamily: monoFont }}>{selectedCategory ? CATEGORY_LABELS[selectedCategory] : "전체 어종"} · {fishes.length}종</Text></View>}
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

    </>
  );
};
