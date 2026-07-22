import { Text, View } from "react-native";

import { FishingBobberMarker } from "./FishingBobberMarker";
import type { TripMiniMapProps } from "./TripMiniMap.types";
import { FIELD_COLORS, monoFont } from "@/src/theme/fieldJournal";

export const TripMiniMap = ({ name }: TripMiniMapProps) => (
  <View className="h-[168px] items-center justify-center overflow-hidden" style={{ backgroundColor: "#DCECEF" }}>
    <FishingBobberMarker kind="trip" selected />
    <Text className="mt-1 text-[9px] tracking-[1px]" style={{ color: FIELD_COLORS.ink, fontFamily: monoFont }}>
      {name.toUpperCase()}
    </Text>
  </View>
);
