import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Fish } from "@/src/hooks/useFishes";
import type { FishRecognitionCandidate } from "@/src/hooks/useFishRecognition";
import type { RecognitionAnalysis } from "@/src/lib/fishRecognition";
import { captureLocationLabel, type RecordCapture } from "@/src/lib/recordFlow";
import { getField60Illustration } from "@/src/data/field60Illustrations";
import { RecognitionContributionCard } from "@/components/record/RecognitionContributionCard";
import { FIELD_COLORS, bodyExtraBoldFont, bodyFont, monoFont } from "@/src/theme/fieldJournal";

export type CandidateRow = { candidate: FishRecognitionCandidate; fish: Fish };

type RecognitionStatusCardProps = {
  isRecognizing: boolean;
  isSlow: boolean;
  error: Error | null;
  needsRetake: boolean;
  note: string | null;
  onOpenCatalog: () => void;
  onRetry: () => void;
  onRetake: () => void;
};

/** 분석 진행 중 / 실패 / 재촬영 권고 카드. 후보가 있을 때는 아무것도 그리지 않는다. */
export const RecognitionStatusCard = ({
  isRecognizing,
  isSlow,
  error,
  needsRetake,
  note,
  onOpenCatalog,
  onRetry,
  onRetake,
}: RecognitionStatusCardProps) => {
  if (isRecognizing) {
    return (
      <View className="mt-5 flex-row items-center border px-4 py-5" style={{ borderColor: FIELD_COLORS.rule, backgroundColor: "#fff" }}>
        <ActivityIndicator color={FIELD_COLORS.teal} />
        <View className="ml-4 flex-1">
          <Text style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>사진의 특징을 비교하고 있어요</Text>
          <Text className="mt-1 text-xs" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
            체형·지느러미·무늬를 도감 60종과 대조합니다.
          </Text>
          {isSlow ? (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={onOpenCatalog}
              className="mt-3 self-start border-b pb-1"
              style={{ borderBottomColor: FIELD_COLORS.teal }}
            >
              <Text style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>기다리지 않고 직접 찾기</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  }
  if (!error && !needsRetake) return null;
  return (
    <View className="mt-5 border-l-4 bg-white px-4 py-4" style={{ borderLeftColor: FIELD_COLORS.orange }}>
      <Text style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
        {error ? "AI 추천을 불러오지 못했어요" : "사진에서 식별 특징이 충분하지 않아요"}
      </Text>
      <Text className="mt-1 text-xs leading-5" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
        {error
          ? "다시 시도하거나 아래 도감 검색에서 직접 선택할 수 있습니다."
          : "반사와 가림을 줄이고, 한 마리의 머리부터 꼬리까지 보이는 옆면을 촬영해 주세요. 눈·입·지느러미가 선명하면 비교에 도움이 됩니다."}
      </Text>
      {!error && note ? (
        <Text className="mt-2 text-xs leading-5" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
          AI가 안내한 이유 · {note}
        </Text>
      ) : null}
      <View className="mt-4 flex-row">
        {error ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="AI 어종 후보 추천 다시 시도"
            onPress={onRetry}
            className="mr-3 border px-4 py-2"
            style={{ borderColor: FIELD_COLORS.teal }}
          >
            <Text style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>다시 시도</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="사진 다시 촬영"
          onPress={onRetake}
          className="border px-4 py-2"
          style={{ borderColor: FIELD_COLORS.rule }}
        >
          <Text style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>다시 촬영</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

type CandidateListProps = {
  rows: CandidateRow[];
  onSelect: (fish: Fish) => void;
};

export const CandidateList = ({ rows, onSelect }: CandidateListProps) => {
  if (rows.length === 0) return null;
  return (
    <View className="mt-5">
      <View className="flex-row items-end justify-between">
        <Text className="text-lg" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>AI 어종 후보 추천</Text>
        <Text className="text-[9px] tracking-[1px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>후보 {rows.length}개</Text>
      </View>
      <Text className="mt-2 text-xs leading-5" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
        사진에서 추정한 후보입니다. 식별 포인트를 비교한 뒤 선택해 주세요.
      </Text>
      {rows.map(({ fish }, index) => {
        const illustration = getField60Illustration(fish.catalog_sort_order, "color");
        return (
          <TouchableOpacity
            key={fish.id}
            accessibilityRole="button"
            accessibilityLabel={`${index + 1}순위 후보, ${fish.name_ko ?? fish.name}`}
            onPress={() => onSelect(fish)}
            className="mt-3 flex-row border bg-white p-3"
            style={{ borderColor: index === 0 ? FIELD_COLORS.teal : FIELD_COLORS.rule }}
          >
            <View className="h-20 w-24 items-center justify-center overflow-hidden" style={{ backgroundColor: FIELD_COLORS.locked }}>
              {illustration ? <Image source={illustration} className="h-full w-full" resizeMode="contain" /> : null}
            </View>
            <View className="min-w-0 flex-1 pl-4">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>{fish.name_ko ?? fish.name}</Text>
                <Text className="text-sm" style={{ color: FIELD_COLORS.orange, fontFamily: bodyExtraBoldFont }}>{index + 1}순위</Text>
              </View>
              <Text numberOfLines={1} className="mt-1 text-[9px] uppercase tracking-[0.8px]" style={{ color: FIELD_COLORS.teal, fontFamily: monoFont }}>
                {fish.name}
              </Text>
              <Text numberOfLines={2} className="mt-2 text-xs leading-5" style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont }}>
                식별 포인트 · {fish.identification_features ?? "형태와 무늬를 도감 설명과 비교해 주세요."}
              </Text>
              {fish.similar_species_notes ? (
                <Text numberOfLines={2} className="mt-1 text-xs leading-5" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
                  유사종 차이 · {fish.similar_species_notes}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

type CatchDetailsFormProps = {
  capture: RecordCapture;
  customSpeciesName: string | null;
  size: string;
  sizeError: string | null;
  memo: string;
  isSaving: boolean;
  onSizeChange: (value: string) => void;
  onMemoChange: (value: string) => void;
  onSave: () => void;
};

/** 어종이 정해진 뒤 보이는 크기·메모·저장 영역. */
export const CatchDetailsForm = ({
  capture,
  customSpeciesName,
  size,
  sizeError,
  memo,
  isSaving,
  onSizeChange,
  onMemoChange,
  onSave,
}: CatchDetailsFormProps) => (
  <View className="mt-5">
    {customSpeciesName ? (
      <View className="mb-5 border-l-4 bg-white px-4 py-4" style={{ borderLeftColor: FIELD_COLORS.orange }}>
        <Text style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>도감 밖 일반 기록</Text>
        <Text className="mt-1 text-xs leading-5" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
          조과 카드에는 저장되지만 도감 해금·배지·개인 최대어·랭킹에는 반영되지 않습니다.
        </Text>
      </View>
    ) : null}
    {capture.source === "photo_library" ? (
      <View className="mb-5 border-l-4 bg-white px-4 py-4" style={{ borderLeftColor: FIELD_COLORS.orange }}>
        <Text style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
          {Platform.OS === "android" ? "일반 기록으로 저장" : "사진 위치 기반 인증"}
        </Text>
        <Text className="mt-1 text-xs leading-5" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
          {Platform.OS === "android"
            // Android는 ACCESS_MEDIA_LOCATION을 쓰지 않아 보관함 사진의 촬영 위치를 읽지 못한다.
            ? "Android에서는 보관함 사진의 촬영 위치를 읽지 않아 일반 기록으로 저장됩니다. 조과 카드에는 남지만 도감 해금·배지·랭킹에는 반영되지 않습니다. 현장 인증이 필요하면 앱 카메라로 촬영해 주세요."
            : "사진의 촬영 위치가 연안으로 확인되면 도감·배지·개인 최대어에 반영됩니다. 위치가 없거나 확인할 수 없으면 일반 기록으로 저장되며 랭킹에는 반영되지 않습니다."}
        </Text>
      </View>
    ) : null}
    <Text className="text-sm font-medium text-slate-700">크기(cm, 선택)</Text>
    <TextInput
      accessibilityLabel="크기 (센티미터, 선택)"
      value={size}
      onChangeText={onSizeChange}
      keyboardType="decimal-pad"
      placeholder="예: 32.5"
      className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-3"
      style={{ borderColor: sizeError ? FIELD_COLORS.orange : undefined }}
    />
    {sizeError ? (
      <Text accessibilityLiveRegion="polite" className="mt-2 text-xs" style={{ color: FIELD_COLORS.orange, fontFamily: bodyFont }}>
        {sizeError}
      </Text>
    ) : null}
    <Text className="mt-4 text-sm font-medium text-slate-700">메모(선택)</Text>
    <View className="mt-2 min-h-[88px] rounded-xl border border-slate-200 bg-white px-4 py-3">
      <TextInput
        accessibilityLabel="메모 (선택)"
        value={memo}
        onChangeText={onMemoChange}
        multiline
        placeholder="채비, 물때, 기억할 점"
        textAlignVertical="top"
        style={{
          minHeight: 64,
          padding: 0,
          fontSize: 16,
          includeFontPadding: false,
          ...(Platform.OS === "android" ? {} : { lineHeight: 22 }),
        }}
      />
    </View>
    <TouchableOpacity accessibilityRole="button" disabled={isSaving} onPress={onSave} className="mt-6 rounded-xl bg-slate-900 py-4">
      {isSaving ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text className="text-center font-semibold text-white">
          {customSpeciesName ? "도감 밖 일반 기록으로 저장" : "사용자 확인 후 이 어종으로 기록"}
        </Text>
      )}
    </TouchableOpacity>
  </View>
);

type CatchReviewScreenProps = {
  capture: RecordCapture;
  aiEnabled: boolean;
  recognition: {
    isRecognizing: boolean;
    isSlow: boolean;
    error: Error | null;
    needsRetake: boolean;
    note: string | null;
    analysis: RecognitionAnalysis | null;
    candidateRows: CandidateRow[];
  };
  selectedFish: Fish | null;
  customSpeciesName: string | null;
  form: { size: string; sizeError: string | null; memo: string; isSaving: boolean };
  onBack: () => void;
  onChangePhoto: () => void;
  onSelectFish: (fish: Fish) => void;
  onClearSelection: () => void;
  onOpenCatalog: () => void;
  onRetry: () => void;
  onRetake: () => void;
  onSizeChange: (value: string) => void;
  onMemoChange: (value: string) => void;
  onSave: () => void;
  /** 도감 검색 시트 등, 화면 위에 띄우는 형제 요소. */
  overlay?: ReactNode;
};

/** 사진 확인 → 어종 확정 → 크기·메모 → 저장. 상태는 모두 부모(record 라우트)가 가진다. */
export const CatchReviewScreen = ({
  capture,
  aiEnabled,
  recognition,
  selectedFish,
  customSpeciesName,
  form,
  onBack,
  onChangePhoto,
  onSelectFish,
  onClearSelection,
  onOpenCatalog,
  onRetry,
  onRetake,
  onSizeChange,
  onMemoChange,
  onSave,
  overlay,
}: CatchReviewScreenProps) => {
  const insets = useSafeAreaInsets();
  const hasSelection = Boolean(selectedFish || customSpeciesName);
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-[#F4F7F8]">
      <View
        className="flex-row items-center justify-between border-b bg-white px-4 pb-3"
        style={{ paddingTop: insets.top + 10, borderBottomColor: FIELD_COLORS.rule }}
      >
        <TouchableOpacity accessibilityRole="button" onPress={onBack} className="w-14 py-2">
          <Text style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>취소</Text>
        </TouchableOpacity>
        <Text className="text-lg" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>조과 확인</Text>
        <View className="w-14" />
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
      >
        <Image source={{ uri: capture.uri }} className="h-56 w-full rounded-xl bg-slate-200" resizeMode="cover" />
        <View className="mt-3 flex-row justify-between">
          <Text className="text-xs text-teal-800">{captureLocationLabel(capture)}</Text>
          <TouchableOpacity accessibilityRole="button" onPress={onChangePhoto}>
            <Text className="text-sm font-medium text-slate-600">
              {capture.source === "photo_library" ? "다른 사진" : "다시 찍기"}
            </Text>
          </TouchableOpacity>
        </View>
        <Text className="mt-6 text-[24px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>어종을 확정해 주세요</Text>
        <Text className="mt-1 text-sm leading-6" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
          {aiEnabled
            ? "AI가 도감 60종 안에서 후보를 찾습니다. 추천 결과는 참고용이며 최종 선택은 직접 확인해 주세요."
            : "사진은 AI로 전송되지 않습니다. 도감에서 직접 어종을 선택해 주세요."}
        </Text>
        <View className="mt-4 border-l-4 bg-white px-4 py-3" style={{ borderLeftColor: FIELD_COLORS.orange }}>
          <Text className="text-xs leading-5" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
            {aiEnabled
              ? "AI가 어종을 자동으로 확정하거나 기록하지 않습니다. 후보 또는 도감 검색에서 어종을 선택한 뒤 직접 기록해 주세요."
              : "도감 60종 밖이라면 이름을 직접 입력해 일반 기록으로 남길 수 있습니다."}
          </Text>
        </View>
        {!recognition.isRecognizing && recognition.analysis ? (
          <RecognitionContributionCard
            key={recognition.analysis.id}
            analysis={recognition.analysis}
            imageBase64={capture.base64}
            clientRequestId={capture.clientRequestId}
          />
        ) : null}
        {hasSelection ? (
          <View className="mt-4 border p-4" style={{ borderColor: FIELD_COLORS.teal, backgroundColor: "#EAF4F1" }}>
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text className="text-xl" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
                  {selectedFish?.name_ko ?? selectedFish?.name ?? customSpeciesName}
                </Text>
                <Text className="mt-1 text-[10px] uppercase tracking-[1px]" style={{ color: FIELD_COLORS.teal, fontFamily: monoFont }}>
                  {selectedFish?.name ?? "OUTSIDE FIELD 60"}
                </Text>
              </View>
              <Text className="text-[10px] tracking-[1px]" style={{ color: FIELD_COLORS.teal, fontFamily: monoFont }}>사용자 확인</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={onClearSelection}
              className="mt-4 self-start border-b pb-1"
              style={{ borderBottomColor: FIELD_COLORS.teal }}
            >
              <Text style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>다른 어종 선택</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {!recognition.isRecognizing ? <CandidateList rows={recognition.candidateRows} onSelect={onSelectFish} /> : null}
            <RecognitionStatusCard
              isRecognizing={recognition.isRecognizing}
              isSlow={recognition.isSlow}
              error={recognition.error}
              needsRetake={recognition.needsRetake}
              note={recognition.note}
              onOpenCatalog={onOpenCatalog}
              onRetry={onRetry}
              onRetake={onRetake}
            />
            {!recognition.isRecognizing ? (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={
                  recognition.candidateRows.length > 0 ? "추천 후보에 없는 어종을 도감에서 직접 검색" : "도감에서 직접 어종 찾기"
                }
                onPress={onOpenCatalog}
                className="mt-5 items-center border py-3"
                style={{ borderColor: FIELD_COLORS.rule }}
              >
                <Text style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>
                  {recognition.candidateRows.length > 0 ? "후보에 없어요 · 직접 검색" : "도감에서 직접 찾기"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </>
        )}
        {hasSelection ? (
          <CatchDetailsForm
            capture={capture}
            customSpeciesName={customSpeciesName}
            size={form.size}
            sizeError={form.sizeError}
            memo={form.memo}
            isSaving={form.isSaving}
            onSizeChange={onSizeChange}
            onMemoChange={onMemoChange}
            onSave={onSave}
          />
        ) : null}
      </ScrollView>
      {overlay}
    </KeyboardAvoidingView>
  );
};
