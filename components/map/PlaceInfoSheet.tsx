import type { RefObject } from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { FishingBobberMarker } from "@/components/map/FishingBobberMarker";
import type { MarineConditions } from "@/src/hooks/useMarineConditions";
import { formatTideTime, nextTide } from "@/src/lib/marineTides";
import {
  MAP_LAYOUT,
  formatClock,
  formatObservedAgo,
  formatRecordDate,
  formatTimelineClock,
  weatherIconName,
  type MapEntry,
} from "@/src/lib/mapScreen";
import { FIELD_COLORS, bodyExtraBoldFont, bodyFont, bodySemiBoldFont, displayFont, monoFont } from "@/src/theme/fieldJournal";

export type SheetMode = "info" | "records";

const Metric = ({ label, value }: { label: string; value: string }) => (
  <View className="min-w-0 flex-1 px-3 py-2.5">
    <Text className="text-[11px]" style={{ color: FIELD_COLORS.muted, fontFamily: bodySemiBoldFont }}>{label}</Text>
    <Text numberOfLines={1} adjustsFontSizeToFit className="mt-0.5 text-[22px]" style={{ color: FIELD_COLORS.ink, fontFamily: displayFont }}>
      {value}
    </Text>
  </View>
);

const kindLabel = (kind: MapEntry["kind"]) =>
  kind === "catch"
    ? "CATCH PLACE"
    : kind === "trip"
      ? "TRIP PLACE"
      : kind === "favorite"
        ? "FAVORITE PLACE"
        : kind === "current"
          ? "CURRENT LOCATION"
          : "SELECTED PLACE";

type PlaceRecordsListProps = {
  entries: MapEntry[];
  onOpen: (entry: MapEntry) => void;
};

/** 선택 장소 반경의 조과·출조 목록(최신순). */
export const PlaceRecordsList = ({ entries, onOpen }: PlaceRecordsListProps) => {
  if (!entries.length) {
    return (
      <View className="items-center px-6 py-10">
        <FontAwesome name="map-o" size={24} color={FIELD_COLORS.muted} />
        <Text className="mt-3 text-base" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
          반경 2km 안에 기록이 없습니다
        </Text>
        <Text className="mt-2 text-center text-xs leading-5" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
          이 장소로 출조를 만들거나 조과 위치를 남기면 여기에서 함께 볼 수 있습니다.
        </Text>
      </View>
    );
  }
  return (
    <>
      {[...entries]
        .sort((left, right) => (right.recordedAt ?? "").localeCompare(left.recordedAt ?? ""))
        .map((entry) => (
          <TouchableOpacity
            key={entry.id}
            accessibilityRole="button"
            accessibilityLabel={`${entry.detailName ?? entry.name} 기록 열기`}
            onPress={() => onOpen(entry)}
            className="flex-row items-center border-b py-4"
            style={{ borderColor: FIELD_COLORS.rule }}
          >
            <View className="h-10 w-10 items-center justify-center border" style={{ borderColor: entry.kind === "catch" ? FIELD_COLORS.orange : FIELD_COLORS.teal }}>
              <FontAwesome
                name={entry.kind === "catch" ? "camera" : "calendar-o"}
                size={16}
                color={entry.kind === "catch" ? FIELD_COLORS.orange : FIELD_COLORS.teal}
              />
            </View>
            <View className="min-w-0 flex-1 px-3">
              <Text numberOfLines={1} className="text-sm" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
                {entry.detailName ?? entry.name}
              </Text>
              <Text numberOfLines={1} className="mt-1 text-[11px]" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
                {entry.kind === "catch" ? "조과" : "출조"} · {formatRecordDate(entry.recordedAt)} · {entry.name}
              </Text>
            </View>
            <FontAwesome name="long-arrow-right" size={15} color={FIELD_COLORS.ink} />
          </TouchableOpacity>
        ))}
    </>
  );
};

type MarineConditionsPanelProps = {
  conditions: MarineConditions | null;
  isLoading: boolean;
  error: Error | null;
  onRefetch: () => void;
};

