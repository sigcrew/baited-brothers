import FontAwesome from "@expo/vector-icons/FontAwesome";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FieldAlertModal } from "@/components/design/FieldAlertModal";
import { FishingMap } from "@/components/map/FishingMap";
import type { FishingMapPoint } from "@/components/map/FishingMap.types";
import { evaluateCoastalSelection } from "@/src/lib/coastalSelection";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
  bodySemiBoldFont,
  displayFont,
  monoFont,
} from "@/src/theme/fieldJournal";

export type TripPlace = {
  name: string;
  latitude: number;
  longitude: number;
};

type TripLocationPickerModalProps = {
  visible: boolean;
  placeName: string;
  initialPlace: TripPlace | null;
  onClose: () => void;
  onConfirm: (place: TripPlace) => void;
};

type PickerNotice = {
  title: string;
  message: string;
};

const isKoreaCoordinate = (latitude: number, longitude: number) =>
  latitude >= 32.5 && latitude <= 39 && longitude >= 124 && longitude <= 132.5;

export const TripLocationPickerModal = ({
  visible,
  placeName,
  initialPlace,
  onClose,
  onConfirm,
}: TripLocationPickerModalProps) => {
  const insets = useSafeAreaInsets();
  const requestRef = useRef(0);
  const [selectedPlace, setSelectedPlace] = useState<TripPlace | null>(initialPlace);
  const [isResolving, setIsResolving] = useState(false);
  const [notice, setNotice] = useState<PickerNotice | null>(null);

  useEffect(() => {
    if (!visible) return;
    requestRef.current += 1;
    setSelectedPlace(initialPlace);
    setIsResolving(false);
    setNotice(null);
  }, [initialPlace, visible]);

  const showInvalidCoordinate = (latitude: number, longitude: number) => {
    if (!isKoreaCoordinate(latitude, longitude)) {
      setNotice({
        title: "국내 위치만 선택할 수 있습니다",
        message: "대한민국 바다·항구·방파제 주변의 장소를 선택해 주세요.",
      });
      return true;
    }
    const coastal = evaluateCoastalSelection(latitude, longitude);
    if (!coastal.allowed) {
      setNotice({
        title: "내륙 지역은 연결할 수 없습니다",
        message: `선택한 위치는 해안에서 약 ${coastal.coastDistanceKm?.toFixed(1)}km 떨어져 있습니다. 바다·항구·방파제 주변을 선택해 주세요.`,
      });
      return true;
    }
    return false;
  };

  const selectCoordinate = async (coordinate: { latitude: number; longitude: number }) => {
    if (showInvalidCoordinate(coordinate.latitude, coordinate.longitude)) return;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setIsResolving(true);
    let resolvedName = placeName.trim();
    try {
      const results = await Location.reverseGeocodeAsync(coordinate);
      if (requestRef.current !== requestId) return;
      const address = results[0];
      const countryCode = address?.isoCountryCode?.toUpperCase();
      if (countryCode && countryCode !== "KR") {
        setNotice({
          title: "국내 위치만 선택할 수 있습니다",
          message: "대한민국 연안의 장소를 선택해 주세요.",
        });
        return;
      }
      if (!resolvedName && address) {
        resolvedName = address.district || address.city || address.subregion || address.region || "";
      }
    } catch {
      // Offshore coordinates may not have a reverse-geocoding result.
    } finally {
      if (requestRef.current === requestId) setIsResolving(false);
    }
    if (requestRef.current !== requestId) return;
    setSelectedPlace({
      name: resolvedName || "선택한 낚시터",
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    });
  };

  const locateCurrentPosition = async () => {
    if (isResolving) return;
    setIsResolving(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setNotice({
          title: "위치 권한이 필요합니다",
          message: "현재 위치를 출조 장소로 연결하려면 위치 접근을 허용해 주세요.",
        });
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await selectCoordinate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch {
      setNotice({
        title: "현재 위치를 확인하지 못했습니다",
        message: "잠시 후 다시 시도하거나 지도에서 직접 장소를 선택해 주세요.",
      });
    } finally {
      setIsResolving(false);
    }
  };

  const findTypedPlace = async () => {
    const query = placeName.trim();
    if (!query || isResolving) {
      if (!query) {
        setNotice({
          title: "낚시터 이름을 먼저 입력해 주세요",
          message: "입력한 장소의 예상 위치를 찾은 뒤 지도에서 확인할 수 있습니다.",
        });
      }
      return;
    }
    setIsResolving(true);
    try {
      const results = await Location.geocodeAsync(query);
      if (!results[0]) {
        setNotice({
          title: "장소를 찾지 못했습니다",
          message: "항구·방파제·해변 이름을 조금 더 구체적으로 입력해 주세요.",
        });
        return;
      }
      await selectCoordinate(results[0]);
    } catch {
      setNotice({
        title: "장소 검색에 실패했습니다",
        message: "잠시 후 다시 시도하거나 지도에서 직접 장소를 선택해 주세요.",
      });
    } finally {
      setIsResolving(false);
    }
  };

  const points: FishingMapPoint[] = selectedPlace
    ? [{
        id: "trip-place-selection",
        kind: "selected",
        label: selectedPlace.name,
        latitude: selectedPlace.latitude,
        longitude: selectedPlace.longitude,
        selected: true,
      }]
    : [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View className="flex-1" style={{ backgroundColor: FIELD_COLORS.foam, paddingTop: insets.top }}>
        <View className="flex-row items-center border-b px-5 py-3" style={{ borderColor: FIELD_COLORS.rule }}>
          <View className="min-w-0 flex-1">
            <Text className="text-[26px] tracking-[-0.8px]" style={{ color: FIELD_COLORS.ink, fontFamily: displayFont }}>
              출조 장소 연결
            </Text>
            <Text className="mt-0.5 text-[9px] tracking-[1.2px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
              TRIP LOCATION · MAP PIN
            </Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="장소 선택 닫기"
            onPress={onClose}
            className="h-11 w-11 items-center justify-center border"
            style={{ borderColor: FIELD_COLORS.rule }}
          >
            <FontAwesome name="close" size={21} color={FIELD_COLORS.ink} />
          </TouchableOpacity>
        </View>

        <View className="relative flex-1">
          <FishingMap
            points={points}
            onSelectPoint={() => undefined}
            onSelectCoordinate={selectCoordinate}
          />

          <View className="absolute inset-x-4 top-4 flex-row">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="입력한 낚시터 이름으로 위치 찾기"
              onPress={findTypedPlace}
              disabled={isResolving}
              className="min-w-0 flex-1 flex-row items-center border bg-white px-4 py-3"
              style={{ borderColor: FIELD_COLORS.ink }}
            >
              <FontAwesome name="search" size={15} color={FIELD_COLORS.teal} />
              <Text numberOfLines={1} className="ml-2 flex-1 text-[13px]" style={{ color: placeName.trim() ? FIELD_COLORS.ink : FIELD_COLORS.muted, fontFamily: bodySemiBoldFont }}>
                {placeName.trim() ? `“${placeName.trim()}” 위치 찾기` : "낚시터 이름을 먼저 입력하세요"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="현재 위치를 출조 장소로 선택"
              onPress={locateCurrentPosition}
              disabled={isResolving}
              className="ml-2 h-12 w-12 items-center justify-center border bg-white"
              style={{ borderColor: FIELD_COLORS.ink }}
            >
              {isResolving
                ? <ActivityIndicator size="small" color={FIELD_COLORS.teal} />
                : <FontAwesome name="crosshairs" size={18} color={FIELD_COLORS.ink} />}
            </TouchableOpacity>
          </View>

          <View
            className="absolute inset-x-0 bottom-0 border-t bg-white px-5 pt-4"
            style={{ borderColor: FIELD_COLORS.ink, paddingBottom: Math.max(insets.bottom, 14) }}
          >
            <Text className="text-[9px] tracking-[1.2px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
              {selectedPlace ? "SELECTED FISHING SPOT" : "TAP THE COAST"}
            </Text>
            <View className="mt-1 flex-row items-end">
              <View className="min-w-0 flex-1 pr-3">
                <Text numberOfLines={1} className="text-xl" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
                  {selectedPlace?.name ?? "지도에서 해안 장소를 선택하세요"}
                </Text>
                <Text className="mt-1 text-[11px]" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
                  {selectedPlace
                    ? `${selectedPlace.latitude.toFixed(5)}, ${selectedPlace.longitude.toFixed(5)}`
                    : "바다·항구·방파제 주변만 연결할 수 있습니다."}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="선택한 출조 장소 연결"
              disabled={!selectedPlace || isResolving}
              onPress={() => selectedPlace && onConfirm(selectedPlace)}
              className="mt-4 h-12 flex-row items-center justify-center"
              style={{ backgroundColor: selectedPlace ? FIELD_COLORS.teal : FIELD_COLORS.locked }}
            >
              <FontAwesome name="map-pin" size={15} color={selectedPlace ? "#FFFFFF" : FIELD_COLORS.muted} />
              <Text className="ml-2 text-[15px]" style={{ color: selectedPlace ? "#FFFFFF" : FIELD_COLORS.muted, fontFamily: bodyExtraBoldFont }}>
                이 위치 연결
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <FieldAlertModal
          visible={Boolean(notice)}
          eyebrow="TRIP LOCATION NOTICE"
          title={notice?.title ?? ""}
          message={notice?.message ?? ""}
          onClose={() => setNotice(null)}
        />
      </View>
    </Modal>
  );
};
