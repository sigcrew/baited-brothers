import { ActivityIndicator, Linking, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PRIVACY_POLICY_URL } from "@/src/lib/recordFlow";
import { FIELD_COLORS, bodyExtraBoldFont, bodyFont, monoFont } from "@/src/theme/fieldJournal";

export const AiConsentLoadingScreen = () => (
  <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: FIELD_COLORS.foam }}>
    <ActivityIndicator color={FIELD_COLORS.teal} />
    <Text className="mt-4 text-sm" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
      사진 처리 동의 상태를 확인하고 있어요
    </Text>
  </View>
);

type AiConsentScreenProps = {
  onAccept: () => void;
  onContinueWithoutAi: () => void;
  onBack: () => void;
};

/** AI 사진 분석 동의 화면. 동의 없이도 도감 직접 선택으로 기록할 수 있다. */
export const AiConsentScreen = ({ onAccept, onContinueWithoutAi, onBack }: AiConsentScreenProps) => {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-1 justify-center px-7"
      style={{
        backgroundColor: FIELD_COLORS.foam,
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 24,
      }}
    >
      <Text className="text-[10px] tracking-[1.5px]" style={{ color: FIELD_COLORS.teal, fontFamily: monoFont }}>
        AI PHOTO ANALYSIS
      </Text>
      <Text className="mt-4 text-[32px] leading-[42px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
        사진 판별 전{`\n`}확인이 필요해요
      </Text>
      <Text className="mt-5 text-[15px] leading-7" style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont }}>
        촬영한 물고기 사진은 어종 후보 추천을 위해 Supabase 보안 함수를
        거쳐 Anthropic으로 전송됩니다. 위치 정보는 AI에 전송하지 않으며,
        사진은 조과를 저장하거나, 별도의 선택 동의로 개선용 사진을 제공할 때 앱 저장소에 보관됩니다.
      </Text>
      <View className="mt-6 border-l-4 bg-white px-4 py-4" style={{ borderLeftColor: FIELD_COLORS.orange }}>
        <Text className="text-sm leading-6" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
          AI 결과는 참고용이며 최종 어종은 사용자가 직접 선택합니다.
        </Text>
      </View>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onAccept}
        className="mt-7 items-center py-4"
        style={{ backgroundColor: FIELD_COLORS.teal }}
      >
        <Text className="text-base text-white" style={{ fontFamily: bodyExtraBoldFont }}>
          동의하고 카메라 열기
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        onPress={onContinueWithoutAi}
        className="mt-3 items-center border py-4"
        style={{ borderColor: FIELD_COLORS.teal }}
      >
        <Text className="text-base" style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>
          AI 없이 기록하기
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="link"
        onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
        className="mt-4 items-center py-2"
      >
        <Text style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>개인정보 처리방침 보기</Text>
      </TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={onBack} className="mt-2 items-center py-2">
        <Text style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>동의하지 않고 돌아가기</Text>
      </TouchableOpacity>
    </View>
  );
};
