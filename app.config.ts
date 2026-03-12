import appJson from './app.json';

const googleMapsApiKey =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  '';

export default ({ config }: { config: Record<string, any> }) => {
  const base = (appJson as any).expo || {};

  return {
    expo: {
      ...base,
      ios: {
        ...base.ios,
        googleMapsApiKey,
      },
      android: {
        ...base.android,
        config: {
          ...(base.android && base.android.config ? base.android.config : {}),
          googleMaps: {
            ...((base.android && base.android.config && base.android.config.googleMaps)
              ? base.android.config.googleMaps
              : {}),
            apiKey: googleMapsApiKey,
          },
        },
      },
      extra: {
        ...base.extra,
        googleMapsApiKey,
      },
    },
  };
};
