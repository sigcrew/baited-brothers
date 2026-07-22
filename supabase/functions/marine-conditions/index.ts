import { createClient } from "npm:@supabase/supabase-js@2.49.1";

type UnknownRecord = Record<string, unknown>;

type ObservationStation = {
  code: string;
  name: string;
  latitude: number;
  longitude: number;
};

type TimedValue = {
  at: string;
  value: number;
};

type CacheState = "hit" | "miss" | "stale";

type CacheResult<T> = {
  value: T;
  state: CacheState;
};

type CacheRow = {
  payload: unknown;
  fresh_until: string;
  stale_until: string;
};

type WeatherCondition =
  | "clear"
  | "partly-cloudy"
  | "cloudy"
  | "rain"
  | "rain-snow"
  | "snow"
  | "shower";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=900",
    },
  });

const normalizedKey = (value: string) =>
  value.toLocaleLowerCase().replace(/[\s_()\[\]{}./℃°-]/g, "");

const pick = (row: UnknownRecord, aliases: string[]) => {
  const aliasSet = new Set(aliases.map(normalizedKey));
  const entry = Object.entries(row).find(([key]) => aliasSet.has(normalizedKey(key)));
  return entry?.[1];
};

const asText = (value: unknown) => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return "";
};

const asNumber = (value: unknown) => {
  const parsed = Number(asText(value).replace(/[^\d.+-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const objectArrays = (value: unknown): UnknownRecord[][] => {
  if (Array.isArray(value)) {
    const direct = value.filter(
      (item): item is UnknownRecord => Boolean(item && typeof item === "object" && !Array.isArray(item)),
    );
    return [direct, ...value.flatMap(objectArrays)].filter((items) => items.length > 0);
  }
  if (!value || typeof value !== "object") return [];
  return Object.values(value as UnknownRecord).flatMap(objectArrays);
};

const responseRows = (value: unknown) =>
  objectArrays(value).sort((a, b) => b.length - a.length)[0] ?? [];

const parseDate = (value: unknown) => {
  const text = asText(value);
  if (!text) return null;
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})(?:[ T]?(\d{2})(\d{2})(\d{2})?)?$/);
  const normalized = compact
    ? `${compact[1]}-${compact[2]}-${compact[3]}T${compact[4] ?? "00"}:${compact[5] ?? "00"}:${compact[6] ?? "00"}+09:00`
    : text.includes("T") || /[+-]\d\d:\d\d$/.test(text)
      ? text
      : `${text.replace(" ", "T")}+09:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const kstDate = (offsetDays = 0) => {
  const date = new Date(Date.now() + 9 * 60 * 60 * 1_000 + offsetDays * 86_400_000);
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}${String(date.getUTCDate()).padStart(2, "0")}`;
};

const latestForecastBase = () => {
  const releaseDelayMs = 15 * 60 * 1_000;
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1_000 - releaseDelayMs);
  const releaseHours = [2, 5, 8, 11, 14, 17, 20, 23];
  let hour = [...releaseHours].reverse().find((candidate) => candidate <= kst.getUTCHours());
  if (hour == null) {
    kst.setUTCDate(kst.getUTCDate() - 1);
    hour = 23;
  }
  return {
    date: `${kst.getUTCFullYear()}${String(kst.getUTCMonth() + 1).padStart(2, "0")}${String(kst.getUTCDate()).padStart(2, "0")}`,
    time: `${String(hour).padStart(2, "0")}00`,
  };
};

const toKmaGrid = (latitude: number, longitude: number) => {
  const earthRadiusKm = 6371.00877;
  const gridSpacingKm = 5;
  const standardLatitude1 = 30;
  const standardLatitude2 = 60;
  const originLongitude = 126;
  const originLatitude = 38;
  const originX = 43;
  const originY = 136;
  const degreesToRadians = Math.PI / 180;

  const radius = earthRadiusKm / gridSpacingKm;
  const latitude1 = standardLatitude1 * degreesToRadians;
  const latitude2 = standardLatitude2 * degreesToRadians;
  const originLng = originLongitude * degreesToRadians;
  const originLat = originLatitude * degreesToRadians;
  let cone = Math.tan(Math.PI * 0.25 + latitude2 * 0.5) /
    Math.tan(Math.PI * 0.25 + latitude1 * 0.5);
  cone = Math.log(Math.cos(latitude1) / Math.cos(latitude2)) / Math.log(cone);
  let scale = Math.tan(Math.PI * 0.25 + latitude1 * 0.5);
  scale = Math.pow(scale, cone) * Math.cos(latitude1) / cone;
  let originRadius = Math.tan(Math.PI * 0.25 + originLat * 0.5);
  originRadius = radius * scale / Math.pow(originRadius, cone);

  let pointRadius = Math.tan(Math.PI * 0.25 + latitude * degreesToRadians * 0.5);
  pointRadius = radius * scale / Math.pow(pointRadius, cone);
  let theta = longitude * degreesToRadians - originLng;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= cone;

  return {
    x: Math.floor(pointRadius * Math.sin(theta) + originX + 0.5),
    y: Math.floor(originRadius - pointRadius * Math.cos(theta) + originY + 0.5),
  };
};

