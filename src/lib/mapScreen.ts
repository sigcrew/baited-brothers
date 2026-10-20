import { Platform } from "react-native";
import type FontAwesome from "@expo/vector-icons/FontAwesome";
import { evaluateCoastalSelection } from "@/src/lib/coastalSelection";
import { countDistinctMapCoordinates } from "@/src/lib/mapClustering";
import type { UserCatch } from "@/src/hooks/useUserCatches";
import type { FishingTrip } from "@/src/hooks/useFishingTrips";
import type { FavoriteFishingSpot } from "@/src/hooks/useFavoriteFishingSpots";

/** 지도 탭이 다루는 모든 지점. 조과·출조·즐겨찾기와 임시 지점(현재 위치, 수동 선택). */
export type MapEntry = {
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

export type MapFilter = "all" | "favorite" | "trip" | "catch";

export const MAP_FILTERS: { key: MapFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "favorite", label: "즐겨찾기" },
  { key: "trip", label: "출조" },
  { key: "catch", label: "조과" },
];

export const MAP_LAYOUT = {
  headerHeight: 50,
  filterRowHeight: Platform.OS === "android" ? 34 : 36,
  filterHorizontalPadding: Platform.OS === "android" ? 12 : 14,
  filterCountHeight: Platform.OS === "android" ? 18 : 20,
  favoriteRowHeight: 32,
  /** app/(tabs)/_layout.tsx의 탭바 높이와 같아야 한다. */
  tabBarHeight: Platform.OS === "android" ? 72 : 64,
  infoSheetSnapPoints: ["24%", "42%", "72%"],
} as const;

/** 같은 지점으로 취급하는 좌표 오차(약 1m). */
export const SAME_COORDINATE_EPSILON = 0.00001;

export const isKoreaCoordinate = (latitude: number, longitude: number) =>
  latitude >= 32.5 && latitude <= 39.0 && longitude >= 124.0 && longitude <= 132.5;

export const haveSameCoordinate = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) =>
  Math.abs(a.latitude - b.latitude) <= SAME_COORDINATE_EPSILON &&
  Math.abs(a.longitude - b.longitude) <= SAME_COORDINATE_EPSILON;

const radians = (value: number) => (value * Math.PI) / 180;

export const distanceKm = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) => {
  const latDelta = radians(b.latitude - a.latitude);
  const lngDelta = radians(b.longitude - a.longitude);
  const value =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lngDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const isMappableCoastalPoint = (latitude: number, longitude: number) =>
  isKoreaCoordinate(latitude, longitude) && evaluateCoastalSelection(latitude, longitude).allowed;

/** 조과·출조·즐겨찾기를 지도 엔트리로 합친다. 내륙·국외 좌표는 지도에서 뺀다. */
export const buildMapEntries = ({
  catches,
  trips,
  favoriteSpots,
  currentEntry,
}: {
  catches: UserCatch[];
  trips: FishingTrip[];
  favoriteSpots: FavoriteFishingSpot[];
  currentEntry: MapEntry | null;
}): MapEntry[] => {
  const catchEntries = catches.flatMap((item): MapEntry[] => {
    if (item.location_lat == null || item.location_lng == null) return [];
    const latitude = Number(item.location_lat);
    const longitude = Number(item.location_lng);
    if (!isMappableCoastalPoint(latitude, longitude)) return [];
    return [{
      id: `catch:${item.id}`,
      kind: "catch",
      latitude,
      longitude,
      name:
        item.location_name?.trim() ||
        item.fish?.name_ko ||
        item.custom_species_name ||
        "조과 기록",
      shouldReverseGeocode: !item.location_name?.trim(),
      fishId: item.fish_id ?? undefined,
      recordId: item.id,
      recordedAt: item.caught_at,
      detailName:
        item.fish?.name_ko ||
        item.fish?.name ||
        item.custom_species_name ||
        "어종 미확인",
    }];
  });
  const tripEntries = trips.flatMap((trip): MapEntry[] => {
    if (trip.spot_lat == null || trip.spot_lng == null) return [];
    const latitude = Number(trip.spot_lat);
    const longitude = Number(trip.spot_lng);
    if (!isMappableCoastalPoint(latitude, longitude)) return [];
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
};

/** 필터 칩에 보이는 "장소 수"(같은 좌표는 하나로). */
export const countFilterPlaces = (entries: MapEntry[]): Record<MapFilter, number> => {
  const countable = entries.filter((entry) => entry.kind !== "current" && entry.kind !== "selected");
  const countPlaces = (items: MapEntry[]) => countDistinctMapCoordinates(items, SAME_COORDINATE_EPSILON);
  return {
    all: countPlaces(countable),
    favorite: countPlaces(countable.filter((entry) => entry.kind === "favorite")),
    trip: countPlaces(countable.filter((entry) => entry.kind === "trip")),
    catch: countPlaces(countable.filter((entry) => entry.kind === "catch")),
  };
};

export const filterVisibleEntries = (
  entries: MapEntry[],
  activeFilter: MapFilter,
  selectedId: string | null,
  isFavoriteCoordinate: (latitude: number, longitude: number) => boolean,
) =>
  entries.filter((entry) =>
    activeFilter === "all" ||
    entry.kind === activeFilter ||
    (activeFilter === "favorite" &&
      (entry.kind === "catch" || entry.kind === "trip") &&
      isFavoriteCoordinate(entry.latitude, entry.longitude)) ||
    entry.id === selectedId ||
    entry.kind === "current" ||
    entry.kind === "selected",
  );

// ---- 표시 포맷터. 조석·예보는 한국 연안 기준이므로 기기 시간대와 무관하게 KST.

export const formatClock = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
};

export const formatObservedAgo = (value?: string | null, now = Date.now()) => {
  if (!value) return "관측 시각 미제공";
  const minutes = Math.max(0, Math.round((now - new Date(value).getTime()) / 60_000));
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}시간 전` : `${Math.round(hours / 24)}일 전`;
};

const kstDayIndex = (ms: number) => Math.floor((ms + 9 * 3_600_000) / 86_400_000);

export const formatTimelineClock = (value: string, now = Date.now()) => {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return "-";
  const dayDiff = kstDayIndex(ms) - kstDayIndex(now);
  const hour = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(new Date(ms)).replace(/\D/g, "");
  const prefix = dayDiff === 0 ? "" : dayDiff === 1 ? "내일 " : dayDiff === 2 ? "모레 " : `${dayDiff}일 뒤 `;
  return `${prefix}${hour.padStart(2, "0")}:00`;
};

export const formatRecordDate = (value?: string) => {
  if (!value) return "날짜 미기록";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

export const weatherIconName = (condition?: string): keyof typeof FontAwesome.glyphMap => {
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
