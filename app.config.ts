import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  const shareLinkDomain =
    process.env.SHARE_LINK_DOMAIN?.trim() || "baited-brothers-share.vercel.app";

  return {
    ...config,
    ios: {
      ...config.ios,
      associatedDomains: [
        ...(config.ios?.associatedDomains ?? []),
        `applinks:${shareLinkDomain}`,
      ],
    },
    android: {
      ...config.android,
      intentFilters: [
        ...(config.android?.intentFilters ?? []),
        {
          action: "VIEW",
          autoVerify: true,
          category: ["BROWSABLE", "DEFAULT"],
          data: [
            {
              scheme: "https",
              host: shareLinkDomain,
              pathPrefix: "/open",
            },
          ],
        },
      ],
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
