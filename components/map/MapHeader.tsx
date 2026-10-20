import FontAwesome from "@expo/vector-icons/FontAwesome";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import type { FavoriteFishingSpot } from "@/src/hooks/useFavoriteFishingSpots";
import { MAP_FILTERS, MAP_LAYOUT, type MapFilter } from "@/src/lib/mapScreen";
import { FIELD_COLORS, bodyExtraBoldFont, bodyFont, bodySemiBoldFont, monoFont } from "@/src/theme/fieldJournal";

const shadow = {
  shadowColor: FIELD_COLORS.ink,
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.14,
  shadowRadius: 8,
  elevation: 4,
} as const;

type MapHeaderProps = {
  topInset: number;
  placeName: string | null;
  isInitialLoading: boolean;
  isLocating: boolean;
  onLocate: () => void;
  activeFilter: MapFilter;
  filterCounts: Record<MapFilter, number>;
  onChangeFilter: (filter: MapFilter) => void;
  favoriteSpots: FavoriteFishingSpot[];
  favoritesLoading: boolean;
  selectedId: string | null;
  onSelectFavorite: (spot: FavoriteFishingSpot) => void;
};

/** 지도 위에 떠 있는 장소 이름 카드, 현재 위치 버튼, 필터 칩, 즐겨찾기 줄. */
export const MapHeader = ({
  topInset,
  placeName,
  isInitialLoading,
  isLocating,
  onLocate,
  activeFilter,
  filterCounts,
  onChangeFilter,
  favoriteSpots,
  favoritesLoading,
  selectedId,
  onSelectFavorite,
}: MapHeaderProps) => {
  const hasFavoriteRow = favoriteSpots.length > 0 || favoritesLoading;
  return (
    <View pointerEvents="box-none" className="absolute inset-x-0 top-0" style={{ paddingTop: topInset + 10 }}>
      <View className="mx-4 flex-row items-center" style={{ gap: 10 }}>
        <View
          className="min-w-0 flex-1 flex-row items-center rounded-full border bg-white px-4"
          style={{ borderColor: FIELD_COLORS.rule, height: MAP_LAYOUT.headerHeight, ...shadow }}
        >
          <FontAwesome name="map-marker" size={16} color={FIELD_COLORS.teal} />
          <View className="ml-2 min-w-0 flex-1">
            <Text
              numberOfLines={1}
              className="text-[13px]"
              style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont, includeFontPadding: false, lineHeight: 18 }}
            >
              {placeName || (isInitialLoading ? "기록 위치를 불러오는 중" : "나의 바다")}
            </Text>
            <Text
              numberOfLines={1}
              className="text-[8px] tracking-[1px]"
              style={{ color: FIELD_COLORS.muted, fontFamily: monoFont, includeFontPadding: false, lineHeight: 11 }}
            >
              PRIVATE FISHING MAP
            </Text>
          </View>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="현재 위치로 이동"
          onPress={onLocate}
          disabled={isLocating}
          className="items-center justify-center rounded-full border bg-white"
          style={{ borderColor: FIELD_COLORS.rule, height: MAP_LAYOUT.headerHeight, width: MAP_LAYOUT.headerHeight, ...shadow }}
        >
          {isLocating
            ? <ActivityIndicator size="small" color={FIELD_COLORS.teal} />
            : <FontAwesome name="crosshairs" size={20} color={FIELD_COLORS.ink} />}
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2" contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
        {MAP_FILTERS.map((filter) => {
          const active = activeFilter === filter.key;
          return (
            <TouchableOpacity
              key={filter.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${filter.label} 지도 필터 ${filterCounts[filter.key]}곳`}
              onPress={() => onChangeFilter(filter.key)}
              className="flex-row items-center rounded-full border"
              style={{
                borderColor: active ? FIELD_COLORS.teal : FIELD_COLORS.rule,
                backgroundColor: active ? FIELD_COLORS.teal : "rgba(255,255,255,0.96)",
                height: MAP_LAYOUT.filterRowHeight,
                paddingHorizontal: MAP_LAYOUT.filterHorizontalPadding,
                shadowColor: FIELD_COLORS.ink,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 5,
                elevation: 3,
              }}
            >
              <Text
                className="text-[11px]"
                style={{ color: active ? "#FFFFFF" : FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont, includeFontPadding: false, lineHeight: 16 }}
              >
                {filter.label}
              </Text>
              <Text
                className="text-[9px]"
                style={{
                  backgroundColor: active ? "rgba(255,255,255,0.18)" : FIELD_COLORS.foam,
                  borderRadius: MAP_LAYOUT.filterCountHeight / 2,
                  color: active ? "#FFFFFF" : FIELD_COLORS.muted,
                  fontFamily: monoFont,
                  height: MAP_LAYOUT.filterCountHeight,
                  includeFontPadding: false,
                  lineHeight: MAP_LAYOUT.filterCountHeight,
                  marginLeft: 8,
                  minWidth: MAP_LAYOUT.filterCountHeight,
                  paddingHorizontal: 5,
                  textAlign: "center",
                }}
              >
                {filterCounts[filter.key]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {hasFavoriteRow ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2" contentContainerStyle={{ gap: 7, paddingHorizontal: 16 }}>
          {favoritesLoading && favoriteSpots.length === 0 ? (
            <View className="rounded-full bg-white px-4 py-2">
              <ActivityIndicator size="small" color={FIELD_COLORS.teal} />
            </View>
          ) : favoriteSpots.map((spot) => (
            <TouchableOpacity
              key={spot.id}
              accessibilityRole="button"
              accessibilityLabel={`${spot.name} 즐겨찾기 장소로 이동`}
              onPress={() => onSelectFavorite(spot)}
              className="flex-row items-center rounded-full border px-3 py-1.5"
              style={{
                borderColor: selectedId === `favorite:${spot.id}` ? FIELD_COLORS.orange : FIELD_COLORS.rule,
                backgroundColor: "rgba(255,255,255,0.96)",
              }}
            >
              <FontAwesome name="star" size={10} color={FIELD_COLORS.orange} />
              <Text className="ml-1.5 text-[10px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>
                {spot.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
};

/** 헤더(필터·즐겨찾기 줄 포함)가 차지하는 높이. 빈 상태 카드 위치 계산용. */
export const mapHeaderHeight = (topInset: number, hasFavoriteRow: boolean) =>
  topInset +
  10 +
  MAP_LAYOUT.headerHeight +
  8 +
  MAP_LAYOUT.filterRowHeight +
  (hasFavoriteRow ? 8 + MAP_LAYOUT.favoriteRowHeight : 0) +
  12;

export const MapEmptyState = ({ top }: { top: number }) => (
  <View
    pointerEvents="none"
    className="absolute inset-x-5 rounded-2xl border bg-white px-5 py-4"
    style={{ borderColor: FIELD_COLORS.rule, top }}
  >
    <Text className="text-xl" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
      아직 지도에 표시할 기록이 없습니다
    </Text>
    <Text className="mt-2 text-sm leading-6" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
      지도에서 바다를 누르거나 현재 위치 버튼을 누르면 인근 수온과 물때를 확인할 수 있습니다.
    </Text>
  </View>
);
