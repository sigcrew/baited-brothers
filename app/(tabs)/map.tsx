import BottomSheet from "@gorhom/bottom-sheet";
import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { FieldAlertModal } from "@/components/design/FieldAlertModal";
import { FishingMap } from "@/components/map/FishingMap";
import type { FishingMapPoint } from "@/components/map/FishingMap.types";
import { MapEmptyState, MapHeader, mapHeaderHeight } from "@/components/map/MapHeader";
import { PlaceInfoSheet, type SheetMode } from "@/components/map/PlaceInfoSheet";
import { TripFormModal } from "@/components/trips/TripFormModal";
import { useFishingTrips, type UpdateTripInput } from "@/src/hooks/useFishingTrips";
import { useFavoriteFishingSpots, type FavoriteFishingSpot } from "@/src/hooks/useFavoriteFishingSpots";
import { useMarineConditions } from "@/src/hooks/useMarineConditions";
import { useUserCatches } from "@/src/hooks/useUserCatches";
import { evaluateCoastalSelection, isKoreaCoordinate } from "@/src/lib/coastalSelection";
import {
  MAP_LAYOUT,
  buildMapEntries,
  countFilterPlaces,
  distanceKm,
  filterVisibleEntries,
  haveSameCoordinate,
  type MapEntry,
  type MapFilter,
} from "@/src/lib/mapScreen";
import { reverseGeocodeKoreanPlaceName } from "@/src/lib/reverseGeocoding";
import { FIELD_COLORS } from "@/src/theme/fieldJournal";

type MapAlert = {
  eyebrow: string;
  title: string;
  message: string;
};

