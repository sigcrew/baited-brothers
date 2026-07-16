import { Asset } from "expo-asset";
import Svg, {
  Circle,
  Defs,
  FeColorMatrix,
  Filter,
  G,
  Image as SvgImage,
  Line,
  Mask,
  Path,
  Rect,
  Text as SvgText,
} from "react-native-svg";

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

const SHIELD_BADGE_IDS = new Set(["trip_first", "trips_5"]);

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
  const sourceUri = Asset.fromModule(source as number).uri;
  const safeId = badgeId.replace(/[^a-zA-Z0-9_-]/g, "");
  const filterId = `badge-alpha-${safeId}`;
  const maskId = `badge-silhouette-${safeId}`;
  const requirementLines = wrapRequirement(requirement);
  const requirementStartY = requirementLines.length > 1 ? 118 : 128;
  const requirementFontSize = requirementLines.length > 1 ? 15 : 17;
  const progressValue = `${Math.min(progressCurrent, progressTarget)} / ${progressTarget}`;
  const isShieldBadge = SHIELD_BADGE_IDS.has(badgeId);

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 276 276"
      accessibilityRole="image"
      accessibilityLabel={`${requirement}, ${progressLabel} ${progressValue}, 획득일 ${acquiredDate}`}
    >
      <Defs>
        <Filter id={filterId} x="0" y="0" width="100%" height="100%">
          <FeColorMatrix
            type="matrix"
            values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"
          />
        </Filter>
        <Mask id={maskId} x="0" y="0" width={size} height={size} maskUnits="userSpaceOnUse">
          <SvgImage
            href={sourceUri}
            x="0"
            y="0"
            width={size}
            height={size}
            preserveAspectRatio="xMidYMid meet"
            filter={`url(#${filterId})`}
          />
        </Mask>
      </Defs>
      <G mask={`url(#${maskId})`}>
        <Rect x="0" y="0" width={size} height={size} fill={FIELD_COLORS.ink} />
        <Rect x="0" y="0" width={size} height={size} fill={FIELD_COLORS.teal} opacity={0.12} />

        <Line x1="54" y1="78" x2="222" y2="78" stroke={FIELD_COLORS.teal} strokeWidth="1" />
        <SvgText
          x="138"
          y="96"
          fill={FIELD_COLORS.orange}
          fontFamily={monoFont}
          fontSize="7"
          letterSpacing="1.8"
          textAnchor="middle"
        >
          UNLOCK CONDITION
        </SvgText>
        {requirementLines.map((line, index) => (
          <SvgText
            key={`${line}-${index}`}
            x="138"
            y={requirementStartY + index * 22}
            fill={FIELD_COLORS.foam}
            fontFamily={bodyExtraBoldFont}
            fontSize={requirementFontSize}
            textAnchor="middle"
          >
            {line}
          </SvgText>
        ))}

        <Line x1="72" y1="148" x2="204" y2="148" stroke={FIELD_COLORS.rule} strokeWidth="1" />
        <SvgText x="62" y="165" fill="#B6C6C7" fontFamily={monoFont} fontSize="7">
          {progressLabel}
        </SvgText>
        <SvgText x="62" y="185" fill={FIELD_COLORS.foam} fontFamily={displayFont} fontSize="21">
          {progressValue}
        </SvgText>
        <SvgText x="214" y="165" fill="#B6C6C7" fontFamily={monoFont} fontSize="7" textAnchor="end">
          ACQUIRED
        </SvgText>
        <SvgText x="214" y="184" fill={FIELD_COLORS.foam} fontFamily={monoFont} fontSize="8" textAnchor="end">
          {acquiredDate}
        </SvgText>

        <Circle cx="138" cy="201" r="7" fill={FIELD_COLORS.orange} />
        <Path d="M134 201 L137 204 L142 198" fill="none" stroke={FIELD_COLORS.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <Line
          x1={isShieldBadge ? 90 : 54}
          y1="214"
          x2={isShieldBadge ? 186 : 222}
          y2="214"
          stroke={FIELD_COLORS.teal}
          strokeWidth="1"
        />
      </G>
    </Svg>
  );
};
