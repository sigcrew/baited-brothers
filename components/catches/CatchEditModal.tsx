import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { UserCatch } from "@/src/hooks/useUserCatches";
import type { Fish } from "@/src/hooks/useFishes";
import { FishCatalogSheet } from "@/components/record/FishCatalogSheet";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
} from "@/src/theme/fieldJournal";

type Props = {
  item: UserCatch | null;
  fishes: Fish[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (
    item: UserCatch,
    input: {
      sizeCm: number | null;
      memo: string | null;
      fishId: string | null;
      customSpeciesName: string | null;
    },
  ) => Promise<Error | null>;
};

export const CatchEditModal = ({
  item,
  fishes,
  isSaving,
  onClose,
  onSave,
}: Props) => {
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState("");
  const [memo, setMemo] = useState("");
  const [selectedFishId, setSelectedFishId] = useState<string | null>(null);
  const [customSpeciesName, setCustomSpeciesName] = useState<string | null>(
    null,
  );
  const [catalogVisible, setCatalogVisible] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    setSize(item?.size_cm ? String(item.size_cm) : "");
    setMemo(item?.memo ?? "");
    setSelectedFishId(item?.fish_id ?? null);
    setCustomSpeciesName(item?.custom_species_name ?? null);
    setCatalogVisible(false);
    setValidation(null);
  }, [item]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", () => {
      setIsKeyboardVisible(true);
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const submit = async () => {
    if (!item || isSaving) return;
    const parsed = size.trim() ? Number(size) : null;
    if (parsed !== null && (!Number.isFinite(parsed) || parsed <= 0)) {
      setValidation("크기는 0보다 큰 숫자로 입력해 주세요.");
      return;
    }
    const error = await onSave(item, {
      sizeCm: parsed,
      memo: memo.trim() || null,
      fishId: selectedFishId,
      customSpeciesName,
    });
    if (error) setValidation(error.message);
  };

  return (
    <>
      <Modal
        visible={Boolean(item)}
        transparent
        animationType="fade"
        onRequestClose={onClose}
      >
        <KeyboardAvoidingView
          behavior="padding"
          enabled={isKeyboardVisible}
          className="flex-1 justify-end bg-black/50"
        >
          <TouchableOpacity
            className="flex-1"
            activeOpacity={1}
            onPress={onClose}
          />
          <View
            className="bg-white"
            style={{
              maxHeight: "92%",
              paddingBottom: isKeyboardVisible
                ? 20
                : Math.max(insets.bottom + 16, 32),
            }}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingHorizontal: 24,
                paddingTop: 24,
                paddingBottom: 20,
              }}
            >
              <Text
                className="text-2xl"
                style={{
                  color: FIELD_COLORS.ink,
                  fontFamily: bodyExtraBoldFont,
                }}
              >
                조과 기록 수정
              </Text>
              <Text
                className="mt-5 text-sm"
                style={{
                  color: FIELD_COLORS.ink,
                  fontFamily: bodyExtraBoldFont,
                }}
              >
                어종
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="조과 어종 변경"
                onPress={() => setCatalogVisible(true)}
                className="mt-2 flex-row items-center justify-between border px-4 py-3"
                style={{ borderColor: FIELD_COLORS.rule }}
              >
                <Text style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont }}>
                  {selectedFishId
                    ? (fishes.find((fish) => fish.id === selectedFishId)
                        ?.name_ko ??
                      fishes.find((fish) => fish.id === selectedFishId)?.name ??
                      "도감 어종")
                    : (customSpeciesName ?? "어종 선택")}
                </Text>
                <Text
                  style={{
                    color: FIELD_COLORS.teal,
                    fontFamily: bodyExtraBoldFont,
                  }}
                >
                  변경
                </Text>
              </TouchableOpacity>
              {item?.fish_id !== selectedFishId ||
              item?.custom_species_name !== customSpeciesName ? (
                <Text
                  className="mt-2 text-xs leading-5"
                  style={{ color: FIELD_COLORS.orange, fontFamily: bodyFont }}
                >
                  어종 정정 이력이 남으며 이 기록은 향후 경쟁 지표에서
                  제외됩니다.
                </Text>
              ) : null}
              <Text
                className="mt-5 text-sm"
                style={{
                  color: FIELD_COLORS.ink,
                  fontFamily: bodyExtraBoldFont,
                }}
              >
                크기 (cm)
              </Text>
              <TextInput
                value={size}
                onChangeText={setSize}
                keyboardType="decimal-pad"
                className="mt-2 border px-4 py-3"
                style={{
                  borderColor: FIELD_COLORS.rule,
                  color: FIELD_COLORS.ink,
                  fontFamily: bodyFont,
                  fontSize: 16,
                  includeFontPadding: false,
                  lineHeight: 22,
                }}
              />
              <Text
                className="mt-5 text-sm"
                style={{
                  color: FIELD_COLORS.ink,
                  fontFamily: bodyExtraBoldFont,
                }}
              >
                메모
              </Text>
              <View
                className="mt-2 border px-4 py-3"
                style={{ borderColor: FIELD_COLORS.rule, minHeight: 112 }}
              >
                <TextInput
                  value={memo}
                  onChangeText={setMemo}
                  multiline
                  textAlignVertical="top"
                  style={{
                    minHeight: 88,
                    padding: 0,
                    color: FIELD_COLORS.ink,
                    fontFamily: bodyFont,
                    fontSize: 16,
                    includeFontPadding: false,
                    ...(Platform.OS === "android"
                      ? {}
                      : { lineHeight: 22 }),
                  }}
                />
              </View>
              {validation ? (
                <Text
                  className="mt-3 text-sm"
                  style={{ color: FIELD_COLORS.red }}
                >
                  {validation}
                </Text>
              ) : null}
            </ScrollView>
            <View className="flex-row px-6 pt-3">
              <TouchableOpacity
                disabled={isSaving}
                onPress={onClose}
                className="h-12 flex-1 items-center justify-center border"
                style={{ borderColor: FIELD_COLORS.rule }}
              >
                <Text style={{ fontFamily: bodyExtraBoldFont }}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={isSaving}
                onPress={submit}
                className="ml-3 h-12 flex-1 items-center justify-center"
                style={{ backgroundColor: FIELD_COLORS.teal }}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    className="text-white"
                    style={{ fontFamily: bodyExtraBoldFont }}
                  >
                    저장
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <FishCatalogSheet
        fishes={fishes}
        isLoading={false}
        visible={catalogVisible}
        onClose={() => setCatalogVisible(false)}
        onSelect={(fish) => {
          setSelectedFishId(fish.id);
          setCustomSpeciesName(null);
        }}
        onSelectCustom={(name) => {
          setSelectedFishId(null);
          setCustomSpeciesName(name);
        }}
      />
    </>
  );
};
