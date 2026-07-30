import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
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
  const [size, setSize] = useState("");
  const [memo, setMemo] = useState("");
  const [selectedFishId, setSelectedFishId] = useState<string | null>(null);
  const [customSpeciesName, setCustomSpeciesName] = useState<string | null>(
    null,
  );
  const [catalogVisible, setCatalogVisible] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);

  useEffect(() => {
    setSize(item?.size_cm ? String(item.size_cm) : "");
    setMemo(item?.memo ?? "");
    setSelectedFishId(item?.fish_id ?? null);
    setCustomSpeciesName(item?.custom_species_name ?? null);
    setCatalogVisible(false);
    setValidation(null);
  }, [item]);

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
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-end bg-black/50"
      >
        <TouchableOpacity className="flex-1" activeOpacity={1} onPress={onClose} />
        <View className="bg-white px-6 pb-10 pt-6">
          <Text
            className="text-2xl"
            style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
          >
            조과 기록 수정
          </Text>
          <Text
            className="mt-5 text-sm"
            style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
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
                ? (fishes.find((fish) => fish.id === selectedFishId)?.name_ko ??
                  fishes.find((fish) => fish.id === selectedFishId)?.name ??
                  "도감 어종")
                : customSpeciesName ?? "어종 선택"}
            </Text>
            <Text
              style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}
            >
              변경
            </Text>
          </TouchableOpacity>
          {(item?.fish_id !== selectedFishId ||
            item?.custom_species_name !== customSpeciesName) ? (
            <Text
              className="mt-2 text-xs leading-5"
              style={{ color: FIELD_COLORS.orange, fontFamily: bodyFont }}
            >
              어종 정정 이력이 남으며 이 기록은 향후 경쟁 지표에서 제외됩니다.
            </Text>
          ) : null}
          <Text
            className="mt-5 text-sm"
            style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
          >
            크기 (cm)
          </Text>
          <TextInput
            value={size}
            onChangeText={setSize}
            keyboardType="decimal-pad"
            className="mt-2 border px-4 py-3"
            style={{ borderColor: FIELD_COLORS.rule, color: FIELD_COLORS.ink }}
          />
          <Text
            className="mt-5 text-sm"
            style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
          >
            메모
          </Text>
          <TextInput
            value={memo}
            onChangeText={setMemo}
            multiline
            className="mt-2 min-h-28 border px-4 py-3"
            style={{
              borderColor: FIELD_COLORS.rule,
              color: FIELD_COLORS.ink,
              fontFamily: bodyFont,
              textAlignVertical: "top",
            }}
          />
          {validation ? (
            <Text className="mt-3 text-sm" style={{ color: FIELD_COLORS.red }}>
              {validation}
            </Text>
          ) : null}
          <View className="mt-6 flex-row">
            <TouchableOpacity
              disabled={isSaving}
              onPress={onClose}
              className="flex-1 items-center border py-4"
              style={{ borderColor: FIELD_COLORS.rule }}
            >
              <Text style={{ fontFamily: bodyExtraBoldFont }}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={isSaving}
              onPress={submit}
              className="ml-3 flex-1 items-center py-4"
              style={{ backgroundColor: FIELD_COLORS.teal }}
            >
              {isSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white" style={{ fontFamily: bodyExtraBoldFont }}>
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
