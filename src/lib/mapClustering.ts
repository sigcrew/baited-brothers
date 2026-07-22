export type ClusterableMapPoint = {
  id: string;
  latitude: number;
  longitude: number;
};

export type MapPointCluster<T extends ClusterableMapPoint> = {
  id: string;
  latitude: number;
  longitude: number;
  points: T[];
};

export const haveSameMapCoordinate = <T extends ClusterableMapPoint>(
  points: T[],
  tolerance = 0.000001,
) => {
  const first = points[0];
  if (!first) return false;
  return points.every((point) =>
    Math.abs(point.latitude - first.latitude) < tolerance &&
    Math.abs(point.longitude - first.longitude) < tolerance,
  );
};

export const countDistinctMapCoordinates = <T extends ClusterableMapPoint>(
  points: T[],
  tolerance = 0.000001,
) => points.reduce<Array<Pick<ClusterableMapPoint, "latitude" | "longitude">>>(
  (coordinates, point) => {
    const exists = coordinates.some((coordinate) =>
      Math.abs(point.latitude - coordinate.latitude) < tolerance &&
      Math.abs(point.longitude - coordinate.longitude) < tolerance,
    );
    return exists ? coordinates : [...coordinates, point];
  },
  [],
).length;

const EARTH_RADIUS_KM = 6371;
const KM_PER_LATITUDE_DEGREE = 111.32;
const MIN_CLUSTER_RADIUS_KM = 0.005;

const toRadians = (value: number) => value * Math.PI / 180;

export const mapPointDistanceKm = (
  left: Pick<ClusterableMapPoint, "latitude" | "longitude">,
  right: Pick<ClusterableMapPoint, "latitude" | "longitude">,
) => {
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const leftLatitude = toRadians(left.latitude);
  const rightLatitude = toRadians(right.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

export const mapClusterRadiusKm = (
  latitude: number,
  latitudeDelta: number,
  longitudeDelta: number,
) => {
  const visibleHeightKm = Math.abs(latitudeDelta) * KM_PER_LATITUDE_DEGREE;
  const visibleWidthKm =
    Math.abs(longitudeDelta) * KM_PER_LATITUDE_DEGREE * Math.cos(toRadians(latitude));

  // Roughly one marker-width on the current viewport. The floor prevents
  // stacked pins from flickering apart at the maximum zoom level.
  return Math.max(Math.min(visibleHeightKm / 10, visibleWidthKm / 7), MIN_CLUSTER_RADIUS_KM);
};

export const clusterMapPoints = <T extends ClusterableMapPoint>(
  points: T[],
  latitudeDelta: number,
  longitudeDelta: number,
): MapPointCluster<T>[] => {
  if (points.length === 0) return [];
  const orderedPoints = [...points].sort((left, right) => left.id.localeCompare(right.id));
  const meanLatitude = orderedPoints.reduce((sum, point) => sum + point.latitude, 0) / orderedPoints.length;
  const radiusKm = mapClusterRadiusKm(meanLatitude, latitudeDelta, longitudeDelta);
  const parents = orderedPoints.map((_, index) => index);

  const findRoot = (index: number): number => {
    if (parents[index] !== index) parents[index] = findRoot(parents[index]);
    return parents[index];
  };
  const join = (left: number, right: number) => {
    const leftRoot = findRoot(left);
    const rightRoot = findRoot(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };

  orderedPoints.forEach((point, index) => {
    for (let candidateIndex = index + 1; candidateIndex < orderedPoints.length; candidateIndex += 1) {
      if (mapPointDistanceKm(point, orderedPoints[candidateIndex]) <= radiusKm) {
        join(index, candidateIndex);
      }
    }
  });

  const groups = new Map<number, T[]>();
  orderedPoints.forEach((point, index) => {
    const root = findRoot(index);
    groups.set(root, [...(groups.get(root) ?? []), point]);
  });

  return [...groups.values()].map((bucket) => {
    const ids = bucket.map((point) => point.id).sort();
    return {
      id: ids.join("|"),
      latitude: bucket.reduce((sum, point) => sum + point.latitude, 0) / bucket.length,
      longitude: bucket.reduce((sum, point) => sum + point.longitude, 0) / bucket.length,
      points: bucket,
    };
  });
};
