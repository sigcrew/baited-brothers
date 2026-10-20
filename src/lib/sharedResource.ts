import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

/**
 * 화면마다 독립적으로 fetch하던 훅(useUserCatches 5곳, useFishingTrips 8곳)이
 * 같은 데이터를 한 번만 불러오고 서로의 변경을 즉시 반영하도록 하는 작은 공유
 * 스토어. React Query를 들이지 않고도 다음을 보장한다.
 *
 * - 같은 키의 동시 로드는 한 요청으로 합쳐진다.
 * - 이미 받은 데이터가 있으면 새로 마운트된 화면은 즉시 그 값을 보고,
 *   staleAfterMs가 지났을 때만 백그라운드에서 다시 받는다.
 * - invalidate(prefix)는 그 사용자의 모든 키를 다시 받는다(CRUD 후).
 * - mutate(key, updater)는 낙관적 갱신을 모든 구독자에게 바로 전파한다.
 */

type Entry<T> = {
  data: T | null;
  error: Error | null;
  loadedAt: number | null;
  inFlight: Promise<void> | null;
  isRefresh: boolean;
  listeners: Set<() => void>;
};

export type SharedResourceOptions<T> = {
  name: string;
  /** 키가 가리키는 데이터를 불러온다. 던지면 error로 기록된다. */
  load: (key: string) => Promise<T>;
  /** 마운트 시 이 시간 안에 받은 데이터는 다시 받지 않는다. */
  staleAfterMs?: number;
};

const registry = new Set<{ clear: () => void }>();

/** 로그아웃 시 모든 공유 리소스를 비운다. 다음 사용자가 이전 사용자의 캐시를 보지 않도록. */
export const clearAllSharedResources = () => registry.forEach((store) => store.clear());

export const createSharedResource = <T>({ name, load, staleAfterMs = 15_000 }: SharedResourceOptions<T>) => {
  const entries = new Map<string, Entry<T>>();

  const entryFor = (key: string): Entry<T> => {
    let entry = entries.get(key);
    if (!entry) {
      entry = { data: null, error: null, loadedAt: null, inFlight: null, isRefresh: false, listeners: new Set() };
      entries.set(key, entry);
    }
    return entry;
  };

  const notify = (entry: Entry<T>) => entry.listeners.forEach((listener) => listener());

  const fetchKey = (key: string, isRefresh: boolean): Promise<void> => {
    const entry = entryFor(key);
    if (entry.inFlight) return entry.inFlight;
    entry.isRefresh = isRefresh;
    const run = (async () => {
      try {
        const data = await load(key);
        entry.data = data;
        entry.error = null;
        entry.loadedAt = Date.now();
      } catch (error) {
        entry.error = error instanceof Error ? error : new Error(`${name}: load failed`);
        if (!isRefresh) entry.data = null;
      } finally {
        entry.inFlight = null;
        entry.isRefresh = false;
        notify(entry);
      }
    })();
    entry.inFlight = run;
    notify(entry);
    return run;
  };

  const isFresh = (entry: Entry<T>) =>
    entry.loadedAt !== null && Date.now() - entry.loadedAt < staleAfterMs;

  const store = {
    /** 캐시가 없거나 오래됐을 때만 받는다. 새 화면 마운트용. */
    ensure: (key: string) => {
      const entry = entryFor(key);
      if (entry.inFlight) return entry.inFlight;
      if (entry.data !== null && isFresh(entry)) return Promise.resolve();
      return fetchKey(key, entry.data !== null);
    },
    /** 캐시와 무관하게 다시 받는다. 기존 데이터는 받는 동안 유지된다. */
    refetch: (key: string) => fetchKey(key, entryFor(key).data !== null),
    /** 접두사로 시작하는, 구독자가 있거나 데이터가 있는 모든 키를 다시 받는다. */
    invalidate: (prefix: string) =>
      Promise.all(
        [...entries.entries()]
          .filter(([key, entry]) => key.startsWith(prefix) && (entry.listeners.size > 0 || entry.data !== null))
          .map(([key]) => fetchKey(key, true)),
      ).then(() => undefined),
    /** 낙관적 로컬 갱신. 서버 확인은 이어서 invalidate로. */
    mutate: (key: string, updater: (current: T | null) => T | null) => {
      const entry = entryFor(key);
      entry.data = updater(entry.data);
      notify(entry);
    },
    /** 같은 접두사의 모든 키에 적용(예: 전체 목록과 출조별 목록 둘 다). */
    mutateAll: (prefix: string, updater: (current: T) => T) => {
      entries.forEach((entry, key) => {
        if (!key.startsWith(prefix) || entry.data === null) return;
        entry.data = updater(entry.data);
        notify(entry);
      });
    },
    /** 로그아웃 등으로 전부 버릴 때. */
    clear: () => {
      entries.forEach((entry) => {
        entry.data = null;
        entry.error = null;
        entry.loadedAt = null;
        notify(entry);
      });
      entries.clear();
    },
    peek: (key: string) => entries.get(key) ?? null,
    subscribe: (key: string, listener: () => void) => {
      const entry = entryFor(key);
      entry.listeners.add(listener);
      return () => {
        entry.listeners.delete(listener);
      };
    },
  };

  /**
   * key가 null이면 구독하지 않고 empty를 돌려준다(로그아웃 상태).
   * autoFetch가 false면 데이터는 구독하되 스스로 받지는 않는다.
   */
  const useSharedResource = (
    key: string | null,
    empty: T,
    { autoFetch = true }: { autoFetch?: boolean } = {},
  ) => {
    const subscribe = useCallback(
      (listener: () => void) => (key ? store.subscribe(key, listener) : () => undefined),
      [key],
    );
    // useSyncExternalStore는 스냅샷 참조가 바뀔 때만 리렌더하므로 튜플을 캐시한다.
    const snapshotRef = useRef<{ entry: Entry<T> | null; data: T | null; error: Error | null; inFlight: boolean; isRefresh: boolean; value: unknown } | null>(null);
    const getSnapshot = useCallback(() => {
      const entry = key ? store.peek(key) : null;
      const data = entry?.data ?? null;
      const error = entry?.error ?? null;
      const inFlight = Boolean(entry?.inFlight);
      const isRefresh = Boolean(entry?.isRefresh);
      const previous = snapshotRef.current;
      if (
        previous &&
        previous.entry === entry &&
        previous.data === data &&
        previous.error === error &&
        previous.inFlight === inFlight &&
        previous.isRefresh === isRefresh
      ) {
        return previous.value;
      }
      const value = { data, error, inFlight, isRefresh };
      snapshotRef.current = { entry, data, error, inFlight, isRefresh, value };
      return value;
    }, [key]);
    const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot) as {
      data: T | null;
      error: Error | null;
      inFlight: boolean;
      isRefresh: boolean;
    };

    useEffect(() => {
      if (!key || !autoFetch) return;
      void store.ensure(key);
    }, [autoFetch, key]);

    const refetch = useCallback(() => (key ? store.refetch(key) : Promise.resolve()), [key]);

    return useMemo(() => {
      const hasData = snapshot.data !== null;
      return {
        data: snapshot.data ?? empty,
        error: snapshot.error,
        // 첫 로드(데이터 없음) 중이면 isLoading, 데이터가 있는 상태의 재로드는 isRefreshing.
        isLoading: Boolean(key) && autoFetch && !hasData && (snapshot.inFlight || snapshot.error === null),
        isRefreshing: hasData && snapshot.inFlight,
        refetch,
      };
    }, [autoFetch, empty, key, refetch, snapshot]);
  };

  registry.add(store);
  return { ...store, useSharedResource };
};
