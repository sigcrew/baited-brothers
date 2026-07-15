import { useEffect, useState } from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import * as ImagePicker from "expo-image-picker";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

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

const pickTripCover = async (): Promise<TripCoverImage | null> => {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert("사진 권한 필요", "출조 커버를 선택하려면 사진 보관함 접근을 허용해 주세요.");
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.85,
  });

  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
  };
};

type TripFormModalProps = {
  visible: boolean;
  trip?: FishingTrip | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (input: UpdateTripInput) => Promise<Error | null>;
};

export const TripFormModal = ({
  visible,
  trip,
  isSaving,
  onClose,
  onSubmit,
}: TripFormModalProps) => {
  const [spotName, setSpotName] = useState("");
  const [scheduledInput, setScheduledInput] = useState(defaultScheduledInput);
  const [memo, setMemo] = useState("");
  const [coverImage, setCoverImage] = useState<TripCoverImage | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setSpotName(trip?.spot_name ?? "");
    setScheduledInput(
      trip ? toLocalInputValue(new Date(trip.scheduled_at)) : defaultScheduledInput()
    );
    setMemo(trip?.memo ?? "");
    setCoverImage(null);
    setFormError(null);
  }, [trip, visible]);

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
    });
    if (error) {
      setFormError(error.message);
      return;
    }
    onClose();
  };

  const currentCover = coverImage?.uri ?? trip?.cover_image_url;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <Pressable onPress={onClose} className="flex-1 justify-end bg-black/40">
          <Pressable
            onPress={(event) => event.stopPropagation()}
            className="max-h-[92%] bg-white px-5 pb-8 pt-5"
          >
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
                  onPress={onClose}
                  className="h-11 w-11 items-center justify-center"
                >
                  <FontAwesome name="close" size={22} color={FIELD_COLORS.ink} />
                </TouchableOpacity>
              </View>

              <View className="mt-5 border-t" style={{ borderColor: FIELD_COLORS.rule }} />

              <Text className="mt-5 text-sm" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>
                낚시터
              </Text>
              <TextInput
                accessibilityLabel="낚시터"
                value={spotName}
                onChangeText={setSpotName}
                placeholder="예: 대천항 방파제"
                placeholderTextColor={FIELD_COLORS.muted}
                className="mt-2 border px-4 py-3 text-base"
                style={{ borderColor: FIELD_COLORS.rule, color: FIELD_COLORS.ink, fontFamily: bodyFont }}
              />

              <Text className="mt-4 text-sm" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>
                일시 · YYYY-MM-DD HH:mm
              </Text>
              <TextInput
                accessibilityLabel="출조 일시"
                value={scheduledInput}
                onChangeText={setScheduledInput}
                placeholder="2026-07-19 05:30"
                placeholderTextColor={FIELD_COLORS.muted}
                autoCapitalize="none"
                className="mt-2 border px-4 py-3 text-base"
                style={{ borderColor: FIELD_COLORS.rule, color: FIELD_COLORS.ink, fontFamily: monoFont }}
              />

              <Text className="mt-4 text-sm" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>
                메모 · 선택
              </Text>
              <TextInput
                accessibilityLabel="출조 메모"
                value={memo}
                onChangeText={setMemo}
                placeholder="물때, 동행, 목표 어종 등"
                placeholderTextColor={FIELD_COLORS.muted}
                multiline
                textAlignVertical="top"
                className="mt-2 min-h-[82px] border px-4 py-3 text-base"
                style={{ borderColor: FIELD_COLORS.rule, color: FIELD_COLORS.ink, fontFamily: bodyFont }}
              />

              <Text className="mt-4 text-sm" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>
                홈 커버 · 선택
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={currentCover ? "출조 커버 사진 다시 선택" : "출조 커버 사진 선택"}
                onPress={async () => {
                  const image = await pickTripCover();
                  if (image) setCoverImage(image);
                }}
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
            </ScrollView>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};
