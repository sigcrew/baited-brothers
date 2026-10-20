import { useState } from "react";
import { Platform, Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { useFieldNotice } from "@/src/contexts/FieldNoticeContext";
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
import { validateNewPassword } from "@/src/lib/passwordReset";
import { FIELD_COLORS, bodyFont } from "@/src/theme/fieldJournal";

const SignupScreen = () => {
  const { signUp } = useAuth();
  const { alert } = useFieldNotice();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const clearError = () => {
    if (formError) setFormError(null);
  };

  const handleSignup = async () => {
    if (!email.trim()) {
      setFormError("이메일 주소를 입력해 주세요.");
      return;
    }
    const passwordError = validateNewPassword(password, passwordConfirm);
    if (passwordError) {
      setFormError(passwordError);
      return;
    }

    setIsSubmitting(true);
    const { error, session } = await signUp(email.trim(), password);
    setIsSubmitting(false);

    if (error) {
      setFormError(error.message);
      return;
    }
    setFormError(null);

    if (session) {
      router.replace("/(tabs)");
      return;
    }
    await alert({
      eyebrow: "ACCOUNT · EMAIL CHECK",
      title: "이메일을 확인해 주세요",
      message: "가입한 이메일로 확인 링크를 보냈습니다. 링크를 확인한 뒤 로그인해 주세요.",
    });
    router.replace("/(auth)/login");
  };

  return (
    <AuthScreen showBack={router.canGoBack()}>
      <AuthBrand />
      <AuthHeadline
        title={"첫 출조 전에,\n기록장을 준비하세요."}
        subtitle="이메일로 가입하면 출조·조과·도감이 한 계정에 모입니다."
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
            clearError();
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
          placeholder="6자 이상"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            clearError();
          }}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          editable={!isSubmitting}
        />
        <AuthTextField
          secure
          label="비밀번호 확인"
          placeholder="같은 비밀번호를 한 번 더"
          value={passwordConfirm}
          onChangeText={(value) => {
            setPasswordConfirm(value);
            clearError();
          }}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={handleSignup}
          editable={!isSubmitting}
        />
      </View>

      <AuthErrorBox message={formError} />
      <AuthPrimaryButton label="가입하기" onPress={handleSignup} busy={isSubmitting} />
      <AuthPolicyNotice action="가입하면" />

      <AuthDivider />

      {Platform.OS === "ios" ? (
        <View className="mb-3">
          <AppleSignInButton fieldJournal />
        </View>
      ) : null}
      <GoogleSignInButton fieldJournal />

      <View className="mt-7 flex-row items-center justify-center">
        <Text className="text-[14px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont }}>
          이미 계정이 있으신가요?{" "}
        </Text>
        <AuthInlineLink
          label="로그인"
          disabled={isSubmitting}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(auth)/login"))}
        />
      </View>
    </AuthScreen>
  );
};

export default SignupScreen;
