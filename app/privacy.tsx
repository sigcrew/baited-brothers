import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
  monoFont,
} from "@/src/theme/fieldJournal";

const Section = ({ title, children }: { title: string; children: string }) => (
  <View className="border-b py-5" style={{ borderColor: FIELD_COLORS.rule }}>
    <Text
      className="text-lg"
      style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
    >
      {title}
    </Text>
    <Text
      className="mt-3 text-sm leading-6"
      style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
    >
      {children}
    </Text>
  </View>
);

export default function PrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: FIELD_COLORS.foam }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 24,
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <TouchableOpacity onPress={() => router.back()} className="py-3">
        <Text style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>
          ← 돌아가기
        </Text>
      </TouchableOpacity>
      <Text
        className="mt-4 text-[34px]"
        style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
      >
        개인정보 처리방침
      </Text>
      <Text
        className="mt-2 text-[10px] tracking-[1.2px]"
        style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}
      >
        EFFECTIVE · 2026.07.20
      </Text>
      <Section title="수집하는 정보">
        계정 이메일과 로그인 제공자 정보, 사용자가 기록한 출조·조과·메모,
        촬영 사진, 조과 인증을 위한 촬영 시점의 위치 정보를 처리합니다.
      </Section>
      <Section title="이용 목적">
        로그인과 계정 관리, 출조 및 조과 기록 보관, 도감 해금, 사진 기반 어종
        후보 추천, 서비스 안정성 개선을 위해 사용합니다.
      </Section>
      <Section title="외부 처리자">
        인증·데이터베이스·파일 저장에는 Supabase를 사용하며, 사진 기반 어종 후보
        추천 시 사진과 도감 후보 정보가 Anthropic API로 전송될 수 있습니다.
        Apple·Google 로그인을 선택하면 해당 제공자의 인증 절차가 적용됩니다.
      </Section>
      <Section title="보관 및 삭제">
        계정이 유지되는 동안 정보를 보관합니다. 사용자는 프로필의 계정 탈퇴에서
        계정과 연결된 기록 및 업로드 사진 삭제를 요청할 수 있습니다. 법령상
        보관 의무가 있는 경우에는 해당 기간 동안 별도로 보관할 수 있습니다.
      </Section>
      <Section title="사용자 권리와 문의">
        사용자는 앱에서 자신의 기록을 수정·삭제할 수 있습니다. 스토어 제출 전
        운영 주체 SIGCREW의 공개 지원 채널
        (github.com/sigcrew/baited-brothers/issues)을 통해 문의할 수 있습니다.
      </Section>
    </ScrollView>
  );
}
