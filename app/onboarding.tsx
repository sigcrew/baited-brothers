import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/src/contexts/AuthContext";
import { markOnboardingSeen, ONBOARDING_SLIDES, type OnboardingSlide } from "@/src/lib/onboarding";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
  bodySemiBoldFont,
  displayFont,
  monoFont,
} from "@/src/theme/fieldJournal";

const Slide = ({ slide, width }: { slide: OnboardingSlide; width: number }) => (
  <View style={{ width }} className="flex-1 justify-center px-8">
    <View
      className="h-24 w-24 items-center justify-center rounded-full"
      style={{ backgroundColor: FIELD_COLORS.paper, borderWidth: 1, borderColor: FIELD_COLORS.rule }}
    >
      <FontAwesome name={slide.icon} size={40} color={FIELD_COLORS.teal} />
    </View>
    <Text className="mt-8 text-[11px] tracking-[2px]" style={{ color: FIELD_COLORS.muted, fontFamily: monoFont }}>
      {slide.eyebrow}
    </Text>
    <Text
      className="mt-2 text-[34px] leading-[42px] tracking-[-1px]"
      style={{ color: FIELD_COLORS.ink, fontFamily: displayFont }}
    >
      {slide.title}
    </Text>
    <Text className="mt-4 text-[15px] leading-6" style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont }}>
      {slide.body}
    </Text>
  </View>
);

/**
 * 첫 실행 안내 3장. "시작하기"는 로그인으로, "둘러보기"는 게스트 상태의 탭으로 보낸다.
 * 어느 쪽이든 다시 보이지 않도록 본 것으로 기록한다.
 */
const OnboardingScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const listRef = useRef<FlatList<OnboardingSlide>>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === ONBOARDING_SLIDES.length - 1;

  const finish = async (destination: "/(tabs)" | "/(auth)/login") => {
    await markOnboardingSeen();
    router.replace(destination);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  const handleNext = () => {
    if (isLast) {
      void finish(session ? "/(tabs)" : "/(auth)/login");
      return;
    }
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  };

  return (
    <View className="flex-1" style={{ backgroundColor: FIELD_COLORS.foam, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="flex-row items-center justify-between px-8 pt-4">
        <Text className="text-[12px] tracking-[2px]" style={{ color: FIELD_COLORS.ink, fontFamily: monoFont }}>
          FIELD GUIDE
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="안내 건너뛰고 둘러보기"
          onPress={() => void finish("/(tabs)")}
          hitSlop={12}
        >
          <Text className="text-[13px]" style={{ color: FIELD_COLORS.muted, fontFamily: bodySemiBoldFont }}>
            건너뛰기
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={ONBOARDING_SLIDES}
        keyExtractor={(slide) => slide.key}
        renderItem={({ item }) => <Slide slide={item} width={width} />}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        className="flex-1"
      />

      <View className="px-8 pb-4">
        <View className="mb-6 flex-row items-center" style={{ gap: 6 }}>
          {ONBOARDING_SLIDES.map((slide, i) => (
            <View
              key={slide.key}
              accessibilityLabel={`${i + 1}번째 안내${i === index ? ", 현재" : ""}`}
              style={{
                height: 4,
                width: i === index ? 28 : 10,
                backgroundColor: i === index ? FIELD_COLORS.teal : FIELD_COLORS.rule,
              }}
            />
          ))}
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={isLast ? "시작하기" : "다음 안내"}
          onPress={handleNext}
          className="flex-row items-center justify-center py-4"
          style={{ backgroundColor: FIELD_COLORS.teal }}
        >
          <Text className="text-[17px] text-white" style={{ fontFamily: bodyExtraBoldFont }}>
            {isLast ? (session ? "시작하기" : "로그인하고 시작하기") : "다음"}
          </Text>
          <FontAwesome name="long-arrow-right" size={18} color="#FFFFFF" style={{ marginLeft: 10 }} />
        </TouchableOpacity>
        {isLast && !session ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="로그인 없이 둘러보기"
            onPress={() => void finish("/(tabs)")}
            className="items-center py-4"
          >
            <Text className="text-[14px]" style={{ color: FIELD_COLORS.teal, fontFamily: bodySemiBoldFont }}>
              먼저 둘러보기
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

export default OnboardingScreen;
