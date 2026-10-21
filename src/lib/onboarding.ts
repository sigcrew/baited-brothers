import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * 첫 실행 온보딩. 안내 문구나 장수가 바뀌어 기존 사용자에게 다시 보여 주고 싶으면
 * 버전을 올린다.
 */
export const ONBOARDING_SEEN_KEY = "onboarding-seen";
export const ONBOARDING_VERSION = "2026-10-21";

export const hasSeenOnboarding = async () => {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_SEEN_KEY)) === ONBOARDING_VERSION;
  } catch {
    // 저장소를 못 읽으면 온보딩을 건너뛴다. 매 실행마다 막아 세우는 것보다 낫다.
    return true;
  }
};

export const markOnboardingSeen = async () => {
  try {
    await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, ONBOARDING_VERSION);
  } catch {
    // 실패해도 이번 실행은 진행한다. 다음 실행에 한 번 더 보일 뿐이다.
  }
};

export type LaunchRoute = "/onboarding" | "/(tabs)" | "/(auth)/login";

/**
 * 앱 진입 화면. 온보딩을 안 봤으면 온보딩, 봤으면 세션 유무로 탭 또는 로그인.
 * 개발 빌드는 세션이 없어도 탭으로 보내 게스트 화면을 바로 볼 수 있게 한다.
 */
export const resolveLaunchRoute = ({
  seenOnboarding,
  hasSession,
  isDevelopment = false,
}: {
  seenOnboarding: boolean;
  hasSession: boolean;
  isDevelopment?: boolean;
}): LaunchRoute => {
  if (!seenOnboarding) return "/onboarding";
  if (hasSession || isDevelopment) return "/(tabs)";
  return "/(auth)/login";
};

export type OnboardingSlide = {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  icon: "calendar-plus-o" | "camera" | "trophy";
};

export const ONBOARDING_SLIDES: readonly OnboardingSlide[] = [
  {
    key: "plan",
    eyebrow: "01 · PLAN",
    title: "출조를\n먼저 계획합니다",
    body: "지도에서 포인트를 고르면 수온과 물때를 미리 보고 날짜를 잡을 수 있습니다. 출조 전날 알림도 보내 드립니다.",
    icon: "calendar-plus-o",
  },
  {
    key: "record",
    eyebrow: "02 · RECORD",
    title: "현장에서\n사진 한 장으로 기록",
    body: "잡은 자리에서 촬영하면 AI가 어종 후보를 추천하고, 위치와 시각이 확인된 조과는 인증 기록으로 남습니다.",
    icon: "camera",
  },
  {
    key: "collect",
    eyebrow: "03 · COLLECT",
    title: "도감 60종과\n배지를 채웁니다",
    body: "새 어종을 만날 때마다 도감이 열리고, 기록이 쌓이면 배지와 조과 카드가 생깁니다. 공유 카드로 자랑할 수도 있습니다.",
    icon: "trophy",
  },
];
