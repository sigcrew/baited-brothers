import { View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

import { FIELD_COLORS } from "@/src/theme/fieldJournal";

type FishingBobberMarkerProps = {
  kind: "catch" | "trip" | "current" | "selected";
  selected?: boolean;
  compact?: boolean;
};

export const FishingBobberMarker = ({ kind, selected = false, compact = false }: FishingBobberMarkerProps) => {
  const prominent = !compact && (selected || kind === "current" || kind === "selected");
  const visualWidth = compact ? 18 : prominent ? 44 : 34;
  const visualHeight = compact ? 24 : prominent ? 56 : 44;
  const hitWidth = compact ? visualWidth : Math.max(44, visualWidth);
  const accent = kind === "catch" ? FIELD_COLORS.orange : FIELD_COLORS.teal;

  return (
    <View
      className="items-center justify-end"
      style={{ width: hitWidth, height: visualHeight }}
    >
      <Svg width={visualWidth} height={visualHeight} viewBox="0 0 50 64" fill="none">
        {prominent ? (
          <>
            <Circle cx="25" cy="36" r="20" fill="#FFFFFF" fillOpacity="0.9" />
            <Circle cx="25" cy="36" r="19" stroke={accent} strokeOpacity="0.4" strokeWidth="1.5" />
          </>
        ) : null}

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

        <Path
          d="M7 45.5C13 41.5 18.8 41.5 25 45.5C31.2 49.5 37 49.5 43 45.5"
          stroke={accent}
          strokeWidth={prominent ? 3 : 2.5}
          strokeLinecap="square"
        />
        {prominent ? (
          <Path
            d="M11 53C16 50 20.4 50 25 53C29.6 56 34 56 39 53"
            stroke={accent}
            strokeWidth="2.4"
            strokeLinecap="square"
          />
        ) : null}
      </Svg>
    </View>
  );
};
