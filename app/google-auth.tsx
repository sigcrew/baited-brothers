import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";

type GoogleAuthParams = {
  "#": string | string[];
};

const GoogleAuthCallbackScreen = () => {
  const params = useLocalSearchParams<GoogleAuthParams>();
  const { session, completeGoogleSignIn } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasStarted = useRef(false);
  const fragment = Array.isArray(params["#"])
    ? params["#"][0]
    : params["#"];

  useEffect(() => {
    if (session) {
      router.replace("/(tabs)");
      return;
    }

    if (!fragment || hasStarted.current) return;
    hasStarted.current = true;
    let isActive = true;

    completeGoogleSignIn(fragment).then(({ error }) => {
      if (!isActive) return;
      if (error) {
        setErrorMessage(error.message);
        return;
      }
      router.replace("/(tabs)");
    });

    return () => {
      isActive = false;
    };
  }, [completeGoogleSignIn, fragment, session]);

  useEffect(() => {
    if (fragment || session) return;

    const timeout = setTimeout(() => {
      setErrorMessage("Google 로그인 정보를 확인할 수 없습니다.");
    }, 5000);

    return () => clearTimeout(timeout);
  }, [fragment, session]);

  return (
    <View className="flex-1 items-center justify-center bg-white px-8">
      {errorMessage ? (
        <>
          <Text className="mb-6 text-center text-base text-gray-700">
            {errorMessage}
          </Text>
          <TouchableOpacity
            className="rounded-xl bg-emerald-700 px-6 py-3"
            onPress={() => router.replace("/(auth)/login")}
            accessibilityRole="button"
            accessibilityLabel="로그인 화면으로 돌아가기"
          >
            <Text className="font-semibold text-white">
              로그인 화면으로 돌아가기
            </Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color="#047857" />
          <Text className="mt-4 text-gray-600">
            Google 로그인을 완료하는 중입니다.
          </Text>
        </>
      )}
    </View>
  );
};

export default GoogleAuthCallbackScreen;
