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

const addressName = (address?: Location.LocationGeocodedAddress) =>
  address?.district ||
  address?.city ||
  address?.subregion ||
  address?.region ||
  null;

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
