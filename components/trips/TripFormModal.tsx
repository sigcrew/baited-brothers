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

const toLocalInputValue = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;

const parseLocalInputValue = (value: string): Date | null => {
  const match = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (!match) return null;

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4] ?? "9"),
    Number(match[5] ?? "0")
  );
  return Number.isNaN(date.getTime()) ? null : date;
};

const defaultScheduledInput = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(6, 0, 0, 0);
  return toLocalInputValue(date);
};

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
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (input: UpdateTripInput) => Promise<Error | null>;
};

const SNAP_POINTS = ["92%"];

export const TripFormModal = ({
  visible,
  trip,
  isSaving,
  onClose,
  onSubmit,
}: TripFormModalProps) => {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const [spotName, setSpotName] = useState("");
  const [scheduledInput, setScheduledInput] = useState(defaultScheduledInput);
  const [memo, setMemo] = useState("");
  const [coverImage, setCoverImage] = useState<TripCoverImage | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [coverActionsVisible, setCoverActionsVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSpotName(trip?.spot_name ?? "");
    setScheduledInput(
      trip ? toLocalInputValue(new Date(trip.scheduled_at)) : defaultScheduledInput()
    );
    setMemo(trip?.memo ?? "");
    setCoverImage(null);
    setRemoveCover(false);
    setCoverActionsVisible(false);
    setFormError(null);
    bottomSheetRef.current?.present();
  }, [trip, visible]);

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
    const scheduledAt = parseLocalInputValue(scheduledInput);
    if (!spotName.trim()) {
      setFormError("낚시터 이름을 입력해 주세요.");
      return;
    }
    if (!scheduledAt) {
      setFormError("날짜는 YYYY-MM-DD HH:mm 형식으로 입력해 주세요.");
      return;
    }

    const error = await onSubmit({
      spotName,
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

          <Text className="mt-4 text-sm" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>
            일시 · YYYY-MM-DD HH:mm
          </Text>
          <BottomSheetTextInput
            accessibilityLabel="출조 일시"
            value={scheduledInput}
            onChangeText={setScheduledInput}
            placeholder="2026-07-19 05:30"
            placeholderTextColor={FIELD_COLORS.muted}
            autoCapitalize="none"
            className="mt-2 border px-4 py-3 text-base"
            style={{
              borderColor: FIELD_COLORS.rule,
              borderWidth: 1,
              color: FIELD_COLORS.ink,
              fontFamily: monoFont,
              fontSize: 16,
              marginTop: 8,
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          />

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
