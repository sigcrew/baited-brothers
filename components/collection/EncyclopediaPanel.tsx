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
import { FIELD_COLORS, monoFont } from "@/src/theme/fieldJournal";

const CATEGORIES: (CatalogGroup | null)[] = [null, ...CATALOG_GROUPS];

const GROUP_CARD_GUIDES: Record<
  CatalogGroup,
  { seasons: number[]; bait: string }
> = {
  flatfish: { seasons: [3, 4, 5, 9, 10, 11], bait: "웜" },
  rockfish: { seasons: [3, 4, 5, 10, 11, 12], bait: "웜" },
  bream: { seasons: [4, 5, 6, 9, 10, 11], bait: "크릴" },
  seabass_croaker: { seasons: [5, 6, 7, 8, 9, 10], bait: "미노우" },
  pelagic: { seasons: [6, 7, 8, 9, 10, 11], bait: "메탈지그" },
  filefish: { seasons: [6, 7, 8, 9, 10], bait: "조개살" },
  pufferfish: { seasons: [5, 6, 7, 8, 9], bait: "오징어살" },
  eel: { seasons: [5, 6, 7, 8, 9, 10], bait: "오징어살" },
  coastal: { seasons: [4, 5, 6, 7, 8, 9, 10], bait: "갯지렁이" },
  squid: { seasons: [4, 5, 6, 9, 10, 11, 12], bait: "에기" },
  octopus: { seasons: [3, 4, 5, 9, 10, 11], bait: "왕눈이에기" },
};

