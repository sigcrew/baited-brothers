export type FishingMapPoint = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  kind: "catch" | "trip" | "current" | "selected";
  selected?: boolean;
};

export type FishingMapProps = {
  points: FishingMapPoint[];
  onSelectPoint: (id: string) => void;
  onSelectCoordinate: (coordinate: { latitude: number; longitude: number }) => void;
};