const CACHE_TTL = {
  stations: { fresh: 24 * 60 * 60 * 1_000, stale: 7 * 24 * 60 * 60 * 1_000 },
  observations: { fresh: 15 * 60 * 1_000, stale: 2 * 60 * 60 * 1_000 },
  tides: { fresh: 6 * 60 * 60 * 1_000, stale: 24 * 60 * 60 * 1_000 },
  weather: { fresh: 30 * 60 * 1_000, stale: 6 * 60 * 60 * 1_000 },
} as const;

const cacheClient = (() => {
  const url = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
})();

const readCache = async <T>(key: string): Promise<CacheRow | null> => {
  if (!cacheClient) return null;
  const { data, error } = await cacheClient
    .from("marine_conditions_cache")
    .select("payload, fresh_until, stale_until")
    .eq("cache_key", key)
    .maybeSingle();
  if (error) {
    console.warn("marine cache read failed", key, error.message);
    return null;
  }
  if (!data) return null;
  const stored = data.payload as UnknownRecord;
  const payload = stored && typeof stored === "object" && "__cache_value" in stored
    ? stored.__cache_value
    : data.payload;
  return { ...data, payload: payload as T };
};

const writeCache = async <T>(
  key: string,
  value: T,
  freshForMs: number,
  staleForMs: number,
) => {
  if (!cacheClient) return;
  const cachedAt = new Date();
  const { error } = await cacheClient.from("marine_conditions_cache").upsert({
    cache_key: key,
    payload: { __cache_value: value },
    cached_at: cachedAt.toISOString(),
    fresh_until: new Date(cachedAt.getTime() + freshForMs).toISOString(),
    stale_until: new Date(cachedAt.getTime() + staleForMs).toISOString(),
  });
  if (error) {
    console.warn("marine cache write failed", key, error.message);
    return;
  }

  const { error: cleanupError } = await cacheClient
    .from("marine_conditions_cache")
    .delete()
    .lt("stale_until", cachedAt.toISOString());
  if (cleanupError) console.warn("marine cache cleanup failed", cleanupError.message);
};

const withCache = async <T>(
  key: string,
  freshForMs: number,
  staleForMs: number,
  loader: () => Promise<T>,
  fallback?: () => T,
): Promise<CacheResult<T>> => {
  const cached = await readCache<T>(key);
  const now = Date.now();
  if (cached && new Date(cached.fresh_until).getTime() > now) {
    return { value: cached.payload as T, state: "hit" };
  }

  try {
    const value = await loader();
    await writeCache(key, value, freshForMs, staleForMs);
    return { value, state: "miss" };
  } catch (error) {
    if (cached && new Date(cached.stale_until).getTime() > now) {
      console.warn(
        "public marine API unavailable; serving stale cache",
        key,
        error instanceof Error ? error.message : "unknown error",
      );
      return { value: cached.payload as T, state: "stale" };
    }
    if (fallback) {
      const value = fallback();
      console.warn(
        "public marine API unavailable; caching empty fallback",
        key,
        error instanceof Error ? error.message : "unknown error",
      );
      await writeCache(key, value, freshForMs, staleForMs);
      return { value, state: "miss" };
    }
    throw error;
  }
};

