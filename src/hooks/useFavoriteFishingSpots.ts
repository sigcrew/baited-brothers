import { useCallback, useMemo, useState } from "react";

import { useAuth } from "@/src/contexts/AuthContext";
import { supabase } from "@/src/lib/supabase";
import type { Tables, TablesInsert } from "@/src/types/database";
import { createSharedResource } from "@/src/lib/sharedResource";

export type FavoriteFishingSpot = Tables<"favorite_fishing_spots">;

type FavoriteSpotInput = {
  name: string;
  latitude: number;
  longitude: number;
};

const sameCoordinate = (
  spot: FavoriteFishingSpot,
  latitude: number,
  longitude: number,
) => Math.abs(Number(spot.latitude) - latitude) < 0.00001 &&
  Math.abs(Number(spot.longitude) - longitude) < 0.00001;

const EMPTY_SPOTS: FavoriteFishingSpot[] = [];

export const favoriteSpotsResource = createSharedResource<FavoriteFishingSpot[]>({
  name: "favorite_fishing_spots",
  load: async (userId) => {
    const { data, error: fetchError } = await supabase
      .from("favorite_fishing_spots")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (fetchError) throw fetchError;
    return data ?? [];
  },
});

export const useFavoriteFishingSpots = () => {
  const { session } = useAuth();
  const userId = session?.user.id;
  const key = userId ?? null;
  const {
    data: spots,
    isLoading,
    error: loadError,
    refetch: fetchSpots,
  } = favoriteSpotsResource.useSharedResource(key, EMPTY_SPOTS);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setError] = useState<Error | null>(null);
  const error = saveError ?? loadError;
  const setSpots = useCallback(
    (updater: (current: FavoriteFishingSpot[]) => FavoriteFishingSpot[]) => {
      if (!key) return;
      favoriteSpotsResource.mutate(key, (current) => updater(current ?? []));
    },
    [key],
  );

  const findByCoordinate = useCallback(
    (latitude: number, longitude: number) =>
      spots.find((spot) => sameCoordinate(spot, latitude, longitude)) ?? null,
    [spots],
  );

  const toggleFavorite = useCallback(async (input: FavoriteSpotInput) => {
    if (!userId) return { error: new Error("로그인이 필요합니다."), isFavorite: false };
    const existing = findByCoordinate(input.latitude, input.longitude);
    setIsSaving(true);

    try {
      if (existing) {
        const { error: deleteError } = await supabase
          .from("favorite_fishing_spots")
          .delete()
          .eq("id", existing.id)
          .eq("user_id", userId);
        if (deleteError) throw deleteError;
        setSpots((current) => current.filter((spot) => spot.id !== existing.id));
        return { error: null, isFavorite: false, spot: existing };
      }

      const payload: TablesInsert<"favorite_fishing_spots"> = {
        user_id: userId,
        name: input.name.trim().slice(0, 80) || "즐겨찾는 바다",
        latitude: input.latitude,
        longitude: input.longitude,
      };
      const { data, error: insertError } = await supabase
        .from("favorite_fishing_spots")
        .insert(payload)
        .select("*")
        .single();
      if (insertError) throw insertError;
      setSpots((current) => [data, ...current]);
      return { error: null, isFavorite: true, spot: data };
    } catch (toggleError) {
      const nextError = toggleError instanceof Error
        ? toggleError
        : new Error("즐겨찾기를 변경하지 못했습니다.");
      setError(nextError);
      return { error: nextError, isFavorite: Boolean(existing), spot: existing };
    } finally {
      setIsSaving(false);
    }
  }, [findByCoordinate, userId]);

  return useMemo(() => ({
    spots,
    isLoading,
    isSaving,
    error,
    isLoggedIn: Boolean(userId),
    findByCoordinate,
    toggleFavorite,
    refetch: fetchSpots,
  }), [error, fetchSpots, findByCoordinate, isLoading, isSaving, spots, toggleFavorite, userId]);
};
