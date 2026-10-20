import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FIELD_COLORS } from "@/src/theme/fieldJournal";
import { TAB_BAR_HEIGHT } from "@/src/theme/tabBar";

export function useArchiveTabBarStyle() {
  const { bottom } = useSafeAreaInsets();
  return useMemo(() => ({
    backgroundColor: FIELD_COLORS.paper,
    borderTopColor: FIELD_COLORS.rule,
    borderTopWidth: 1,
    height: TAB_BAR_HEIGHT + bottom,
    paddingTop: 6,
    paddingBottom: 6 + bottom,
  }), [bottom]);
}
