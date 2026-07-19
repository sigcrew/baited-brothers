import { Image } from "expo-image";
import { Text, View } from "react-native";

import { getBadgeImageSource } from "@/components/badges/FieldBadgeAsset";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  displayFont,
  monoFont,
} from "@/src/theme/fieldJournal";

type FieldBadgeBackAssetProps = {
  acquiredDate: string;
  badgeId: string;
  progressCurrent: number;
  progressLabel: string;
  progressTarget: number;
  requirement: string;
  size?: number;
};

const wrapRequirement = (requirement: string) => {
  const words = requirement.split(" ");
  const lines: string[] = [];

  for (const word of words) {
    const currentLine = lines.at(-1);
    if (!currentLine || currentLine.length + word.length + 1 > 13) {
      lines.push(word);
    } else {
      lines[lines.length - 1] = `${currentLine} ${word}`;
    }
  }

  return lines.slice(0, 2);
};

export const FieldBadgeBackAsset = ({
  acquiredDate,
  badgeId,
  progressCurrent,
  progressLabel,
  progressTarget,
  requirement,
  size = 276,
}: FieldBadgeBackAssetProps) => {
  const source = getBadgeImageSource(badgeId);
  const requirementLines = wrapRequirement(requirement);
  const progressValue = `${Math.min(progressCurrent, progressTarget)} / ${progressTarget}`;
  const contentWidth = size * 0.58;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={`${requirement}, ${progressLabel} ${progressValue}, 획득일 ${acquiredDate}`}
      style={{ height: size, width: size }}
    >
      <Image
        source={source}
        contentFit="contain"
        tintColor={FIELD_COLORS.ink}
        style={{
          height: size,
          left: 0,
          position: "absolute",
          top: 0,
          width: size,
        }}
      />

      <View
        style={{
          alignItems: "center",
          left: (size - contentWidth) / 2,
          position: "absolute",
          top: size * 0.28,
          width: contentWidth,
        }}
      >
        <View
          style={{
            backgroundColor: FIELD_COLORS.teal,
            height: 1,
            opacity: 0.9,
            width: "100%",
          }}
        />
        <Text
          style={{
            color: FIELD_COLORS.orange,
            fontFamily: monoFont,
            fontSize: 7,
            letterSpacing: 1.5,
            marginTop: 9,
          }}
        >
          UNLOCK CONDITION
        </Text>
        <View style={{ marginTop: 8 }}>
          {requirementLines.map((line, index) => (
            <Text
              key={`${line}-${index}`}
              style={{
                color: FIELD_COLORS.foam,
                fontFamily: bodyExtraBoldFont,
                fontSize: requirementLines.length > 1 ? 15 : 17,
                lineHeight: 21,
                textAlign: "center",
              }}
            >
              {line}
            </Text>
          ))}
        </View>

        <View
          style={{
            backgroundColor: FIELD_COLORS.rule,
            height: 1,
            marginTop: 10,
            width: "82%",
          }}
        />
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 8,
            width: "100%",
          }}
        >
          <View>
            <Text style={{ color: "#B6C6C7", fontFamily: monoFont, fontSize: 7 }}>
              {progressLabel}
            </Text>
            <Text
              style={{
                color: FIELD_COLORS.foam,
                fontFamily: displayFont,
                fontSize: 21,
                lineHeight: 24,
              }}
            >
              {progressValue}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: "#B6C6C7", fontFamily: monoFont, fontSize: 7 }}>
              ACQUIRED
            </Text>
            <Text
              style={{
                color: FIELD_COLORS.foam,
                fontFamily: monoFont,
                fontSize: 8,
                marginTop: 6,
              }}
            >
              {acquiredDate}
            </Text>
          </View>
        </View>

        <View
          style={{
            alignItems: "center",
            backgroundColor: FIELD_COLORS.orange,
            borderRadius: 7,
            height: 14,
            justifyContent: "center",
            marginTop: 8,
            width: 14,
          }}
        >
          <Text
            style={{
              color: FIELD_COLORS.ink,
              fontFamily: bodyExtraBoldFont,
              fontSize: 9,
              lineHeight: 11,
            }}
          >
            ✓
          </Text>
        </View>
      </View>
    </View>
  );
};
