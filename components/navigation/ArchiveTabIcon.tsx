import type { ReactNode } from "react";
import { useWindowDimensions, View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

type ArchiveTabIconName = "home" | "journal" | "collection" | "profile";

type ArchiveTabIconProps = {
  name: ArchiveTabIconName;
  color: string;
  focused: boolean;
};

const STROKE_WIDTH = 2.2;

const TabIconFrame = ({ children, color, focused }: { children: ReactNode; color: string; focused: boolean }) => {
  const { width } = useWindowDimensions();
  const indicatorWidth = width * 0.1875;

  return (
    <View style={{ width: 34, height: 32, alignItems: "center", justifyContent: "center" }}>
      {focused ? (
        <View
          style={{
            position: "absolute",
            top: -14,
            left: (34 - indicatorWidth) / 2,
            width: indicatorWidth,
            height: 3,
            backgroundColor: color,
            zIndex: 1,
          }}
        />
      ) : null}
      {children}
    </View>
  );
};

export const ArchiveTabIcon = ({ name, color, focused }: ArchiveTabIconProps) => {
  if (name === "home") {
    return (
      <TabIconFrame color={color} focused={focused}>
      <Svg width={32} height={32} viewBox="0 0 28 28" fill="none">
        <Path
          d="M4 12.2 14 3.8l10 8.4v11.7h-7.2v-7.3h-5.6v7.3H4V12.2Z"
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="square"
          strokeLinejoin="miter"
          fill={focused ? `${color}18` : "none"}
        />
      </Svg>
      </TabIconFrame>
    );
  }

  if (name === "journal") {
    const lineColor = focused ? "#FFFFFF" : color;
    return (
      <TabIconFrame color={color} focused={focused}>
      <Svg width={32} height={32} viewBox="0 0 28 28" fill="none">
        <Rect
          x="6"
          y="5"
          width="16"
          height="20"
          rx="1"
          fill={focused ? color : "none"}
          stroke={color}
          strokeWidth={STROKE_WIDTH}
        />
        <Path
          d="M10 3h8v5h-8V3Z"
          fill={focused ? "#FFFFFF" : "none"}
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          strokeLinejoin="miter"
        />
        {[12, 16, 20].map((y) => (
          <Line key={y} x1="10" y1={y} x2="18" y2={y} stroke={lineColor} strokeWidth="1.7" />
        ))}
      </Svg>
      </TabIconFrame>
    );
  }

  if (name === "collection") {
    return (
      <TabIconFrame color={color} focused={focused}>
      <Svg width={36} height={32} viewBox="0 0 36 28" fill="none">
        <Path
          d="M2.8 14c3.1-4.4 7.8-6.6 13.3-6.3 3.9.2 7.1 1.7 9.7 3.8l7.7-3.8-1.7 6.3 1.7 6.3-7.7-3.8c-2.6 2.1-5.8 3.6-9.7 3.8C10.6 20.6 5.9 18.4 2.8 14Z"
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Path
          d="M13.7 7.8c1.5-2.2 3.6-3.5 6.2-3.8-.7 1.6-.8 3-.3 4.1M13.8 20.2c1.5 2.2 3.6 3.5 6.2 3.8-.7-1.6-.8-3-.3-4.1"
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx="8.4" cy="12.4" r="1.15" fill={color} />
      </Svg>
      </TabIconFrame>
    );
  }

  return (
    <TabIconFrame color={color} focused={focused}>
    <Svg width={32} height={32} viewBox="0 0 28 28" fill="none">
      <Circle
        cx="14"
        cy="8"
        r="4.2"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        fill={focused ? `${color}18` : "none"}
      />
      <Path
        d="M5 24c0-5.8 3.6-9.2 9-9.2s9 3.4 9 9.2H5Z"
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={focused ? `${color}18` : "none"}
      />
    </Svg>
    </TabIconFrame>
  );
};
