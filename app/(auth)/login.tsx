import { useState } from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { Link, router } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import AppleSignInButton from "@/components/auth/AppleSignInButton";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import {
  AuthBrand,
  AuthDivider,
  AuthErrorBox,
  AuthHeadline,
  AuthInlineLink,
  AuthPolicyNotice,
  AuthPrimaryButton,
  AuthScreen,
  AuthTextField,
  JournalRule,
} from "@/components/auth/FieldJournalAuth";
import { authErrorMessage } from "@/src/lib/authErrors";
import { FIELD_COLORS, bodyFont, bodySemiBoldFont } from "@/src/theme/fieldJournal";

const LoginScreen = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // 홈에서 push로 들어왔을 때만 닫기 버튼을 보여 준다. 앱 시작 시 Redirect로 온 경우에는
  // 돌아갈 화면이 없다.
  const canGoBack = router.canGoBack();

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setFormError("이메일과 비밀번호를 모두 입력해 주세요.");
      return;
    }

    setIsSubmitting(true);
    const { error } = await signIn(email.trim(), password);
    setIsSubmitting(false);

    if (error) {
      setFormError(authErrorMessage(error, "로그인하지 못했습니다. 잠시 후 다시 시도해 주세요."));
      return;
    }
    setFormError(null);
    router.replace("/(tabs)");
  };

  return (
    <AuthScreen showBack={canGoBack}>
      <AuthBrand />
      <AuthHeadline
        title={"잡은 순간부터,\n기록은 시작됩니다."}
        subtitle="출조와 조과, 발견한 어종을 한곳에 남겨보세요."
      />
      <JournalRule />

      <View className="mt-7">
        <AuthTextField
          first
          label="이메일"
          placeholder="이메일 주소"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (formError) setFormError(null);
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          editable={!isSubmitting}
        />
        <AuthTextField
          secure
          label="비밀번호"
          placeholder="비밀번호 입력"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (formError) setFormError(null);
          }}
          autoComplete="password"
          textContentType="password"
          returnKeyType="done"
          onSubmitEditing={handleLogin}
          editable={!isSubmitting}
        />
        <View className="mt-3 flex-row justify-end">
          <Link href="/(auth)/forgot-password" asChild>
            <TouchableOpacity disabled={isSubmitting} accessibilityRole="link">
              <Text
                className="text-[13px]"
                style={{ color: FIELD_COLORS.muted, fontFamily: bodySemiBoldFont }}
              >
                비밀번호를 잊으셨나요?
              </Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>

      <AuthErrorBox message={formError} />
      <AuthPrimaryButton label="로그인" onPress={handleLogin} busy={isSubmitting} />

      <AuthDivider />

      {Platform.OS === "ios" ? (
        <View className="mb-3">
          <AppleSignInButton fieldJournal />
        </View>
      ) : null}
      <GoogleSignInButton fieldJournal />

      <View className="mt-7 flex-row items-center justify-center">
        <Text className="text-[14px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont }}>
          아직 계정이 없나요?{" "}
        </Text>
        <AuthInlineLink
          label="회원가입"
          disabled={isSubmitting}
          onPress={() => router.push("/(auth)/signup")}
        />
      </View>

      <AuthPolicyNotice action="로그인하면" />
    </AuthScreen>
  );
};

export default LoginScreen;
