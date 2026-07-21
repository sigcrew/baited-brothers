import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/src/contexts/AuthContext";
import { supabase } from "@/src/lib/supabase";
import type { Fish } from "@/src/hooks/useFishes";
import type { Tables } from "@/src/types/database";
import { createSignedUserMediaUrls } from "@/src/lib/userMedia";

export type FishRegulation = Tables<"fish_regulations">;
export type FishCatchRecord = Pick<
  Tables<"user_catches">,
  | "id"
  | "caught_at"
  | "location_name"
  | "size_cm"
  | "image_url"
  | "image_path"
  | "thumbnail_path"
  | "trip_id"
  | "memo"
> & { thumbnail_url?: string | null };

type FishDetailState = {
  fish: Fish | null;
  regulations: FishRegulation[];
  catches: FishCatchRecord[];
  isLoading: boolean;
  error: Error | null;
};

const EMPTY_STATE: FishDetailState = {
  fish: null,
  regulations: [],
  catches: [],
  isLoading: true,
  error: null,
};

export const useFishDetail = (fishId?: string) => {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [state, setState] = useState<FishDetailState>(EMPTY_STATE);

  const fetchDetail = useCallback(async () => {
    if (!fishId) {
      setState({ ...EMPTY_STATE, isLoading: false, error: new Error("어종 ID가 없습니다.") });
      return;
    }

    setState((current) => ({ ...current, isLoading: true, error: null }));

    const today = new Date().toISOString().slice(0, 10);
    const fishPromise = supabase.from("fishes").select("*").eq("id", fishId).maybeSingle();
    const regulationPromise = supabase
      .from("fish_regulations")
      .select("*")
      .eq("fish_id", fishId)
      .lte("effective_from", today)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
      .order("regulation_type")
      .order("effective_from", { ascending: false });
    const catchesPromise = userId
      ? supabase
          .from("user_catches")
          .select("id, caught_at, location_name, size_cm, image_url, image_path, thumbnail_path, trip_id, memo")
          .eq("user_id", userId)
          .eq("fish_id", fishId)
          .eq("verification_status", "verified")
          .order("caught_at", { ascending: false })
      : Promise.resolve({ data: [] as FishCatchRecord[], error: null });

    const [fishResult, regulationsResult, catchesResult] = await Promise.all([
      fishPromise,
      regulationPromise,
      catchesPromise,
    ]);
    const fetchError = fishResult.error ?? regulationsResult.error ?? catchesResult.error;

    if (fetchError) {
      setState({ ...EMPTY_STATE, isLoading: false, error: fetchError as Error });
      return;
    }

    const catchRows = (catchesResult.data as FishCatchRecord[]) ?? [];
    let resolvedCatches = catchRows;
    try {
      const signedUrls = await createSignedUserMediaUrls(
        catchRows.flatMap((item) => [item.image_path, item.thumbnail_path]),
      );
      resolvedCatches = catchRows.map((item) => ({
        ...item,
        image_url:
          (item.image_path ? signedUrls.get(item.image_path) : null) ??
          item.image_url,
        thumbnail_url:
          (item.thumbnail_path
            ? signedUrls.get(item.thumbnail_path)
            : null) ?? null,
      }));
    } catch (signError) {
      setState({
        ...EMPTY_STATE,
        isLoading: false,
        error: signError as Error,
      });
      return;
    }

    setState({
      fish: fishResult.data,
      regulations: regulationsResult.data ?? [],
      catches: resolvedCatches,
      isLoading: false,
      error: null,
    });
  }, [fishId, userId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const discovery = useMemo(() => {
    const bestSize = state.catches.reduce<number | null>((best, item) => {
      if (item.size_cm == null) return best;
      return best == null ? item.size_cm : Math.max(best, item.size_cm);
    }, null);
    const chronological = [...state.catches].sort((a, b) => a.caught_at.localeCompare(b.caught_at));

    return {
      count: state.catches.length,
      firstCaughtAt: chronological[0]?.caught_at ?? null,
      latestCaughtAt: state.catches[0]?.caught_at ?? null,
      bestSizeCm: bestSize,
      locations: Array.from(
        new Set(state.catches.flatMap((item) => (item.location_name ? [item.location_name] : [])))
      ),
    };
  }, [state.catches]);

  const isUnlocked =
    state.catches.length > 0 ||
    (__DEV__ &&
      !userId &&
      state.fish?.catalog_sort_order != null &&
      state.fish.catalog_sort_order <= 2);

  return { ...state, discovery, isUnlocked, refetch: fetchDetail };
};
