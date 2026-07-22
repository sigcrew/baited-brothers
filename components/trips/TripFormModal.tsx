import { useEffect, useState } from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useCallback, useRef } from "react";

import { TripCoverActionSheet } from "@/components/trips/TripCoverActionSheet";
import { TripDateTimePickerModal } from "@/components/trips/TripDateTimePickerModal";
import {
  TripLocationPickerModal,
  type TripPlace,
} from "@/components/trips/TripLocationPickerModal";
import type {
  FishingTrip,
  TripCoverImage,
  UpdateTripInput,
} from "@/src/hooks/useFishingTrips";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
  bodySemiBoldFont,
  displayFont,
  monoFont,
} from "@/src/theme/fieldJournal";

const pad = (value: number) => String(value).padStart(2, "0");

const defaultScheduledDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(6, 0, 0, 0);
  return date;
};

const formatTripDate = (date: Date) =>
  `${date.getFullYear()}. ${pad(date.getMonth() + 1)}. ${pad(date.getDate())}.`;

const formatTripTime = (date: Date) =>
  new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

const PhotoActionIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 20 20" fill="none">
    <Rect x="2" y="3" width="16" height="14" stroke={FIELD_COLORS.teal} strokeWidth="1.8" />
    <Circle cx="7" cy="8" r="1.5" fill={FIELD_COLORS.teal} />
    <Path
      d="m3.5 15 4.2-4.2 3 3 2.4-2.4 3.4 3.6"
      stroke={FIELD_COLORS.teal}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const SubmitArrowIcon = () => (
  <Svg width={22} height={20} viewBox="0 0 22 20" fill="none">
    <Line x1="1" y1="10" x2="20" y2="10" stroke="#FFFFFF" strokeWidth="2.4" />
    <Path
      d="m15.5 5.5 4.5 4.5-4.5 4.5"
      stroke="#FFFFFF"
      strokeWidth="2.4"
      strokeLinecap="square"
      strokeLinejoin="miter"
    />
  </Svg>
);

type TripFormModalProps = {
  visible: boolean;
  trip?: FishingTrip | null;
  initialPlace?: {
    name: string;
    latitude: number;
    longitude: number;
  } | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (input: UpdateTripInput) => Promise<Error | null>;
};

const SNAP_POINTS = ["92%"];

