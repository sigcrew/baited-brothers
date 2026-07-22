import FontAwesome from "@expo/vector-icons/FontAwesome";
import { View } from "react-native";

import { FishingBobberMarker } from "./FishingBobberMarker";
import type { FishingMapPoint } from "./FishingMap.types";
import { FIELD_COLORS } from "@/src/theme/fieldJournal";

type MapPointMarkerProps = Pick<FishingMapPoint, "kind" | "selected" | "favorite"> & {
  scale?: number;
};

export const MapPointMarker = ({ kind, selected, favorite = false, scale = 1 }: MapPointMarkerProps) => {
  if (kind === "selected") {
    return (
      <View className="h-6 w-6 items-center justify-center">
        <FontAwesome name="crosshairs" size={20} color={FIELD_COLORS.teal} />
      </View>
    );
  }

  if (kind === "current") {
    return (
      <View
        className="h-6 w-6 border-4 border-white"
        style={{ backgroundColor: "#2F80ED", borderRadius: 12 }}
      />
    );
  }

  if (kind === "favorite") {
    const size = 36 * scale;
    return (
      <View
        className="items-center justify-center border-2 bg-white"
        style={{ width: size, height: size, borderColor: FIELD_COLORS.orange, borderRadius: size / 2 }}
      >
        <FontAwesome name="star" size={16 * scale} color={FIELD_COLORS.orange} />
      </View>
    );
  }

  return (
    <View className="relative">
      <FishingBobberMarker kind={kind} selected={selected} scale={scale} />
      {favorite ? (
        <View
          className="absolute items-center justify-center"
          style={{ width: 16 * scale, height: 16 * scale, right: 6 * scale, top: 11 * scale }}
        >
          <FontAwesome name="star" size={10 * scale} color={FIELD_COLORS.orange} />
        </View>
      ) : null}
    </View>
  );
};
