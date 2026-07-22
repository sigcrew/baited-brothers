import FontAwesome from "@expo/vector-icons/FontAwesome";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ArchiveTabHeader } from "@/components/design/ArchiveTabHeader";
import { FieldAlertModal } from "@/components/design/FieldAlertModal";
import { FishingBobberMarker } from "@/components/map/FishingBobberMarker";
import { FishingMap } from "@/components/map/FishingMap";
import type { FishingMapPoint } from "@/components/map/FishingMap.types";
import { TripFormModal } from "@/components/trips/TripFormModal";
import { useFishingTrips, type UpdateTripInput } from "@/src/hooks/useFishingTrips";
import { useMarineConditions } from "@/src/hooks/useMarineConditions";
import { useUserCatches } from "@/src/hooks/useUserCatches";
import { evaluateCoastalSelection } from "@/src/lib/coastalSelection";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
  bodySemiBoldFont,
  displayFont,
  monoFont,
} from "@/src/theme/fieldJournal";

type MapEntry = {
  id: string;
  kind: "catch" | "trip" | "current" | "selected";
  latitude: number;
  longitude: number;
  name: string;
  shouldReverseGeocode: boolean;
  fishId?: string;
};

type MapAlert = {
  eyebrow: string;
  title: string;
  message: string;
};

const isKoreaCoordinate = (latitude: number, longitude: number) =>
  latitude >= 32.5 && latitude <= 39.0 && longitude >= 124.0 && longitude <= 132.5;

const INFO_SHEET_SNAP_POINTS = ["24%", "42%", "72%"];

const radians = (value: number) => (value * Math.PI) / 180;

