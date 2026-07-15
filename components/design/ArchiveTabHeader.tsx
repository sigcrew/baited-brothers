import type { ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  displayFont,
} from "@/src/theme/fieldJournal";
import { ArchiveRule } from "./ArchiveRule";

type ArchiveTabHeaderProps = {
  title: string;
  backgroundColor?: string;
  foregroundColor?: string;
  ruleColor?: string;
  actionLabel?: string;
  actionAccessibilityLabel?: string;
  onAction?: () => void;
  rightSlot?: ReactNode;
};

export const ArchiveTabHeader = ({
  title,
  backgroundColor = "#FFFFFF",
  foregroundColor = FIELD_COLORS.ink,
  ruleColor = FIELD_COLORS.rule,
  actionLabel,
  actionAccessibilityLabel,
  onAction,
  rightSlot,
}: ArchiveTabHeaderProps) => (
  <View
    className="px-5"
    style={{
      paddingTop: 12,
      backgroundColor,
    }}
  >
    <View
      className="flex-row items-center justify-between"
      style={{ height: 56 }}
    >
      <Text
        className="text-[42px] leading-[48px] tracking-[-2px]"
        style={{ color: foregroundColor, fontFamily: displayFont }}
      >
        {title}
      </Text>
      {rightSlot ? (
        <View style={{ transform: [{ translateY: -2 }] }}>{rightSlot}</View>
      ) : actionLabel ? (
        onAction ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
            onPress={onAction}
            className="px-1 py-2"
            style={{ transform: [{ translateY: -3 }] }}
          >
            <Text
              className="text-base"
              style={{ color: FIELD_COLORS.teal, fontFamily: bodyExtraBoldFont }}
            >
              {actionLabel}
            </Text>
          </TouchableOpacity>
        ) : (
          <Text
            className="px-1 py-2 text-base"
            style={{
              color: FIELD_COLORS.teal,
              fontFamily: bodyExtraBoldFont,
              transform: [{ translateY: -3 }],
            }}
          >
            {actionLabel}
          </Text>
        )
      ) : null}
    </View>
    <ArchiveRule ticks color={ruleColor} />
  </View>
);
