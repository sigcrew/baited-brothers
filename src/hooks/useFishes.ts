import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import type { Tables } from "@/src/types/database";
import { FIELD_60_FALLBACK_FISHES } from "@/src/data/field60CatalogFallback";

export type Fish = Tables<"fishes">;

export const CATALOG_GROUPS = [
  "flatfish",
  "rockfish",
  "bream",
  "seabass_croaker",
  "pelagic",
  "filefish",
  "pufferfish",
  "eel",
  "coastal",
  "squid",
  "octopus",
] as const;

export type CatalogGroup = (typeof CATALOG_GROUPS)[number];
export type CatalogScope = "core" | "collectible" | "all";

const CATEGORY_LABELS: Record<CatalogGroup, string> = {
  flatfish: "넙치·가자미",
  rockfish: "볼락·우럭",
  bream: "돔",
  seabass_croaker: "농어·민어",
  pelagic: "회유성 어종",
  filefish: "쥐치",
  pufferfish: "복어",
  eel: "붕장어",
  coastal: "연안 어종",
  squid: "오징어",
  octopus: "문어",
};

export const getCatalogGroupLabel = (group: string) =>
  CATEGORY_LABELS[group as CatalogGroup] ?? "기타";

export const useFishes = (
  group?: CatalogGroup | null,
  scope: CatalogScope = "core"
) => {
  const fallbackFishes = useMemo(
    () =>
      group
        ? FIELD_60_FALLBACK_FISHES.filter(
            (fish) => fish.collection_group === group,
          )
        : FIELD_60_FALLBACK_FISHES,
    [group],
  );
  const [fishes, setFishes] = useState<Fish[]>(fallbackFishes);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchFishes = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(fishes.length === 0);
    setError(null);

    let query = supabase
      .from("fishes")
      .select("*")
      .order("catalog_sort_order", { ascending: true, nullsFirst: false })
      .order("name_ko", { ascending: true });

    if (scope === "core") {
      query = query.eq("catalog_status", "core");
    } else if (scope === "collectible") {
      query = query.in("catalog_status", ["core", "extended"]);
    } else {
      query = query.neq("catalog_status", "needs_review");
    }

    if (group) {
      query = query.eq("collection_group", group);
    }

    const { data, error: fetchError } = await query;

    if (fetchError) {
      setError(fetchError as Error);
      setFishes(fallbackFishes);
    } else {
      setFishes(data ?? []);
    }

    if (isRefresh) setIsRefreshing(false);
    else setIsLoading(false);
  }, [fallbackFishes, fishes.length, group, scope]);

  const refetch = useCallback(() => fetchFishes(true), [fetchFishes]);
  const retry = useCallback(() => fetchFishes(false), [fetchFishes]);

  useEffect(() => {
    fetchFishes();
  }, [fetchFishes]);

  return { fishes, isLoading, isRefreshing, error, refetch, retry };
}

export { CATEGORY_LABELS };
