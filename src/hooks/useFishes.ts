import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import type { Tables } from "@/src/types/database";

export type Fish = Tables<"fishes">;

const CATEGORY_LABELS: Record<Fish["category"], string> = {
  flatfish: "광어류",
  rockfish: "우럭류",
  seabass: "농어류",
  mackerel: "고등어류",
  bream: "도미류",
  mullet: "숭어류",
  cutlassfish: "갈치류",
  eel: "곰치류",
  pufferfish: "복어류",
  other: "기타",
};

export const useFishes = (category?: Fish["category"] | null) => {
  const [fishes, setFishes] = useState<Fish[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchFishes = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    let query = supabase
      .from("fishes")
      .select("*")
      .order("name_ko", { ascending: true });

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError as Error);
      setFishes([]);
    } else {
      setFishes(data ?? []);
    }

    if (isRefresh) setIsRefreshing(false);
    else setIsLoading(false);
  }, [category]);

  const refetch = useCallback(() => fetchFishes(true), [fetchFishes]);
  const retry = useCallback(() => fetchFishes(false), [fetchFishes]);

  useEffect(() => {
    fetchFishes();
  }, [fetchFishes]);

  return { fishes, isLoading, isRefreshing, error, refetch, retry };
}

export { CATEGORY_LABELS };
