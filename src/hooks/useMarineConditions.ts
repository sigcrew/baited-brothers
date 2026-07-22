import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

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

  const fetchConditions = useCallback(async (force = false) => {
    if (latitude == null || longitude == null) {
      setData(null);
      setIsLoading(false);
      setIsStale(false);
      setError(null);
      return;
    }

    const key = cacheKey(latitude, longitude);
    setIsLoading(true);
    setError(null);

    let cached: CachedConditions | null = null;
    try {
      const raw = await AsyncStorage.getItem(key);
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

    try {
      const { data: response, error: invokeError } = await supabase.functions.invoke(
        "marine-conditions",
        { body: { latitude, longitude } },
      );
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
      setError(
        fetchError instanceof Error
          ? fetchError
          : new Error("해양 관측 정보를 불러오지 못했습니다."),
      );
      setIsStale(Boolean(cached?.data));
    } finally {
      setIsLoading(false);
    }
  }, [latitude, longitude]);

  useEffect(() => {
    void fetchConditions(false);
  }, [fetchConditions]);

  const refetch = useCallback(() => fetchConditions(true), [fetchConditions]);

  return { data, isLoading, isStale, error, refetch };
};
