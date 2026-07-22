import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/src/contexts/AuthContext";
import { supabase } from "@/src/lib/supabase";
import type { Tables, TablesInsert } from "@/src/types/database";

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

export const useFavoriteFishingSpots = () => {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [spots, setSpots] = useState<FavoriteFishingSpot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchSpots = useCallback(async () => {
    if (!userId) {
      setSpots([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    const { data, error: fetchError } = await supabase
      .from("favorite_fishing_spots")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (fetchError) {
      setError(fetchError as Error);
    } else {
      setSpots(data ?? []);
      setError(null);
    }
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    void fetchSpots();
  }, [fetchSpots]);

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
