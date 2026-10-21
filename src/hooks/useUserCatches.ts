import { useCallback, useMemo, useRef } from "react";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import type { Tables } from "@/src/types/database";
import {
  createSignedUserMediaUrls,
  removeUserMedia,
} from "@/src/lib/userMedia";
import { trackAnalyticsEvent } from "@/src/lib/analytics";
import { summarizeCollectionCoverage } from "@/src/lib/catchRewards";
import { toUserMessage, withTimeout } from "@/src/lib/appErrors";
import { createSharedResource } from "@/src/lib/sharedResource";

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

const EMPTY_CATCHES: UserCatch[] = [];

// 키는 `${userId}|${tripId ?? ""}`. 같은 사용자의 전체 목록과 출조별 목록이 한
// 스토어를 공유해, 홈·지도·수집·프로필이 각자 fetch하던 것을 한 번으로 줄인다.
const catchKey = (userId: string, tripId?: string) => `${userId}|${tripId ?? ""}`;

const loadCatches = async (key: string): Promise<UserCatch[]> => {
  const [userId, tripId] = key.split("|");
  let query = supabase
    .from("user_catches")
    .select(
      "*, fish:fishes!user_catches_fish_id_fkey(id, name, name_ko, image_url, category, catalog_sort_order)"
    )
    .eq("user_id", userId);
  if (tripId) query = query.eq("trip_id", tripId);
  const { data, error: fetchError } = await query.order("caught_at", { ascending: false });
  if (fetchError) throw fetchError;

  const rows = (data as UserCatch[]) ?? [];
  try {
    const signedUrls = await createSignedUserMediaUrls(
      rows.flatMap((item) => [item.image_path, item.thumbnail_path]),
    );
    return rows.map((item) => ({
      ...item,
      image_url:
        (item.image_path ? signedUrls.get(item.image_path) : null) ?? item.image_url,
      thumbnail_url:
        (item.thumbnail_path ? signedUrls.get(item.thumbnail_path) : null) ?? null,
    }));
  } catch (signError) {
    console.warn("catch media signing failed", signError);
    return rows;
  }
};

export const catchesResource = createSharedResource<UserCatch[]>({
  name: "user_catches",
  load: loadCatches,
});

export const useUserCatches = (tripId?: string) => {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const key = userId ? catchKey(userId, tripId) : null;

  const {
    data: catches,
    isLoading,
    isRefreshing,
    error,
  } = catchesResource.useSharedResource(key, EMPTY_CATCHES);
  const pendingOperations = useRef(new Set<string>());

  // 전체 목록과 출조별 목록을 함께 갱신한다.
  const fetchCatches = useCallback(
    async (_isRefresh = false) => {
      if (!userId) return;
      await catchesResource.invalidate(`${userId}|`);
    },
    [userId],
  );
  const setCatches = useCallback(
    (updater: (items: UserCatch[]) => UserCatch[]) => {
      if (!userId) return;
      catchesResource.mutateAll(`${userId}|`, updater);
    },
    [userId],
  );

  const coverage = useMemo(() => summarizeCollectionCoverage(catches), [catches]);
  const unlockedFishIds = coverage.unlockedFishIds;

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
    generalRecordCount: coverage.generalRecordCount,
    generalRecordOnlyFishIds: coverage.generalRecordOnlyFishIds,
    isLoading,
    isRefreshing,
    error,
    isLoggedIn: Boolean(userId),
    refetch: () => fetchCatches(true),
    updateCatch,
    deleteCatch,
  };
};
