import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import type { Tables } from "@/src/types/database";
import {
  createSignedUserMediaUrls,
  removeUserMedia,
} from "@/src/lib/userMedia";

export type UserCatch = Tables<"user_catches"> & {
  thumbnail_url?: string | null;
  fish?: Pick<
    Tables<"fishes">,
    | "id"
    | "name"
    | "name_ko"
    | "image_url"
    | "category"
    | "catalog_sort_order"
  > | null;
};

export const useUserCatches = (tripId?: string) => {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [catches, setCatches] = useState<UserCatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchCatches = useCallback(
    async (isRefresh = false) => {
      if (!userId) {
        setCatches([]);
        setIsLoading(false);
        setIsRefreshing(false);
        setError(null);
        return;
      }

      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      let query = supabase
        .from("user_catches")
        .select(
          "*, fish:fishes(id, name, name_ko, image_url, category, catalog_sort_order)"
        )
        .eq("user_id", userId);

      if (tripId) query = query.eq("trip_id", tripId);

      const { data, error: fetchError } = await query.order("caught_at", {
        ascending: false,
      });

      if (fetchError) {
        setError(fetchError as Error);
        setCatches([]);
      } else {
        const rows = (data as UserCatch[]) ?? [];
        try {
          const signedUrls = await createSignedUserMediaUrls(
            rows.flatMap((item) => [item.image_path, item.thumbnail_path]),
          );
          setCatches(
            rows.map((item) => ({
              ...item,
              image_url:
                (item.image_path ? signedUrls.get(item.image_path) : null) ??
                item.image_url,
              thumbnail_url:
                (item.thumbnail_path
                  ? signedUrls.get(item.thumbnail_path)
                  : null) ?? null,
            })),
          );
        } catch (signError) {
          setError(signError as Error);
          setCatches(rows);
        }
      }

      if (isRefresh) setIsRefreshing(false);
      else setIsLoading(false);
    },
    [tripId, userId]
  );

  useEffect(() => {
    fetchCatches();
  }, [fetchCatches]);

  const unlockedFishIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of catches) {
      if (item.verification_status === "verified") ids.add(item.fish_id);
    }
    return ids;
  }, [catches]);

  const updateCatch = async (
    catchId: string,
    input: { sizeCm?: number | null; memo?: string | null },
  ) => {
    if (!userId) return { error: new Error("로그인이 필요합니다.") };
    const { error: updateError } = await supabase
      .from("user_catches")
      .update({
        size_cm: input.sizeCm ?? null,
        memo: input.memo?.trim() || null,
      })
      .eq("id", catchId)
      .eq("user_id", userId);
    if (!updateError) await fetchCatches(true);
    return { error: updateError ? (updateError as Error) : null };
  };

  const deleteCatch = async (item: UserCatch) => {
    if (!userId) return { error: new Error("로그인이 필요합니다.") };
    const { error: deleteError } = await supabase
      .from("user_catches")
      .delete()
      .eq("id", item.id)
      .eq("user_id", userId);
    if (deleteError) return { error: deleteError as Error };

    const legacyMarker = "/storage/v1/object/public/user-uploads/";
    const legacyPath = item.image_url?.includes(legacyMarker)
      ? decodeURIComponent(item.image_url.split(legacyMarker)[1] ?? "")
      : null;
    await removeUserMedia([
      item.image_path,
      item.thumbnail_path,
      legacyPath,
    ]);
    await fetchCatches(true);
    return { error: null };
  };

  return {
    catches,
    unlockedFishIds,
    isLoading,
    isRefreshing,
    error,
    isLoggedIn: Boolean(userId),
    refetch: () => fetchCatches(true),
    updateCatch,
    deleteCatch,
  };
};
