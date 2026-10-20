import {
  buildMapEntries,
  countFilterPlaces,
  filterVisibleEntries,
  formatObservedAgo,
  formatTimelineClock,
  weatherIconName,
  type MapEntry,
} from "@/src/lib/mapScreen";

const BUSAN = { lat: 35.05, lng: 129.1 };
const SEOUL = { lat: 37.56, lng: 126.98 };

const catchRow = (id: string, lat: number | null, lng: number | null, extra: Record<string, unknown> = {}) =>
  ({
    id,
    location_lat: lat,
    location_lng: lng,
    location_name: null,
    fish_id: "fish-1",
    fish: { name_ko: "넙치", name: "Paralichthys olivaceus" },
    custom_species_name: null,
    caught_at: "2026-10-20T01:00:00Z",
    ...extra,
  }) as never;

const tripRow = (id: string, lat: number | null, lng: number | null, status = "planned") =>
  ({ id, spot_lat: lat, spot_lng: lng, spot_name: "부산 앞바다", scheduled_at: "2026-10-21T00:00:00Z", status }) as never;

describe("buildMapEntries", () => {
  it("keeps coastal Korean records and drops inland, missing or foreign coordinates", () => {
    const entries = buildMapEntries({
      catches: [catchRow("c1", BUSAN.lat, BUSAN.lng), catchRow("c2", SEOUL.lat, SEOUL.lng), catchRow("c3", null, null)],
      trips: [tripRow("t1", BUSAN.lat, BUSAN.lng), tripRow("t2", 51.5, -0.1)],
      favoriteSpots: [{ id: "f1", name: "자주 가는 곳", latitude: BUSAN.lat, longitude: BUSAN.lng } as never],
      currentEntry: null,
    });
    expect(entries.map((entry) => entry.id)).toEqual(["favorite:f1", "catch:c1", "trip:t1"]);
    expect(entries[1]).toEqual(expect.objectContaining({ kind: "catch", detailName: "넙치", shouldReverseGeocode: true }));
  });

  it("puts the temporary current/selected entry first", () => {
    const current: MapEntry = {
      id: "current-location",
      kind: "current",
      latitude: BUSAN.lat,
      longitude: BUSAN.lng,
      name: "현재 위치",
      shouldReverseGeocode: true,
    };
    const entries = buildMapEntries({ catches: [], trips: [], favoriteSpots: [], currentEntry: current });
    expect(entries[0].id).toBe("current-location");
  });
});

describe("countFilterPlaces / filterVisibleEntries", () => {
  const entries: MapEntry[] = [
    { id: "catch:1", kind: "catch", latitude: 35, longitude: 129, name: "a", shouldReverseGeocode: false },
    { id: "catch:2", kind: "catch", latitude: 35, longitude: 129, name: "b", shouldReverseGeocode: false },
    { id: "trip:1", kind: "trip", latitude: 35.2, longitude: 129.2, name: "c", shouldReverseGeocode: false },
    { id: "favorite:1", kind: "favorite", latitude: 34.9, longitude: 128.6, name: "d", shouldReverseGeocode: false },
    { id: "current-location", kind: "current", latitude: 35.5, longitude: 129.5, name: "e", shouldReverseGeocode: false },
  ];

  it("counts distinct places per filter and ignores temporary entries", () => {
    expect(countFilterPlaces(entries)).toEqual({ all: 3, favorite: 1, trip: 1, catch: 1 });
  });

  it("the favorite filter keeps records that sit on a favorite spot plus temporary entries", () => {
    const visible = filterVisibleEntries(entries, "favorite", null, (lat, lng) => lat === 35.2 && lng === 129.2);
    expect(visible.map((entry) => entry.id)).toEqual(["trip:1", "favorite:1", "current-location"]);
  });

  it("the selected entry stays visible under any filter", () => {
    const visible = filterVisibleEntries(entries, "trip", "catch:2", () => false);
    expect(visible.map((entry) => entry.id)).toEqual(["catch:2", "trip:1", "current-location"]);
  });
});

describe("formatters", () => {
  const now = Date.parse("2026-10-20T03:30:00.000Z"); // 12:30 KST

  it("formatTimelineClock labels today, tomorrow and later days in KST", () => {
    expect(formatTimelineClock("2026-10-20T06:00:00.000Z", now)).toBe("15:00");
    expect(formatTimelineClock("2026-10-20T16:00:00.000Z", now)).toBe("내일 01:00");
    expect(formatTimelineClock("2026-10-22T00:00:00.000Z", now)).toBe("모레 09:00");
    expect(formatTimelineClock("garbage", now)).toBe("-");
  });

  it("formatObservedAgo picks minutes, hours or days", () => {
    expect(formatObservedAgo("2026-10-20T03:10:00.000Z", now)).toBe("20분 전");
    expect(formatObservedAgo("2026-10-20T00:30:00.000Z", now)).toBe("3시간 전");
    expect(formatObservedAgo("2026-10-17T03:30:00.000Z", now)).toBe("3일 전");
    expect(formatObservedAgo(null, now)).toBe("관측 시각 미제공");
  });

  it("weatherIconName maps conditions to icons with a cloudy fallback", () => {
    expect(weatherIconName("clear")).toBe("sun-o");
    expect(weatherIconName("shower")).toBe("umbrella");
    expect(weatherIconName(undefined)).toBe("cloud");
  });
});
