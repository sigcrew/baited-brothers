import { Modal, Pressable, Text, TouchableOpacity, View } from "react-native";

import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
  monoFont,
} from "@/src/theme/fieldJournal";

type FieldAlertModalProps = {
  visible: boolean;
  eyebrow?: string;
  title: string;
  message: string;
  onClose: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  destructive?: boolean;
  /** 있으면 취소와 확인 사이에 두 번째 행동 버튼을 그린다. */
  secondaryLabel?: string;
  secondaryDestructive?: boolean;
  onSecondary?: () => void;
};

export const FieldAlertModal = ({
  visible,
  eyebrow = "FIELD NOTICE",
  title,
  message,
  onClose,
  confirmLabel = "확인",
  cancelLabel = "취소",
  onConfirm,
  destructive = false,
  secondaryLabel,
  secondaryDestructive = false,
  onSecondary,
}: FieldAlertModalProps) => (
  <Modal
    visible={visible}
    transparent
    statusBarTranslucent
    navigationBarTranslucent
    animationType="fade"
    presentationStyle="overFullScreen"
    onRequestClose={onClose}
  >
    <View className="flex-1 items-center justify-center px-5">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="안내 닫기"
        onPress={onClose}
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(5, 28, 35, 0.66)" }}
      />

      <View
        accessibilityViewIsModal
        className="w-full max-w-[360px] border bg-white"
        style={{
          borderColor: FIELD_COLORS.ink,
          shadowColor: FIELD_COLORS.ink,
          shadowOffset: { width: 7, height: 7 },
          shadowOpacity: 0.22,
          shadowRadius: 0,
        }}
      >
        <View className="flex-row items-center border-b px-5 py-4" style={{ borderColor: FIELD_COLORS.rule }}>
          <View
            className="h-7 w-7 items-center justify-center"
            style={{ backgroundColor: FIELD_COLORS.orange }}
          >
            <Text className="text-base text-white" style={{ fontFamily: bodyExtraBoldFont }}>!</Text>
          </View>
          <Text
            className="ml-3 text-[10px] tracking-[1.4px]"
            style={{ color: FIELD_COLORS.teal, fontFamily: monoFont }}
          >
            {eyebrow}
          </Text>
        </View>

        <View className="px-5 pb-5 pt-6">
          <Text
            accessibilityRole="header"
            className="text-[23px] leading-[32px] tracking-[-0.5px]"
            style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
          >
            {title}
          </Text>
          <Text
            className="mt-3 text-[14px] leading-6"
            style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
          >
            {message}
          </Text>

          <View className="my-5 flex-row items-center">
            <View className="h-[2px] w-10" style={{ backgroundColor: FIELD_COLORS.orange }} />
            <View className="ml-2 h-px flex-1" style={{ backgroundColor: FIELD_COLORS.rule }} />
          </View>

          {onConfirm ? (
            <View className="flex-row gap-2">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={cancelLabel}
                activeOpacity={0.82}
                onPress={onClose}
                className="h-12 flex-1 items-center justify-center border"
                style={{ borderColor: FIELD_COLORS.rule }}
              >
                <Text
                  className="text-[15px]"
                  style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
                >
                  {cancelLabel}
                </Text>
              </TouchableOpacity>
              {onSecondary && secondaryLabel ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel={secondaryLabel}
                  activeOpacity={0.82}
                  onPress={onSecondary}
                  className="h-12 flex-1 items-center justify-center border"
                  style={{ borderColor: secondaryDestructive ? FIELD_COLORS.orange : FIELD_COLORS.teal }}
                >
                  <Text
                    className="text-[15px]"
                    style={{
                      color: secondaryDestructive ? FIELD_COLORS.orange : FIELD_COLORS.teal,
                      fontFamily: bodyExtraBoldFont,
                    }}
                  >
                    {secondaryLabel}
                  </Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={confirmLabel}
                activeOpacity={0.85}
                onPress={onConfirm}
                className="h-12 flex-1 items-center justify-center"
                style={{
                  backgroundColor: destructive ? FIELD_COLORS.orange : FIELD_COLORS.teal,
                }}
              >
                <Text className="text-[15px] text-white" style={{ fontFamily: bodyExtraBoldFont }}>
                  {confirmLabel}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              activeOpacity={0.85}
              onPress={onClose}
              className="h-12 items-center justify-center"
              style={{ backgroundColor: FIELD_COLORS.teal }}
            >
              <Text className="text-[15px] text-white" style={{ fontFamily: bodyExtraBoldFont }}>
                {confirmLabel}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  </Modal>
);
