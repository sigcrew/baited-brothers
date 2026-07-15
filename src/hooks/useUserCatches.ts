import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import type { Tables } from "@/src/types/database";

export type UserCatch = Tables<"user_catches"> & {
  fish?: Pick<Tables<"fishes">, "id" | "name" | "name_ko" | "image_url" | "category"> | null;
};

export const useUserCatches = () => {
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

      const { data, error: fetchError } = await supabase
        .from("user_catches")
        .select(
          "*, fish:fishes(id, name, name_ko, image_url, category)"
        )
        .eq("user_id", userId)
        .order("caught_at", { ascending: false });

      if (fetchError) {
        setError(fetchError as Error);
        setCatches([]);
      } else {
        setCatches((data as UserCatch[]) ?? []);
      }

      if (isRefresh) setIsRefreshing(false);
      else setIsLoading(false);
    },
    [userId]
  );

  useEffect(() => {
    fetchCatches();
  }, [fetchCatches]);

  const unlockedFishIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of catches) {
      ids.add(item.fish_id);
    }
    return ids;
  }, [catches]);

  return {
    catches,
    unlockedFishIds,
    isLoading,
    isRefreshing,
    error,
    isLoggedIn: Boolean(userId),
    refetch: () => fetchCatches(true),
  };
};
