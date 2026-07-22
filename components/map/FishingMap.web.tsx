import { useState } from "react";
import { Pressable, Text, TouchableOpacity, View } from "react-native";

import { FishingBobberMarker } from "./FishingBobberMarker";
import type { FishingMapProps } from "./FishingMap.types";
import { FIELD_COLORS, monoFont } from "@/src/theme/fieldJournal";

const placement = (value: number, index: number, span: number, offset: number) => {
  const normalized = Math.abs(Math.sin(value * 12.9898 + index * 7.23));
  return offset + normalized * span;
};

export const FishingMap = ({ points, onSelectPoint, onSelectCoordinate }: FishingMapProps) => {
  const [size, setSize] = useState({ width: 1, height: 1 });

  return (
    <View
      accessibilityLabel="나의 조과 위치 지도 미리보기"
      className="flex-1 overflow-hidden"
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      style={{ backgroundColor: "#DCECEF" }}
    >
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="지도에서 장소 선택"
      className="absolute inset-0"
      onPress={(event) => {
        const x = Math.min(1, Math.max(0, event.nativeEvent.locationX / size.width));
        const y = Math.min(1, Math.max(0, event.nativeEvent.locationY / size.height));
        onSelectCoordinate({
          latitude: 39 - y * 6.5,
          longitude: 124 + x * 8.5,
        });
      }}
    />
    {[18, 38, 58, 78].map((top) => (
      <View
        key={`h-${top}`}
        className="absolute left-0 right-0 border-t"
        style={{ top: `${top}%`, borderColor: "rgba(20, 59, 68, 0.12)" }}
      />
    ))}
    {[18, 38, 58, 78].map((left) => (
      <View
        key={`v-${left}`}
        className="absolute bottom-0 top-0 border-l"
        style={{ left: `${left}%`, borderColor: "rgba(20, 59, 68, 0.12)" }}
      />
    ))}
    <View
      className="absolute -right-10 bottom-[-25%] h-[95%] w-[58%] border-l"
      style={{ backgroundColor: "#F3F0E8", borderColor: FIELD_COLORS.rule, transform: [{ rotate: "8deg" }] }}
    />
    <Text
      className="absolute left-5 top-5 text-[10px] tracking-[1.4px]"
      style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}
    >
      KOREA COAST · PRIVATE FIELD MAP
    </Text>
    {points.map((point, index) => (
      <TouchableOpacity
        key={point.id}
        accessibilityRole="button"
        accessibilityLabel={`${point.label} 조과 위치 선택`}
        onPress={() => onSelectPoint(point.id)}
        className="absolute items-center"
        style={{
          left: `${placement(point.longitude, index, 68, 12)}%`,
          top: `${placement(point.latitude, index + 2, 27, 15)}%`,
          transform: [{ translateX: -20 }, { translateY: -20 }],
        }}
      >
        <FishingBobberMarker kind={point.kind} selected={point.selected} />
      </TouchableOpacity>
    ))}
    </View>
  );
};
