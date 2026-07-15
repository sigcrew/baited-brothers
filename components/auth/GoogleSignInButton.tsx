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
import { useAuth } from "@/src/contexts/AuthContext";

const GoogleSignInButton = () => {
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
      className="flex-row items-center justify-center rounded-xl border border-gray-300 bg-white py-3 active:bg-gray-50"
    >
      {isLoading ? (
        <ActivityIndicator size="small" color="#4285F4" />
      ) : (
        <>
          <View className="mr-3 h-5 w-5 items-center justify-center rounded-full bg-[#4285F4]">
            <Text className="text-xs font-bold text-white">G</Text>
          </View>
          <Text className="font-medium text-gray-700">Google로 계속하기</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

export default GoogleSignInButton;
