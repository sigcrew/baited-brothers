import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  Image,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getField60Illustration } from "@/src/data/field60Illustrations";
import type { Fish } from "@/src/hooks/useFishes";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
  displayFont,
  monoFont,
} from "@/src/theme/fieldJournal";

type CatchCompletionViewProps = {
  fish: Fish;
  isFirstDiscovery: boolean;
  isDevelopmentTest: boolean;
  isFileUpload: boolean;
  discoveredCount: number;
  sizeCm?: number;
  onViewRecord: () => void;
  onViewEncyclopedia: () => void;
  onGoHome: () => void;
};

const RAY_ANGLES = Array.from({ length: 16 }, (_, index) => index * 22.5);

const CompletionRule = ({ ticks = false }: { ticks?: boolean }) => (
  <View className="relative h-3 flex-row items-center">
    <View
      className="h-px flex-1"
      style={{ backgroundColor: FIELD_COLORS.rule }}
    />
    {ticks ? (
      <View className="absolute inset-x-0 top-1 flex-row justify-around">
        {Array.from({ length: 9 }, (_, index) => (
          <View
            key={index}
            className="w-px"
            style={{
              height: index === 4 ? 8 : 5,
              backgroundColor: FIELD_COLORS.rule,
            }}
          />
        ))}
      </View>
    ) : null}
  </View>
);

const DiscoveryRays = () => (
  <View pointerEvents="none" className="absolute inset-0">
    {RAY_ANGLES.map((angle, index) => (
      <View
        key={angle}
        className="absolute left-1/2 top-1/2 w-px"
        style={{
          height: index % 2 === 0 ? 34 : 22,
          marginLeft: -0.5,
          marginTop: -17,
          backgroundColor: FIELD_COLORS.teal,
          opacity: index % 2 === 0 ? 0.72 : 0.44,
          transform: [
            { rotate: `${angle}deg` },
            { translateY: -106 },
          ],
        }}
      />
    ))}
  </View>
);

