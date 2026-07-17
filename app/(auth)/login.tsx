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
  Image,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Link, router } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/src/contexts/AuthContext";
import AppleSignInButton from "@/components/auth/AppleSignInButton";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import {
  FIELD_COLORS,
  bodyFont,
  bodySemiBoldFont,
  bodyExtraBoldFont,
  displayFont,
  monoFont,
} from "@/src/theme/fieldJournal";

type FieldName = "email" | "password" | null;

const AppIconMark = () => (
  <View
    className="h-[66px] w-[64px] overflow-hidden"
    accessibilityRole="image"
    accessibilityLabel="낚시당한 녀석들 앱 아이콘"
  >
    <Image
      source={require("@/assets/images/adaptive-icon-baited.png")}
      resizeMode="cover"
      style={{
        position: "absolute",
        left: -22,
        top: -21,
        width: 108,
        height: 108,
      }}
    />
  </View>
);

const JournalRule = () => (
  <View className="mt-6 flex-row items-center">
    <View className="h-px flex-1" style={{ backgroundColor: FIELD_COLORS.rule }} />
    {Array.from({ length: 13 }).map((_, index) => (
      <View
        key={index}
        className="absolute top-0 w-px"
        style={{
          left: `${index * 8}%`,
          height: index % 4 === 0 ? 8 : 5,
          backgroundColor: FIELD_COLORS.rule,
        }}
      />
    ))}
    <CircleRuleEnd />
  </View>
);

const CircleRuleEnd = () => (
  <View
    className="absolute right-0 h-[7px] w-[7px] rounded-full border"
    style={{ borderColor: FIELD_COLORS.muted, backgroundColor: FIELD_COLORS.foam }}
  />
);

const LoginScreen = () => {
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeField, setActiveField] = useState<FieldName>(null);
  const [showPassword, setShowPassword] = useState(false);

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
      className="flex-1"
      style={{ backgroundColor: FIELD_COLORS.foam }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          paddingTop: Math.max(insets.top + 18, 34),
          paddingBottom: Math.max(insets.bottom + 24, 32),
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full max-w-[540px]">
          <View className="flex-row items-center justify-center">
            <AppIconMark />
            <Text
              className="ml-1 text-[27px] leading-[36px] tracking-[-0.9px]"
              style={{ color: FIELD_COLORS.ink, fontFamily: displayFont }}
            >
              낚시당한 녀석들
            </Text>
          </View>

          <View className="mt-7">
            <Text
              className="text-[41px] leading-[54px] tracking-[-1.3px]"
              style={{ color: FIELD_COLORS.ink, fontFamily: displayFont }}
            >
              잡은 순간부터,{"\n"}기록은 시작됩니다.
            </Text>
            <Text
              className="mt-3 text-[14px] leading-6"
              style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont }}
            >
              출조와 조과, 발견한 어종을 한곳에 남겨보세요.
            </Text>
          </View>

          <JournalRule />

          <View className="mt-7">
            <Text style={styles.label}>이메일</Text>
            <View
              className="mt-2 h-[54px] justify-center rounded-[4px] border bg-white px-4"
              style={{
                borderColor:
                  activeField === "email" ? FIELD_COLORS.teal : FIELD_COLORS.rule,
                borderWidth: activeField === "email" ? 1.5 : 1,
              }}
            >
              <TextInput
                className="h-full text-[15px]"
                style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont, outlineStyle: "none" } as never}
                placeholder="이메일 주소"
                placeholderTextColor="#93A2A5"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setActiveField("email")}
                onBlur={() => setActiveField(null)}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                returnKeyType="next"
                editable={!isSubmitting}
              />
            </View>

            <Text className="mt-5" style={styles.label}>비밀번호</Text>
            <View
              className="mt-2 h-[54px] flex-row items-center rounded-[4px] border bg-white pl-4 pr-2"
              style={{
                borderColor:
                  activeField === "password" ? FIELD_COLORS.teal : FIELD_COLORS.rule,
                borderWidth: activeField === "password" ? 1.5 : 1,
              }}
            >
              <TextInput
                className="h-full flex-1 text-[15px]"
                style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont, outlineStyle: "none" } as never}
                placeholder="비밀번호 입력"
                placeholderTextColor="#93A2A5"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setActiveField("password")}
                onBlur={() => setActiveField(null)}
                secureTextEntry={!showPassword}
                autoComplete="password"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                editable={!isSubmitting}
              />
              <TouchableOpacity
                onPress={() => setShowPassword((value) => !value)}
                className="h-10 w-10 items-center justify-center"
                accessibilityRole="button"
                accessibilityLabel={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
              >
                <FontAwesome
                  name={showPassword ? "eye-slash" : "eye"}
                  size={19}
                  color={FIELD_COLORS.muted}
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            className="mt-7 h-[54px] items-center justify-center rounded-[4px]"
            style={{
              backgroundColor: FIELD_COLORS.teal,
              opacity: isSubmitting ? 0.68 : 1,
            }}
            activeOpacity={0.78}
            onPress={handleLogin}
            disabled={isSubmitting}
            accessibilityRole="button"
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text
                className="text-[17px] text-white"
                style={{ fontFamily: bodyExtraBoldFont }}
              >
                로그인
              </Text>
            )}
          </TouchableOpacity>

          <View className="my-6 flex-row items-center">
            <View className="h-px flex-1" style={{ backgroundColor: FIELD_COLORS.rule }} />
            <Text
              className="mx-4 text-[12px]"
              style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}
            >
              또는
            </Text>
            <View className="h-px flex-1" style={{ backgroundColor: FIELD_COLORS.rule }} />
          </View>

          {Platform.OS === "ios" ? (
            <View className="mb-3">
              <AppleSignInButton fieldJournal />
            </View>
          ) : null}
          <GoogleSignInButton fieldJournal />

          <View className="mt-7 flex-row items-center justify-center">
            <Text
              className="text-[14px]"
              style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont }}
            >
              아직 계정이 없나요?{" "}
            </Text>
            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity disabled={isSubmitting} accessibilityRole="link">
                <Text
                  className="border-b pb-0.5 text-[14px]"
                  style={{
                    borderColor: FIELD_COLORS.teal,
                    color: FIELD_COLORS.teal,
                    fontFamily: bodySemiBoldFont,
                  }}
                >
                  회원가입
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  label: {
    color: FIELD_COLORS.ink,
    fontFamily: bodySemiBoldFont,
    fontSize: 13,
    lineHeight: 20,
  },
});

export default LoginScreen;
