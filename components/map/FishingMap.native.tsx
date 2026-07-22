import MapView, { Marker, type Region } from "react-native-maps";
import { Text, View } from "react-native";
import { useEffect, useMemo, useRef, useState } from "react";

import { MapPointMarker } from "./MapPointMarker";
import type { FishingMapPoint, FishingMapProps } from "./FishingMap.types";
import {
  clusterMapPoints,
  countDistinctMapCoordinates,
  haveSameMapCoordinate,
  type MapPointCluster,
} from "@/src/lib/mapClustering";
import { FIELD_COLORS, bodyExtraBoldFont, monoFont } from "@/src/theme/fieldJournal";

const KOREA_REGION: Region = {
  latitude: 35.55,
  longitude: 127.65,
  latitudeDelta: 4.8,
  longitudeDelta: 4.2,
};

const isInKoreaScope = (latitude: number, longitude: number) =>
  latitude >= 32.5 && latitude <= 39.0 && longitude >= 124.0 && longitude <= 132.5;

const markerCenterOffsetY = (kind: FishingMapPoint["kind"], scale = 1) => {
  switch (kind) {
    case "current":
      return -12;
    case "favorite":
      return -18 * scale;
    case "selected":
      return 0;
    default:
      return -28 * scale;
  }
};

const markerScaleForLatitudeDelta = (latitudeDelta: number) => {
  if (latitudeDelta >= 1.2) return 0.72;
  if (latitudeDelta <= 0.08) return 1.1;
  return 1;
};