const CompletionButton = ({
  label,
  variant,
  onPress,
}: {
  label: string;
  variant: "primary" | "secondary" | "text";
  onPress: () => void;
}) => {
  const primary = variant === "primary";
  const secondary = variant === "secondary";

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className={`items-center justify-center ${
        variant === "text" ? "mt-1 py-2" : "mt-2 min-h-12 border px-5 py-3"
      }`}
      style={{
        backgroundColor: primary ? FIELD_COLORS.teal : "transparent",
        borderColor: secondary ? FIELD_COLORS.teal : "transparent",
      }}
    >
      <Text
        className={variant === "text" ? "text-base" : "text-lg"}
        style={{
          color: primary ? "#fff" : FIELD_COLORS.teal,
          fontFamily: bodyExtraBoldFont,
          textDecorationLine: variant === "text" ? "underline" : "none",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
};

export const CatchCompletionView = ({
  fish,
  isFirstDiscovery,
  isDevelopmentTest,
  isFileUpload,
  discoveredCount,
  sizeCm,
  onViewRecord,
  onViewEncyclopedia,
  onGoHome,
}: CatchCompletionViewProps) => {
  const insets = useSafeAreaInsets();
  const illustration = getField60Illustration(
    fish.catalog_sort_order,
    "color",
  );
  const scientificName = fish.name.split(/\s+/).slice(0, 2).join(" ");
  const discoveredCountLabel = String(discoveredCount).padStart(2, "0");

  return (
    <View
      className="flex-1"
      style={{ flex: 1, backgroundColor: FIELD_COLORS.foam }}
    >
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 480,
          alignSelf: "center",
          backgroundColor: FIELD_COLORS.foam,
        }}
        contentContainerStyle={{
          flexGrow: 1,
          backgroundColor: FIELD_COLORS.foam,
          paddingTop: insets.top + 14,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 20,
        }}
      >
        <View className="items-center">
          <View
            className="h-12 w-12 items-center justify-center rounded-full border-[3px]"
            style={{ borderColor: FIELD_COLORS.teal }}
          >
            <FontAwesome name="check" size={22} color={FIELD_COLORS.teal} />
          </View>
          <Text
            className="mt-3 text-center text-[34px] leading-[41px]"
            style={{ color: FIELD_COLORS.ink, fontFamily: displayFont }}
          >
            {isFirstDiscovery ? "새로운 어종 발견!" : "조과 기록 완료"}
          </Text>
        </View>

        <View className="mt-3">
          <CompletionRule ticks />
        </View>

        <View
          className={`relative mt-1 items-center justify-center overflow-hidden border ${
            isFirstDiscovery ? "h-[238px]" : "h-[190px]"
          }`}
          style={{
            borderColor: FIELD_COLORS.rule,
            backgroundColor: "#EAF1F2",
          }}
        >
          {isFirstDiscovery ? <DiscoveryRays /> : null}
          {illustration ? (
            <Image
              source={illustration}
              resizeMode="contain"
              style={{
                width: isFirstDiscovery ? "115%" : "125%",
                height: isFirstDiscovery ? "115%" : "125%",
              }}
              accessibilityLabel={`${fish.name_ko ?? fish.name} 컬러 일러스트`}
            />
          ) : (
            <FontAwesome name="image" size={42} color={FIELD_COLORS.muted} />
          )}
        </View>

        <View className="items-center px-3 pt-4">
          <Text
            className="text-center text-[36px] leading-[42px]"
            style={{ color: FIELD_COLORS.ink, fontFamily: displayFont }}
          >
            {fish.name_ko ?? fish.name}
          </Text>
          <Text
            className="mt-2 text-center text-[10px] uppercase tracking-[1.4px]"
            style={{ color: FIELD_COLORS.teal, fontFamily: monoFont }}
          >
            {scientificName}
          </Text>
        </View>

        {isFirstDiscovery ? (
          <View className="mt-4">
            <View className="flex-row items-center">
              <View
                className="h-px flex-1"
                style={{ backgroundColor: FIELD_COLORS.rule }}
              />
              <Text
                className="mx-4 text-[22px]"
                style={{ color: FIELD_COLORS.ink, fontFamily: bodyExtraBoldFont }}
              >
                도감{" "}
                <Text style={{ color: FIELD_COLORS.orange }}>
                  {discoveredCountLabel}
                </Text>{" "}
                / 60
              </Text>
              <View
                className="h-px flex-1"
                style={{ backgroundColor: FIELD_COLORS.rule }}
              />
            </View>
            <Text
              className="mt-3 text-center text-sm leading-6"
              style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont }}
            >
              처음 발견한 어종이 도감에 기록되었습니다.
            </Text>
          </View>
        ) : (
          <View className="mt-4 border-y" style={{ borderColor: FIELD_COLORS.rule }}>
            {sizeCm ? (
              <View
                className="flex-row items-center border-b px-4 py-3"
                style={{ borderColor: FIELD_COLORS.rule }}
              >
                <FontAwesome
                  name="arrows-h"
                  size={20}
                  color={FIELD_COLORS.teal}
                />
                <Text
                  className="ml-5 text-[26px]"
                  style={{
                    color: FIELD_COLORS.ink,
                    fontFamily: bodyExtraBoldFont,
                  }}
                >
                  {sizeCm} cm
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-center px-4 py-3">
              <FontAwesome
                name={
                  isDevelopmentTest
                    ? "flask"
                    : isFileUpload
                      ? "upload"
                      : "camera"
                }
                size={21}
                color={FIELD_COLORS.orange}
              />
              <Text
                className="ml-5 flex-1 text-sm leading-6"
                style={{ color: FIELD_COLORS.ink, fontFamily: bodyFont }}
              >
                {isDevelopmentTest
                  ? "개발용 판별 결과가 확정되었습니다."
                  : isFileUpload
                    ? "업로드한 사진이 실제 조과로 기록되었습니다."
                    : "사진과 위치 정보가 기록되었습니다."}
              </Text>
            </View>
          </View>
        )}

        {isDevelopmentTest ? (
          <Text
            className="mt-3 text-center text-xs leading-5"
            style={{ color: FIELD_COLORS.muted, fontFamily: bodyFont }}
          >
            개발용 테스트 결과이며 실제 조과와 도감에는 저장되지 않습니다.
          </Text>
        ) : null}

        <View className="mt-auto pt-5">
          <CompletionRule />
          <CompletionButton
            label="기록 보기"
            variant="primary"
            onPress={onViewRecord}
          />
          <CompletionButton
            label="도감 보기"
            variant="secondary"
            onPress={onViewEncyclopedia}
          />
          <CompletionButton
            label="홈으로"
            variant="text"
            onPress={onGoHome}
          />
        </View>
      </ScrollView>
    </View>
  );
};
