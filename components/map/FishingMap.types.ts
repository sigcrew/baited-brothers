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
  /** 지도를 가리는 하단 UI(탭바 등)의 높이. 지도 로고/법적 고지를 그 위로 올린다. */
  bottomInset?: number;
  focusPointId?: string | null;
  focusLatitudeDelta?: number | null;
  onSelectPoint: (id: string) => void;
  onSelectCluster?: (ids: string[]) => void;
  onSelectCoordinate: (coordinate: { latitude: number; longitude: number }) => void;
};