const distanceKm = (a: MapEntry, b: MapEntry) => {
  const latDelta = radians(b.latitude - a.latitude);
  const lngDelta = radians(b.longitude - a.longitude);
  const value =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(lngDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const formatClock = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
};

const formatObservedAgo = (value?: string | null) => {
  if (!value) return "관측 시각 미제공";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}시간 전` : `${Math.round(hours / 24)}일 전`;
};

const weatherIconName = (
  condition?: string,
): keyof typeof FontAwesome.glyphMap => {
  switch (condition) {
    case "clear":
      return "sun-o";
    case "partly-cloudy":
    case "cloudy":
      return "cloud";
    case "snow":
      return "snowflake-o";
    case "rain-snow":
    case "rain":
    case "shower":
      return "umbrella";
    default:
      return "cloud";
  }
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <View className="min-w-0 flex-1 px-3 py-2.5">
    <Text className="text-[11px]" style={{ color: FIELD_COLORS.muted, fontFamily: bodySemiBoldFont }}>
      {label}
    </Text>
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      className="mt-0.5 text-[22px]"
      style={{ color: FIELD_COLORS.ink, fontFamily: displayFont }}
    >
      {value}
    </Text>
  </View>
);

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const infoSheetRef = useRef<BottomSheet>(null);
  const selectionRequestRef = useRef(0);
  const { catches, isLoading: catchesLoading } = useUserCatches();
  const {
    trips,
    isLoading: tripsLoading,
    isSaving,
    createTrip,
  } = useFishingTrips();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentEntry, setCurrentEntry] = useState<MapEntry | null>(null);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [mapAlert, setMapAlert] = useState<MapAlert | null>(null);

  const showMapAlert = (title: string, message: string, eyebrow = "MAP NOTICE · COAST ONLY") => {
    setMapAlert({ eyebrow, title, message });
  };

  const entries = useMemo<MapEntry[]>(() => {
    const catchEntries = catches.flatMap((item): MapEntry[] => {
      if (item.location_lat == null || item.location_lng == null) return [];
      const latitude = Number(item.location_lat);
      const longitude = Number(item.location_lng);
      if (
        !isKoreaCoordinate(latitude, longitude) ||
        !evaluateCoastalSelection(latitude, longitude).allowed
      ) return [];
      return [{
        id: `catch:${item.id}`,
        kind: "catch",
        latitude,
        longitude,
        name: item.location_name?.trim() || item.fish?.name_ko || "조과 기록",
        shouldReverseGeocode: !item.location_name?.trim(),
        fishId: item.fish_id,
      }];
    });
    const tripEntries = trips.flatMap((trip): MapEntry[] => {
      if (trip.spot_lat == null || trip.spot_lng == null) return [];
      const latitude = Number(trip.spot_lat);
      const longitude = Number(trip.spot_lng);
      if (
        !isKoreaCoordinate(latitude, longitude) ||
        !evaluateCoastalSelection(latitude, longitude).allowed
      ) return [];
      return [{
        id: `trip:${trip.id}`,
        kind: "trip",
        latitude,
        longitude,
        name: trip.spot_name,
        shouldReverseGeocode: false,
      }];
    });
    return currentEntry ? [currentEntry, ...catchEntries, ...tripEntries] : [...catchEntries, ...tripEntries];
  }, [catches, currentEntry, trips]);

  useEffect(() => {
    if (!selectedId && entries[0]) setSelectedId(entries[0].id);
    if (selectedId && !entries.some((entry) => entry.id === selectedId)) {
      setSelectedId(entries[0]?.id ?? null);
    }
  }, [entries, selectedId]);

  const selected = entries.find((entry) => entry.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) {
      infoSheetRef.current?.close();
      return;
    }
    const frame = requestAnimationFrame(() => infoSheetRef.current?.snapToIndex(1));
    return () => cancelAnimationFrame(frame);
  }, [selected?.id, selected?.latitude, selected?.longitude]);
  const nearbyEntries = useMemo(
    () => selected ? entries.filter((entry) => !["current", "selected"].includes(entry.kind) && distanceKm(selected, entry) <= 2) : [],
    [entries, selected],
  );
  const nearbyCatchCount = nearbyEntries.filter((entry) => entry.kind === "catch").length;
  const nearbyTripCount = nearbyEntries.filter((entry) => entry.kind === "trip").length;
  const nearbySpeciesCount = new Set(
    nearbyEntries.flatMap((entry) => entry.fishId ? [entry.fishId] : []),
  ).size;

  useEffect(() => {
    let active = true;
    setPlaceName(selected?.name ?? null);
    if (!selected?.shouldReverseGeocode) return;

    void Location.reverseGeocodeAsync({
      latitude: selected.latitude,
      longitude: selected.longitude,
    }).then((results) => {
      if (!active || !results[0]) return;
      const result = results[0];
      const resolved = result.district || result.city || result.subregion || result.region || selected.name;
      setPlaceName(resolved);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [selected]);

  const {
    data: conditions,
    isLoading: conditionsLoading,
    isStale,
    error: conditionsError,
    refetch: refetchConditions,
  } = useMarineConditions(selected?.latitude, selected?.longitude);

  const points = useMemo<FishingMapPoint[]>(
    () => entries.map((entry) => ({
      id: entry.id,
      latitude: entry.latitude,
      longitude: entry.longitude,
      label: entry.kind === "trip"
        ? "출조"
        : entry.kind === "current"
          ? "현재"
          : entry.kind === "selected"
            ? "선택"
            : entry.name,
      kind: entry.kind,
      selected: entry.id === selectedId,
    })),
    [entries, selectedId],
  );

  const locateMe = async () => {
    if (isLocating) return;
    setIsLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        showMapAlert(
          "위치 권한이 필요합니다",
          "현재 장소의 해양 정보를 보려면 위치 접근을 허용해 주세요.",
          "LOCATION NOTICE",
        );
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!isKoreaCoordinate(position.coords.latitude, position.coords.longitude)) {
        showMapAlert("국내 위치만 지원합니다", "현재 지도와 해양 관측 정보는 대한민국 연안에서만 제공됩니다.");
        return;
      }
      if (!evaluateCoastalSelection(position.coords.latitude, position.coords.longitude).allowed) {
        showMapAlert(
          "현재 위치는 해안 지역이 아닙니다",
          "지도에서 바다·항구·방파제 주변을 선택해 주세요.",
        );
        return;
      }
      const entry: MapEntry = {
        id: "current-location",
        kind: "current",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        name: "현재 위치",
        shouldReverseGeocode: true,
      };
      setCurrentEntry(entry);
      setSelectedId(entry.id);
    } catch {
      showMapAlert(
        "현재 위치를 확인하지 못했습니다",
        "잠시 후 다시 시도하거나 지도에서 원하는 해안 장소를 선택해 주세요.",
        "LOCATION ERROR",
      );
    } finally {
      setIsLocating(false);
    }
  };

  const selectPoint = (id: string) => {
    setSelectedId(id);
    requestAnimationFrame(() => infoSheetRef.current?.snapToIndex(1));
  };

  const selectCoordinate = async (coordinate: { latitude: number; longitude: number }) => {
    const requestId = selectionRequestRef.current + 1;
    selectionRequestRef.current = requestId;
    if (!isKoreaCoordinate(coordinate.latitude, coordinate.longitude)) {
      showMapAlert("국내 위치만 지원합니다", "대한민국 연안 안쪽의 장소를 선택해 주세요.");
      return;
    }
    const coastalSelection = evaluateCoastalSelection(coordinate.latitude, coordinate.longitude);
    if (!coastalSelection.allowed) {
      const distance = coastalSelection.coastDistanceKm?.toFixed(1);
      showMapAlert(
        "내륙 지역은 선택할 수 없습니다",
        `선택한 위치는 해안에서 약 ${distance}km 떨어져 있습니다. 바다·항구·방파제 주변을 선택해 주세요.`,
      );
      return;
    }

    let resolvedName: string | null = null;
    try {
      const results = await Location.reverseGeocodeAsync(coordinate);
      if (selectionRequestRef.current !== requestId) return;
      const address = results[0];
      const countryCode = address?.isoCountryCode?.toUpperCase();
      if (countryCode && countryCode !== "KR") {
        showMapAlert("국내 위치만 지원합니다", "대한민국 연안 안쪽의 장소를 선택해 주세요.");
        return;
      }
      resolvedName = address
        ? address.district || address.city || address.subregion || address.region || null
        : null;
    } catch {
      // Offshore points often have no reverse-geocoding result. The coastline
      // check above remains sufficient for those coordinates.
    }
    if (selectionRequestRef.current !== requestId) return;

    const entry: MapEntry = {
      id: "map-selection",
      kind: "selected",
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
      name: resolvedName || "선택한 바다",
      shouldReverseGeocode: false,
    };
    setCurrentEntry(entry);
    setSelectedId(entry.id);
    requestAnimationFrame(() => infoSheetRef.current?.snapToIndex(1));
  };

  const submitTrip = async (input: UpdateTripInput) => {
    const result = await createTrip(input);
    return result.error;
  };

  const highTide = conditions?.tides.find((item) => item.type === "high");
  const lowTide = conditions?.tides.find((item) => item.type === "low");
  const selectedPlace = selected ? {
    name: placeName || selected.name,
    latitude: selected.latitude,
    longitude: selected.longitude,
  } : null;
  const isInitialLoading = catchesLoading || tripsLoading;

  return (
    <View className="flex-1" style={{ paddingTop: insets.top, backgroundColor: FIELD_COLORS.foam }}>
      <ArchiveTabHeader
        title="나의 바다"
        backgroundColor={FIELD_COLORS.foam}
        rightSlot={(
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="현재 위치로 이동"
            onPress={locateMe}
            disabled={isLocating}
            className="h-11 w-11 items-center justify-center border"
            style={{ borderColor: FIELD_COLORS.rule }}
          >
            {isLocating
              ? <ActivityIndicator size="small" color={FIELD_COLORS.teal} />
              : <FontAwesome name="crosshairs" size={20} color={FIELD_COLORS.ink} />}
          </TouchableOpacity>
        )}
      />

      <View className="flex-row items-center px-5 py-3" style={{ backgroundColor: FIELD_COLORS.foam }}>
        <FontAwesome name="map-marker" size={16} color={FIELD_COLORS.teal} />
        <Text className="ml-2 flex-1 text-sm" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>
          {placeName || (isInitialLoading ? "기록 위치를 불러오는 중" : "지도를 눌러 바다와 해안 장소를 선택하세요")}
        </Text>
        <Text className="text-[9px] tracking-[1px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
          PRIVATE
        </Text>
      </View>

      <View className="relative flex-1">
        <FishingMap
          points={points}
          onSelectPoint={selectPoint}
          onSelectCoordinate={selectCoordinate}
        />

        {!isInitialLoading && entries.length === 0 ? (
          <View pointerEvents="none" className="absolute inset-x-5 top-6 border bg-white px-5 py-5" style={{ borderColor: FIELD_COLORS.ink }}>
            <Text className="text-xl" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
              아직 지도에 표시할 기록이 없습니다
            </Text>
            <Text className="mt-2 text-sm leading-6" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
              지도에서 바다를 누르거나 현재 위치 버튼을 누르면 인근 수온과 물때를 확인할 수 있습니다.
            </Text>
          </View>
        ) : null}

        {selected ? (
          <BottomSheet
            ref={infoSheetRef}
            index={1}
            backgroundStyle={{
              backgroundColor: "#FFFFFF",
              borderColor: FIELD_COLORS.ink,
              borderRadius: 0,
              borderWidth: 1,
            }}
            enableDynamicSizing={false}
            enablePanDownToClose
            handleIndicatorStyle={{
              backgroundColor: FIELD_COLORS.teal,
              borderRadius: 0,
              height: 3,
              width: 44,
            }}
            handleStyle={{ paddingBottom: 6, paddingTop: 10 }}
            snapPoints={INFO_SHEET_SNAP_POINTS}
          >
            <BottomSheetView style={{ paddingBottom: 12, paddingHorizontal: 16 }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <FishingBobberMarker kind="selected" compact />
                <Text className="ml-2 text-[10px] tracking-[1.2px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
                  SELECTED PLACE
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="선택 장소 정보 닫기"
                hitSlop={8}
                onPress={() => infoSheetRef.current?.close()}
                className="h-8 w-8 items-center justify-center"
              >
                <FontAwesome name="close" size={15} color={FIELD_COLORS.ink} />
              </TouchableOpacity>
            </View>

            <View className="mt-1 flex-row items-start justify-between">
              <View className="min-w-0 flex-1 pr-3">
                <Text numberOfLines={1} className="mt-1 text-[27px]" style={{ color: FIELD_COLORS.ink, fontFamily: displayFont }}>
                  {placeName || selected.name}
                </Text>
                <Text className="mt-1 text-xs" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>
                  출조 {nearbyTripCount} · 조과 {nearbyCatchCount} · 어종 {nearbySpeciesCount}
                </Text>
              </View>
              <View className="items-end">
                {conditions?.weather ? (
                  <View className="items-end">
                    <View className="flex-row items-center">
                      <FontAwesome
                        name={weatherIconName(conditions.weather.condition)}
                        size={15}
                        color={FIELD_COLORS.orange}
                      />
                      <Text className="ml-1.5 text-[12px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
                        {conditions.weather.label}
                      </Text>
                    </View>
                    <Text className="mt-0.5 text-[11px]" style={{ color: FIELD_COLORS.teal, fontFamily: bodySemiBoldFont }}>
                      {conditions.weather.temperatureC == null ? "-" : `${conditions.weather.temperatureC.toFixed(0)}°`}
                      {conditions.weather.precipitationProbabilityPercent == null
                        ? ""
                        : ` · 강수 ${conditions.weather.precipitationProbabilityPercent.toFixed(0)}%`}
                    </Text>
                    <Text className="mt-0.5 text-[8px] tracking-[0.5px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
                      KMA FORECAST
                    </Text>
                  </View>
                ) : !conditionsLoading ? (
                  <View className="px-2 py-1" style={{ backgroundColor: FIELD_COLORS.locked }}>
                    <Text className="text-[9px]" style={{ color: FIELD_COLORS.muted, fontFamily: bodySemiBoldFont }}>
                      날씨 자료 없음
                    </Text>
                  </View>
                ) : null}
                {isStale ? (
                  <View className="mt-1 px-2 py-1" style={{ backgroundColor: "#FFF0E9" }}>
                    <Text className="text-[9px]" style={{ color: FIELD_COLORS.orange, fontFamily: bodySemiBoldFont }}>
                      저장된 관측값
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View className="mt-2.5 flex-row border-y" style={{ borderColor: FIELD_COLORS.rule }}>
              <Metric label="다음 만조" value={formatClock(highTide?.at)} />
              <View className="w-px" style={{ backgroundColor: FIELD_COLORS.rule }} />
              <Metric
                label="바람"
                value={conditions?.windSpeedMs == null ? "-" : `${conditions.windSpeedMs.toFixed(1)}m/s`}
              />
              <View className="w-px" style={{ backgroundColor: FIELD_COLORS.rule }} />
              <Metric
                label="수온"
                value={conditions?.waterTemperatureC == null ? "-" : `${conditions.waterTemperatureC.toFixed(1)}°C`}
              />
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
                          <Text className="text-[9px]" style={{ color: FIELD_COLORS.muted, fontFamily: bodySemiBoldFont }}>
                            24H 변화 없음
                          </Text>
                        </View>
                      ) : (
                        <Text className="text-[10px]" style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>
                          24H {conditions.waterTemperatureDelta24hC >= 0 ? "+" : ""}{conditions.waterTemperatureDelta24hC.toFixed(1)}°C
                        </Text>
                      )}
                      {lowTide ? (
                        <Text className="ml-2 text-[10px]" style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>
                          간조 {formatClock(lowTide.at)}
                        </Text>
                      ) : null}
                    </View>
                  </>
                ) : conditionsLoading ? (
                  <View className="flex-row items-center">
                    <ActivityIndicator size="small" color={FIELD_COLORS.teal} />
                    <Text className="ml-2 text-xs" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
                      인근 관측소를 찾는 중입니다
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity accessibilityRole="button" onPress={refetchConditions} className="flex-row items-center">
                    <View className="border px-2 py-1" style={{ borderColor: FIELD_COLORS.orange, backgroundColor: "#FFF0E9" }}>
                      <Text className="text-[10px]" style={{ color: FIELD_COLORS.orange, fontFamily: bodyExtraBoldFont }}>
                        {conditionsError ? "불러오기 실패" : "관측 자료 없음"}
                      </Text>
                    </View>
                    <Text className="ml-2 text-[11px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>
                      눌러서 다시 확인
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`${placeName || selected.name} 출조 계획 만들기`}
              onPress={() => setFormVisible(true)}
              className="mt-4 flex-row items-center justify-center py-3"
              style={{ backgroundColor: FIELD_COLORS.teal }}
            >
              <FontAwesome name="calendar-plus-o" size={18} color="#FFFFFF" />
              <Text className="ml-3 text-base text-white" style={{ fontFamily: bodyExtraBoldFont }}>
                이 장소로 출조 계획
              </Text>
            </TouchableOpacity>
            </BottomSheetView>
          </BottomSheet>
        ) : null}
      </View>

      <TripFormModal
        visible={formVisible}
        trip={null}
        initialPlace={selectedPlace}
        isSaving={isSaving}
        onClose={() => setFormVisible(false)}
        onSubmit={submitTrip}
      />

      <FieldAlertModal
        visible={Boolean(mapAlert)}
        eyebrow={mapAlert?.eyebrow}
        title={mapAlert?.title ?? ""}
        message={mapAlert?.message ?? ""}
        onClose={() => setMapAlert(null)}
      />
    </View>
  );
}
