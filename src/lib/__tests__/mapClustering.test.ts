import {
  clusterMapPoints,
  countDistinctMapCoordinates,
  haveSameMapCoordinate,
  mapClusterRadiusKm,
  mapPointDistanceKm,
} from "../mapClustering";

const points = [
  { id: "a", latitude: 37.4200, longitude: 126.4300 },
  { id: "b", latitude: 37.4210, longitude: 126.4310 },
  { id: "c", latitude: 35.1000, longitude: 129.0400 },
];

describe("clusterMapPoints", () => {
  it("groups nearby points at a wide map scale", () => {
    const clusters = clusterMapPoints(points, 4.8, 4.2);
    expect(clusters).toHaveLength(2);
    expect(clusters.find((cluster) => cluster.points.length === 2)?.points.map((point) => point.id).sort())
      .toEqual(["a", "b"]);
  });

  it("splits nearby points after zooming in", () => {
    const clusters = clusterMapPoints(points, 0.002, 0.002);
    expect(clusters).toHaveLength(3);
  });

  it("keeps a stable id regardless of point order", () => {
    const first = clusterMapPoints(points.slice(0, 2), 4.8, 4.2)[0];
    const reversed = clusterMapPoints(points.slice(0, 2).reverse(), 4.8, 4.2)[0];
    expect(first.id).toBe(reversed.id);
  });

  it("groups close points even when they straddle the old grid boundary", () => {
    const clusters = clusterMapPoints([
      { id: "left", latitude: 37.4399, longitude: 126.5 },
      { id: "right", latitude: 37.4401, longitude: 126.5 },
    ], 4.8, 4.2);

    expect(clusters).toHaveLength(1);
  });

  it("uses a real-distance radius that shrinks as the map zooms in", () => {
    expect(mapPointDistanceKm(points[0], points[1])).toBeGreaterThan(0.1);
    expect(mapClusterRadiusKm(37.42, 4.8, 4.2)).toBeGreaterThan(50);
    expect(mapClusterRadiusKm(37.42, 0.0001, 0.0001)).toBe(0.005);
  });

  it("splits distinct places about 20m apart at the closest map scale", () => {
    const clusters = clusterMapPoints([
      { id: "record", latitude: 35.9432, longitude: 126.5294 },
      { id: "favorite", latitude: 35.94338, longitude: 126.5294 },
    ], 0.0005, 0.0005);

    expect(clusters).toHaveLength(2);
  });

  it("recognizes records stacked on the same coordinate", () => {
    expect(haveSameMapCoordinate([
      { id: "trip", latitude: 35.9432, longitude: 126.5294 },
      { id: "catch", latitude: 35.9432, longitude: 126.5294 },
    ])).toBe(true);
    expect(haveSameMapCoordinate(points.slice(0, 2))).toBe(false);
  });

  it("counts places instead of records in a mixed cluster", () => {
    expect(countDistinctMapCoordinates([
      { id: "trip-a", latitude: 35.9432, longitude: 126.5294 },
      { id: "catch-a", latitude: 35.9432, longitude: 126.5294 },
      { id: "trip-b", latitude: 35.9442, longitude: 126.5304 },
      { id: "catch-b", latitude: 35.9442, longitude: 126.5304 },
    ])).toBe(2);
  });
});
