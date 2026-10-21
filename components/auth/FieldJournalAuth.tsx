import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
  bodySemiBoldFont,
  displayFont,
  monoFont,
} from "@/src/theme/fieldJournal";

/**
 * 로그인·회원가입·비밀번호 재설정 화면이 공유하는 필드 저널 스타일 조각들.
 * 로그인 화면에 있던 구성을 그대로 꺼내 회원가입 화면이 같은 룩을 쓰게 했다.
 */

export const AppIconMark = () => (
  <View
    className="h-[66px] w-[64px] overflow-hidden"
    accessibilityRole="image"
    accessibilityLabel="낚시당한 녀석들 앱 아이콘"
  >
    <Image
      source={require("@/assets/images/adaptive-icon-baited.png")}
      resizeMode="cover"
      style={{ position: "absolute", left: -22, top: -21, width: 108, height: 108 }}
    />
  </View>
);

export const JournalRule = () => (
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
    <View
      className="absolute right-0 h-[7px] w-[7px] rounded-full border"
      style={{ borderColor: FIELD_COLORS.muted, backgroundColor: FIELD_COLORS.foam }}
    />
  </View>
);

export const AuthDivider = ({ label = "또는" }: { label?: string }) => (
  <View className="my-6 flex-row items-center">
    <View className="h-px flex-1" style={{ backgroundColor: FIELD_COLORS.rule }} />
    <Text className="mx-4 text-[12px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
      {label}
    </Text>
    <View className="h-px flex-1" style={{ backgroundColor: FIELD_COLORS.rule }} />
  </View>
);

type AuthScreenProps = {
  children: ReactNode;
  /** 스택에 이전 화면이 있을 때만 좌상단에 닫기 버튼을 보여 준다. */
  showBack?: boolean;
  backLabel?: string;
};

