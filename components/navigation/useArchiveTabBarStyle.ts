import { useMemo } from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FIELD_COLORS } from "@/src/theme/fieldJournal";

export function useArchiveTabBarStyle() {
  const { bottom } = useSafeAreaInsets();
  return useMemo(() => ({
    backgroundColor: FIELD_COLORS.paper,
    borderTopColor: FIELD_COLORS.rule,
    borderTopWidth: 1,
    height: (Platform.OS === "android" ? 72 : 64) + bottom,
    paddingTop: 6,
    paddingBottom: 6 + bottom,
  }), [bottom]);
}
