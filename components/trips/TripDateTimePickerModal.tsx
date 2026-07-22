import DateTimePicker from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
  displayFont,
  monoFont,
} from "@/src/theme/fieldJournal";

type TripDateTimePickerModalProps = {
  visible: boolean;
  mode: "date" | "time";
  value: Date;
  onClose: () => void;
  onConfirm: (value: Date) => void;
};

export const TripDateTimePickerModal = ({
  visible,
  mode,
  value,
  onClose,
  onConfirm,
}: TripDateTimePickerModalProps) => {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (visible) setDraft(value);
  }, [value, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="fade"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View className="flex-1 justify-end">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="날짜 시간 선택 닫기"
          onPress={onClose}
          className="absolute inset-0"
          style={{ backgroundColor: "rgba(5, 28, 35, 0.66)" }}
        />
        <View
          className="border-t bg-white px-5 pt-5"
          style={{ borderColor: FIELD_COLORS.ink, paddingBottom: Math.max(insets.bottom, 18) }}
        >
          <View className="flex-row items-start justify-between">
            <View>
              <Text className="text-[26px] tracking-[-0.8px]" style={{ color: FIELD_COLORS.ink, fontFamily: displayFont }}>
                {mode === "date" ? "날짜 선택" : "시간 선택"}
              </Text>
              <Text className="mt-1 text-[9px] tracking-[1.2px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
                TRIP SCHEDULE · {mode === "date" ? "DATE" : "TIME"}
              </Text>
            </View>
            <Text className="text-xs" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
              {mode === "date" ? "출조할 날" : "출발 시간"}
            </Text>
          </View>

          <View className="mt-4 border-y py-1" style={{ borderColor: FIELD_COLORS.rule }}>
            <DateTimePicker
              value={draft}
              mode={mode}
              display="spinner"
              locale="ko-KR"
              minuteInterval={5}
              onChange={(_event, next) => next && setDraft(next)}
              style={{ width: "100%", height: 190 }}
              textColor={FIELD_COLORS.ink}
            />
          </View>

          <View className="mt-5 flex-row">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="날짜 시간 선택 취소"
              onPress={onClose}
              className="h-12 flex-1 items-center justify-center border"
              style={{ borderColor: FIELD_COLORS.rule }}
            >
              <Text className="text-[14px]" style={{ color: FIELD_COLORS.muted, fontFamily: bodyExtraBoldFont }}>
                취소
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="선택한 날짜 시간 적용"
              onPress={() => onConfirm(draft)}
              className="ml-2 h-12 flex-[1.4] items-center justify-center"
              style={{ backgroundColor: FIELD_COLORS.teal }}
            >
              <Text className="text-[14px] text-white" style={{ fontFamily: bodyExtraBoldFont }}>
                이 {mode === "date" ? "날짜" : "시간"}로 선택
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
