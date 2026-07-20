import type { ReactNode } from "react";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
  bodySemiBoldFont,
  monoFont,
} from "@/src/theme/fieldJournal";

export const SettingsScaffold = ({
  title,
  eyebrow,
  description,
  children,
}: {
  title: string;
  eyebrow: string;
  description?: string;
  children: ReactNode;
}) => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: FIELD_COLORS.foam }}
      contentContainerStyle={{
        paddingTop: insets.top + 12,
        paddingBottom: insets.bottom + 36,
        paddingHorizontal: 24,
      }}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="이전 화면"
        onPress={() => router.back()}
        className="py-3"
      >
        <Text style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}>
          ← 돌아가기
        </Text>
      </TouchableOpacity>
      <Text
        className="mt-4 text-[10px] tracking-[1.8px]"
        style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}
      >
        {eyebrow}
      </Text>
      <Text
        className="mt-2 text-[34px] leading-[42px]"
        style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          className="mt-3 text-sm leading-6"
          style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
        >
          {description}
        </Text>
      ) : null}
      <View
        className="mt-6 border-t"
        style={{ borderColor: FIELD_COLORS.rule }}
      >
        {children}
      </View>
    </ScrollView>
  );
};

export const SettingsLinkRow = ({
  icon,
  label,
  value,
  color = FIELD_COLORS.ink,
  onPress,
}: {
  icon: React.ComponentProps<typeof FontAwesome>["name"];
  label: string;
  value?: string;
  color?: string;
  onPress: () => void;
}) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    className="flex-row items-center border-b py-5"
    style={{ borderColor: FIELD_COLORS.rule }}
  >
    <View className="h-8 w-10 items-center justify-center">
      <FontAwesome name={icon} size={21} color={color} />
    </View>
    <View className="min-w-0 flex-1 px-2">
      <Text
        className="text-base"
        style={{ color, fontFamily: bodySemiBoldFont }}
      >
        {label}
      </Text>
      {value ? (
        <Text
          className="mt-1 text-xs"
          style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
        >
          {value}
        </Text>
      ) : null}
    </View>
    <FontAwesome name="long-arrow-right" size={20} color={color} />
  </TouchableOpacity>
);
