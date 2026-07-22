import { View } from "react-native";
import Svg, { Line, Path, Rect } from "react-native-svg";

import { FIELD_COLORS } from "@/src/theme/fieldJournal";

type FishingBobberMarkerProps = {
  kind: "catch" | "trip" | "favorite" | "current" | "selected";
  selected?: boolean;
  compact?: boolean;
  scale?: number;
};

export const FishingBobberMarker = ({ compact = false, scale = 1 }: FishingBobberMarkerProps) => {
  const visualWidth = (compact ? 18 : 34) * scale;
  const visualHeight = (compact ? 24 : 44) * scale;
  const frameWidth = (compact ? 18 : 44) * scale;
  const frameHeight = (compact ? 24 : 56) * scale;

  return (
    <View
      className="items-center justify-end"
      style={{ width: frameWidth, height: frameHeight }}
    >
      <Svg width={visualWidth} height={visualHeight} viewBox="0 0 50 64" fill="none">
        <Line x1="25" y1="4" x2="25" y2="18" stroke="#FF4B1F" strokeWidth="3.4" strokeLinecap="round" />
        <Path
          d="M25 15C19.8 19.8 18.4 29.3 19.1 37H30.9C31.6 29.3 30.2 19.8 25 15Z"
          fill="#FF4B1F"
        />
        <Rect x="19.1" y="34" width="11.8" height="4.3" fill="#FFFFFF" />
        <Path
          d="M19.3 38.1H30.7C30 45 28 49.7 25 52.3C22 49.7 20 45 19.3 38.1Z"
          fill={FIELD_COLORS.ink}
        />
        <Line x1="25" y1="51" x2="25" y2="59" stroke={FIELD_COLORS.ink} strokeWidth="3" strokeLinecap="round" />
      </Svg>
    </View>
  );
};
