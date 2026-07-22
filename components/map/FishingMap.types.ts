export type FishingMapPoint = {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  kind: "catch" | "trip" | "favorite" | "current" | "selected";
  selected?: boolean;
  favorite?: boolean;
};

export type FishingMapProps = {
  points: FishingMapPoint[];
  focusPointId?: string | null;
  focusLatitudeDelta?: number | null;
  onSelectPoint: (id: string) => void;
  onSelectCluster?: (ids: string[]) => void;
  onSelectCoordinate: (coordinate: { latitude: number; longitude: number }) => void;
};
