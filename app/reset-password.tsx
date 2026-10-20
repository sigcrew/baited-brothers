import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/src/contexts/AuthContext";
import { supabase } from "@/src/lib/supabase";
import { parseGoogleAuthCallback } from "@/src/lib/googleAuthCallback";
import { passwordResetErrorMessage, validateNewPassword } from "@/src/lib/passwordReset";
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
import { FIELD_COLORS, bodyFont } from "@/src/theme/fieldJournal";

type ResetParams = {
  code: string | string[];
  error: string | string[];
  error_description: string | string[];
  "#": string | string[];
};

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/**
 * 재설정 메일 링크가 baited-brothers://reset-password?code=... 로 돌아오면 code를
 * 세션으로 바꾼 뒤 새 비밀번호를 받는다. (auth) 그룹 밖에 두는 이유: 그 그룹의
 * 레이아웃은 세션이 생기는 순간 탭으로 Redirect해 버려서 비밀번호를 정할 수 없다.
 */
const ResetPasswordScreen = () => {
  const params = useLocalSearchParams<ResetParams>();
  const { session, updatePassword } = useAuth();
  const [phase, setPhase] = useState<"verifying" | "ready" | "failed" | "done">("verifying");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const started = useRef(false);

  const code = first(params.code);
  const providerError = first(params.error_description) ?? first(params.error);
  const fragment = first(params["#"]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const verify = async () => {
      if (providerError) {
        setLinkError(passwordResetErrorMessage({ message: providerError }));
        setPhase("failed");
        return;
      }
      const callback = code ? `code=${encodeURIComponent(code)}` : fragment ?? "";
      const parsed = parseGoogleAuthCallback(callback);
      if (parsed.kind === "error") {
        // 이미 로그인된 사용자가 설정에서 들어온 경우처럼, 링크 없이도 세션이 있으면 진행.
        if (session) {
          setPhase("ready");
          return;
        }
        setLinkError("재설정 링크가 올바르지 않습니다. 메일을 다시 요청해 주세요.");
        setPhase("failed");
        return;
      }
      const { error } =
        parsed.kind === "code"
          ? await supabase.auth.exchangeCodeForSession(parsed.code)
          : await supabase.auth.setSession({
              access_token: parsed.accessToken,
              refresh_token: parsed.refreshToken,
            });
      if (error) {
        setLinkError(passwordResetErrorMessage(error));
        setPhase("failed");
        return;
      }
      setPhase("ready");
    };
    void verify();
  }, [code, fragment, providerError, session]);

  const handleSubmit = async () => {
    const validationError = validateNewPassword(password, confirm);
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setIsSubmitting(true);
    const { error } = await updatePassword(password);
    setIsSubmitting(false);
    if (error) {
      setFormError(passwordResetErrorMessage(error));
      return;
    }
    setFormError(null);
    setPhase("done");
  };

  return (
    <AuthScreen>
      <AuthBrand />
      <AuthHeadline
        title={phase === "done" ? "비밀번호를\n바꿨습니다." : "새 비밀번호를\n정해 주세요."}
        subtitle={
          phase === "done"
            ? "지금부터 새 비밀번호로 로그인됩니다."
            : "6자 이상으로, 이전과 다른 비밀번호를 입력해 주세요."
        }
      />
      <JournalRule />

      {phase === "verifying" ? (
        <View className="mt-10 items-center">
          <ActivityIndicator color={FIELD_COLORS.teal} />
          <Text className="mt-3 text-[13px]" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
            재설정 링크를 확인하는 중입니다.
          </Text>
        </View>
      ) : null}

      {phase === "failed" ? (
        <>
          <AuthErrorBox message={linkError} />
          <AuthPrimaryButton
            label="재설정 메일 다시 요청"
            onPress={() => router.replace("/(auth)/forgot-password")}
          />
          <View className="mt-7 flex-row justify-center">
            <AuthInlineLink label="로그인으로 돌아가기" onPress={() => router.replace("/(auth)/login")} />
          </View>
        </>
      ) : null}

      {phase === "ready" ? (
        <>
          <View className="mt-7">
            <AuthTextField
              first
              secure
              label="새 비밀번호"
              placeholder="6자 이상"
              value={password}
              onChangeText={(value) => {
                setPassword(value);
                if (formError) setFormError(null);
              }}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="next"
              editable={!isSubmitting}
            />
            <AuthTextField
              secure
              label="새 비밀번호 확인"
              placeholder="같은 비밀번호를 한 번 더"
              value={confirm}
              onChangeText={(value) => {
                setConfirm(value);
                if (formError) setFormError(null);
              }}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              editable={!isSubmitting}
            />
          </View>
          <AuthErrorBox message={formError} />
          <AuthPrimaryButton label="비밀번호 변경" onPress={handleSubmit} busy={isSubmitting} />
        </>
      ) : null}

      {phase === "done" ? (
        <AuthPrimaryButton label="기록장으로 가기" onPress={() => router.replace("/(tabs)")} />
      ) : null}
    </AuthScreen>
  );
};

export default ResetPasswordScreen;
