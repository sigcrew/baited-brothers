import { useCallback, useEffect, useRef, useState } from "react";

import { useAuth } from "@/src/contexts/AuthContext";
import { supabase } from "@/src/lib/supabase";
import type { FishingTrip } from "@/src/hooks/useFishingTrips";

export type JournalTripFilter = "all" | FishingTrip["status"];

export type JournalTripCounts = {
  all: number;
  planned: number;
  done: number;
  canceled: number;
};

const PAGE_SIZE = 10;
const EMPTY_COUNTS: JournalTripCounts = {
  all: 0,
  planned: 0,
  done: 0,
  canceled: 0,
};

const fetchStatusCount = async (userId: string, status: FishingTrip["status"]) => {
  const { count, error } = await supabase
    .from("fishing_trips")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", status);

  if (error) throw error;
  return count ?? 0;
};

const fetchCounts = async (userId: string): Promise<JournalTripCounts> => {
  const [planned, done, canceled] = await Promise.all([
    fetchStatusCount(userId, "planned"),
    fetchStatusCount(userId, "done"),
    fetchStatusCount(userId, "canceled"),
  ]);

  return {
    all: planned + done + canceled,
    planned,
    done,
    canceled,
  };
};

const fetchFilteredRange = async ({
  userId,
  filter,
  offset,
  limit,
}: {
  userId: string;
  filter: Exclude<JournalTripFilter, "all">;
  offset: number;
  limit: number;
}) => {
  const ascending = filter === "planned";
  const { data, error } = await supabase
    .from("fishing_trips")
    .select("*")
    .eq("user_id", userId)
    .eq("status", filter)
    .order("scheduled_at", { ascending })
    .order("id", { ascending })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return data ?? [];
};

const fetchJournalRange = async ({
  userId,
  filter,
  counts,
  offset,
}: {
  userId: string;
  filter: JournalTripFilter;
  counts: JournalTripCounts;
  offset: number;
}) => {
  if (filter !== "all") {
    return fetchFilteredRange({ userId, filter, offset, limit: PAGE_SIZE });
  }

  const rows: FishingTrip[] = [];
  let remaining = PAGE_SIZE;

  if (offset < counts.planned) {
    const plannedRows = await fetchFilteredRange({
      userId,
      filter: "planned",
      offset,
      limit: Math.min(remaining, counts.planned - offset),
    });
    rows.push(...plannedRows);
    remaining -= plannedRows.length;
  }

  if (remaining > 0) {
    const historyOffset = Math.max(0, offset - counts.planned);
    const { data, error } = await supabase
      .from("fishing_trips")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["done", "canceled"])
      .order("scheduled_at", { ascending: false })
      .order("id", { ascending: false })
      .range(historyOffset, historyOffset + remaining - 1);

    if (error) throw error;
    rows.push(...(data ?? []));
  }

  return rows;
};

export const useJournalTrips = (filter: JournalTripFilter) => {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [trips, setTrips] = useState<FishingTrip[]>([]);
  const [counts, setCounts] = useState<JournalTripCounts>(EMPTY_COUNTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<Error | null>(null);
  const nextOffsetRef = useRef(0);
  const requestVersionRef = useRef(0);
  const loadingMoreRef = useRef(false);

  const loadFirstPage = useCallback(async (refreshing = false) => {
    const requestVersion = ++requestVersionRef.current;
    loadingMoreRef.current = false;
    setIsLoadingMore(false);

    if (!userId) {
      setTrips([]);
      setCounts(EMPTY_COUNTS);
      setIsLoading(false);
      setIsRefreshing(false);
      setHasMore(false);
      setError(null);
      return;
    }

    if (refreshing) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);
    setLoadMoreError(null);

    try {
      const nextCounts = await fetchCounts(userId);
      const firstPage = await fetchJournalRange({
        userId,
        filter,
        counts: nextCounts,
        offset: 0,
      });

      if (requestVersion !== requestVersionRef.current) return;
      setCounts(nextCounts);
      setTrips(firstPage);
      nextOffsetRef.current = firstPage.length;
      setHasMore(firstPage.length < nextCounts[filter]);
    } catch (loadError) {
      if (requestVersion !== requestVersionRef.current) return;
      setTrips([]);
      setCounts(EMPTY_COUNTS);
      setHasMore(false);
      setError(loadError instanceof Error ? loadError : new Error("출조 일지를 불러오지 못했습니다."));
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [filter, userId]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!userId || !hasMore || loadingMoreRef.current || isLoading || isRefreshing) return;

    const requestVersion = requestVersionRef.current;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    setLoadMoreError(null);

    try {
      const nextPage = await fetchJournalRange({
        userId,
        filter,
        counts,
        offset: nextOffsetRef.current,
      });

      if (requestVersion !== requestVersionRef.current) return;
      setTrips((current) => {
        const knownIds = new Set(current.map((trip) => trip.id));
        return [...current, ...nextPage.filter((trip) => !knownIds.has(trip.id))];
      });
      nextOffsetRef.current += nextPage.length;
      setHasMore(nextOffsetRef.current < counts[filter] && nextPage.length > 0);
    } catch (nextError) {
      if (requestVersion !== requestVersionRef.current) return;
      setLoadMoreError(nextError instanceof Error ? nextError : new Error("다음 기록을 불러오지 못했습니다."));
    } finally {
      if (requestVersion === requestVersionRef.current) {
        loadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [counts, filter, hasMore, isLoading, isRefreshing, userId]);

  return {
    trips,
    counts,
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasMore,
    error,
    loadMoreError,
    refetch: () => loadFirstPage(true),
    loadMore,
    pageSize: PAGE_SIZE,
  };
};
