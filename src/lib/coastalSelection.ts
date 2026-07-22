import koreaBoundary from "@/src/data/geo/korea-adm0.json";

type Position = [number, number];
type LinearRing = Position[];
type Polygon = LinearRing[];
type MultiPolygon = Polygon[];

export type CoastalSelectionResult = {
  allowed: boolean;
  isOnLand: boolean;
  coastDistanceKm: number | null;
};

const MAX_INLAND_DISTANCE_KM = 3;

const polygons = koreaBoundary.features[0].geometry.coordinates as MultiPolygon;

const isPointInRing = (longitude: number, latitude: number, ring: LinearRing) => {
  let inside = false;
  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const [currentLng, currentLat] = ring[current];
    const [previousLng, previousLat] = ring[previous];
    const crossesLatitude = currentLat > latitude !== previousLat > latitude;
    const intersectionLng = (
      ((previousLng - currentLng) * (latitude - currentLat)) /
      (previousLat - currentLat || Number.EPSILON)
    ) + currentLng;
    if (crossesLatitude && longitude < intersectionLng) inside = !inside;
  }
  return inside;
};

const isPointInPolygon = (longitude: number, latitude: number, polygon: Polygon) =>
  Boolean(
    polygon[0] &&
    isPointInRing(longitude, latitude, polygon[0]) &&
    !polygon.slice(1).some((hole) => isPointInRing(longitude, latitude, hole)),
  );

const distanceToSegmentKm = (
  longitude: number,
  latitude: number,
  start: Position,
  end: Position,
) => {
  const latitudeKm = 111.32;
  const longitudeKm = latitudeKm * Math.cos((latitude * Math.PI) / 180);
  const startX = (start[0] - longitude) * longitudeKm;
  const startY = (start[1] - latitude) * latitudeKm;
  const endX = (end[0] - longitude) * longitudeKm;
  const endY = (end[1] - latitude) * latitudeKm;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const lengthSquared = deltaX ** 2 + deltaY ** 2;
  const ratio = lengthSquared === 0
    ? 0
    : Math.max(0, Math.min(1, -(startX * deltaX + startY * deltaY) / lengthSquared));
  return Math.hypot(startX + ratio * deltaX, startY + ratio * deltaY);
};

const distanceToRingKm = (longitude: number, latitude: number, ring: LinearRing) => {
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < ring.length; index += 1) {
    nearest = Math.min(
      nearest,
      distanceToSegmentKm(longitude, latitude, ring[index - 1], ring[index]),
    );
  }
  return nearest;
};

export const evaluateCoastalSelection = (
  latitude: number,
  longitude: number,
): CoastalSelectionResult => {
  const landPolygon = polygons.find((polygon) => isPointInPolygon(longitude, latitude, polygon));
  if (!landPolygon) {
    return { allowed: true, isOnLand: false, coastDistanceKm: null };
  }

  const coastDistanceKm = distanceToRingKm(longitude, latitude, landPolygon[0]);
  return {
    allowed: coastDistanceKm <= MAX_INLAND_DISTANCE_KM,
    isOnLand: true,
    coastDistanceKm,
  };
};
