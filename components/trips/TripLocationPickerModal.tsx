import FontAwesome from "@expo/vector-icons/FontAwesome";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FieldAlertModal } from "@/components/design/FieldAlertModal";
import { FishingMap } from "@/components/map/FishingMap";
import type { FishingMapPoint } from "@/components/map/FishingMap.types";
import { searchPlaces, type PlaceSearchResult } from "@/src/lib/placeSearch";
import { evaluateCoastalSelection } from "@/src/lib/coastalSelection";
import { reverseGeocodeKoreanPlaceName } from "@/src/lib/reverseGeocoding";
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
  const searchInputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState(placeName);
  const [selectedPlace, setSelectedPlace] = useState<TripPlace | null>(initialPlace);
  const [isResolving, setIsResolving] = useState(false);
  const [notice, setNotice] = useState<PickerNotice | null>(null);
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const canSearch = Boolean(query.trim()) && !isResolving;

  useEffect(() => {
    requestRef.current += 1;
    if (!visible) return;
    setQuery(placeName);
    setSelectedPlace(initialPlace);
    setIsResolving(false);
    setNotice(null);
    setResults([]);
  }, [initialPlace, placeName, visible]);

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
    Keyboard.dismiss();
    setResults([]);
    if (showInvalidCoordinate(coordinate.latitude, coordinate.longitude)) return;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setIsResolving(true);
    let resolvedName = "";
    try {
      // 수동으로 고른 좌표는 기기 위치 권한과 무관하다. 지역명 조회는 best effort이고
      // 실패하면 "선택한 낚시터"로 남긴다(지도 탭과 같은 동작).
      const result = await reverseGeocodeKoreanPlaceName(coordinate);
      if (requestRef.current !== requestId) return;
      const countryCode = result.countryCode;
      if (countryCode && countryCode !== "KR") {
        setNotice({
          title: "국내 위치만 선택할 수 있습니다",
          message: "대한민국 연안의 장소를 선택해 주세요.",
        });
        return;
      }
      resolvedName = result.name || "";
    } catch {
      // Offshore coordinates may not have a reverse-geocoding result.
    } finally {
      if (requestRef.current === requestId) setIsResolving(false);
    }
    if (requestRef.current !== requestId) return;
    const nextName = resolvedName || "선택한 낚시터";
    setQuery(nextName);
    setSelectedPlace({
      name: nextName,
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    });
  };

  const locateCurrentPosition = async () => {
    if (isResolving) return;
    Keyboard.dismiss();
    // GPS 조회도 요청 토큰을 가진다. 조회 중 지도를 누르면 늦게 온 GPS 결과가
    // 사용자의 선택을 덮어쓰지 않고, 스피너도 그 선택이 끝날 때까지 유지된다.
    const requestId = ++requestRef.current;
    setIsResolving(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (requestRef.current !== requestId) return;
      if (!permission.granted) {
        setNotice({
          title: "위치 권한이 필요합니다",
          message: "현재 위치를 출조 장소로 연결하려면 위치 접근을 허용해 주세요.",
        });
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (requestRef.current !== requestId) return;
      await selectCoordinate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch {
      if (requestRef.current !== requestId) return;
      setNotice({
        title: "현재 위치를 확인하지 못했습니다",
        message: "잠시 후 다시 시도하거나 지도에서 직접 장소를 선택해 주세요.",
      });
    } finally {
      // selectCoordinate가 넘겨받았거나 다른 요청이 시작됐으면 그쪽이 스피너를 끈다.
      if (requestRef.current === requestId) setIsResolving(false);
    }
  };

  const findTypedPlace = async () => {
    const trimmed = query.trim();
    if (!trimmed || isResolving) return;
    Keyboard.dismiss();
    const requestId = ++requestRef.current;
    setIsResolving(true);
    setResults([]);
    setSelectedPlace(null);
    try {
      const places = await searchPlaces(trimmed);
      if (requestRef.current !== requestId) return;
      setResults(places);
      if (!places.length) setNotice({
        title: "장소를 찾지 못했습니다",
        message: "지역명을 함께 검색하거나 지도에서 직접 위치를 선택해 주세요.",
      });
    } catch {
      if (requestRef.current !== requestId) return;
      setNotice({
        title: "장소 검색을 이용할 수 없습니다",
        message: "잠시 후 다시 검색하거나 지도에서 직접 위치를 선택해 주세요.",
      });
    } finally {
      if (requestRef.current === requestId) setIsResolving(false);
    }
  };

  const chooseSearchResult = (place: PlaceSearchResult) => {
    if (showInvalidCoordinate(place.latitude, place.longitude)) return;
    ++requestRef.current;
    setSelectedPlace({ name: place.name, latitude: place.latitude, longitude: place.longitude });
    setQuery(place.name);
    setResults([]);
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
            <Text
              className="text-[26px] tracking-[-0.8px]"
              style={{
                color: FIELD_COLORS.ink,
                fontFamily: displayFont,
                includeFontPadding: false,
                lineHeight: 34,
              }}
            >
              출조 장소 연결
            </Text>
            <Text
              className="mt-0.5 text-[9px] tracking-[1.2px]"
              style={{
                color: FIELD_COLORS.muted,
                fontFamily: monoFont,
                includeFontPadding: false,
                lineHeight: 12,
              }}
            >
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
            focusPointId={selectedPlace ? "trip-place-selection" : null}
            onSelectPoint={() => undefined}
            onSelectCoordinate={selectCoordinate}
          />

          <View className="absolute inset-x-4 top-4 flex-row items-center">
            <View
              className="min-w-0 flex-1 flex-row items-center border bg-white px-3"
              style={{ borderColor: FIELD_COLORS.ink, height: 48 }}
            >
              <FontAwesome name="search" size={15} color={FIELD_COLORS.teal} />
              <TextInput
                ref={searchInputRef}
                accessibilityLabel="낚시터 이름 검색"
                value={query}
                onChangeText={(value) => { setQuery(value); setResults([]); }}
                onSubmitEditing={findTypedPlace}
                returnKeyType="search"
                placeholder="낚시터 이름 입력 후 검색"
                placeholderTextColor={FIELD_COLORS.muted}
                maxLength={100}
                editable={!isResolving}
                style={{
                  flex: 1,
                  marginLeft: 8,
                  paddingVertical: 0,
                  color: FIELD_COLORS.ink,
                  fontFamily: bodySemiBoldFont,
                  fontSize: 14,
                  includeFontPadding: false,
                  ...(Platform.OS === "android" ? {} : { lineHeight: 20 }),
                }}
              />
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="입력한 낚시터 이름으로 위치 찾기"
                onPress={findTypedPlace}
                disabled={!canSearch}
                style={{
                  alignSelf: "stretch",
                  justifyContent: "center",
                  paddingHorizontal: 8,
                }}
              >
                <Text
                  style={{
                    color: canSearch ? FIELD_COLORS.teal : FIELD_COLORS.muted,
                    fontFamily: bodyExtraBoldFont,
                    fontSize: 13,
                    lineHeight: 18,
                    includeFontPadding: false,
                    textAlignVertical: "center",
                  }}
                >
                  검색
                </Text>
              </TouchableOpacity>
            </View>
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

          {results.length > 0 && (
            <View style={{ position: "absolute", top: 72, left: 16, right: 16, maxHeight: 260, backgroundColor: "white", borderWidth: 1, borderColor: FIELD_COLORS.rule }}>
              <Text style={{ padding: 10, color: FIELD_COLORS.muted, fontSize: 11 }}>검색 결과 · Kakao · 장소를 선택하세요</Text>
              <ScrollView keyboardShouldPersistTaps="handled">
                {results.map((place) => (
                  <TouchableOpacity key={place.id} accessibilityRole="button" accessibilityLabel={`${place.name}, ${place.address} 선택`} onPress={() => chooseSearchResult(place)} style={{ padding: 12, borderTopWidth: 1, borderColor: FIELD_COLORS.rule }}>
                    <Text style={{ fontFamily: bodyExtraBoldFont, color: FIELD_COLORS.ink }}>{place.name}</Text>
                    <Text style={{ marginTop: 4, fontSize: 12, color: FIELD_COLORS.muted }}>{place.address}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <View
            className="absolute inset-x-0 bottom-0 border-t bg-white px-5 pt-4"
            style={{
              borderColor: FIELD_COLORS.ink,
              paddingBottom: insets.bottom + 16,
            }}
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
              onPress={() => {
                if (!selectedPlace) return;
                onConfirm(selectedPlace);
              }}
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
