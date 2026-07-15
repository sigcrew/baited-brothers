import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import type { Tables, TablesInsert } from "@/src/types/database";

export type FishingTrip = Tables<"fishing_trips">;

export type CreateTripInput = {
  spotName: string;
  scheduledAt: Date;
  memo?: string;
};

export const useFishingTrips = () => {
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
        setTrips(data ?? []);
      }

      if (isRefresh) setIsRefreshing(false);
      else setIsLoading(false);
    },
    [userId]
  );

  useEffect(() => {
    fetchTrips();
  }, [fetchTrips]);

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
      const payload: TablesInsert<"fishing_trips"> = {
        user_id: userId,
        spot_name: spotName,
        scheduled_at: input.scheduledAt.toISOString(),
        memo: input.memo?.trim() ? input.memo.trim() : null,
        status: "planned",
      };

      const { error: insertError } = await supabase
        .from("fishing_trips")
        .insert(payload);

      setIsSaving(false);

      if (insertError) {
        return { error: insertError as Error };
      }

      await fetchTrips(true);
      return { error: null };
    },
    [userId, fetchTrips]
  );

  const markDone = useCallback(
    async (tripId: string) => {
      setIsSaving(true);
      const { error: updateError } = await supabase
        .from("fishing_trips")
        .update({
          status: "done",
          completed_at: new Date().toISOString(),
        })
        .eq("id", tripId);

      setIsSaving(false);

      if (updateError) {
        return { error: updateError as Error };
      }

      await fetchTrips(true);
      return { error: null };
    },
    [fetchTrips]
  );

  const cancelTrip = useCallback(
    async (tripId: string) => {
      setIsSaving(true);
      const { error: updateError } = await supabase
        .from("fishing_trips")
        .update({
          status: "canceled",
          completed_at: null,
        })
        .eq("id", tripId);

      setIsSaving(false);

      if (updateError) {
        return { error: updateError as Error };
      }

      await fetchTrips(true);
      return { error: null };
    },
    [fetchTrips]
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
    markDone,
    cancelTrip,
  };
};
