import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useAuth } from "@/src/contexts/AuthContext";
import {
  FIELD_COLORS,
  bodySemiBoldFont,
} from "@/src/theme/fieldJournal";

type GoogleSignInButtonProps = {
  fieldJournal?: boolean;
};

const GoogleSignInButton = ({ fieldJournal = false }: GoogleSignInButtonProps) => {
  const { signInWithGoogle } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = async () => {
    if (Platform.OS === "web") {
      Alert.alert(
        "웹 미지원",
        "Google 로그인은 iOS/Android 앱에서만 사용할 수 있습니다."
      );
      return;
    }

    setIsLoading(true);
    const { error } = await signInWithGoogle();
    setIsLoading(false);

    if (error) {
      if (error.message?.includes("취소")) return;
      Alert.alert("Google 로그인 실패", error.message);
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
        borderColor: fieldJournal ? FIELD_COLORS.rule : "#D1D5DB",
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
              size={19}
              color="#4285F4"
              style={{ marginRight: 12 }}
            />
          ) : (
            <View className="mr-3 h-5 w-5 items-center justify-center rounded-full bg-[#4285F4]">
              <Text className="text-xs font-bold text-white">G</Text>
            </View>
          )}
          <Text
            className={fieldJournal ? "text-[15px]" : "font-medium text-gray-700"}
            style={
              fieldJournal
                ? {
                    color: FIELD_COLORS.ink,
                    fontFamily: bodySemiBoldFont,
                  }
                : undefined
            }
          >
            Google로 계속하기
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

export default GoogleSignInButton;
