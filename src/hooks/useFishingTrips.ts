import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import type { Tables, TablesInsert, TablesUpdate } from "@/src/types/database";
import { optimizeUserPhoto } from "@/src/lib/optimizeUserPhoto";
import {
  createSignedUserMediaUrls,
  removeUserMedia,
  uploadUserPhotoVariants,
} from "@/src/lib/userMedia";

export type FishingTrip = Tables<"fishing_trips"> & {
  cover_thumbnail_url?: string | null;
};

export type CreateTripInput = {
  spotName: string;
  scheduledAt: Date;
  memo?: string;
  coverImage?: TripCoverImage;
};

export type UpdateTripInput = Omit<CreateTripInput, "coverImage"> & {
  coverImage?: TripCoverImage;
  removeCover?: boolean;
};

export type TripCoverImage = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
};

const uploadTripCover = async (userId: string, image: TripCoverImage) => {
  const optimized = await optimizeUserPhoto({
    uri: image.uri,
    width: image.width,
    height: image.height,
    maxDimension: 1280,
    compress: 0.75,
  });
  return uploadUserPhotoVariants({
    userId,
    folder: "trips",
    photo: optimized,
  });
};

type UseFishingTripsOptions = {
  autoFetch?: boolean;
};

export const useFishingTrips = ({ autoFetch = true }: UseFishingTripsOptions = {}) => {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [trips, setTrips] = useState<FishingTrip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTrips = useCallback(
    async (isRefresh = false) => {
      if (!userId) {
        setTrips([]);
        setIsLoading(false);
        setIsRefreshing(false);
        setError(null);
        return;
      }

      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("fishing_trips")
        .select("*")
        .eq("user_id", userId)
        .order("scheduled_at", { ascending: true });

      if (fetchError) {
        setError(fetchError as Error);
        setTrips([]);
      } else {
        const rows = data ?? [];
        try {
          const signedUrls = await createSignedUserMediaUrls(
            rows.flatMap((trip) => [
              trip.cover_image_path,
              trip.cover_thumbnail_path,
            ]),
          );
          setTrips(
            rows.map((trip) => ({
              ...trip,
              cover_image_url:
                (trip.cover_image_path
                  ? signedUrls.get(trip.cover_image_path)
                  : null) ?? trip.cover_image_url,
              cover_thumbnail_url:
                (trip.cover_thumbnail_path
                  ? signedUrls.get(trip.cover_thumbnail_path)
                  : null) ?? null,
            })),
          );
        } catch (signError) {
          setError(signError as Error);
          setTrips(rows);
        }
      }

      if (isRefresh) setIsRefreshing(false);
      else setIsLoading(false);
    },
    [userId]
  );

  useEffect(() => {
    if (autoFetch) {
      fetchTrips();
    } else {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [autoFetch, fetchTrips]);

  const plannedTrips = useMemo(
    () => trips.filter((trip) => trip.status === "planned"),
    [trips]
  );

  const recentDoneTrips = useMemo(
    () =>
      trips
        .filter((trip) => trip.status === "done")
        .sort((a, b) => {
          const aTime = a.completed_at ?? a.scheduled_at;
          const bTime = b.completed_at ?? b.scheduled_at;
          return bTime.localeCompare(aTime);
        })
        .slice(0, 5),
    [trips]
  );

  const createTrip = useCallback(
    async (input: CreateTripInput) => {
      if (!userId) {
        return { error: new Error("로그인이 필요합니다.") };
      }

      const spotName = input.spotName.trim();
      if (!spotName) {
        return { error: new Error("낚시터 이름을 입력해 주세요.") };
      }

      setIsSaving(true);
      let uploadedPaths: string[] = [];

      try {
        const uploadedCover = input.coverImage
          ? await uploadTripCover(userId, input.coverImage)
          : null;
        uploadedPaths = uploadedCover
          ? [uploadedCover.imagePath, uploadedCover.thumbnailPath]
          : [];

        const payload: TablesInsert<"fishing_trips"> = {
          user_id: userId,
          spot_name: spotName,
          scheduled_at: input.scheduledAt.toISOString(),
          memo: input.memo?.trim() ? input.memo.trim() : null,
          status: "planned",
          cover_image_url: null,
          cover_image_path: uploadedCover?.imagePath ?? null,
          cover_thumbnail_path: uploadedCover?.thumbnailPath ?? null,
        };

        const { error: insertError } = await supabase
          .from("fishing_trips")
          .insert(payload);

        if (insertError) throw insertError;
      } catch (createError) {
        await removeUserMedia(uploadedPaths);
        return {
          error: createError instanceof Error
            ? createError
            : new Error("출조 일정을 저장하지 못했습니다."),
        };
      } finally {
        setIsSaving(false);
      }

      if (autoFetch) await fetchTrips(true);
      return { error: null };
    },
    [autoFetch, userId, fetchTrips]
  );

  const updateTripCover = useCallback(
    async (tripId: string, image: TripCoverImage) => {
      if (!userId) return { error: new Error("로그인이 필요합니다.") };

      const trip = trips.find((item) => item.id === tripId);
      if (!trip) return { error: new Error("출조 일정을 찾지 못했습니다.") };

      setIsSaving(true);
      let uploadedPaths: string[] = [];

      try {
        const uploadedCover = await uploadTripCover(userId, image);
        uploadedPaths = [uploadedCover.imagePath, uploadedCover.thumbnailPath];

        const { error: updateError } = await supabase
          .from("fishing_trips")
          .update({
            cover_image_url: null,
            cover_image_path: uploadedCover.imagePath,
            cover_thumbnail_path: uploadedCover.thumbnailPath,
          })
          .eq("id", tripId)
          .eq("user_id", userId);

        if (updateError) throw updateError;

        await removeUserMedia([
          trip.cover_image_path,
          trip.cover_thumbnail_path,
        ]);
        await fetchTrips(true);
        return { error: null };
      } catch (updateError) {
        await removeUserMedia(uploadedPaths);
        return {
          error: updateError instanceof Error
            ? updateError
            : new Error("커버 사진을 변경하지 못했습니다."),
        };
      } finally {
        setIsSaving(false);
      }
    },
    [fetchTrips, trips, userId]
  );

  const removeTripCover = useCallback(
    async (tripId: string) => {
      if (!userId) return { error: new Error("로그인이 필요합니다.") };

      const trip = trips.find((item) => item.id === tripId);
      if (!trip) return { error: new Error("출조 일정을 찾지 못했습니다.") };

      setIsSaving(true);
      try {
        const { error: updateError } = await supabase
          .from("fishing_trips")
          .update({
            cover_image_url: null,
            cover_image_path: null,
            cover_thumbnail_path: null,
          })
          .eq("id", tripId)
          .eq("user_id", userId);

        if (updateError) throw updateError;
        await removeUserMedia([
          trip.cover_image_path,
          trip.cover_thumbnail_path,
        ]);
        await fetchTrips(true);
        return { error: null };
      } catch (removeError) {
        return {
          error: removeError instanceof Error
            ? removeError
            : new Error("기본 커버로 되돌리지 못했습니다."),
        };
      } finally {
        setIsSaving(false);
      }
    },
    [fetchTrips, trips, userId]
  );

  const updateTrip = useCallback(
    async (tripId: string, input: UpdateTripInput) => {
      if (!userId) return { error: new Error("로그인이 필요합니다.") };

      const trip = trips.find((item) => item.id === tripId);
      if (!trip) return { error: new Error("출조 일정을 찾지 못했습니다.") };

      const spotName = input.spotName.trim();
      if (!spotName) return { error: new Error("낚시터 이름을 입력해 주세요.") };

      setIsSaving(true);
      let uploadedPaths: string[] = [];

      try {
        const uploadedCover = input.coverImage
          ? await uploadTripCover(userId, input.coverImage)
          : null;
        uploadedPaths = uploadedCover
          ? [uploadedCover.imagePath, uploadedCover.thumbnailPath]
          : [];

        const payload: TablesUpdate<"fishing_trips"> = {
          spot_name: spotName,
          scheduled_at: input.scheduledAt.toISOString(),
          memo: input.memo?.trim() ? input.memo.trim() : null,
          ...(input.removeCover
            ? {
                cover_image_url: null,
                cover_image_path: null,
                cover_thumbnail_path: null,
              }
            : {}),
          ...(uploadedCover
            ? {
                cover_image_url: null,
                cover_image_path: uploadedCover.imagePath,
                cover_thumbnail_path: uploadedCover.thumbnailPath,
              }
            : {}),
        };

        const { error: updateError } = await supabase
          .from("fishing_trips")
          .update(payload)
          .eq("id", tripId)
          .eq("user_id", userId);

        if (updateError) throw updateError;

        if (uploadedCover || input.removeCover) {
          await removeUserMedia([
            trip.cover_image_path,
            trip.cover_thumbnail_path,
          ]);
        }
      } catch (updateError) {
        await removeUserMedia(uploadedPaths);
        return {
          error: updateError instanceof Error
            ? updateError
            : new Error("출조 일정을 수정하지 못했습니다."),
        };
      } finally {
        setIsSaving(false);
      }

      await fetchTrips(true);
      return { error: null };
    },
    [fetchTrips, trips, userId]
  );

  const deleteTrip = useCallback(
    async (tripId: string) => {
      if (!userId) return { error: new Error("로그인이 필요합니다.") };

      const trip = trips.find((item) => item.id === tripId);
      if (!trip) return { error: new Error("출조 일정을 찾지 못했습니다.") };

      setIsSaving(true);
      try {
        const { error: deleteError } = await supabase
          .from("fishing_trips")
          .delete()
          .eq("id", tripId)
          .eq("user_id", userId);

        if (deleteError) throw deleteError;

        await removeUserMedia([
          trip.cover_image_path,
          trip.cover_thumbnail_path,
        ]);
      } catch (deleteError) {
        return {
          error: deleteError instanceof Error
            ? deleteError
            : new Error("출조 일정을 삭제하지 못했습니다."),
        };
      } finally {
        setIsSaving(false);
      }

      await fetchTrips(true);
      return { error: null };
    },
    [fetchTrips, trips, userId]
  );

  const markDone = useCallback(
    async (tripId: string) => {
      if (!userId) return { error: new Error("로그인이 필요합니다.") };
      setIsSaving(true);
      const { error: updateError } = await supabase
        .from("fishing_trips")
        .update({
          status: "done",
          completed_at: new Date().toISOString(),
        })
        .eq("id", tripId)
        .eq("user_id", userId);

      setIsSaving(false);

      if (updateError) {
        return { error: updateError as Error };
      }

      await fetchTrips(true);
      return { error: null };
    },
    [fetchTrips, userId]
  );

  const cancelTrip = useCallback(
    async (tripId: string) => {
      if (!userId) return { error: new Error("로그인이 필요합니다.") };
      setIsSaving(true);
      const { error: updateError } = await supabase
        .from("fishing_trips")
        .update({
          status: "canceled",
          completed_at: null,
        })
        .eq("id", tripId)
        .eq("user_id", userId);

      setIsSaving(false);

      if (updateError) {
        return { error: updateError as Error };
      }

      await fetchTrips(true);
      return { error: null };
    },
    [fetchTrips, userId]
  );

  return {
    trips,
    plannedTrips,
    recentDoneTrips,
    isLoading,
    isRefreshing,
    isSaving,
    error,
    isLoggedIn: Boolean(userId),
    refetch: () => fetchTrips(true),
    createTrip,
    updateTrip,
    updateTripCover,
    removeTripCover,
    deleteTrip,
    markDone,
    cancelTrip,
  };
};
