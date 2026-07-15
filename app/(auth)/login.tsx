import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import { Link, router } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import AppleSignInButton from "@/components/auth/AppleSignInButton";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

const LoginScreen = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert("입력 오류", "이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setIsSubmitting(false);

    if (error) {
      Alert.alert("로그인 실패", error.message);
      return;
    }

    router.replace("/(tabs)");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-12">
          <Text className="text-3xl font-bold text-gray-900">낚시당한 녀석들</Text>
          <Text className="mt-2 text-gray-600">로그인하여 기록을 관리하세요</Text>
        </View>

        <TextInput
          className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base"
          placeholder="이메일"
          placeholderTextColor="#9ca3af"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          editable={!isSubmitting}
        />

        <TextInput
          className="mb-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base"
          placeholder="비밀번호"
          placeholderTextColor="#9ca3af"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          editable={!isSubmitting}
        />

        <TouchableOpacity
          className="rounded-xl bg-blue-600 py-3 active:bg-blue-700"
          onPress={handleLogin}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-center font-semibold text-white">로그인</Text>
          )}
        </TouchableOpacity>

        <View className="mb-6 mt-8 flex-row items-center">
          <View className="h-px flex-1 bg-gray-200" />
          <Text className="mx-4 text-sm text-gray-500">또는</Text>
          <View className="h-px flex-1 bg-gray-200" />
        </View>

        {Platform.OS === "ios" && (
          <View className="mb-4">
            <AppleSignInButton />
          </View>
        )}
        <GoogleSignInButton />

        <View className="mt-8 flex-row justify-center">
          <Text className="text-gray-600">계정이 없으신가요? </Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity disabled={isSubmitting}>
              <Text className="font-semibold text-blue-600">회원가입</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;
