import * as Location from "expo-location";

import {
  evaluateCoastalSelection,
  findNearestKoreanCoastCoordinate,
} from "@/src/lib/coastalSelection";
import { lookupKoreanRegionName } from "@/src/lib/regionLookup";

type Coordinate = {
  latitude: number;
  longitude: number;
};

export type ReverseGeocodePlaceNameResult = {
  name: string | null;
  countryCode: string | null;
};

const KOREAN_ADMINISTRATIVE_SUFFIX =
  /(특별자치도|특별자치시|광역시|특별시|자치시|자치구|도|시|군|구)$/;

const cleanAddressPart = (value?: string | null) => value?.trim() || null;

const administrativeKey = (value: string) =>
  value.replace(KOREAN_ADMINISTRATIVE_SUFFIX, "");

const addressName = (address?: Location.LocationGeocodedAddress) => {
  const candidates = [
    address?.region,
    address?.city,
    address?.subregion,
    address?.district,
  ]
    .map(cleanAddressPart)
    .filter((value): value is string => Boolean(value));
  const administrativeParts = candidates.filter((value) =>
    KOREAN_ADMINISTRATIVE_SUFFIX.test(value)
  );
  const parts = administrativeParts.length > 0
    ? administrativeParts
    : candidates;
  const uniqueParts = parts.reduce<string[]>((result, part) => {
    const partHasSuffix = KOREAN_ADMINISTRATIVE_SUFFIX.test(part);
    const isDuplicate = result.some((existing) => {
      if (existing === part) return true;
      const existingHasSuffix = KOREAN_ADMINISTRATIVE_SUFFIX.test(existing);
      return (
        (!existingHasSuffix || !partHasSuffix) &&
        administrativeKey(existing) === administrativeKey(part)
      );
    });
    return isDuplicate ? result : [...result, part];
  }, []);

  return uniqueParts.join(" ") || null;
};

// 기기 지오코더(iOS는 권한 없이 동작, Android는 위치 권한이 있어야 동작)를 먼저 쓴다.
// 예외가 나거나 이름이 없으면 서버의 카카오 행정구역 조회로 넘어간다.
const deviceAddress = async (coordinate: Coordinate) => {
  try {
    return (await Location.reverseGeocodeAsync(coordinate))[0];
  } catch {
    return undefined;
  }
};

type NamedLookup = { name: string | null; countryCode: string | null };

const lookupName = async (coordinate: Coordinate): Promise<NamedLookup> => {
  const address = await deviceAddress(coordinate);
  const countryCode = address?.isoCountryCode?.toUpperCase() || null;
  const name = addressName(address);
  if (name) return { name, countryCode };
  if (countryCode && countryCode !== "KR") return { name: null, countryCode };
  const serverName = await lookupKoreanRegionName(coordinate);
  return serverName ? { name: serverName, countryCode: "KR" } : { name: null, countryCode };
};

export const reverseGeocodeKoreanPlaceName = async (
  coordinate: Coordinate,
): Promise<ReverseGeocodePlaceNameResult> => {
  const isOnLand = evaluateCoastalSelection(
    coordinate.latitude,
    coordinate.longitude,
  ).isOnLand;
  const direct = await lookupName(coordinate);

  if (direct.name) {
    return {
      name: isOnLand ? direct.name : `${direct.name} 앞바다`,
      countryCode: direct.countryCode,
    };
  }
  if (direct.countryCode && direct.countryCode !== "KR") {
    return { name: null, countryCode: direct.countryCode };
  }

  const nearestCoast = findNearestKoreanCoastCoordinate(
    coordinate.latitude,
    coordinate.longitude,
  );
  if (!nearestCoast) {
    return { name: null, countryCode: direct.countryCode };
  }

  const coast = await lookupName({
    latitude: nearestCoast.latitude,
    longitude: nearestCoast.longitude,
  });

  return {
    name: coast.name ? `${coast.name} 앞바다` : null,
    countryCode: coast.countryCode || direct.countryCode,
  };
};