export const AuthScreen = ({ children, showBack = false, backLabel = "닫기" }: AuthScreenProps) => {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1"
      style={{ backgroundColor: FIELD_COLORS.foam }}
    >
      {showBack ? (
        <View
          className="absolute left-0 z-10 px-3"
          style={{ top: insets.top + 6 }}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="이전 화면으로 돌아가기"
            onPress={() => router.back()}
            className="h-10 flex-row items-center px-2"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <FontAwesome name="angle-left" size={22} color={FIELD_COLORS.ink} />
            <Text className="ml-1.5 text-[14px]" style={{ color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}>
              {backLabel}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          paddingTop: Math.max(insets.top + (showBack ? 54 : 18), 34),
          paddingBottom: Math.max(insets.bottom + 24, 32),
          paddingHorizontal: 24,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="w-full max-w-[540px]">{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export const AuthBrand = () => (
  <View className="flex-row items-center justify-center">
    <AppIconMark />
    <Text
      className="ml-1 text-[27px] leading-[36px] tracking-[-0.9px]"
      style={{ color: FIELD_COLORS.ink, fontFamily: displayFont }}
    >
      낚시당한 녀석들
    </Text>
  </View>
);

export const AuthHeadline = ({ title, subtitle }: { title: string; subtitle?: string }) => (
  <View className="mt-7">
    <Text
      className="text-[41px] leading-[54px] tracking-[-1.3px]"
      style={{ color: FIELD_COLORS.ink, fontFamily: displayFont }}
    >
      {title}
    </Text>
    {subtitle ? (
      <Text className="mt-3 text-[14px] leading-6" style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont }}>
        {subtitle}
      </Text>
    ) : null}
  </View>
);

type AuthTextFieldProps = Omit<TextInputProps, "style"> & {
  label: string;
  /** 비밀번호 필드: 보기/숨기기 토글을 붙인다. */
  secure?: boolean;
  first?: boolean;
};

export const AuthTextField = ({ label, secure = false, first = false, ...inputProps }: AuthTextFieldProps) => {
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  return (
    <View className={first ? "" : "mt-5"}>
      <Text style={authStyles.label}>{label}</Text>
      <View
        className="mt-2 h-[54px] flex-row items-center rounded-[4px] border bg-white pl-4"
        style={{
          paddingRight: secure ? 8 : 16,
          borderColor: focused ? FIELD_COLORS.teal : FIELD_COLORS.rule,
          borderWidth: focused ? 1.5 : 1,
        }}
      >
        <TextInput
          className="h-full flex-1 text-[15px]"
          style={{
            color: FIELD_COLORS.ink,
            fontFamily: bodyFont,
            includeFontPadding: false,
            // 15px 입력값의 g·y·@ 꼬리가 잘리지 않게 넉넉히 둔다.
            lineHeight: 22,
            outlineStyle: "none",
            paddingVertical: 0,
            textAlignVertical: "center",
          } as never}
          placeholderTextColor="#93A2A5"
          secureTextEntry={secure && !visible}
          {...inputProps}
          onFocus={(event) => {
            setFocused(true);
            inputProps.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            inputProps.onBlur?.(event);
          }}
        />
        {secure ? (
          <TouchableOpacity
            onPress={() => setVisible((value) => !value)}
            className="h-10 w-10 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel={visible ? "비밀번호 숨기기" : "비밀번호 보기"}
          >
            <FontAwesome name={visible ? "eye-slash" : "eye"} size={19} color={FIELD_COLORS.muted} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

export const AuthErrorBox = ({ message }: { message: string | null }) =>
  message ? (
    <View className="mt-4 border-l-4 bg-white px-4 py-3" style={{ borderLeftColor: FIELD_COLORS.orange }}>
      <Text
        accessibilityLiveRegion="polite"
        className="text-[13px] leading-5"
        style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont }}
      >
        {message}
      </Text>
    </View>
  ) : null;

export const AuthPrimaryButton = ({
  label,
  onPress,
  busy = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}) => (
  <TouchableOpacity
    className="mt-7 h-[54px] items-center justify-center rounded-[4px]"
    style={{ backgroundColor: FIELD_COLORS.teal, opacity: busy || disabled ? 0.68 : 1 }}
    activeOpacity={0.78}
    onPress={onPress}
    disabled={busy || disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    {busy ? (
      <ActivityIndicator color="white" />
    ) : (
      <Text className="text-[17px] text-white" style={{ fontFamily: bodyExtraBoldFont }}>
        {label}
      </Text>
    )}
  </TouchableOpacity>
);

export const AuthInlineLink = ({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) => (
  <TouchableOpacity onPress={onPress} disabled={disabled} accessibilityRole="link">
    <Text
      className="border-b pb-0.5 text-[14px]"
      style={{ borderColor: FIELD_COLORS.teal, color: FIELD_COLORS.teal, fontFamily: bodySemiBoldFont }}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

/** 가입·로그인 하단의 개인정보 처리방침 고지. 앱 내 /privacy 화면으로 연결한다. */
export const AuthPolicyNotice = ({ action = "계속하면" }: { action?: string }) => (
  <View className="mt-6 flex-row flex-wrap items-center justify-center">
    <Text className="text-[12px] leading-5" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
      {action} 낚시당한 녀석들의{" "}
    </Text>
    <TouchableOpacity onPress={() => router.push("/privacy")} accessibilityRole="link">
      <Text
        className="border-b text-[12px] leading-5"
        style={{ borderColor: FIELD_COLORS.muted, color: FIELD_COLORS.ink, fontFamily: bodySemiBoldFont }}
      >
        개인정보 처리방침
      </Text>
    </TouchableOpacity>
    <Text className="text-[12px] leading-5" style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}>
      에 동의하게 됩니다.
    </Text>
  </View>
);

export const authStyles = StyleSheet.create({
  label: {
    color: FIELD_COLORS.ink,
    fontFamily: bodySemiBoldFont,
    fontSize: 13,
    lineHeight: 20,
  },
});
