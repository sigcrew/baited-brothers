import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Text, View } from "react-native";
import { useMemo } from "react";
import { useUserCatches } from "@/src/hooks/useUserCatches";
import { useFishingTrips } from "@/src/hooks/useFishingTrips";
import { SettingsScaffold } from "@/components/settings/SettingsScaffold";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
  monoFont,
} from "@/src/theme/fieldJournal";

export default function SavedPlacesScreen() {
  const { catches } = useUserCatches();
  const { trips } = useFishingTrips();
  const places = useMemo(() => {
    const counts = new Map<
      string,
      { name: string; catches: number; trips: number }
    >();
    for (const item of catches) {
      const name = item.location_name?.trim();
      if (!name) continue;
      const current = counts.get(name) ?? { name, catches: 0, trips: 0 };
      current.catches += 1;
      counts.set(name, current);
    }
    for (const trip of trips) {
      const name = trip.spot_name?.trim();
      if (!name) continue;
      const current = counts.get(name) ?? { name, catches: 0, trips: 0 };
      current.trips += 1;
      counts.set(name, current);
    }
    return [...counts.values()].sort(
      (a, b) => b.catches + b.trips - (a.catches + a.trips),
    );
  }, [catches, trips]);

  return (
    <SettingsScaffold
      eyebrow="FIELD LOCATIONS"
      title="저장한 장소"
      description="출조와 조과 기록에 남긴 장소를 한곳에서 확인합니다."
    >
      {places.length ? (
        places.map((place, index) => (
          <View
            key={place.name}
            className="flex-row items-center border-b py-5"
            style={{ borderColor: FIELD_COLORS.rule }}
          >
            <View className="h-11 w-11 items-center justify-center">
              <FontAwesome
                name="map-marker"
                size={25}
                color={FIELD_COLORS.teal}
              />
            </View>
            <View className="min-w-0 flex-1 px-2">
              <Text
                className="text-lg"
                style={{
                  color: FIELD_COLORS.ink,
                  fontFamily: bodyExtraBoldFont,
                }}
              >
                {place.name}
              </Text>
              <Text
                className="mt-1 text-xs"
                style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
              >
                출조 {place.trips} · 조과 {place.catches}
              </Text>
            </View>
            <Text
              className="text-xs tracking-[1px]"
              style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}
            >
              {String(index + 1).padStart(2, "0")}
            </Text>
          </View>
        ))
      ) : (
        <View className="items-center py-16">
          <FontAwesome name="map-o" size={38} color={FIELD_COLORS.muted} />
          <Text
            className="mt-5 text-lg"
            style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
          >
            아직 저장된 장소가 없습니다
          </Text>
          <Text
            className="mt-2 text-center text-sm leading-6"
            style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
          >
            출조 일정이나 조과를 기록하면{"\n"}장소가 자동으로 모입니다.
          </Text>
        </View>
      )}
    </SettingsScaffold>
  );
}
