import FontAwesome from "@expo/vector-icons/FontAwesome";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ArchiveTabHeader } from "@/components/design/ArchiveTabHeader";
import { FieldAlertModal } from "@/components/design/FieldAlertModal";
import { FishingBobberMarker } from "@/components/map/FishingBobberMarker";
import { FishingMap } from "@/components/map/FishingMap";
import type { FishingMapPoint } from "@/components/map/FishingMap.types";
import { TripFormModal } from "@/components/trips/TripFormModal";
import { useFishingTrips, type UpdateTripInput } from "@/src/hooks/useFishingTrips";
import { useFavoriteFishingSpots } from "@/src/hooks/useFavoriteFishingSpots";
import { useMarineConditions } from "@/src/hooks/useMarineConditions";
import { useUserCatches } from "@/src/hooks/useUserCatches";
import { evaluateCoastalSelection } from "@/src/lib/coastalSelection";
import { countDistinctMapCoordinates } from "@/src/lib/mapClustering";
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
  kind: "catch" | "trip" | "favorite" | "current" | "selected";
  latitude: number;
  longitude: number;
  name: string;
  shouldReverseGeocode: boolean;
  fishId?: string;
  recordId?: string;
  recordedAt?: string;
  detailName?: string;
};

type MapAlert = {
  eyebrow: string;
  title: string;
  message: string;
};

type MapFilter = "all" | "favorite" | "trip" | "catch";

const MAP_FILTERS: { key: MapFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "favorite", label: "즐겨찾기" },
  { key: "trip", label: "출조" },
  { key: "catch", label: "조과" },
];

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

const formatTimelineClock = (value: string) => {
  const date = new Date(value);
  const isTomorrow = date.getDate() !== new Date().getDate();
  return `${isTomorrow ? "내일 " : ""}${String(date.getHours()).padStart(2, "0")}:00`;
};

