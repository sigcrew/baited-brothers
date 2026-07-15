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

const SignupScreen = () => {
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignup = async () => {
    if (!email.trim() || !password || !passwordConfirm) {
      Alert.alert("입력 오류", "모든 항목을 입력해주세요.");
      return;
    }

    if (password.length < 6) {
      Alert.alert("입력 오류", "비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    if (password !== passwordConfirm) {
      Alert.alert("입력 오류", "비밀번호가 일치하지 않습니다.");
      return;
    }

    setIsSubmitting(true);
    const { error, session } = await signUp(email.trim(), password);
    setIsSubmitting(false);

    if (error) {
      Alert.alert("회원가입 실패", error.message);
      return;
    }

    if (session) {
      router.replace("/(tabs)");
    } else {
      Alert.alert(
        "이메일 확인",
        "가입한 이메일로 확인 링크가 발송되었습니다. 이메일을 확인해주세요.",
        [{ text: "확인", onPress: () => router.replace("/(auth)/login") }]
      );
    }
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
          <Text className="text-3xl font-bold text-gray-900">회원가입</Text>
          <Text className="mt-2 text-gray-600">이메일로 가입하고 시작하세요</Text>
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
          className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base"
          placeholder="비밀번호 (6자 이상)"
          placeholderTextColor="#9ca3af"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          editable={!isSubmitting}
        />

        <TextInput
          className="mb-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base"
          placeholder="비밀번호 확인"
          placeholderTextColor="#9ca3af"
          value={passwordConfirm}
          onChangeText={setPasswordConfirm}
          secureTextEntry
          autoComplete="new-password"
          editable={!isSubmitting}
        />

        <TouchableOpacity
          className="rounded-xl bg-blue-600 py-3 active:bg-blue-700"
          onPress={handleSignup}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-center font-semibold text-white">가입하기</Text>
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
          <Text className="text-gray-600">이미 계정이 있으신가요? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity disabled={isSubmitting}>
              <Text className="font-semibold text-blue-600">로그인</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default SignupScreen;