const serviceKey = () => {
  const raw = Deno.env.get("DATA_GO_KR_API_KEY")?.trim();
  if (!raw) throw new Error("DATA_GO_KR_API_KEY is not configured.");
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const fetchJson = async (url: URL) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Public marine API returned ${response.status}.`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Public marine API did not return JSON.");
    }
  } finally {
    clearTimeout(timeout);
  }
};

const publicDataUrl = (path: string, parameters: Record<string, string>) => {
  const url = new URL(`https://apis.data.go.kr/1192136/${path}`);
  url.searchParams.set("serviceKey", serviceKey());
  Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
};

const weatherForecastUrl = (parameters: Record<string, string>) => {
  const url = new URL(
    "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst",
  );
  url.searchParams.set("ServiceKey", serviceKey());
  Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value));
  return url;
};

const fetchStations = async (): Promise<ObservationStation[]> => {
  const url = new URL(
    "https://api.odcloud.kr/api/15146602/v1/uddi:81b0665b-4f21-41e8-91f1-d3ecc4a7a3f1",
  );
  url.searchParams.set("serviceKey", serviceKey());
  url.searchParams.set("page", "1");
  url.searchParams.set("perPage", "300");

  const body = (await fetchJson(url)) as UnknownRecord;
  const rows = Array.isArray(body.data) ? body.data : responseRows(body);

  return rows.flatMap((item) => {
    const row = item as UnknownRecord;
    const code = asText(pick(row, ["obsCode", "stationCode", "조위관측소 고유번호", "관측소코드"]));
    const name = asText(pick(row, ["obsName", "stationName", "조위관측소 명", "조위관측소 명칭", "관측소명", "지점명"]));
    const latitude = asNumber(pick(row, ["lat", "latitude", "조위관측소 위도", "위도"]));
    const longitude = asNumber(pick(row, ["lon", "lot", "longitude", "조위관측소 경도", "경도"]));
    return code && name && latitude != null && longitude != null
      ? [{ code, name, latitude, longitude }]
      : [];
  });
};

