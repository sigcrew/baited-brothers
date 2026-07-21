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
        EFFECTIVE · 2026.07.21
      </Text>
      <Section title="수집하는 정보">
        계정 이메일과 로그인 제공자 정보, 사용자가 기록한 출조·조과·메모,
        촬영 사진, 조과 인증을 위한 촬영 시점의 위치 정보, 앱 버전·운영체제와
        기능 이용 기록(AI 처리 결과, 도감·카드 열람, 출조·조과 변경)을
        처리합니다. 이용 기록에는 사진, 좌표, 메모, 이메일을 중복 저장하지
        않습니다.
      </Section>
      <Section title="이용 목적">
        로그인과 계정 관리, 출조 및 조과 기록 보관, 도감 해금, 사진 기반 어종
        후보 추천, 오류 대응, 서비스 안정성·사용 흐름 개선, AI 및 저장 용량
        운영을 위해 사용합니다.
      </Section>
      <Section title="외부 처리자">
        인증·데이터베이스·파일 저장에는 Supabase를 사용하며, 사진 기반 어종 후보
        추천과 이용 기록 저장에도 Supabase를 사용합니다. AI 추천 시 사진과 도감
        후보 정보가 Anthropic API로 전송될 수 있습니다.
        Apple·Google 로그인을 선택하면 해당 제공자의 인증 절차가 적용됩니다.
      </Section>
      <Section title="보관 및 삭제">
        계정이 유지되는 동안 출조·조과와 업로드 사진을 보관합니다. 원본 기능 이용
        기록은 최대 90일 후 삭제하며, 이후에는 사용자를 식별할 수 없는 기간별
        집계만 남길 수 있습니다. 계정 탈퇴 시 계정에 연결된 기록, 사진과 원본
        이용 기록을 삭제합니다. 법령상 보관 의무가 있는 경우에는 해당 기간 동안
        별도로 보관할 수 있습니다.
      </Section>
      <Section title="사용자 권리와 문의">
        사용자는 앱에서 자신의 기록을 수정·삭제할 수 있습니다. 개인정보 관련
        문의와 권리 행사는 운영 주체 SIGCREW의 지원 이메일
        (sigcrew@sigcrew.com)을 통해 요청할 수 있습니다.
      </Section>
    </ScrollView>
  );
}
