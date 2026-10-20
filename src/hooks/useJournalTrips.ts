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

/**
 * "전체" 보기의 페이지 커서. 예정(오름차순)과 지난 출조(내림차순)를 각각 어디까지
 * 읽었는지 따로 기억한다. 예전에는 첫 로드 때의 카운트로 오프셋을 계산해서, 사이에
 * 출조가 생기거나 완료되면 행을 건너뛰거나 중복으로 읽었다.
 */
type JournalCursor = {
  offset: number;
  planned: number;
  history: number;
  plannedExhausted: boolean;
};

const INITIAL_CURSOR: JournalCursor = { offset: 0, planned: 0, history: 0, plannedExhausted: false };

const fetchJournalRange = async ({
  userId,
  filter,
  cursor,
}: {
  userId: string;
  filter: JournalTripFilter;
  cursor: JournalCursor;
}): Promise<{ rows: FishingTrip[]; cursor: JournalCursor; exhausted: boolean }> => {
  if (filter !== "all") {
    const rows = await fetchFilteredRange({ userId, filter, offset: cursor.offset, limit: PAGE_SIZE });
    return {
      rows,
      cursor: { ...cursor, offset: cursor.offset + rows.length },
      exhausted: rows.length < PAGE_SIZE,
    };
  }

  const rows: FishingTrip[] = [];
  let remaining = PAGE_SIZE;
  const next = { ...cursor };

  if (!next.plannedExhausted) {
    const plannedRows = await fetchFilteredRange({
      userId,
      filter: "planned",
      offset: next.planned,
      limit: remaining,
    });
    rows.push(...plannedRows);
    next.planned += plannedRows.length;
    remaining -= plannedRows.length;
    if (plannedRows.length < PAGE_SIZE) next.plannedExhausted = true;
  }

  let historyExhausted = false;
  if (remaining > 0) {
    const { data, error } = await supabase
      .from("fishing_trips")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["done", "canceled"])
      .order("scheduled_at", { ascending: false })
      .order("id", { ascending: false })
      .range(next.history, next.history + remaining - 1);

    if (error) throw error;
    const historyRows = data ?? [];
    rows.push(...historyRows);
    next.history += historyRows.length;
    historyExhausted = historyRows.length < remaining;
  }

  return { rows, cursor: next, exhausted: next.plannedExhausted && historyExhausted };
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
  const cursorRef = useRef<JournalCursor>(INITIAL_CURSOR);
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
      const [nextCounts, firstPage] = await Promise.all([
        fetchCounts(userId),
        fetchJournalRange({ userId, filter, cursor: INITIAL_CURSOR }),
      ]);

      if (requestVersion !== requestVersionRef.current) return;
      setCounts(nextCounts);
      setTrips(firstPage.rows);
      cursorRef.current = firstPage.cursor;
      setHasMore(!firstPage.exhausted);
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
      const nextPage = await fetchJournalRange({ userId, filter, cursor: cursorRef.current });

      if (requestVersion !== requestVersionRef.current) return;
      setTrips((current) => {
        const knownIds = new Set(current.map((trip) => trip.id));
        return [...current, ...nextPage.rows.filter((trip) => !knownIds.has(trip.id))];
      });
      cursorRef.current = nextPage.cursor;
      setHasMore(!nextPage.exhausted);
    } catch (nextError) {
      if (requestVersion !== requestVersionRef.current) return;
      setLoadMoreError(nextError instanceof Error ? nextError : new Error("다음 기록을 불러오지 못했습니다."));
    } finally {
      if (requestVersion === requestVersionRef.current) {
        loadingMoreRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [filter, hasMore, isLoading, isRefreshing, userId]);

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
