import MapView, { Marker, type Region } from "react-native-maps";
import { View } from "react-native";

import { FishingBobberMarker } from "./FishingBobberMarker";
import type { FishingMapProps } from "./FishingMap.types";

const KOREA_REGION: Region = {
  latitude: 35.55,
  longitude: 127.65,
  latitudeDelta: 4.8,
  longitudeDelta: 4.2,
};

const isInKoreaScope = (latitude: number, longitude: number) =>
  latitude >= 32.5 && latitude <= 39.0 && longitude >= 124.0 && longitude <= 132.5;

export const FishingMap = ({ points, onSelectPoint, onSelectCoordinate }: FishingMapProps) => {
  const first = points[0];
  const initialRegion: Region = first && isInKoreaScope(first.latitude, first.longitude)
    ? {
        latitude: first.latitude,
        longitude: first.longitude,
        latitudeDelta: 0.42,
        longitudeDelta: 0.42,
      }
    : KOREA_REGION;

  return (
    <MapView
      accessibilityLabel="나의 조과 위치 지도"
      accessibilityRole="button"
      initialRegion={initialRegion}
      mapType="mutedStandard"
      rotateEnabled={false}
      pitchEnabled={false}
      minZoomLevel={5}
      maxZoomLevel={18}
      showsCompass={false}
      showsUserLocation={false}
      onPress={(event) => onSelectCoordinate(event.nativeEvent.coordinate)}
      style={{ flex: 1 }}
    >
      {points.map((point) => (
        <Marker
          key={`${point.id}:${point.selected ? "selected" : "idle"}`}
          accessibilityLabel={`${point.label} 조과 위치 선택`}
          coordinate={{ latitude: point.latitude, longitude: point.longitude }}
          onPress={(event) => {
            event.stopPropagation();
            onSelectPoint(point.id);
          }}
          tracksViewChanges={false}
        >
          <View
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${point.label} 조과 위치 선택`}
          >
            <FishingBobberMarker kind={point.kind} selected={point.selected} />
          </View>
        </Marker>
      ))}
    </MapView>
  );
};
