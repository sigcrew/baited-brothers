import { supabase } from "@/src/lib/supabase";
import type { MarineConditions } from "@/src/hooks/useMarineConditions";
import type { Json } from "@/src/types/database";

type CaptureCatchConditionsInput = {
  catchId: string;
  userId: string;
  latitude: number;
  longitude: number;
};

export const captureCatchConditions = async ({
  catchId,
  userId,
  latitude,
  longitude,
}: CaptureCatchConditionsInput) => {
  try {
    const { data, error } = await supabase.functions.invoke("marine-conditions", {
      body: { latitude, longitude },
    });
    if (error) throw error;

    const conditions = data as MarineConditions;
    if (!conditions?.station?.code) return;

    const snapshot: Json = {
      schema_version: 1,
      captured_at: new Date().toISOString(),
      coordinate: { latitude, longitude },
      station: {
        code: conditions.station.code,
        name: conditions.station.name,
        distance_km: conditions.station.distanceKm,
      },
      observed_at: conditions.observedAt,
      fetched_at: conditions.fetchedAt,
      water_temperature_c: conditions.waterTemperatureC,
      water_temperature_delta_24h_c: conditions.waterTemperatureDelta24hC,
      wind_speed_ms: conditions.windSpeedMs,
      wind_direction: conditions.windDirection,
      tides: conditions.tides as unknown as Json,
      weather: conditions.weather as unknown as Json,
    };

    const { error: updateError } = await supabase
      .from("user_catches")
      .update({ conditions_snapshot: snapshot })
      .eq("id", catchId)
      .eq("user_id", userId);
    if (updateError) throw updateError;
  } catch {
    // Environmental enrichment is best-effort and must never block catch saving.
  }
};