const MAP_TAB_BAR_HEIGHT = MAP_LAYOUT.tabBarHeight;

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ focusId?: string }>();
  const infoSheetRef = useRef<BottomSheet>(null);
  const selectionRequestRef = useRef(0);
  const handledFocusRef = useRef<string | null>(null);
  const { catches, isLoading: catchesLoading, refetch: refetchCatches } = useUserCatches();
  const {
    trips,
    isLoading: tripsLoading,
    isSaving,
    createTrip,
    refetch: refetchTrips,
  } = useFishingTrips();
  const {
    spots: favoriteSpots,
    isLoading: favoritesLoading,
    isSaving: favoriteSaving,
    isLoggedIn,
    findByCoordinate,
    toggleFavorite,
    refetch: refetchFavorites,
  } = useFavoriteFishingSpots();
  // 탭 화면은 마운트된 채 남아 있으므로, 다른 화면에서 조과를 기록하거나 출조를
  // 바꾼 뒤 돌아왔을 때 다시 불러온다. 첫 마운트는 훅이 이미 가져온다.
  const hasFocusedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedRef.current) {
        hasFocusedRef.current = true;
        return;
      }
      void refetchCatches();
      void refetchTrips();
      void refetchFavorites();
    }, [refetchCatches, refetchTrips, refetchFavorites]),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<MapFilter>("all");
  const [currentEntry, setCurrentEntry] = useState<MapEntry | null>(null);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const [formVisible, setFormVisible] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [mapAlert, setMapAlert] = useState<MapAlert | null>(null);
  const [sheetMode, setSheetMode] = useState<SheetMode>("info");
  const [clusterRecordIds, setClusterRecordIds] = useState<string[] | null>(null);
  const [focusPointId, setFocusPointId] = useState<string | null>(null);
  const [focusLatitudeDelta, setFocusLatitudeDelta] = useState<number | null>(null);

  const showMapAlert = (title: string, message: string, eyebrow = "MAP NOTICE · COAST ONLY") => {
    setMapAlert({ eyebrow, title, message });
  };

  const entries = useMemo<MapEntry[]>(
    () => buildMapEntries({ catches, trips, favoriteSpots, currentEntry }),
    [catches, currentEntry, favoriteSpots, trips],
  );

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
      .filter((entry) => (entry.kind === "catch" || entry.kind === "trip") && haveSameCoordinate(entry, focusEntry))
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

  const filterCounts = useMemo(() => countFilterPlaces(entries), [entries]);

  const visibleEntries = useMemo(
    () =>
      filterVisibleEntries(entries, activeFilter, selectedId, (latitude, longitude) =>
        Boolean(findByCoordinate(latitude, longitude)),
      ),
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

  // `selected`는 entries가 바뀔 때마다 새 객체라서 그대로 deps에 넣으면 같은 장소에도
  // 역지오코딩이 반복 호출된다(iOS 지오코더는 호출을 제한한다). 식별값만 본다.
  const selectedName = selected?.name ?? null;
  const selectedLatitude = selected?.latitude ?? null;
  const selectedLongitude = selected?.longitude ?? null;
  const selectedNeedsGeocode = Boolean(selected?.shouldReverseGeocode);
  useEffect(() => {
    let active = true;
    setPlaceName(selectedName);
    if (!selectedNeedsGeocode || selectedLatitude == null || selectedLongitude == null) return;

    void reverseGeocodeKoreanPlaceName({
      latitude: selectedLatitude,
      longitude: selectedLongitude,
    }).then((result) => {
      if (!active || !result.name) return;
      setPlaceName(result.name);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [selectedLatitude, selectedLongitude, selectedName, selectedNeedsGeocode]);

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

    // A manually selected coordinate does not require the user's device location.
    // Name lookup is best effort; denied geocoding falls back to "선택한 바다".
    let resolvedName: string | null = null;
    try {
      const result = await reverseGeocodeKoreanPlaceName(coordinate);
      if (selectionRequestRef.current !== requestId) return;
      const countryCode = result.countryCode;
      if (countryCode && countryCode !== "KR") {
        showMapAlert("국내 위치만 지원합니다", "대한민국 연안 안쪽의 장소를 선택해 주세요.");
        return;
      }
      resolvedName = result.name;
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

  const selectedPlace = selected ? {
    name: placeName || selected.name,
    latitude: selected.latitude,
    longitude: selected.longitude,
  } : null;
  const isInitialLoading = catchesLoading || tripsLoading;
  const hasFavoriteRow = favoriteSpots.length > 0 || favoritesLoading;

  const selectFavoriteChip = (spot: FavoriteFishingSpot) => {
    const favoriteId = `favorite:${spot.id}`;
    const spotCoordinate = { latitude: Number(spot.latitude), longitude: Number(spot.longitude) };
    const recordAtFavorite = entries.find(
      (entry) => (entry.kind === "catch" || entry.kind === "trip") && haveSameCoordinate(entry, spotCoordinate),
    );
    clearTemporaryMapSelection(favoriteId);
    setActiveFilter("favorite");
    setSelectedId(favoriteId);
    focusMapPoint(recordAtFavorite?.id ?? favoriteId);
    setSheetMode("info");
    setClusterRecordIds(null);
  };

  const changeSheetMode = (mode: SheetMode) => {
    setSheetMode(mode);
    if (mode === "records") infoSheetRef.current?.snapToIndex(2);
  };

  const openRecord = (entry: MapEntry) => {
    if (!entry.recordId) return;
    if (entry.kind === "catch") {
      router.push({ pathname: "/(tabs)/encyclopedia", params: { segment: "cards", catchId: entry.recordId } });
    } else if (entry.kind === "trip") {
      router.push({ pathname: "/trips/[id]", params: { id: entry.recordId } });
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: FIELD_COLORS.foam }}>
      <View className="absolute inset-0">
        <FishingMap
          points={points}
          bottomInset={insets.bottom + MAP_TAB_BAR_HEIGHT}
          focusPointId={focusPointId}
          focusLatitudeDelta={focusLatitudeDelta}
          onSelectPoint={selectPoint}
          onSelectCluster={selectCluster}
          onSelectCoordinate={selectCoordinate}
        />
      </View>

      <MapHeader
        topInset={insets.top}
        placeName={placeName}
        isInitialLoading={isInitialLoading}
        isLocating={isLocating}
        onLocate={locateMe}
        activeFilter={activeFilter}
        filterCounts={filterCounts}
        onChangeFilter={setActiveFilter}
        favoriteSpots={favoriteSpots}
        favoritesLoading={favoritesLoading}
        selectedId={selectedId}
        onSelectFavorite={selectFavoriteChip}
      />

      {!isInitialLoading && entries.length === 0 ? (
        <MapEmptyState top={mapHeaderHeight(insets.top, hasFavoriteRow)} />
      ) : null}

      {selected ? (
        <PlaceInfoSheet
          sheetRef={infoSheetRef}
          bottomInset={insets.bottom + MAP_TAB_BAR_HEIGHT}
          selected={selected}
          placeName={placeName}
          counts={{ trips: nearbyTripCount, catches: nearbyCatchCount, species: nearbySpeciesCount }}
          isFavorite={Boolean(selectedFavorite)}
          favoriteSaving={favoriteSaving}
          onToggleFavorite={toggleSelectedFavorite}
          onClose={closePlaceSheet}
          onDismissed={clearPlaceSelection}
          sheetMode={sheetMode}
          onChangeSheetMode={changeSheetMode}
          recordEntries={recordEntries}
          onOpenRecord={openRecord}
          conditions={conditions}
          conditionsLoading={conditionsLoading}
          conditionsStale={isStale}
          conditionsError={conditionsError}
          onRefetchConditions={refetchConditions}
          onPlanTrip={() => setFormVisible(true)}
        />
      ) : null}

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