const formatSeasonRanges = (months: number[]) => {
  const sorted = [...new Set(months)].sort((a, b) => a - b);
  if (sorted.length === 0) return null;

  const ranges: Array<[number, number]> = [];
  let start = sorted[0];
  let end = sorted[0];

  for (const month of sorted.slice(1)) {
    if (month === end + 1) {
      end = month;
    } else {
      ranges.push([start, end]);
      start = month;
      end = month;
    }
  }
  ranges.push([start, end]);

  return `${ranges
    .map(([rangeStart, rangeEnd]) =>
      rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}–${rangeEnd}`,
    )
    .join("·")}월`;
};

const getFishCardGuide = (fish: Fish) => {
  const fallback =
    GROUP_CARD_GUIDES[fish.collection_group as CatalogGroup] ??
    GROUP_CARD_GUIDES.coastal;
  const bait = fish.recommended_baits[0] ?? fallback.bait;

  if (fish.min_size_cm) {
    return `금지체장 ${fish.min_size_cm}cm · 미끼 ${bait}`;
  }

  const season =
    formatSeasonRanges(
      fish.peak_seasons.length > 0 ? fish.peak_seasons : fallback.seasons,
    ) ?? "시즌 확인 중";
  return `제철 ${season} · 미끼 ${bait}`;
};

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

const ErasedTextLine = ({
  text,
  width,
  color,
  size,
  tracking = 0,
  bold = false,
  intensity = "normal",
}: {
  text: string;
  width: number;
  color: string;
  size: number;
  tracking?: number;
  bold?: boolean;
  intensity?: "normal" | "strong";
}) => {
  const textWidth = Math.min(
    width,
    Math.max(size, Array.from(text).length * size * 0.96),
  );

  return (
    <View style={{ width, height: size + 5, overflow: "hidden" }}>
      <Text
        numberOfLines={1}
        style={{
          color,
          fontFamily: bold ? undefined : monoFont,
          fontSize: size,
          fontWeight: bold ? "900" : "400",
          letterSpacing: tracking,
          opacity: 1,
        }}
      >
        {text}
      </Text>
      {intensity === "strong" ? (
        <>
          <View
            className="absolute"
            style={{
              left: 3.5,
              top: 0,
              width: Math.max(0, textWidth - 7),
              height: size + 5,
              backgroundColor: FIELD_COLORS.foam,
              opacity: 0.995,
            }}
          />
          <View
            className="absolute overflow-hidden"
            style={{
              left: textWidth - 6,
              top: 0,
              width: 6,
              height: size + 5,
            }}
          >
            <Text
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: size + 4,
                color,
                fontSize: size,
                fontWeight: bold ? "900" : "400",
                transform: [{ translateX: -(size - 7) }],
              }}
            >
              {Array.from(text).at(-1)}
            </Text>
          </View>
          {[
            {
              left: textWidth * 0.34,
              top: size * 0.24,
              width: 6,
              height: 3,
            },
            {
              left: textWidth * 0.55,
              top: size * 0.52,
              width: 4,
              height: 4,
            },
            {
              left: textWidth * 0.7,
              top: size * 0.72,
              width: 7,
              height: 3,
            },
          ].map((fragment, index) => (
            <View
              key={`erased-fragment-${index}`}
              className="absolute overflow-hidden"
              style={fragment}
            >
              <Text
                numberOfLines={1}
                style={{
                  position: "absolute",
                  left: 0,
                  top: -fragment.top,
                  width: textWidth,
                  color,
                  fontFamily: bold ? undefined : monoFont,
                  fontSize: size,
                  fontWeight: bold ? "900" : "400",
                  letterSpacing: tracking,
                  transform: [{ translateX: -fragment.left }],
                }}
              >
                {text}
              </Text>
            </View>
          ))}
          {[
            {
              left: textWidth * 0.32,
              top: size * 0.32,
              width: 6,
              height: 2,
              rotate: "-8deg",
            },
            {
              left: textWidth * 0.53,
              top: size * 0.58,
              width: 3,
              height: 3,
              rotate: "4deg",
            },
            {
              left: textWidth * 0.69,
              top: size * 0.75,
              width: 7,
              height: 2,
              rotate: "-3deg",
            },
          ].map((mark, index) => (
            <View
              key={`erased-ink-${index}`}
              className="absolute"
              style={{
                left: mark.left,
                top: mark.top,
                width: mark.width,
                height: mark.height,
                backgroundColor: color,
                opacity: 0.72,
                transform: [{ rotate: mark.rotate }],
              }}
            />
          ))}
        </>
      ) : (
        <>
          <View
            className="absolute h-[7px]"
            style={{
              left: width * 0.08,
              top: size * 0.24,
              width: width * 0.38,
              backgroundColor: FIELD_COLORS.foam,
              opacity: 0.98,
              transform: [{ rotate: "-3deg" }],
            }}
          />
          <View
            className="absolute h-[8px]"
            style={{
              right: width * 0.02,
              top: size * 0.54,
              width: width * 0.46,
              backgroundColor: FIELD_COLORS.foam,
              opacity: 0.96,
              transform: [{ rotate: "2deg" }],
            }}
          />
          <View
            className="absolute h-[5px]"
            style={{
              left: width * 0.25,
              top: size * 0.78,
              width: width * 0.5,
              backgroundColor: FIELD_COLORS.foam,
              opacity: 0.92,
              transform: [{ rotate: "-1deg" }],
            }}
          />
          <View
            className="absolute h-[3px]"
            style={{
              left: 0,
              top: size * 0.66,
              width: width * 0.17,
              backgroundColor: FIELD_COLORS.foam,
              opacity: 0.88,
            }}
          />
          <View
            className="absolute h-[4px]"
            style={{
              right: width * 0.18,
              top: size * 0.08,
              width: width * 0.22,
              backgroundColor: FIELD_COLORS.foam,
              opacity: 0.94,
            }}
          />
        </>
      )}
    </View>
  );
};

const RedactedFishMetadata = ({ fish }: { fish: Fish }) => (
  <View
    className="min-w-0 flex-1 justify-center py-2 pl-4"
    accessibilityLabel="미발견 어종 정보 잠김"
  >
    <ErasedTextLine
      text={fish.name_ko ?? fish.name}
      width={132}
      color={FIELD_COLORS.ink}
      size={22}
      bold
      intensity="strong"
    />
    <View className="mt-3">
      <ErasedTextLine
        text={fish.name.toUpperCase()}
        width={156}
        color={FIELD_COLORS.teal}
        size={10}
        tracking={0.8}
      />
    </View>
    <View
      className="mt-4 h-px w-20"
      style={{ backgroundColor: FIELD_COLORS.rule }}
    />
    <View className="mt-4">
      <ErasedTextLine
        text={getFishCardGuide(fish)}
        width={156}
        color={FIELD_COLORS.muted}
        size={11}
      />
    </View>
  </View>
);

type EncyclopediaPanelProps = {
  insetsBottom: number;
  allFishes: Fish[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  unlockedFishIds: Set<string>;
  totalFishCount: number;
  unlockedCount: number;
  onRefreshAll?: () => void;
  onRetry: () => void;
  onOpenFish: (fishId: string) => void;
};

const FishRow = ({
  fish,
  unlocked,
  onPress,
}: {
  fish: Fish;
  unlocked: boolean;
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
          : "미발견 어종 잠금 화면 보기"
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
                : "미발견 어종 점선 실루엣"
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
            name={unlocked ? "check" : "circle-o"}
            size={10}
            color="white"
          />
          <Text className="ml-1 text-[9px] text-white" style={{ fontFamily: monoFont }}>
            {unlocked ? "발견 완료" : "미발견"}
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
            numberOfLines={2}
          >
            {fish.name.toUpperCase()}
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
        <RedactedFishMetadata fish={fish} />
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
          <Text className="text-[10px] tracking-[1px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>FIELD 60 · V1</Text>
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
                  onPress={() => onOpenFish(item.id)}
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

    </>
  );
};
