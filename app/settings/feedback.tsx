import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { SettingsScaffold } from "@/components/settings/SettingsScaffold";
import { useAuth } from "@/src/contexts/AuthContext";
import { supabase } from "@/src/lib/supabase";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
} from "@/src/theme/fieldJournal";

const CATEGORIES = [
  { key: "identification", label: "어종 판별" },
  { key: "recording", label: "조과 기록" },
  { key: "collection", label: "도감·카드" },
  { key: "map_marine", label: "지도·바다 정보" },
  { key: "other", label: "기타" },
] as const;

export default function FeedbackScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [category, setCategory] =
    useState<(typeof CATEGORIES)[number]["key"]>("identification");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    const userId = session?.user.id;
    const normalizedMessage = message.trim();
    if (!userId) {
      Alert.alert("로그인 필요", "문제 신고는 로그인 후 보낼 수 있습니다.");
      return;
    }
    if (!normalizedMessage) {
      Alert.alert("내용 확인", "겪은 문제를 간단히 적어 주세요.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.from("user_feedback").insert({
      user_id: userId,
      category,
      message: normalizedMessage,
      app_version: Constants.expoConfig?.version ?? "unknown",
      build_number:
        Constants.expoConfig?.ios?.buildNumber ??
        Constants.expoConfig?.android?.versionCode?.toString() ??
        null,
      platform: Platform.OS,
    });
    setIsSubmitting(false);

    if (error) {
      Alert.alert("전송 실패", "잠시 후 다시 시도해 주세요.");
      return;
    }
    Alert.alert("신고 접수", "보내주신 내용은 제품 개선에만 사용합니다.", [
      { text: "확인", onPress: () => router.back() },
    ]);
  };

  return (
    <SettingsScaffold
      eyebrow="PRIVATE FEEDBACK"
      title="문제 신고"
      description="문제를 재현하는 데 필요한 최소한의 내용만 받습니다."
    >
      <View className="px-5 pb-8">
        <Text
          className="text-sm"
          style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
        >
          어떤 부분인가요?
        </Text>
        <View className="mt-3 flex-row flex-wrap">
          {CATEGORIES.map((item) => {
            const selected = item.key === category;
            return (
              <TouchableOpacity
                key={item.key}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setCategory(item.key)}
                className="mb-2 mr-2 border px-3 py-2"
                style={{
                  borderColor: selected
                    ? FIELD_COLORS.teal
                    : FIELD_COLORS.rule,
                  backgroundColor: selected ? "#EAF4F1" : "#fff",
                }}
              >
                <Text
                  style={{
                    color: selected
                      ? FIELD_COLORS.teal
                      : FIELD_COLORS.ink,
                    fontFamily: bodyExtraBoldFont,
                  }}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text
          className="mt-5 text-sm"
          style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
        >
          문제 내용
        </Text>
        <TextInput
          accessibilityLabel="문제 신고 내용"
          value={message}
          onChangeText={setMessage}
          maxLength={500}
          multiline
          placeholder="무엇을 하던 중 어떤 문제가 생겼는지 적어 주세요."
          placeholderTextColor={FIELD_COLORS.muted}
          className="mt-2 min-h-36 border bg-white px-4 py-3"
          style={{
            borderColor: FIELD_COLORS.rule,
            color: FIELD_COLORS.ink,
            fontFamily: bodyFont,
            textAlignVertical: "top",
          }}
        />
        <Text
          className="mt-2 text-right text-xs"
          style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
        >
          {message.length} / 500
        </Text>

        <View
          className="mt-5 border-l-4 bg-white px-4 py-3"
          style={{ borderLeftColor: FIELD_COLORS.orange }}
        >
          <Text
            className="text-xs leading-5"
            style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
          >
            사진·위치 좌표·이메일·전화번호는 수집하지 않습니다. 신고 내용에도
            개인정보를 적지 말아 주세요.
          </Text>
        </View>

        <TouchableOpacity
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={submit}
          className="mt-6 items-center py-4"
          style={{ backgroundColor: FIELD_COLORS.teal }}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              className="text-white"
              style={{ fontFamily: bodyExtraBoldFont }}
            >
              최소 정보로 신고 보내기
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SettingsScaffold>
  );
}
