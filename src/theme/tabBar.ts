import { Platform } from "react-native";

/**
 * 하단 탭바 본체 높이(safe-area 제외). 탭바 스타일(useArchiveTabBarStyle)과
 * 지도 시트·지도 패딩 계산(MAP_LAYOUT)이 같은 값을 써야 한다.
 */
export const TAB_BAR_HEIGHT = Platform.OS === "android" ? 72 : 64;
