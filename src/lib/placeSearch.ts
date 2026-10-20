import { supabase } from './supabase';
import { withTimeout } from './appErrors';

export type PlaceSearchResult = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
};

export async function searchPlaces(query: string): Promise<PlaceSearchResult[]> {
  const { data, error } = await withTimeout(
    supabase.functions.invoke<{ places: PlaceSearchResult[] }>('search-places', { body: { query } }),
    12000,
    '검색 시간이 초과되었습니다. 지도에서 직접 위치를 선택해 주세요.',
  );
  if (error || !Array.isArray(data?.places)) {
    throw new Error('장소 검색을 이용할 수 없습니다. 잠시 후 다시 검색하거나 지도에서 직접 위치를 선택해 주세요.');
  }
  return data.places;
}
