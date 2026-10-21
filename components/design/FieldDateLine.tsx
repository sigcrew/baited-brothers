import { Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Text as SvgText } from "react-native-svg";

import { antonNumberWidth } from "@/src/lib/homeHero";
import { dateKoreanFont, dateNumberFont } from "@/src/theme/fieldJournal";

/**
 * 저널식 날짜 줄: 큰 Anton 숫자 + DoHyeon "월·일·요일". 홈 히어로와 출조 상세가 같이 쓴다.
 *
 * 숫자는 윗부분이 잘리지 않도록 SVG에 그리고, 한글 글자의 밑변을 숫자 밑변에 맞춘다.
 * 맞춤 값은 iPhone 16 Pro 스크린샷에서 글리프 밑변 픽셀을 재서 정했다.
 */
export type FieldDatePart =
  | { kind: "number"; value: string }
  | { kind: "unit"; value: string }
  | { kind: "weekday"; value: string };

type FieldDateLineProps = {
  parts: FieldDatePart[];
  color: string;
  /** 숫자 상자 기준 크기. 실제 글리프는 이 값의 0.86배로 그린다. */
  numberSize: number;
  unitSize: number;
  weekdaySize?: number;
  /** 줄 높이 = numberSize × 이 값. 홈 히어로처럼 위 여백이 넉넉해야 하면 키운다. */
  lineHeightRatio?: number;
  style?: StyleProp<ViewStyle>;
};

const NUMBER_RENDER_SCALE = 0.86;
const KOREAN_LINE_HEIGHT_RATIO = 1.5;
/**
 * DoHyeon 글자 밑변이 Text 상자 밑변에서 떠 있는 높이 ≈ lineHeight/2 − 0.314 × fontSize.
 * (iOS, lineHeight가 글꼴 기본 높이보다 클 때. 두 가지 크기로 재서 같은 계수가 나왔다.)
 */
const DOHYEON_BASELINE_COEFFICIENT = 0.314;

const numberGeometry = (numberSize: number, height: number) => {
  const renderSize = numberSize * NUMBER_RENDER_SCALE;
  const topPad = Math.max(10, height - renderSize * 1.02);
  const baseline = topPad + renderSize * 0.92;
  return { renderSize, baseline, bottomGap: height - baseline };
};

const AntonNumber = ({ value, color, numberSize, height }: { value: string; color: string; numberSize: number; height: number }) => {
  const { renderSize, baseline } = numberGeometry(numberSize, height);
  return (
    <Svg width={antonNumberWidth(value || "0", renderSize)} height={height}>
      <SvgText fill={color} fontSize={renderSize} fontFamily={dateNumberFont} fontWeight="400" x={2} y={baseline}>
        {value}
      </SvgText>
    </Svg>
  );
};

/** 한글 조각을 숫자 밑변에 맞추는 marginBottom. */
export const koreanBaselineMargin = (numberSize: number, height: number, fontSize: number) => {
  const lineHeight = Math.round(fontSize * KOREAN_LINE_HEIGHT_RATIO);
  const glyphGap = lineHeight / 2 - DOHYEON_BASELINE_COEFFICIENT * fontSize;
  return { lineHeight, marginBottom: Math.round(numberGeometry(numberSize, height).bottomGap - glyphGap) };
};

export const FieldDateLine = ({
  parts,
  color,
  numberSize,
  unitSize,
  weekdaySize = unitSize,
  lineHeightRatio = 1.55,
  style,
}: FieldDateLineProps) => {
  const height = Math.round(numberSize * lineHeightRatio);
  return (
    <View
      accessible
      accessibilityLabel={parts.map((part) => part.value).join("").replace(/\s+/g, " ").trim()}
      style={[{ height, flexDirection: "row", alignItems: "flex-end", overflow: "visible" }, style]}
    >
      {parts.map((part, index) => {
        if (part.kind === "number") {
          return <AntonNumber key={index} value={part.value} color={color} numberSize={numberSize} height={height} />;
        }
        const fontSize = part.kind === "weekday" ? weekdaySize : unitSize;
        const { lineHeight, marginBottom } = koreanBaselineMargin(numberSize, height, fontSize);
        return (
          <Text
            key={index}
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit={part.kind === "weekday"}
            minimumFontScale={0.75}
            style={{
              flexShrink: part.kind === "weekday" ? 1 : 0,
              color,
              fontFamily: dateKoreanFont,
              fontSize,
              lineHeight,
              marginBottom,
            }}
          >
            {part.value}
          </Text>
        );
      })}
    </View>
  );
};