const formatRecordDate = (value?: string) => {
  if (!value) return "날짜 미기록";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
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
  const router = useRouter();
  const params = useLocalSearchParams<{ focusId?: string }>();
  const infoSheetRef = useRef<BottomSheet>(null);
  const selectionRequestRef = useRef(0);
  const handledFocusRef = useRef<string | null>(null);
  const { catches, isLoading: catchesLoading } = useUserCatches();
  const {
    trips,
    isLoading: tripsLoading,
    isSaving,
    createTrip,
  } = useFishingTrips();
  const {
    spots: favoriteSpots,
    isLoading: favoritesLoading,
    isSaving: favoriteSaving,
    isLoggedIn,
    findByCoordinate,
    toggleFavorite,
  } = useFavoriteFishingSpots();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<MapFilter>("all");
  const [currentEntry, setCurrentEntry] = useState<MapEntry | null>(null);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [mapAlert, setMapAlert] = useState<MapAlert | null>(null);
  const [sheetMode, setSheetMode] = useState<"info" | "records">("info");
  const [clusterRecordIds, setClusterRecordIds] = useState<string[] | null>(null);
  const [focusPointId, setFocusPointId] = useState<string | null>(null);
  const [focusLatitudeDelta, setFocusLatitudeDelta] = useState<number | null>(null);

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
        recordId: item.id,
        recordedAt: item.caught_at,
        detailName: item.fish?.name_ko || item.fish?.name || "어종 미확인",
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
        recordId: trip.id,
        recordedAt: trip.scheduled_at,
        detailName: trip.status === "planned" ? "출조 예정" : trip.status === "done" ? "출조 완료" : "출조 취소",
      }];
    });
    const favoriteEntries = favoriteSpots.map((spot): MapEntry => ({
      id: `favorite:${spot.id}`,
      kind: "favorite",
      latitude: Number(spot.latitude),
      longitude: Number(spot.longitude),
      name: spot.name,
      shouldReverseGeocode: false,
    }));
    return currentEntry
      ? [currentEntry, ...favoriteEntries, ...catchEntries, ...tripEntries]
      : [...favoriteEntries, ...catchEntries, ...tripEntries];
  }, [catches, currentEntry, favoriteSpots, trips]);

  useEffect(() => {
    const focusId = typeof params.focusId === "string" ? params.focusId : null;
    if (!focusId) {
      handledFocusRef.current = null;
      setFocusPointId(null);
      setFocusLatitudeDelta(null);
      return;
    }
    if (handledFocusRef.current === focusId) return;
    const focusEntry = entries.find((entry) => entry.id === focusId);
    if (!focusEntry) return;
    const colocatedRecordIds = entries
      .filter((entry) =>
        (entry.kind === "catch" || entry.kind === "trip") &&
        Math.abs(entry.latitude - focusEntry.latitude) <= 0.00001 &&
        Math.abs(entry.longitude - focusEntry.longitude) <= 0.00001,
      )
      .map((entry) => entry.id);
    const showColocatedRecords = colocatedRecordIds.length > 1;
    handledFocusRef.current = focusId;
    selectionRequestRef.current += 1;
    setCurrentEntry(null);
    setActiveFilter("all");
    setSelectedId(focusId);
    setFocusLatitudeDelta(0.05);
    setFocusPointId(focusId);
    setSheetMode(showColocatedRecords ? "records" : "info");
    setClusterRecordIds(showColocatedRecords ? colocatedRecordIds : null);
    requestAnimationFrame(() => infoSheetRef.current?.snapToIndex(showColocatedRecords ? 2 : 1));
    router.setParams({ focusId: "" });
  }, [entries, params.focusId, router]);

  const filterCounts = useMemo<Record<MapFilter, number>>(() => {
    const countable = entries.filter((entry) => !["current", "selected"].includes(entry.kind));
    const countPlaces = (items: MapEntry[]) => countDistinctMapCoordinates(items, 0.00001);
    return {
      all: countPlaces(countable),
      favorite: countPlaces(countable.filter((entry) => entry.kind === "favorite")),
      trip: countPlaces(countable.filter((entry) => entry.kind === "trip")),
      catch: countPlaces(countable.filter((entry) => entry.kind === "catch")),
    };
  }, [entries]);

  const visibleEntries = useMemo(
    () => entries.filter((entry) =>
      activeFilter === "all" ||
      entry.kind === activeFilter ||
      (activeFilter === "favorite" &&
        (entry.kind === "catch" || entry.kind === "trip") &&
        Boolean(findByCoordinate(entry.latitude, entry.longitude))) ||
      entry.id === selectedId ||
      entry.kind === "current" ||
      entry.kind === "selected"),
    [activeFilter, entries, findByCoordinate, selectedId],
  );

  useEffect(() => {
    if (selectedId && !entries.some((entry) => entry.id === selectedId)) {
      setSelectedId(null);
    }
  }, [entries, selectedId]);

  const selected = entries.find((entry) => entry.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) {
      infoSheetRef.current?.close();
      return;
    }
    const frame = requestAnimationFrame(() => infoSheetRef.current?.snapToIndex(sheetMode === "records" ? 2 : 1));
    return () => cancelAnimationFrame(frame);
  }, [selected?.id, selected?.latitude, selected?.longitude, sheetMode]);
  const nearbyEntries = useMemo(
    () => selected ? entries.filter((entry) => !["current", "selected", "favorite"].includes(entry.kind) && distanceKm(selected, entry) <= 2) : [],
    [entries, selected],
  );
  const recordEntries = useMemo(() => {
    if (!clusterRecordIds) return nearbyEntries;
    const idSet = new Set(clusterRecordIds);
    return entries.filter((entry) =>
      idSet.has(entry.id) && (entry.kind === "catch" || entry.kind === "trip"),
    );
  }, [clusterRecordIds, entries, nearbyEntries]);
  const nearbyCatchCount = recordEntries.filter((entry) => entry.kind === "catch").length;
  const nearbyTripCount = recordEntries.filter((entry) => entry.kind === "trip").length;
  const nearbySpeciesCount = new Set(
    recordEntries.flatMap((entry) => entry.fishId ? [entry.fishId] : []),
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
    () => {
      const favoriteIdsCoveredByRecords = new Set(
        entries.flatMap((entry) => {
          if (entry.kind !== "catch" && entry.kind !== "trip") return [];
          const favoriteSpot = findByCoordinate(entry.latitude, entry.longitude);
          return favoriteSpot ? [`favorite:${favoriteSpot.id}`] : [];
        }),
      );

      return visibleEntries.flatMap((entry): FishingMapPoint[] => {
        if (entry.kind === "favorite" && favoriteIdsCoveredByRecords.has(entry.id)) return [];
        const favoriteSpot = entry.kind === "catch" || entry.kind === "trip"
          ? findByCoordinate(entry.latitude, entry.longitude)
          : null;
        return [{
          id: entry.id,
          latitude: entry.latitude,
          longitude: entry.longitude,
          label: entry.kind === "trip"
            ? "출조"
            : entry.kind === "favorite"
              ? "즐겨찾기"
            : entry.kind === "current"
              ? "현재"
              : entry.kind === "selected"
                ? "선택"
                : entry.name,
          kind: entry.kind,
          selected: entry.id === selectedId || Boolean(favoriteSpot && selectedId === `favorite:${favoriteSpot.id}`),
          favorite: Boolean(favoriteSpot),
        }];
      });
    },
    [entries, findByCoordinate, selectedId, visibleEntries],
  );

  const locateMe = async () => {
    if (isLocating) return;
    selectionRequestRef.current += 1;
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
      setClusterRecordIds(null);
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

  const clearTemporaryMapSelection = (nextId?: string) => {
    if (currentEntry?.kind !== "selected" || currentEntry.id === nextId) return;
    selectionRequestRef.current += 1;
    setCurrentEntry(null);
  };

  const focusMapPoint = (id: string, latitudeDelta: number | null = null) => {
    setFocusPointId(null);
    setFocusLatitudeDelta(latitudeDelta);
    requestAnimationFrame(() => setFocusPointId(id));
  };

  const selectPoint = (id: string) => {
    clearTemporaryMapSelection(id);
    setSelectedId(id);
    setSheetMode("info");
    setClusterRecordIds(null);
    requestAnimationFrame(() => infoSheetRef.current?.snapToIndex(1));
  };

  const selectCluster = (ids: string[]) => {
    clearTemporaryMapSelection();
    const clusterEntries = ids.flatMap((id) => {
      const entry = entries.find((item) => item.id === id);
      return entry ? [entry] : [];
    });
    if (!clusterEntries.length) return;

    const preferredEntry = clusterEntries.find((entry) => entry.kind === "catch")
      ?? clusterEntries.find((entry) => entry.kind === "trip")
      ?? clusterEntries[0];
    setSelectedId(preferredEntry.id);
    setClusterRecordIds(ids);
    setSheetMode("records");
  };

  const clearPlaceSelection = () => {
    if (selected?.kind === "selected") {
      selectionRequestRef.current += 1;
      setCurrentEntry(null);
    }
    setSelectedId(null);
    setClusterRecordIds(null);
    setSheetMode("info");
    setPlaceName(null);
  };

  const closePlaceSheet = () => {
    clearPlaceSelection();
    infoSheetRef.current?.close();
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
    setSheetMode("info");
    setClusterRecordIds(null);
    requestAnimationFrame(() => infoSheetRef.current?.snapToIndex(1));
  };

  const submitTrip = async (input: UpdateTripInput) => {
    const result = await createTrip(input);
    return result.error;
  };

  const selectedFavorite = selected
    ? findByCoordinate(selected.latitude, selected.longitude)
    : null;

  const toggleSelectedFavorite = async () => {
    if (!selected || favoriteSaving) return;
    if (!isLoggedIn) {
      showMapAlert(
        "로그인이 필요합니다",
        "즐겨찾는 장소를 계정에 저장하려면 먼저 로그인해 주세요.",
        "FAVORITE PLACE",
      );
      return;
    }
    const result = await toggleFavorite({
      name: placeName || selected.name,
      latitude: selected.latitude,
      longitude: selected.longitude,
    });
    if (result.error) {
      showMapAlert("즐겨찾기를 저장하지 못했습니다", result.error.message, "FAVORITE ERROR");
      return;
    }
    if (result.isFavorite && result.spot) {
      clearTemporaryMapSelection(`favorite:${result.spot.id}`);
      setSelectedId(`favorite:${result.spot.id}`);
      setClusterRecordIds(null);
    }
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

      {favoriteSpots.length > 0 || favoritesLoading ? (
        <View className="border-t px-5 py-2" style={{ borderColor: FIELD_COLORS.rule, backgroundColor: FIELD_COLORS.foam }}>
          <View className="mb-1.5 flex-row items-center">
            <FontAwesome name="star" size={11} color={FIELD_COLORS.orange} />
            <Text className="ml-1.5 text-[9px] tracking-[1px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
              FAVORITE COASTS
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {favoritesLoading && favoriteSpots.length === 0 ? (
              <ActivityIndicator size="small" color={FIELD_COLORS.teal} />
            ) : favoriteSpots.map((spot) => (
              <TouchableOpacity
                key={spot.id}
                accessibilityRole="button"
                accessibilityLabel={`${spot.name} 즐겨찾기 장소로 이동`}
                onPress={() => {
                  const favoriteId = `favorite:${spot.id}`;
                  const recordAtFavorite = entries.find((entry) =>
                    (entry.kind === "catch" || entry.kind === "trip") &&
                    Math.abs(entry.latitude - Number(spot.latitude)) <= 0.00001 &&
                    Math.abs(entry.longitude - Number(spot.longitude)) <= 0.00001,
                  );
                  clearTemporaryMapSelection(favoriteId);
                  setActiveFilter("favorite");
                  setSelectedId(favoriteId);
                  focusMapPoint(recordAtFavorite?.id ?? favoriteId);
                  setSheetMode("info");
                  setClusterRecordIds(null);
                }}
                className="border px-3 py-1.5"
                style={{
                  borderColor: selectedId === `favorite:${spot.id}` ? FIELD_COLORS.orange : FIELD_COLORS.rule,
                  backgroundColor: "#FFFFFF",
                }}
              >
                <Text className="text-[11px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>
                  {spot.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <View className="border-t px-5 py-2" style={{ borderColor: FIELD_COLORS.rule, backgroundColor: "#FFFFFF" }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {MAP_FILTERS.map((filter) => {
            const active = activeFilter === filter.key;
            return (
              <TouchableOpacity
                key={filter.key}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${filter.label} 지도 필터 ${filterCounts[filter.key]}곳`}
                onPress={() => setActiveFilter(filter.key)}
                className="flex-row items-center border px-3 py-2"
                style={{
                  borderColor: active ? FIELD_COLORS.teal : FIELD_COLORS.rule,
                  backgroundColor: active ? FIELD_COLORS.teal : "#FFFFFF",
                }}
              >
                <Text className="text-[11px]" style={{ color: active ? "#FFFFFF" : FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
                  {filter.label}
                </Text>
                <View className="ml-2 min-w-5 items-center px-1 py-0.5" style={{ backgroundColor: active ? "#FFFFFF" : FIELD_COLORS.locked }}>
                  <Text className="text-[9px]" style={{ color: active ? FIELD_COLORS.teal : FIELD_COLORS.muted, fontFamily: monoFont }}>
                    {filterCounts[filter.key]}곳
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View className="relative flex-1">
        <FishingMap
          points={points}
          focusPointId={focusPointId}
          focusLatitudeDelta={focusLatitudeDelta}
          onSelectPoint={selectPoint}
          onSelectCluster={selectCluster}
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
            onClose={clearPlaceSelection}
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
            <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 20, paddingHorizontal: 16 }}>
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
                  {selected.kind === "catch"
                    ? "CATCH PLACE"
                    : selected.kind === "trip"
                      ? "TRIP PLACE"
                      : selected.kind === "favorite"
                        ? "FAVORITE PLACE"
                        : selected.kind === "current"
                          ? "CURRENT LOCATION"
                          : "SELECTED PLACE"}
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="선택 장소 정보 닫기"
                hitSlop={8}
                onPress={closePlaceSheet}
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
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={selectedFavorite ? "즐겨찾기에서 제거" : "즐겨찾기에 추가"}
                  disabled={favoriteSaving}
                  onPress={toggleSelectedFavorite}
                  className="mb-2 h-9 w-9 items-center justify-center border"
                  style={{
                    borderColor: selectedFavorite ? FIELD_COLORS.orange : FIELD_COLORS.rule,
                    backgroundColor: selectedFavorite ? "#FFF0E9" : "#FFFFFF",
                  }}
                >
                  {favoriteSaving
                    ? <ActivityIndicator size="small" color={FIELD_COLORS.orange} />
                    : <FontAwesome name={selectedFavorite ? "star" : "star-o"} size={17} color={selectedFavorite ? FIELD_COLORS.orange : FIELD_COLORS.ink} />}
                </TouchableOpacity>
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

            <View className="mt-3 flex-row border-b" style={{ borderColor: FIELD_COLORS.rule }}>
              {(["info", "records"] as const).map((mode) => {
                const active = sheetMode === mode;
                return (
                  <TouchableOpacity
                    key={mode}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      setSheetMode(mode);
                      if (mode === "records") infoSheetRef.current?.snapToIndex(2);
                    }}
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
                {recordEntries.length ? (
                  [...recordEntries]
                    .sort((left, right) => (right.recordedAt ?? "").localeCompare(left.recordedAt ?? ""))
                    .map((entry) => (
                      <TouchableOpacity
                        key={entry.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${entry.detailName ?? entry.name} 기록 열기`}
                        onPress={() => {
                          if (!entry.recordId) return;
                          if (entry.kind === "catch") {
                            router.push({
                              pathname: "/(tabs)/encyclopedia",
                              params: { segment: "cards", catchId: entry.recordId },
                            });
                          } else if (entry.kind === "trip") {
                            router.push({ pathname: "/trips/[id]", params: { id: entry.recordId } });
                          }
                        }}
                        className="flex-row items-center border-b py-4"
                        style={{ borderColor: FIELD_COLORS.rule }}
                      >
                        <View
                          className="h-10 w-10 items-center justify-center border"
                          style={{ borderColor: entry.kind === "catch" ? FIELD_COLORS.orange : FIELD_COLORS.teal }}
                        >
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
                    ))
                ) : (
                  <View className="items-center px-6 py-10">
                    <FontAwesome name="map-o" size={24} color={FIELD_COLORS.muted} />
                    <Text className="mt-3 text-base" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
                      반경 2km 안에 기록이 없습니다
                    </Text>
                    <Text className="mt-2 text-center text-xs leading-5" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
                      이 장소로 출조를 만들거나 조과 위치를 남기면 여기에서 함께 볼 수 있습니다.
                    </Text>
                  </View>
                )}
              </View>
            ) : (
            <>
            {conditions?.weatherTimeline?.length ? (
              <View className="mt-3 border-y py-3" style={{ borderColor: FIELD_COLORS.rule }}>
                <View className="mb-2 flex-row items-center justify-between">
                  <Text className="text-[9px] tracking-[1.2px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
                    24H OUTLOOK · 시간대별 출조 정보
                  </Text>
                  <Text className="text-[9px]" style={{ color: FIELD_COLORS.teal, fontFamily: bodySemiBoldFont }}>
                    기상청 예보
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {conditions.weatherTimeline.map((forecast) => (
                    <View
                      key={forecast.forecastAt}
                      className="w-[92px] border px-2.5 py-2"
                      style={{ borderColor: FIELD_COLORS.rule, backgroundColor: FIELD_COLORS.foam }}
                    >
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
                          <Text className="ml-1 text-[9px]" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
                            {tide.heightCm.toFixed(0)}cm
                          </Text>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                ) : null}
              </View>
            ) : null}

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
            </>
            )}
            </BottomSheetScrollView>
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
