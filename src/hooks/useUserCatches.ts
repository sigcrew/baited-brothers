import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import type { Tables } from "@/src/types/database";
import {
  createSignedUserMediaUrls,
  removeUserMedia,
} from "@/src/lib/userMedia";
import { trackAnalyticsEvent } from "@/src/lib/analytics";
import { countsForCollectionRewards } from "@/src/lib/catchRewards";
import { toUserMessage, withTimeout } from "@/src/lib/appErrors";

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
  const pendingOperations = useRef(new Set<string>());

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
          "*, fish:fishes!user_catches_fish_id_fkey(id, name, name_ko, image_url, category, catalog_sort_order)"
        )
        .eq("user_id", userId);

      if (tripId) query = query.eq("trip_id", tripId);

      const { data, error: fetchError } = await query.order("caught_at", {
        ascending: false,
      });

      if (fetchError) {
        setError(fetchError as Error);
        if (!isRefresh) setCatches([]);
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
      if (
        item.fish_id &&
        countsForCollectionRewards(item.verification_status)
      ) {
        ids.add(item.fish_id);
      }
    }
    return ids;
  }, [catches]);

  const updateCatch = async (
    catchId: string,
    input: {
      sizeCm?: number | null;
      memo?: string | null;
      fishId?: string | null;
      customSpeciesName?: string | null;
    },
  ) => {
    if (!userId) return { error: new Error("로그인이 필요합니다.") };
    const operationKey = catchId;
    if (pendingOperations.current.has(operationKey)) {
      return { error: new Error("이미 저장 중입니다. 잠시만 기다려 주세요.") };
    }
    const current = catches.find((item) => item.id === catchId);
    const customSpeciesName = input.customSpeciesName?.trim() || null;
    const speciesIncluded =
      input.fishId !== undefined || input.customSpeciesName !== undefined;
    if (
      speciesIncluded &&
      Boolean(input.fishId) === Boolean(customSpeciesName)
    ) {
      return {
        error: new Error(
          "도감 어종 또는 도감 밖 어종 이름 중 하나를 선택해 주세요.",
        ),
      };
    }
    const speciesChanged =
      speciesIncluded &&
      (current?.fish_id !== (input.fishId ?? null) ||
        current?.custom_species_name !== customSpeciesName);
    pendingOperations.current.add(operationKey);
    try {
      const { data: updatedCatch, error: updateError } = await withTimeout(
        Promise.resolve(
          supabase
            .from("user_catches")
            .update({
              size_cm: input.sizeCm ?? null,
              memo: input.memo?.trim() || null,
              ...(speciesIncluded
                ? {
                    fish_id: input.fishId ?? null,
                    custom_species_name: customSpeciesName,
                  }
                : {}),
            })
            .eq("id", catchId)
            .eq("user_id", userId)
            .select(
              "*, fish:fishes!user_catches_fish_id_fkey(id, name, name_ko, image_url, category, catalog_sort_order)",
            )
            .maybeSingle(),
        ),
        15_000,
        "조과 저장 시간이 초과되었습니다.",
      );
      if (updateError) {
        return {
          error: new Error(toUserMessage(updateError, "조과 저장에 실패했습니다.")),
        };
      }
      if (!updatedCatch) {
        return {
          error: new Error(
            "수정할 조과를 찾지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.",
          ),
        };
      }

      setCatches((items) =>
        items.map((item) =>
          item.id === catchId ? (updatedCatch as UserCatch) : item,
        ),
      );
      if (speciesChanged && input.fishId) {
        void supabase.functions
          .invoke("verify-catch", { body: { catchId } })
          .finally(() => fetchCatches(true));
      } else {
        void fetchCatches(true);
      }
      void trackAnalyticsEvent("catch_updated", {
        has_size: input.sizeCm != null,
        has_note: Boolean(input.memo?.trim()),
        species_changed: speciesChanged,
        outside_catalog: speciesIncluded && !input.fishId,
      });
      return { error: null };
    } catch (updateError) {
      return {
        error: new Error(
          toUserMessage(updateError, "조과 저장에 실패했습니다."),
        ),
      };
    } finally {
      pendingOperations.current.delete(operationKey);
    }
  };

  const deleteCatch = async (item: UserCatch) => {
    if (!userId) return { error: new Error("로그인이 필요합니다.") };
    const operationKey = item.id;
    if (pendingOperations.current.has(operationKey)) {
      return { error: new Error("이미 삭제 중입니다. 잠시만 기다려 주세요.") };
    }

    pendingOperations.current.add(operationKey);
    try {
      const { data: deletedRows, error: deleteError } = await withTimeout(
        Promise.resolve(
          supabase
            .from("user_catches")
            .delete()
            .eq("id", item.id)
            .eq("user_id", userId)
            .select("id"),
        ),
        15_000,
        "조과 삭제 시간이 초과되었습니다.",
      );
      if (deleteError) {
        return {
          error: new Error(toUserMessage(deleteError, "조과 삭제에 실패했습니다.")),
        };
      }
      if (!deletedRows?.length) {
        return {
          error: new Error(
            "삭제할 조과를 찾지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.",
          ),
        };
      }

      setCatches((items) => items.filter((current) => current.id !== item.id));
      const legacyMarker = "/storage/v1/object/public/user-uploads/";
      const legacyPath = item.image_url?.includes(legacyMarker)
        ? decodeURIComponent(item.image_url.split(legacyMarker)[1] ?? "")
        : null;
      void removeUserMedia([
        item.image_path,
        item.thumbnail_path,
        legacyPath,
      ]).catch(() => undefined);
      void trackAnalyticsEvent("catch_deleted");
      void fetchCatches(true);
      return { error: null };
    } catch (deleteError) {
      return {
        error: new Error(
          toUserMessage(deleteError, "조과 삭제에 실패했습니다."),
        ),
      };
    } finally {
      pendingOperations.current.delete(operationKey);
    }
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