const distanceKm = (
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) => {
  const radians = (value: number) => (value * Math.PI) / 180;
  const latDelta = radians(latitudeB - latitudeA);
  const lngDelta = radians(longitudeB - longitudeA);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(radians(latitudeA)) *
      Math.cos(radians(latitudeB)) *
      Math.sin(lngDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const fetchWaterTemperature = async (stationCode: string) => {
  const bodies = await Promise.all(
    [-1, 0].map((offset) =>
      fetchJson(
        publicDataUrl("surveyWaterTemp/GetSurveyWaterTempApiService", {
          type: "json",
          obsCode: stationCode,
          reqDate: kstDate(offset),
          min: "60",
          pageNo: "1",
          numOfRows: "300",
        }),
      ),
    ),
  );

  const values = bodies
    .flatMap(responseRows)
    .flatMap((row): TimedValue[] => {
      const at = parseDate(pick(row, ["obsrvnDt", "obsTime", "recordTime", "관측일시", "측정일시", "일시"]));
      const value = asNumber(pick(row, ["wtem", "waterTemp", "waterTemperature", "수온", "측정수온"]));
      return at && value != null ? [{ at: at.toISOString(), value }] : [];
    })
    .sort((a, b) => a.at.localeCompare(b.at));

  const latest = values.at(-1) ?? null;
  if (!latest) return { latest: null, delta24h: null };

  const target = new Date(latest.at).getTime() - 86_400_000;
  const previous = values.reduce<TimedValue | null>((best, item) => {
    if (item.at === latest.at) return best;
    if (!best) return item;
    return Math.abs(new Date(item.at).getTime() - target) <
      Math.abs(new Date(best.at).getTime() - target)
      ? item
      : best;
  }, null);
  const closeEnough = previous && Math.abs(new Date(previous.at).getTime() - target) <= 3 * 60 * 60 * 1_000;

  return {
    latest,
    delta24h: closeEnough ? Number((latest.value - previous.value).toFixed(1)) : null,
  };
};

const fetchWind = async (stationCode: string) => {
  const body = await fetchJson(
    publicDataUrl("surveyWind/GetSurveyWindApiService", {
      type: "json",
      obsCode: stationCode,
      reqDate: kstDate(),
      min: "60",
      pageNo: "1",
      numOfRows: "300",
    }),
  );
  const rows = responseRows(body)
    .flatMap((row) => {
      const at = parseDate(pick(row, ["obsrvnDt", "obsTime", "recordTime", "관측일시", "측정일시", "일시"]));
      const speed = asNumber(pick(row, ["wspd", "windSpeed", "ws", "풍속", "측정풍속"]));
      const direction = asText(pick(row, ["wndrct", "windDirection", "wd", "풍향", "측정풍향"]));
      return at && speed != null
        ? [{ at: at.toISOString(), speed, direction: direction || null }]
        : [];
    })
    .sort((a, b) => a.at.localeCompare(b.at));
  return rows.at(-1) ?? null;
};

const fetchTides = async (stationCode: string) => {
  const bodies = await Promise.all(
    [0, 1].map((offset) =>
      fetchJson(
        publicDataUrl("tideFcstHghLw/GetTideFcstHghLwApiService", {
          type: "json",
          obsCode: stationCode,
          reqDate: kstDate(offset),
          pageNo: "1",
          numOfRows: "20",
        }),
      ),
    ),
  );
  const now = Date.now() - 60 * 60 * 1_000;
  return bodies
    .flatMap(responseRows)
    .flatMap((row) => {
      const at = parseDate(pick(row, ["predcDt", "predTime", "obsTime", "예측일시", "일시"]));
      const rawType = asText(pick(row, ["extrSe", "hlCode", "highLow", "극치구분", "고저조구분"])).toLocaleLowerCase();
      const type = rawType === "1" || rawType === "h" || rawType.includes("high") || rawType.includes("고")
        ? "high"
        : rawType === "2" || rawType === "l" || rawType.includes("low") || rawType.includes("저")
          ? "low"
          : null;
      const heightCm = asNumber(pick(row, ["predcTdlvVl", "predLevel", "tideLevel", "예측조위", "조위"]));
      return at && type ? [{ at: at.toISOString(), type, heightCm }] : [];
    })
    .filter((item) => new Date(item.at).getTime() >= now)
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 4);
};

const weatherDescription = (precipitationType: number, sky: number) => {
  const precipitation: Record<number, { condition: WeatherCondition; label: string }> = {
    1: { condition: "rain", label: "비" },
    2: { condition: "rain-snow", label: "비 또는 눈" },
    3: { condition: "snow", label: "눈" },
    4: { condition: "shower", label: "소나기" },
    5: { condition: "rain", label: "빗방울" },
    6: { condition: "rain-snow", label: "빗방울 또는 눈날림" },
    7: { condition: "snow", label: "눈날림" },
  };
  if (precipitation > 0 && precipitation[precipitationType]) {
    return precipitation[precipitationType];
  }
  if (sky === 1) return { condition: "clear" as const, label: "맑음" };
  if (sky === 3) return { condition: "partly-cloudy" as const, label: "구름 많음" };
  return { condition: "cloudy" as const, label: "흐림" };
};

const fetchWeatherForecast = async (latitude: number, longitude: number) => {
  const base = latestForecastBase();
  const grid = toKmaGrid(latitude, longitude);
  const body = await fetchJson(
    weatherForecastUrl({
      dataType: "JSON",
      pageNo: "1",
      numOfRows: "1000",
      base_date: base.date,
      base_time: base.time,
      nx: String(grid.x),
      ny: String(grid.y),
    }),
  );
  const grouped = new Map<string, Record<string, number>>();
  responseRows(body).forEach((row) => {
    const date = asText(pick(row, ["fcstDate", "예보일자"]));
    const time = asText(pick(row, ["fcstTime", "예보시각"]));
    const category = asText(pick(row, ["category", "자료구분코드"]));
    const value = asNumber(pick(row, ["fcstValue", "예보 값", "예보값"]));
    if (!date || !time || !category || value == null) return;
    const key = `${date}${time.padStart(4, "0")}`;
    grouped.set(key, { ...grouped.get(key), [category]: value });
  });

  const forecast = [...grouped.entries()]
    .flatMap(([key, values]) => {
      const at = parseDate(key);
      return at && values.TMP != null && (values.SKY != null || values.PTY != null)
        ? [{ at, values }]
        : [];
    })
    .sort(
      (left, right) =>
        Math.abs(left.at.getTime() - Date.now()) - Math.abs(right.at.getTime() - Date.now()),
    )[0];
  if (!forecast) return null;

  const description = weatherDescription(forecast.values.PTY ?? 0, forecast.values.SKY ?? 4);
  return {
    forecastAt: forecast.at.toISOString(),
    condition: description.condition,
    label: description.label,
    temperatureC: forecast.values.TMP,
    precipitationProbabilityPercent: forecast.values.POP ?? null,
    humidityPercent: forecast.values.REH ?? null,
  };
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const body = await request.json();
    const latitude = Number(body?.latitude);
    const longitude = Number(body?.longitude);
    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return json({ error: "Valid latitude and longitude are required." }, 400);
    }
    if (latitude < 32.5 || latitude > 39 || longitude < 124 || longitude > 132.5) {
      return json({ error: "Korean coastal coordinates are required." }, 400);
    }

    const stationCache = await withCache(
      "stations:v1",
      CACHE_TTL.stations.fresh,
      CACHE_TTL.stations.stale,
      fetchStations,
    );
    const nearest = stationCache.value
      .map((station) => ({
        ...station,
        distanceKm: distanceKm(latitude, longitude, station.latitude, station.longitude),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)[0];
    if (!nearest) return json({ error: "No observation station is available." }, 503);

    const grid = toKmaGrid(latitude, longitude);
    const forecastBase = latestForecastBase();
    const today = kstDate();
    const [temperatureResult, windResult, tideResult, weatherResult] = await Promise.allSettled([
      withCache(
        `water:v1:${nearest.code}:${today}`,
        CACHE_TTL.observations.fresh,
        CACHE_TTL.observations.stale,
        () => fetchWaterTemperature(nearest.code),
        () => ({ latest: null, delta24h: null }),
      ),
      withCache(
        `wind:v1:${nearest.code}:${today}`,
        CACHE_TTL.observations.fresh,
        CACHE_TTL.observations.stale,
        () => fetchWind(nearest.code),
        () => null,
      ),
      withCache(
        `tides:v1:${nearest.code}:${today}`,
        CACHE_TTL.tides.fresh,
        CACHE_TTL.tides.stale,
        () => fetchTides(nearest.code),
        () => [],
      ),
      withCache(
        `weather:v1:${grid.x}:${grid.y}:${forecastBase.date}${forecastBase.time}`,
        CACHE_TTL.weather.fresh,
        CACHE_TTL.weather.stale,
        () => fetchWeatherForecast(latitude, longitude),
        () => null,
      ),
    ]);
    const temperature = temperatureResult.status === "fulfilled"
      ? temperatureResult.value.value
      : { latest: null, delta24h: null };
    const wind = windResult.status === "fulfilled" ? windResult.value.value : null;
    const tides = tideResult.status === "fulfilled" ? tideResult.value.value : [];
    const weather = weatherResult.status === "fulfilled" ? weatherResult.value.value : null;
    if (weatherResult.status === "rejected") {
      console.warn(
        "weather forecast unavailable",
        weatherResult.reason instanceof Error ? weatherResult.reason.message : "unknown error",
      );
    }

    const cacheStates = {
      stations: stationCache.state,
      water: temperatureResult.status === "fulfilled" ? temperatureResult.value.state : "miss",
      wind: windResult.status === "fulfilled" ? windResult.value.state : "miss",
      tides: tideResult.status === "fulfilled" ? tideResult.value.state : "miss",
      weather: weatherResult.status === "fulfilled" ? weatherResult.value.state : "miss",
    } satisfies Record<string, CacheState>;
    const resourceStates = Object.values(cacheStates);
    const cacheStatus = resourceStates.includes("stale")
      ? "stale"
      : resourceStates.every((state) => state === "hit")
        ? "hit"
        : resourceStates.some((state) => state === "hit")
          ? "mixed"
          : "miss";

    return json({
      station: {
        code: nearest.code,
        name: nearest.name,
        latitude: nearest.latitude,
        longitude: nearest.longitude,
        distanceKm: Number(nearest.distanceKm.toFixed(1)),
      },
      observedAt: temperature.latest?.at ?? wind?.at ?? null,
      waterTemperatureC: temperature.latest?.value ?? null,
      waterTemperatureDelta24hC: temperature.delta24h,
      windSpeedMs: wind?.speed ?? null,
      windDirection: wind?.direction ?? null,
      tides,
      weather,
      fetchedAt: new Date().toISOString(),
      cache: { status: cacheStatus, resources: cacheStates },
    });
  } catch (error) {
    console.error(
      "marine-conditions failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return json({ error: "해양 관측 정보를 불러오지 못했습니다." }, 502);
  }
});
