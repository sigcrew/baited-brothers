import type { ReactNode } from "react";
import { Text, TouchableOpacity, useWindowDimensions, View } from "react-native";

import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  displayFont,
} from "@/src/theme/fieldJournal";
import { ArchiveRule } from "./ArchiveRule";

const TITLE_BASE_WIDTH = 430;
const TITLE_BASE_SIZE = 42;
const TITLE_BASE_LINE_HEIGHT = 48;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

type ArchiveTabHeaderProps = {
  title: string;
  backgroundColor?: string;
  foregroundColor?: string;
  ruleColor?: string;
  actionLabel?: string;
  actionAccessibilityLabel?: string;
  onAction?: () => void;
  leadingSlot?: ReactNode;
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
  leadingSlot,
  rightSlot,
}: ArchiveTabHeaderProps) => {
  const { width } = useWindowDimensions();
  const titleScale = clamp(width / TITLE_BASE_WIDTH, 0.76, 1);
  const titleSize = Math.round(TITLE_BASE_SIZE * titleScale);
  const titleLineHeight = Math.round(TITLE_BASE_LINE_HEIGHT * titleScale);

  return (
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
        <View className="min-w-0 flex-1 flex-row items-center pr-2">
          {leadingSlot ? <View className="mr-2 shrink-0">{leadingSlot}</View> : null}
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            allowFontScaling={false}
            className="min-w-0 flex-1 tracking-[-2px]"
            style={{
              color: foregroundColor,
              fontFamily: displayFont,
              fontSize: titleSize,
              lineHeight: titleLineHeight,
            }}
          >
            {title}
          </Text>
        </View>
        {rightSlot ? (
          <View className="ml-1 shrink-0" style={{ transform: [{ translateY: -2 }] }}>
            {rightSlot}
          </View>
        ) : actionLabel ? (
          onAction ? (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={actionAccessibilityLabel ?? actionLabel}
              onPress={onAction}
              className="shrink-0 px-1 py-2"
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
              className="shrink-0 px-1 py-2 text-base"
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
};