export const TripFormModal = ({
  visible,
  trip,
  initialPlace,
  isSaving,
  onClose,
  onSubmit,
}: TripFormModalProps) => {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [spotName, setSpotName] = useState("");
  const [scheduledAt, setScheduledAt] = useState(defaultScheduledDate);
  const [dateTimePickerMode, setDateTimePickerMode] = useState<"date" | "time" | null>(null);
  const [memo, setMemo] = useState("");
  const [coverImage, setCoverImage] = useState<TripCoverImage | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [coverActionsVisible, setCoverActionsVisible] = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<TripPlace | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSpotName(trip?.spot_name ?? initialPlace?.name ?? "");
    const tripDate = trip ? new Date(trip.scheduled_at) : null;
    setScheduledAt(tripDate && !Number.isNaN(tripDate.getTime()) ? tripDate : defaultScheduledDate());
    setMemo(trip?.memo ?? "");
    setCoverImage(null);
    setRemoveCover(false);
    setCoverActionsVisible(false);
    setDateTimePickerMode(null);
    setLocationPickerVisible(false);
    setSelectedPlace(
      trip?.spot_lat != null && trip?.spot_lng != null
        ? {
            name: trip.spot_name,
            latitude: Number(trip.spot_lat),
            longitude: Number(trip.spot_lng),
          }
        : initialPlace ?? null,
    );
    setFormError(null);
    bottomSheetRef.current?.present();
  }, [initialPlace?.latitude, initialPlace?.longitude, initialPlace?.name, trip, visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.62}
        pressBehavior="close"
      />
    ),
    [],
  );

  const dismiss = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);

  const handleSubmit = async () => {
    if (!spotName.trim()) {
      setFormError("낚시터 이름을 입력해 주세요.");
      return;
    }

    const error = await onSubmit({
      spotName,
      spotLatitude: selectedPlace?.latitude ?? null,
      spotLongitude: selectedPlace?.longitude ?? null,
      scheduledAt,
      memo,
      coverImage: coverImage ?? undefined,
      removeCover: removeCover || undefined,
    });
    if (error) {
      setFormError(error.message);
      return;
    }
    onClose();
  };

  const currentCover = removeCover
    ? null
    : coverImage?.uri ?? trip?.cover_image_url;

  if (!visible) return null;

  return (
    <>
      <BottomSheetModal
        ref={bottomSheetRef}
        accessibilityViewIsModal
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBackground}
        enableDynamicSizing={false}
        enablePanDownToClose
        handleIndicatorStyle={styles.handleIndicator}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        onDismiss={onClose}
        snapPoints={SNAP_POINTS}
        style={styles.sheet}
      >
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        >
          <View className="flex-row items-start justify-between">
            <View>
              <Text
                className="text-[30px] tracking-[-1px]"
                style={{ color: FIELD_COLORS.ink, fontFamily: displayFont }}
              >
                {trip ? "출조 수정" : "새 출조"}
              </Text>
              <Text
                className="mt-1 text-xs tracking-[1px]"
                style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}
              >
                FIELD PLAN · {trip ? "EDIT" : "NEW"}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="닫기"
              onPress={dismiss}
              className="h-11 w-11 items-center justify-center"
            >
              <FontAwesome name="close" size={22} color={FIELD_COLORS.ink} />
            </TouchableOpacity>
          </View>

          <View className="mt-5 border-t" style={{ borderColor: FIELD_COLORS.rule }} />

          <Text className="mt-5 text-sm" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>
            낚시터
          </Text>
          <BottomSheetTextInput
            accessibilityLabel="낚시터"
            value={spotName}
            onChangeText={setSpotName}
            placeholder="예: 대천항 방파제"
            placeholderTextColor={FIELD_COLORS.muted}
            className="mt-2 border px-4 py-3 text-base"
            style={{
              borderColor: FIELD_COLORS.rule,
              borderWidth: 1,
              color: FIELD_COLORS.ink,
              fontFamily: bodyFont,
              fontSize: 16,
              marginTop: 8,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          />

          <View
            className="mt-3 border px-4 py-3"
            style={{
              borderColor: selectedPlace ? FIELD_COLORS.teal : FIELD_COLORS.rule,
              backgroundColor: selectedPlace ? "#EDF7F5" : FIELD_COLORS.foam,
            }}
          >
            <View className="flex-row items-center">
              <View
                className="h-8 w-8 items-center justify-center"
                style={{ backgroundColor: selectedPlace ? FIELD_COLORS.teal : FIELD_COLORS.locked }}
              >
                <FontAwesome name="map-pin" size={15} color={selectedPlace ? "#FFFFFF" : FIELD_COLORS.muted} />
              </View>
              <View className="ml-3 min-w-0 flex-1">
                <Text className="text-[12px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
                  {selectedPlace ? "지도 위치 연결됨" : "지도 위치가 연결되지 않았습니다"}
                </Text>
                <Text numberOfLines={1} className="mt-0.5 text-[10px]" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
                  {selectedPlace
                    ? `${selectedPlace.latitude.toFixed(5)}, ${selectedPlace.longitude.toFixed(5)}`
                    : "연결하면 지도 탭에 이 출조가 표시됩니다."}
                </Text>
              </View>
            </View>
            <View className="mt-3 flex-row">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={selectedPlace ? "출조 지도 위치 변경" : "출조 지도 위치 연결"}
                onPress={() => setLocationPickerVisible(true)}
                className="flex-1 items-center border py-2.5"
                style={{ borderColor: FIELD_COLORS.teal, backgroundColor: "#FFFFFF" }}
              >
                <Text className="text-[12px]" style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>
                  {selectedPlace ? "지도 위치 변경" : "지도에서 장소 연결"}
                </Text>
              </TouchableOpacity>
              {selectedPlace ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="출조 지도 위치 연결 해제"
                  onPress={() => setSelectedPlace(null)}
                  className="ml-2 items-center justify-center border px-4"
                  style={{ borderColor: FIELD_COLORS.rule }}
                >
                  <Text className="text-[12px]" style={{ color: FIELD_COLORS.muted, fontFamily: bodySemiBoldFont }}>
                    연결 해제
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          <Text className="mt-4 text-sm" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>
            출조 일시
          </Text>
          <View className="mt-2 flex-row">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`출조 날짜 ${formatTripDate(scheduledAt)} 선택`}
              onPress={() => setDateTimePickerMode("date")}
              className="h-[54px] min-w-0 flex-[1.2] flex-row items-center border px-3"
              style={{ borderColor: FIELD_COLORS.rule }}
            >
              <FontAwesome name="calendar" size={15} color={FIELD_COLORS.teal} />
              <Text numberOfLines={1} className="ml-2 text-[14px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>
                {formatTripDate(scheduledAt)}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`출조 시간 ${formatTripTime(scheduledAt)} 선택`}
              onPress={() => setDateTimePickerMode("time")}
              className="ml-2 h-[54px] min-w-0 flex-1 flex-row items-center border px-3"
              style={{ borderColor: FIELD_COLORS.rule }}
            >
              <FontAwesome name="clock-o" size={16} color={FIELD_COLORS.orange} />
              <Text numberOfLines={1} className="ml-2 text-[14px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>
                {formatTripTime(scheduledAt)}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="mt-2 flex-row">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="출조 날짜 오늘로 설정"
              onPress={() => {
                const next = new Date(scheduledAt);
                const today = new Date();
                next.setFullYear(today.getFullYear(), today.getMonth(), today.getDate());
                setScheduledAt(next);
              }}
              className="border px-3 py-2"
              style={{ borderColor: FIELD_COLORS.rule }}
            >
              <Text className="text-[11px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>오늘</Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="출조 일시 내일 새벽 5시로 설정"
              onPress={() => {
                const next = new Date();
                next.setDate(next.getDate() + 1);
                next.setHours(5, 0, 0, 0);
                setScheduledAt(next);
              }}
              className="ml-2 border px-3 py-2"
              style={{ borderColor: FIELD_COLORS.rule }}
            >
              <Text className="text-[11px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>내일 새벽</Text>
            </TouchableOpacity>
            {[4, 5, 6].map((hour) => (
              <TouchableOpacity
                key={hour}
                accessibilityRole="button"
                accessibilityLabel={`출조 시간 ${pad(hour)}시로 설정`}
                onPress={() => {
                  const next = new Date(scheduledAt);
                  next.setHours(hour, 0, 0, 0);
                  setScheduledAt(next);
                }}
                className="ml-2 flex-1 items-center border py-2"
                style={{ borderColor: scheduledAt.getHours() === hour && scheduledAt.getMinutes() === 0 ? FIELD_COLORS.teal : FIELD_COLORS.rule }}
              >
                <Text className="text-[11px]" style={{ color: scheduledAt.getHours() === hour && scheduledAt.getMinutes() === 0 ? FIELD_COLORS.teal : FIELD_COLORS.muted, fontFamily: bodySemiBoldFont }}>
                  {pad(hour)}:00
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="mt-4 text-sm" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>
            메모 · 선택
          </Text>
          <BottomSheetTextInput
            accessibilityLabel="출조 메모"
            value={memo}
            onChangeText={setMemo}
            placeholder="물때, 동행, 목표 어종 등"
            placeholderTextColor={FIELD_COLORS.muted}
            multiline
            textAlignVertical="top"
            className="mt-2 min-h-[82px] border px-4 py-3 text-base"
            style={{
              borderColor: FIELD_COLORS.rule,
              borderWidth: 1,
              color: FIELD_COLORS.ink,
              fontFamily: bodyFont,
              fontSize: 16,
              marginTop: 8,
              minHeight: 82,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          />

          <Text className="mt-4 text-sm" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>
            홈 커버 · 선택
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={currentCover ? "출조 커버 사진 다시 선택" : "출조 커버 사진 선택"}
            onPress={() => setCoverActionsVisible(true)}
            className="mt-2 overflow-hidden border"
            style={{ borderColor: FIELD_COLORS.rule, backgroundColor: FIELD_COLORS.foam }}
          >
            {currentCover ? (
              <View>
                <Image source={{ uri: currentCover }} style={{ width: "100%", height: 138 }} resizeMode="cover" />
                <View className="absolute bottom-3 right-3 bg-black/60 px-3 py-2">
                  <Text className="text-xs text-white" style={{ fontFamily: bodySemiBoldFont }}>사진 다시 선택</Text>
                </View>
              </View>
            ) : (
              <View className="h-24 flex-row items-center justify-center">
                <View className="h-6 w-6 items-center justify-center">
                  <PhotoActionIcon />
                </View>
                <Text className="ml-2 text-sm" style={{ color: FIELD_COLORS.teal, fontFamily: bodySemiBoldFont, lineHeight: 24 }}>사진 선택</Text>
              </View>
            )}
          </TouchableOpacity>

          {formError ? (
            <Text className="mt-3 text-sm" style={{ color: FIELD_COLORS.orange, fontFamily: bodyFont }}>
              {formError}
            </Text>
          ) : null}

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={trip ? "출조 수정 저장" : "새 출조 저장"}
            onPress={handleSubmit}
            disabled={isSaving}
            className="mt-5 flex-row items-center justify-center py-4"
            style={{ backgroundColor: FIELD_COLORS.teal }}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View className="flex-row items-center justify-center">
                <Text
                  className="text-base text-white"
                  style={{ fontFamily: bodyExtraBoldFont, lineHeight: 24 }}
                >
                  {trip ? "수정 저장" : "출조 추가"}
                </Text>
                <View className="ml-3 h-6 w-6 items-center justify-center">
                  <SubmitArrowIcon />
                </View>
              </View>
            )}
          </TouchableOpacity>
        </BottomSheetScrollView>
      </BottomSheetModal>

      <TripCoverActionSheet
        hasCover={Boolean(currentCover)}
        visible={coverActionsVisible}
        onClose={() => setCoverActionsVisible(false)}
        onSelect={(image) => {
          setCoverImage(image);
          setRemoveCover(false);
        }}
        onRemove={() => {
          setCoverImage(null);
          setRemoveCover(true);
        }}
      />

      <TripLocationPickerModal
        visible={locationPickerVisible}
        placeName={spotName}
        initialPlace={selectedPlace}
        onClose={() => setLocationPickerVisible(false)}
        onConfirm={(place) => {
          setSelectedPlace(place);
          if (!spotName.trim()) setSpotName(place.name);
          setLocationPickerVisible(false);
        }}
      />

      <TripDateTimePickerModal
        visible={dateTimePickerMode !== null}
        mode={dateTimePickerMode ?? "date"}
        value={scheduledAt}
        onClose={() => setDateTimePickerMode(null)}
        onConfirm={(next) => {
          setScheduledAt(next);
          setDateTimePickerMode(null);
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  handleIndicator: {
    backgroundColor: FIELD_COLORS.rule,
    height: 4,
    width: 48,
  },
  sheet: {
    alignSelf: "center",
    maxWidth: 520,
    width: "100%",
  },
  sheetBackground: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
});
