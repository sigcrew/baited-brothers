import * as Location from "expo-location";

import {
  evaluateCoastalSelection,
  findNearestKoreanCoastCoordinate,
} from "@/src/lib/coastalSelection";

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

export const reverseGeocodeKoreanPlaceName = async (
  coordinate: Coordinate,
): Promise<ReverseGeocodePlaceNameResult> => {
  const isOnLand = evaluateCoastalSelection(
    coordinate.latitude,
    coordinate.longitude,
  ).isOnLand;
  const directAddress = (await Location.reverseGeocodeAsync(coordinate))[0];
  const directCountryCode = directAddress?.isoCountryCode?.toUpperCase() || null;
  const directName = addressName(directAddress);

  if (directName) {
    return {
      name: isOnLand ? directName : `${directName} 앞바다`,
      countryCode: directCountryCode,
    };
  }
  if (directCountryCode && directCountryCode !== "KR") {
    return { name: null, countryCode: directCountryCode };
  }

  const nearestCoast = findNearestKoreanCoastCoordinate(
    coordinate.latitude,
    coordinate.longitude,
  );
  if (!nearestCoast) {
    return { name: null, countryCode: directCountryCode };
  }

  const coastAddress = (await Location.reverseGeocodeAsync({
    latitude: nearestCoast.latitude,
    longitude: nearestCoast.longitude,
  }))[0];
  const coastName = addressName(coastAddress);

  return {
    name: coastName ? `${coastName} 앞바다` : null,
    countryCode:
      coastAddress?.isoCountryCode?.toUpperCase() ||
      directCountryCode,
  };
};
