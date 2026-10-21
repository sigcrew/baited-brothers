import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { router } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useAuth } from "@/src/contexts/AuthContext";
import { useFieldNotice } from "@/src/contexts/FieldNoticeContext";
import {
  FIELD_COLORS,
  bodySemiBoldFont,
} from "@/src/theme/fieldJournal";

type GoogleSignInButtonProps = {
  fieldJournal?: boolean;
};

// iOS에서는 바로 위에 시스템이 그리는 Apple 버튼(높이 54pt)이 있다. 그 버튼 글자는
// 시스템 글꼴·검정·약 20pt라서, 나란히 놓인 Google 버튼 글자도 같은 모양으로 맞춘다.
// Android에는 Apple 버튼이 없으니 앱 글꼴을 그대로 쓴다.
export const fieldJournalGoogleLabelStyle = () =>
  Platform.OS === "ios"
    ? { color: "#000000", fontSize: 20, fontWeight: "500" as const, lineHeight: 26 }
    : {
        color: FIELD_COLORS.ink,
        fontFamily: bodySemiBoldFont,
        fontSize: 16,
        includeFontPadding: false,
        // 16px Noto Sans의 g·p 꼬리가 들어가도록 1.5배. 20이면 Android에서 잘린다.
        lineHeight: 24,
      };

const GoogleSignInButton = ({ fieldJournal = false }: GoogleSignInButtonProps) => {
  const { signInWithGoogle } = useAuth();
  const { alert } = useFieldNotice();
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = async () => {
    if (Platform.OS === "web") {
      await alert({ eyebrow: "GOOGLE LOGIN · NOTICE", title: "웹에서는 지원하지 않습니다", message: "Google 로그인은 iOS/Android 앱에서만 사용할 수 있습니다." });
      return;
    }

    setIsLoading(true);
    const { error } = await signInWithGoogle();
    setIsLoading(false);

    if (error) {
      if (error.message?.includes("취소")) return;
      await alert({ eyebrow: "GOOGLE LOGIN · ERROR", title: "Google 로그인 실패", message: error.message });
      return;
    }

    router.replace("/(tabs)");
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isLoading}
      activeOpacity={0.72}
      className={`flex-row items-center justify-center border bg-white ${
        fieldJournal ? "h-[54px] rounded-[4px]" : "rounded-xl py-3"
      }`}
      style={{
        borderColor: fieldJournal ? FIELD_COLORS.ink : "#D1D5DB",
        opacity: isLoading ? 0.65 : 1,
      }}
      accessibilityRole="button"
      accessibilityLabel="Google로 계속하기"
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#4285F4" />
      ) : (
        <>
          {fieldJournal ? (
            <FontAwesome
              name="google"
              size={Platform.OS === "ios" ? 20 : 18}
              color="#4285F4"
              style={{ marginRight: 10 }}
            />
          ) : (
            <View className="mr-3 h-5 w-5 items-center justify-center rounded-full bg-[#4285F4]">
              <Text className="text-xs font-bold text-white">G</Text>
            </View>
          )}
          <Text
            className={fieldJournal ? undefined : "font-medium text-gray-700"}
            style={fieldJournal ? fieldJournalGoogleLabelStyle() : undefined}
          >
            Google로 계속하기
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

export default GoogleSignInButton;
