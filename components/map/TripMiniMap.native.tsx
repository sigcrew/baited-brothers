import MapView, { Marker } from "react-native-maps";
import { View } from "react-native";

import { FishingBobberMarker } from "./FishingBobberMarker";
import type { TripMiniMapProps } from "./TripMiniMap.types";

export const TripMiniMap = ({ latitude, longitude, name }: TripMiniMapProps) => (
  <View pointerEvents="none" style={{ height: 168, overflow: "hidden" }}>
    <MapView
      accessibilityLabel={`${name} 출조 위치 미니 지도`}
      initialRegion={{
        latitude,
        longitude,
        latitudeDelta: 0.055,
        longitudeDelta: 0.055,
      }}
      mapType="mutedStandard"
      pitchEnabled={false}
      rotateEnabled={false}
      scrollEnabled={false}
      zoomEnabled={false}
      toolbarEnabled={false}
      style={{ flex: 1 }}
    >
      <Marker
        anchor={{ x: 0.5, y: 1 }}
        centerOffset={{ x: 0, y: -28 }}
        coordinate={{ latitude, longitude }}
        tracksViewChanges={false}
      >
        <FishingBobberMarker kind="trip" selected />
      </Marker>
    </MapView>
  </View>
);