export const FishingMap = ({
  points,
  focusPointId,
  focusLatitudeDelta,
  onSelectPoint,
  onSelectCluster,
  onSelectCoordinate,
}: FishingMapProps) => {
  const mapRef = useRef<MapView>(null);
  const lastMarkerPressAtRef = useRef(0);
  const first = points[0];
  const initialRegion: Region = first && isInKoreaScope(first.latitude, first.longitude)
    ? {
        latitude: first.latitude,
        longitude: first.longitude,
        latitudeDelta: 0.42,
        longitudeDelta: 0.42,
      }
    : KOREA_REGION;
  const [region, setRegion] = useState(initialRegion);
  const markerScale = markerScaleForLatitudeDelta(region.latitudeDelta);
  const clusterablePoints = useMemo(
    () => points.filter((point) => point.kind === "catch" || point.kind === "trip" || point.kind === "favorite"),
    [points],
  );
  const standalonePoints = useMemo(
    () => points.filter((point) => point.kind === "current" || point.kind === "selected"),
    [points],
  );
  const clusters = useMemo(
    () => clusterMapPoints(clusterablePoints, region.latitudeDelta, region.longitudeDelta),
    [clusterablePoints, region.latitudeDelta, region.longitudeDelta],
  );

  useEffect(() => {
    if (!focusPointId) return;
    const point = points.find((item) => item.id === focusPointId);
    if (!point) return;
    const latitudeDelta = focusLatitudeDelta
      ?? Math.min(Math.max(region.latitudeDelta, 0.04), 0.18);
    const longitudeDelta = focusLatitudeDelta
      ?? Math.min(Math.max(region.longitudeDelta, 0.04), 0.18);
    mapRef.current?.animateToRegion({
      latitude: point.latitude - latitudeDelta * 0.2,
      longitude: point.longitude,
      latitudeDelta,
      longitudeDelta,
    }, 320);
  }, [focusLatitudeDelta, focusPointId]);

  const zoomIntoCluster = (cluster: MapPointCluster<(typeof points)[number]>) => {
    const latitudes = cluster.points.map((point) => point.latitude);
    const longitudes = cluster.points.map((point) => point.longitude);
    const latitudeSpan = Math.max(...latitudes) - Math.min(...latitudes);
    const longitudeSpan = Math.max(...longitudes) - Math.min(...longitudes);
    const nextRegion = {
      latitude: cluster.latitude,
      longitude: cluster.longitude,
      latitudeDelta: Math.max(latitudeSpan * 2.8, region.latitudeDelta / 2.5, 0.0005),
      longitudeDelta: Math.max(longitudeSpan * 2.8, region.longitudeDelta / 2.5, 0.0005),
    };
    const sameCoordinate = haveSameMapCoordinate(cluster.points);
    const cannotZoomFurther =
      nextRegion.latitudeDelta >= region.latitudeDelta * 0.98 &&
      nextRegion.longitudeDelta >= region.longitudeDelta * 0.98;

    if (sameCoordinate || cannotZoomFurther) {
      const recordIds = cluster.points
        .filter((point) => point.kind === "catch" || point.kind === "trip")
        .map((point) => point.id);
      if (recordIds.length && onSelectCluster) {
        onSelectCluster(recordIds);
      } else {
        onSelectPoint(cluster.points[0].id);
      }
      return;
    }

    mapRef.current?.animateToRegion(nextRegion, 280);
  };

  return (
    <MapView
      ref={mapRef}
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
      onPress={(event) => {
        if (
          event.nativeEvent.action === "marker-press" ||
          Date.now() - lastMarkerPressAtRef.current < 500
        ) return;
        onSelectCoordinate(event.nativeEvent.coordinate);
      }}
      onRegionChangeComplete={setRegion}
      style={{ flex: 1 }}
    >
      {standalonePoints.map((point) => (
        <Marker
          key={`standalone:${point.id}`}
          accessibilityLabel={`${point.favorite ? "즐겨찾기 " : ""}${point.label} 지도 위치 선택`}
          anchor={point.kind === "selected" ? { x: 0.5, y: 0.5 } : { x: 0.5, y: 1 }}
          centerOffset={{ x: 0, y: markerCenterOffsetY(point.kind) }}
          coordinate={{ latitude: point.latitude, longitude: point.longitude }}
          onPress={(event) => {
            lastMarkerPressAtRef.current = Date.now();
            event.stopPropagation();
            onSelectPoint(point.id);
          }}
          tracksViewChanges={false}
        >
          <View accessible accessibilityRole="button" accessibilityLabel={`${point.favorite ? "즐겨찾기 " : ""}${point.label} 지도 위치 선택`}>
            <MapPointMarker kind={point.kind} selected={point.selected} favorite={point.favorite} />
          </View>
        </Marker>
      ))}
      {clusters.map((cluster) => {
        if (cluster.points.length === 1) {
          const point = cluster.points[0];
          return (
            <Marker
              key={`point:${point.id}`}
              accessibilityLabel={`${point.favorite ? "즐겨찾기 " : ""}${point.label} 지도 위치 선택`}
              anchor={{ x: 0.5, y: 1 }}
              centerOffset={{ x: 0, y: markerCenterOffsetY(point.kind, markerScale) }}
              coordinate={{ latitude: point.latitude, longitude: point.longitude }}
              onPress={(event) => {
                lastMarkerPressAtRef.current = Date.now();
                event.stopPropagation();
                onSelectPoint(point.id);
              }}
            >
              <View accessible accessibilityRole="button" accessibilityLabel={`${point.favorite ? "즐겨찾기 " : ""}${point.label} 지도 위치 선택`}>
                <MapPointMarker kind={point.kind} selected={point.selected} favorite={point.favorite} scale={markerScale} />
              </View>
            </Marker>
          );
        }

        const sameCoordinate = haveSameMapCoordinate(cluster.points);
        const locationCount = countDistinctMapCoordinates(cluster.points);
        const tripCount = cluster.points.filter((point) => point.kind === "trip").length;
        const catchCount = cluster.points.filter((point) => point.kind === "catch").length;
        const hasRecords = tripCount > 0 || catchCount > 0;
        const isFavorite = cluster.points.some((point) => point.kind === "favorite" || point.favorite);
        const clusterAccessibilityLabel = sameCoordinate
          ? hasRecords
            ? `${isFavorite ? "즐겨찾기 " : ""}같은 장소의 출조 ${tripCount}개 조과 ${catchCount}개 기록 보기`
            : "즐겨찾기 장소 보기"
          : `${locationCount}개 장소 묶음 확대`;

        return (
          <Marker
            key={`cluster:${cluster.id}`}
            accessibilityLabel={clusterAccessibilityLabel}
            anchor={{ x: 0.5, y: 1 }}
            centerOffset={{ x: 0, y: sameCoordinate ? -28 * markerScale : -24 }}
            coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
            onPress={(event) => {
              lastMarkerPressAtRef.current = Date.now();
              event.stopPropagation();
              zoomIntoCluster(cluster);
            }}
          >
            {sameCoordinate ? (
              <View accessible accessibilityRole="button" accessibilityLabel={clusterAccessibilityLabel}>
                <MapPointMarker
                  kind={hasRecords ? (catchCount > 0 ? "catch" : "trip") : "favorite"}
                  selected={cluster.points.some((point) => point.selected)}
                  favorite={hasRecords && isFavorite}
                  scale={markerScale}
                />
              </View>
            ) : (
              <View
                accessible
                accessibilityRole="button"
                accessibilityLabel={clusterAccessibilityLabel}
                className="h-12 w-12 items-center justify-center border-2 bg-white"
                style={{ borderColor: FIELD_COLORS.teal, borderRadius: 24 }}
              >
                <Text className="text-base" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
                  {locationCount}
                </Text>
                <Text className="text-[7px] tracking-[0.5px]" style={{ color: FIELD_COLORS.teal, fontFamily: monoFont }}>
                  장소
                </Text>
              </View>
            )}
          </Marker>
        );
      })}
    </MapView>
  );
};
