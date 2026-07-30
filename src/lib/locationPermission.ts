import * as Location from "expo-location";

export const ensureForegroundLocationPermission = async () => {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;

  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.granted;
};
