import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";

import { withTimeout } from "@/src/lib/appErrors";
import { supabase } from "@/src/lib/supabase";

export type MarineStation = {
  code: string;
  name: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
};

export type MarineTide = {
  at: string;
  type: "high" | "low";
  heightCm: number | null;
};

export type WeatherForecast = {
  forecastAt: string;
  condition:
    | "clear"
    | "partly-cloudy"
    | "cloudy"
    | "rain"
    | "rain-snow"
    | "snow"
    | "shower";
  label: string;
  temperatureC: number | null;
  precipitationProbabilityPercent: number | null;
  humidityPercent: number | null;
  windSpeedMs: number | null;
  windDirection: string | null;
};

export type MarineConditions = {
  station: MarineStation;
  observedAt: string | null;
  waterTemperatureC: number | null;
  waterTemperatureDelta24hC: number | null;
  windSpeedMs: number | null;
  windDirection: string | null;
  tides: MarineTide[];
  weather: WeatherForecast | null;
  weatherTimeline: WeatherForecast[];
  fetchedAt: string;
  cache?: {
    status: "hit" | "miss" | "mixed" | "stale";
    resources: Record<string, "hit" | "miss" | "stale">;
  };
};

const CACHE_TTL_MS = 30 * 60 * 1_000;

const cacheKey = (latitude: number, longitude: number) =>
  `marine-conditions:v3:${latitude.toFixed(2)}:${longitude.toFixed(2)}`;

type CachedConditions = {
  savedAt: number;
  data: MarineConditions;
};

export const useMarineConditions = (
  latitude?: number | null,
  longitude?: number | null,
) => {
  const [data, setData] = useState<MarineConditions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const requestSequence = useRef(0);
  const lastKeyRef = useRef<string | null>(null);

  const fetchConditions = useCallback(async (force = false) => {
    const requestId = ++requestSequence.current;
    const isCurrent = () => requestSequence.current === requestId;
    if (latitude == null || longitude == null) {
      setData(null);
      setIsLoading(false);
      setIsStale(false);
      setError(null);
      return;
    }

    const key = cacheKey(latitude, longitude);
    setIsLoading(true);
    // 다른 장소로 바뀌었을 때만 패널을 비운다. 같은 장소의 "다시 확인"은 기존
    // 값을 그대로 보여 주며 갱신해 깜빡임이 없다.
    if (lastKeyRef.current !== key) {
      setData(null);
      setIsStale(false);
    }
    lastKeyRef.current = key;
    setError(null);

    let cached: CachedConditions | null = null;
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!isCurrent()) return;
      cached = raw ? (JSON.parse(raw) as CachedConditions) : null;
      if (cached?.data) {
        setData(cached.data);
        setIsStale(
          Date.now() - cached.savedAt >= CACHE_TTL_MS ||
            cached.data.cache?.status === "stale",
        );
        if (!force && Date.now() - cached.savedAt < CACHE_TTL_MS) {
          setIsLoading(false);
          return;
        }
      }
    } catch {
      cached = null;
    }

    if (!isCurrent()) return;
    try {
      // marine-conditions는 유료 API 프록시라 사용자 세션 없이는 호출하지 않는다.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!isCurrent()) return;
      if (!session) {
        throw new Error("로그인 후 해양 정보를 확인할 수 있습니다.");
      }
      const { data: response, error: invokeError } = await withTimeout(supabase.functions.invoke(
        "marine-conditions",
        { body: { latitude, longitude } },
      ), 20_000, "해양 정보 요청 시간이 초과되었습니다. 다시 시도해 주세요.");
      if (!isCurrent()) return;
      if (invokeError) throw invokeError;

      const next = response as MarineConditions;
      if (!next?.station?.code) {
        throw new Error("가까운 해양 관측소를 찾지 못했습니다.");
      }
      setData(next);
      setIsStale(next.cache?.status === "stale");
      await AsyncStorage.setItem(
        key,
        JSON.stringify({ savedAt: Date.now(), data: next } satisfies CachedConditions),
      );
    } catch (fetchError) {
      if (!isCurrent()) return;
      setError(
        fetchError instanceof Error
          ? fetchError
          : new Error("해양 관측 정보를 불러오지 못했습니다."),
      );
      setIsStale(Boolean(cached?.data));
    } finally {
      if (isCurrent()) setIsLoading(false);
    }
  }, [latitude, longitude]);

  useEffect(() => {
    void fetchConditions(false);
    return () => { requestSequence.current += 1; };
  }, [fetchConditions]);

  const refetch = useCallback(() => fetchConditions(true), [fetchConditions]);

  return { data, isLoading, isStale, error, refetch };
};
