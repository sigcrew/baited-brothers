import { Image, type ImageSourcePropType, View } from "react-native";

type FieldBadgeAssetProps = {
  badgeId: string;
  unlocked: boolean;
  label?: string;
  size?: number;
  opacity?: number;
};

const BADGE_IMAGES: Record<string, ImageSourcePropType> = {
  trip_first: require("@/assets/images/badges/trip-first.png"),
  trips_5: require("@/assets/images/badges/trips-five.png"),
  field_note: require("@/assets/images/badges/field-note.png"),
  dawn_trip: require("@/assets/images/badges/dawn-trip.png"),
  first_catch: require("@/assets/images/badges/first-catch.png"),
  catches_5: require("@/assets/images/badges/catches-five.png"),
  species_3: require("@/assets/images/badges/species-three.png"),
  species_10: require("@/assets/images/badges/species-ten.png"),
};

export const getBadgeImageSource = (badgeId: string) =>
  BADGE_IMAGES[badgeId] ?? BADGE_IMAGES.first_catch;

export const FieldBadgeAsset = ({ badgeId, unlocked, label, size = 142, opacity = 1 }: FieldBadgeAssetProps) => {
  const source = getBadgeImageSource(badgeId);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Image
        source={source}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel={`${label ?? badgeId} 배지${unlocked ? " 획득" : " 잠김"}`}
        style={{ width: size, height: size, opacity: unlocked ? opacity : 0.18 }}
      />
    </View>
  );
};
