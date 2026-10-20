import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import {
  AuthBrand,
  AuthErrorBox,
  AuthHeadline,
  AuthInlineLink,
  AuthPrimaryButton,
  AuthScreen,
  AuthTextField,
  JournalRule,
} from "@/components/auth/FieldJournalAuth";
import { passwordResetErrorMessage, validateResetEmail } from "@/src/lib/passwordReset";
import { FIELD_COLORS, bodyFont, bodyExtraBoldFont, monoFont } from "@/src/theme/fieldJournal";

const ForgotPasswordScreen = () => {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSubmit = async () => {
    const validationError = validateResetEmail(email);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setIsSubmitting(true);
    const { error } = await requestPasswordReset(email.trim());
    setIsSubmitting(false);
    if (error) {
      setFormError(passwordResetErrorMessage(error));
      return;
    }
    setFormError(null);
    setSentTo(email.trim());
  };

  return (
    <AuthScreen showBack={router.canGoBack()}>
      <AuthBrand />
      <AuthHeadline
        title={"비밀번호를\n다시 정합니다."}
        subtitle="가입한 이메일로 재설정 링크를 보내 드립니다. 링크를 열면 앱에서 새 비밀번호를 정할 수 있습니다."
      />
      <JournalRule />

      {sentTo ? (
        <View className="mt-7 border-l-4 bg-white px-4 py-4" style={{ borderLeftColor: FIELD_COLORS.teal }}>
          <Text className="text-[11px] tracking-[1px]" style={{ color: FIELD_COLORS.teal, fontFamily: monoFont }}>
            RESET LINK SENT
          </Text>
          <Text className="mt-2 text-[16px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}>
            메일을 확인해 주세요
          </Text>
          <Text className="mt-1 text-[13px] leading-5" style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont }}>
            {sentTo} 로 재설정 링크를 보냈습니다. 메일이 보이지 않으면 스팸함을 확인하거나 잠시 후 다시 요청해 주세요.
          </Text>
          <View className="mt-4 flex-row">
            <AuthInlineLink label="로그인으로 돌아가기" onPress={() => router.replace("/(auth)/login")} />
          </View>
        </View>
      ) : (
        <>
          <View className="mt-7">
            <AuthTextField
              first
              label="이메일"
              placeholder="가입한 이메일 주소"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                if (formError) setFormError(null);
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="send"
              onSubmitEditing={handleSubmit}
              editable={!isSubmitting}
            />
          </View>
          <AuthErrorBox message={formError} />
          <AuthPrimaryButton label="재설정 링크 보내기" onPress={handleSubmit} busy={isSubmitting} />
          <View className="mt-7 flex-row items-center justify-center">
            <Text className="text-[14px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont }}>
              비밀번호가 기억나셨나요?{" "}
            </Text>
            <AuthInlineLink
              label="로그인"
              disabled={isSubmitting}
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/(auth)/login"))}
            />
          </View>
        </>
      )}
    </AuthScreen>
  );
};

export default ForgotPasswordScreen;