/** 24시간 예보·조석 스트립, 핵심 지표 3개, 관측소 설명. */
export const MarineConditionsPanel = ({ conditions, isLoading, error, onRefetch }: MarineConditionsPanelProps) => {
  const highTide = nextTide(conditions?.tides ?? [], "high");
  const lowTide = nextTide(conditions?.tides ?? [], "low");
  return (
    <>
      {conditions?.weatherTimeline?.length ? (
        <View className="mt-3 border-y py-3" style={{ borderColor: FIELD_COLORS.rule }}>
          <View className="mb-2 flex-row items-center justify-between">
            <Text className="text-[9px] tracking-[1.2px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
              24H OUTLOOK · 시간대별 출조 정보
            </Text>
            <Text className="text-[9px]" style={{ color: FIELD_COLORS.teal, fontFamily: bodySemiBoldFont }}>기상청 예보</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {conditions.weatherTimeline.map((forecast) => (
              <View key={forecast.forecastAt} className="w-[92px] border px-2.5 py-2" style={{ borderColor: FIELD_COLORS.rule, backgroundColor: FIELD_COLORS.foam }}>
                <Text className="text-[10px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
                  {formatTimelineClock(forecast.forecastAt)}
                </Text>
                <View className="mt-1.5 flex-row items-center">
                  <FontAwesome name={weatherIconName(forecast.condition)} size={13} color={FIELD_COLORS.orange} />
                  <Text className="ml-1.5 text-base" style={{ color: FIELD_COLORS.ink, fontFamily: displayFont }}>
                    {forecast.temperatureC == null ? "-" : `${forecast.temperatureC.toFixed(0)}°`}
                  </Text>
                </View>
                <Text className="mt-1 text-[9px]" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
                  강수 {forecast.precipitationProbabilityPercent == null ? "-" : `${forecast.precipitationProbabilityPercent.toFixed(0)}%`}
                </Text>
                <Text className="mt-0.5 text-[9px]" style={{ color: FIELD_COLORS.teal, fontFamily: bodySemiBoldFont }}>
                  {forecast.windDirection ?? "-"} {forecast.windSpeedMs == null ? "-" : `${forecast.windSpeedMs.toFixed(1)}m/s`}
                </Text>
              </View>
            ))}
          </ScrollView>
          {conditions.tides.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2" contentContainerStyle={{ gap: 6 }}>
              {conditions.tides.map((tide) => (
                <View key={`${tide.type}:${tide.at}`} className="flex-row items-center px-2 py-1" style={{ backgroundColor: tide.type === "high" ? "#E6F5F2" : FIELD_COLORS.locked }}>
                  <Text className="text-[9px]" style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>
                    {tide.type === "high" ? "만조" : "간조"} {formatClock(tide.at)}
                  </Text>
                  {tide.heightCm == null ? null : (
                    <Text className="ml-1 text-[9px]" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>{tide.heightCm.toFixed(0)}cm</Text>
                  )}
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      <View className="mt-2.5 flex-row border-y" style={{ borderColor: FIELD_COLORS.rule }}>
        <Metric label="다음 만조" value={formatTideTime(highTide?.at)} />
        <View className="w-px" style={{ backgroundColor: FIELD_COLORS.rule }} />
        <Metric label="바람" value={conditions?.windSpeedMs == null ? "-" : `${conditions.windSpeedMs.toFixed(1)}m/s`} />
        <View className="w-px" style={{ backgroundColor: FIELD_COLORS.rule }} />
        <Metric label="수온" value={conditions?.waterTemperatureC == null ? "-" : `${conditions.waterTemperatureC.toFixed(1)}°C`} />
      </View>

      <View className="mt-2.5 flex-row items-center">
        <View className="min-w-0 flex-1">
          {conditions ? (
            <>
              <Text numberOfLines={1} className="text-[11px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>
                {conditions.station.name} 관측소 · 선택 지점에서 {conditions.station.distanceKm.toFixed(1)}km
              </Text>
              <View className="mt-1 flex-row items-center">
                <Text className="text-[10px]" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
                  국립해양조사원 · {formatObservedAgo(conditions.observedAt)}
                </Text>
                <View className="mx-2 h-3 w-px" style={{ backgroundColor: FIELD_COLORS.rule }} />
                {conditions.waterTemperatureDelta24hC == null ? (
                  <View className="px-1.5 py-0.5" style={{ backgroundColor: FIELD_COLORS.locked }}>
                    <Text className="text-[9px]" style={{ color: FIELD_COLORS.muted, fontFamily: bodySemiBoldFont }}>24H 변화 없음</Text>
                  </View>
                ) : (
                  <Text className="text-[10px]" style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>
                    24H {conditions.waterTemperatureDelta24hC >= 0 ? "+" : ""}{conditions.waterTemperatureDelta24hC.toFixed(1)}°C
                  </Text>
                )}
                {lowTide ? (
                  <Text className="ml-2 text-[10px]" style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>
                    간조 {formatTideTime(lowTide.at)}
                  </Text>
                ) : null}
              </View>
            </>
          ) : isLoading ? (
            <View className="flex-row items-center">
              <ActivityIndicator size="small" color={FIELD_COLORS.teal} />
              <Text className="ml-2 text-xs" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>인근 관측소를 찾는 중입니다</Text>
            </View>
          ) : (
            <TouchableOpacity accessibilityRole="button" onPress={onRefetch} className="flex-row items-center">
              <View className="border px-2 py-1" style={{ borderColor: FIELD_COLORS.orange, backgroundColor: "#FFF0E9" }}>
                <Text className="text-[10px]" style={{ color: FIELD_COLORS.orange, fontFamily: bodyExtraBoldFont }}>
                  {error ? "불러오기 실패" : "관측 자료 없음"}
                </Text>
              </View>
              <Text className="ml-2 text-[11px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>눌러서 다시 확인</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </>
  );
};

type PlaceInfoSheetProps = {
  sheetRef: RefObject<BottomSheet | null>;
  bottomInset: number;
  selected: MapEntry;
  placeName: string | null;
  counts: { trips: number; catches: number; species: number };
  isFavorite: boolean;
  favoriteSaving: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
  onDismissed: () => void;
  sheetMode: SheetMode;
  onChangeSheetMode: (mode: SheetMode) => void;
  recordEntries: MapEntry[];
  onOpenRecord: (entry: MapEntry) => void;
  conditions: MarineConditions | null;
  conditionsLoading: boolean;
  conditionsStale: boolean;
  conditionsError: Error | null;
  onRefetchConditions: () => void;
  onPlanTrip: () => void;
};

/**
 * 선택 장소 바텀시트. 탭바(absolute)가 시트를 덮지 않도록 시트가 차지하는 영역을
 * 탭바 위에서 끝나는 컨테이너로 제한한다(gorhom v5의 bottomInset은 modal 전용).
 */
export const PlaceInfoSheet = ({
  sheetRef,
  bottomInset,
  selected,
  placeName,
  counts,
  isFavorite,
  favoriteSaving,
  onToggleFavorite,
  onClose,
  onDismissed,
  sheetMode,
  onChangeSheetMode,
  recordEntries,
  onOpenRecord,
  conditions,
  conditionsLoading,
  conditionsStale,
  conditionsError,
  onRefetchConditions,
  onPlanTrip,
}: PlaceInfoSheetProps) => {
  const displayName = placeName || selected.name;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: bottomInset }}>
      <BottomSheet
        ref={sheetRef}
        index={1}
        onClose={onDismissed}
        backgroundStyle={{ backgroundColor: "#FFFFFF", borderColor: FIELD_COLORS.ink, borderRadius: 0, borderWidth: 1 }}
        enableDynamicSizing={false}
        enablePanDownToClose
        handleIndicatorStyle={{ backgroundColor: FIELD_COLORS.teal, borderRadius: 0, height: 3, width: 44 }}
        handleStyle={{ paddingBottom: 6, paddingTop: 10 }}
        snapPoints={[...MAP_LAYOUT.infoSheetSnapPoints]}
      >
        <BottomSheetScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16, paddingHorizontal: 16 }}>
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
              {selected.kind === "catch" || selected.kind === "trip" ? (
                <FishingBobberMarker kind={selected.kind} compact />
              ) : (
                <View className="h-6 w-5 items-center justify-center">
                  <FontAwesome
                    name={selected.kind === "current" ? "crosshairs" : selected.kind === "favorite" ? "star" : "map-marker"}
                    size={selected.kind === "favorite" ? 14 : 15}
                    color={selected.kind === "favorite" ? FIELD_COLORS.orange : FIELD_COLORS.teal}
                  />
                </View>
              )}
              <Text className="ml-2 text-[10px] tracking-[1.2px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
                {kindLabel(selected.kind)}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="선택 장소 정보 닫기"
              hitSlop={8}
              onPress={onClose}
              className="h-8 w-8 items-center justify-center"
            >
              <FontAwesome name="close" size={15} color={FIELD_COLORS.ink} />
            </TouchableOpacity>
          </View>

          <View className="mt-1 flex-row items-start justify-between">
            <View className="min-w-0 flex-1 pr-3">
              <Text numberOfLines={1} className="mt-1 text-[27px]" style={{ color: FIELD_COLORS.ink, fontFamily: displayFont }}>
                {displayName}
              </Text>
              <Text className="mt-1 text-xs" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>
                출조 {counts.trips} · 조과 {counts.catches} · 어종 {counts.species}
              </Text>
            </View>
            <View className="items-end">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={isFavorite ? "즐겨찾기에서 제거" : "즐겨찾기에 추가"}
                disabled={favoriteSaving}
                onPress={onToggleFavorite}
                className="mb-2 h-9 w-9 items-center justify-center border"
                style={{ borderColor: isFavorite ? FIELD_COLORS.orange : FIELD_COLORS.rule, backgroundColor: isFavorite ? "#FFF0E9" : "#FFFFFF" }}
              >
                {favoriteSaving
                  ? <ActivityIndicator size="small" color={FIELD_COLORS.orange} />
                  : <FontAwesome name={isFavorite ? "star" : "star-o"} size={17} color={isFavorite ? FIELD_COLORS.orange : FIELD_COLORS.ink} />}
              </TouchableOpacity>
              {conditions?.weather ? (
                <View className="items-end">
                  <View className="flex-row items-center">
                    <FontAwesome name={weatherIconName(conditions.weather.condition)} size={15} color={FIELD_COLORS.orange} />
                    <Text className="ml-1.5 text-[12px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
                      {conditions.weather.label}
                    </Text>
                  </View>
                  <Text className="text-[11px]" style={{ color: FIELD_COLORS.teal, fontFamily: bodySemiBoldFont, includeFontPadding: false, lineHeight: 14, marginTop: 2 }}>
                    {conditions.weather.temperatureC == null ? "-" : `${conditions.weather.temperatureC.toFixed(0)}°`}
                    {conditions.weather.precipitationProbabilityPercent == null ? "" : ` · 강수 ${conditions.weather.precipitationProbabilityPercent.toFixed(0)}%`}
                  </Text>
                  <Text className="text-[8px] tracking-[0.5px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont, includeFontPadding: false, lineHeight: 10, marginTop: 1 }}>
                    KMA FORECAST
                  </Text>
                </View>
              ) : !conditionsLoading ? (
                <View className="px-2 py-1" style={{ backgroundColor: FIELD_COLORS.locked }}>
                  <Text className="text-[9px]" style={{ color: FIELD_COLORS.muted, fontFamily: bodySemiBoldFont }}>날씨 자료 없음</Text>
                </View>
              ) : null}
              {conditionsStale ? (
                <View className="mt-1 px-2 py-1" style={{ backgroundColor: "#FFF0E9" }}>
                  <Text className="text-[9px]" style={{ color: FIELD_COLORS.orange, fontFamily: bodySemiBoldFont }}>저장된 관측값</Text>
                </View>
              ) : null}
            </View>
          </View>

          <View className="mt-3 flex-row border-b" style={{ borderColor: FIELD_COLORS.rule }}>
            {(["info", "records"] as const).map((mode) => {
              const active = sheetMode === mode;
              return (
                <TouchableOpacity
                  key={mode}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  onPress={() => onChangeSheetMode(mode)}
                  className="flex-1 items-center py-2.5"
                  style={{ borderBottomWidth: active ? 3 : 0, borderColor: FIELD_COLORS.teal }}
                >
                  <Text style={{ color: active ? FIELD_COLORS.teal : FIELD_COLORS.muted, fontFamily: bodyExtraBoldFont }}>
                    {mode === "info" ? "장소 정보" : `기록 ${recordEntries.length}`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {sheetMode === "records" ? (
            <View className="pt-2">
              <PlaceRecordsList entries={recordEntries} onOpen={onOpenRecord} />
            </View>
          ) : (
            <>
              <MarineConditionsPanel
                conditions={conditions}
                isLoading={conditionsLoading}
                error={conditionsError}
                onRefetch={onRefetchConditions}
              />
              <View style={{ paddingBottom: 16, paddingTop: 16 }}>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={`${displayName} 출조 계획 만들기`}
                  onPress={onPlanTrip}
                  className="flex-row items-center justify-center py-3"
                  style={{ backgroundColor: FIELD_COLORS.teal }}
                >
                  <FontAwesome name="calendar-plus-o" size={18} color="#FFFFFF" />
                  <Text className="ml-3 text-base text-white" style={{ fontFamily: bodyExtraBoldFont }}>이 장소로 출조 계획</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
};
