import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;

  return {
    ...config,
    android: {
      ...config.android,
      config: googleMapsApiKey
        ? {
            ...config.android?.config,
            googleMaps: {
              apiKey: googleMapsApiKey,
            },
          }
        : config.android?.config,
    },
  } as ExpoConfig;
};
