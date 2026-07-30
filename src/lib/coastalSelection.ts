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

export type NearestCoastCoordinate = {
  latitude: number;
  longitude: number;
  distanceKm: number;
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

const nearestPointOnSegment = (
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
  return {
    distanceKm: Math.hypot(startX + ratio * deltaX, startY + ratio * deltaY),
    latitude: start[1] + (end[1] - start[1]) * ratio,
    longitude: start[0] + (end[0] - start[0]) * ratio,
  };
};

const distanceToRingKm = (longitude: number, latitude: number, ring: LinearRing) => {
  let nearest = Number.POSITIVE_INFINITY;
  for (let index = 1; index < ring.length; index += 1) {
    nearest = Math.min(
      nearest,
      nearestPointOnSegment(longitude, latitude, ring[index - 1], ring[index]).distanceKm,
    );
  }
  return nearest;
};

export const findNearestKoreanCoastCoordinate = (
  latitude: number,
  longitude: number,
): NearestCoastCoordinate | null => {
  let nearest: (NearestCoastCoordinate & { polygon: Polygon }) | null = null;

  for (const polygon of polygons) {
    const ring = polygon[0];
    for (let index = 1; index < ring.length; index += 1) {
      const candidate = nearestPointOnSegment(
        longitude,
        latitude,
        ring[index - 1],
        ring[index],
      );
      if (!nearest || candidate.distanceKm < nearest.distanceKm) {
        nearest = { ...candidate, polygon };
      }
    }
  }

  if (!nearest) return null;

  const insetKm = 0.5;
  const latitudeKm = 111.32;
  const longitudeKm = latitudeKm * Math.cos((nearest.latitude * Math.PI) / 180);
  const ringCenter = nearest.polygon[0].reduce(
    (sum, [ringLongitude, ringLatitude]) => ({
      latitude: sum.latitude + ringLatitude,
      longitude: sum.longitude + ringLongitude,
    }),
    { latitude: 0, longitude: 0 },
  );
  const pointCount = nearest.polygon[0].length || 1;
  const centerLatitude = ringCenter.latitude / pointCount;
  const centerLongitude = ringCenter.longitude / pointCount;
  const towardCenterX = (centerLongitude - nearest.longitude) * longitudeKm;
  const towardCenterY = (centerLatitude - nearest.latitude) * latitudeKm;
  const towardCenterLength = Math.hypot(towardCenterX, towardCenterY) || 1;
  const lookupLongitude =
    nearest.longitude + (towardCenterX / towardCenterLength) * (insetKm / longitudeKm);
  const lookupLatitude =
    nearest.latitude + (towardCenterY / towardCenterLength) * (insetKm / latitudeKm);

  if (
    isPointInPolygon(lookupLongitude, lookupLatitude, nearest.polygon)
  ) {
    return {
      latitude: lookupLatitude,
      longitude: lookupLongitude,
      distanceKm: nearest.distanceKm,
    };
  }

  return {
    latitude: nearest.latitude,
    longitude: nearest.longitude,
    distanceKm: nearest.distanceKm,
  };
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
