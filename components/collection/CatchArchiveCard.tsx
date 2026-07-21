import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useState } from "react";
import {
  Image,
  type ImageSourcePropType,
  Text,
  View,
} from "react-native";

import { getField60Illustration } from "@/src/data/field60Illustrations";
import type { UserCatch } from "@/src/hooks/useUserCatches";
import {
  FIELD_COLORS,
  bodyExtraBoldFont,
  bodyFont,
  displayFont,
  monoFont,
} from "@/src/theme/fieldJournal";

type CatchArchiveCardProps = {
  item: UserCatch;
  variant: "compact" | "detail";
};

const CARD_COLORS = {
  paper: "#F3F0E6",
  ink: "#0B2940",
  teal: "#2A7378",
  orange: "#E95A28",
  wash: "#E9ECE6",
} as const;

const APP_ICON = require("@/assets/images/card-app-icon-transparent.png");
const PAPER_TEXTURE = require("@/assets/images/design/catch-card-paper-texture.png");

const formatCaughtAt = (iso: string) =>
  new Date(iso)
    .toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    .replace(/\. /g, ".")
    .replace(/\.$/, "");

const getCardNumber = (id: string) => {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 999;
  }
  return `CAT-${String(hash + 1).padStart(3, "0")}`;
};

const getNormalizedMemo = (memo: string | null) => {
  const normalized = memo?.replace(/\s+/g, " ").trim();
  return normalized || null;
};

const AppIconMark = ({ compact }: { compact: boolean }) => {
  const frame = compact ? 22 : 32;
  const imageSize = compact ? 38 : 54;
  const offset = compact ? -8 : -11;

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="낚시당한 녀석들 앱 아이콘"
      style={{
        width: frame,
        height: frame,
        overflow: "hidden",
      }}
    >
      <Image
        source={APP_ICON}
        resizeMode="cover"
        style={{
          position: "absolute",
          width: imageSize,
          height: imageSize,
          left: offset,
          top: offset,
        }}
      />
    </View>
  );
};

const PaperTexture = () => (
  <Image
    source={PAPER_TEXTURE}
    resizeMode="repeat"
    accessibilityIgnoresInvertColors
    style={{
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      width: "100%",
      height: "100%",
      opacity: 0.72,
    }}
  />
);

const RulerScale = ({
  sizeCm,
  compact,
}: {
  sizeCm: number | null;
  compact: boolean;
}) => {
  const maxCm = sizeCm == null ? 50 : Math.max(10, Math.ceil(sizeCm / 10) * 10);
  const ticks = Array.from({ length: maxCm + 1 }, (_, value) => value);
  const markerPercent =
    sizeCm == null ? null : Math.min(100, Math.max(0, (sizeCm / maxCm) * 100));

  return (
    <View
      style={{
        height: compact ? 31 : 48,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: CARD_COLORS.teal,
      }}
    >
      <View style={{ height: compact ? 17 : 28, position: "relative" }}>
        {ticks.map((value) => {
          const major = value % 10 === 0;
          const middle = !major && value % 5 === 0;
          return (
            <View
              key={value}
              style={{
                position: "absolute",
                bottom: 0,
                left: `${(value / maxCm) * 100}%`,
                width: 1,
                height: compact
                  ? major
                    ? 10
                    : middle
                      ? 7
                      : 4
                  : major
                    ? 18
                    : middle
                      ? 13
                      : 8,
                backgroundColor: CARD_COLORS.ink,
                opacity: major ? 0.9 : 0.62,
              }}
            />
          );
        })}
        {markerPercent != null ? (
          <View
            accessibilityLabel={`입력 크기 ${sizeCm}센티미터`}
            style={{
              position: "absolute",
              bottom: 0,
              left: `${markerPercent}%`,
              width: compact ? 2 : 3,
              height: compact ? 15 : 25,
              marginLeft: compact ? -1 : -1.5,
              backgroundColor: CARD_COLORS.orange,
            }}
          />
        ) : null}
      </View>
      <View className="flex-row justify-between px-px">
        {Array.from({ length: maxCm / 10 + 1 }, (_, index) => index * 10).map(
          (value) => (
            <Text
              key={value}
              style={{
                color: CARD_COLORS.ink,
                fontFamily: monoFont,
                fontSize: compact ? 6 : 9,
                lineHeight: compact ? 10 : 14,
              }}
            >
              {value}
            </Text>
          ),
        )}
      </View>
    </View>
  );
};

const CardPhoto = ({
  item,
  illustration,
  compact,
}: {
  item: UserCatch;
  illustration: ImageSourcePropType | null;
  compact: boolean;
}) => {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photoUrl = compact
    ? item.thumbnail_url ?? item.image_url
    : item.image_url ?? item.thumbnail_url;
  const showPhoto = Boolean(photoUrl) && !photoFailed;

  return (
    <View
      style={{
        aspectRatio: compact ? 1.22 : 1.38,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: CARD_COLORS.ink,
        backgroundColor: CARD_COLORS.wash,
      }}
    >
      {showPhoto ? (
        <Image
          source={{ uri: photoUrl! }}
          resizeMode="cover"
          onError={() => setPhotoFailed(true)}
          style={{ width: "100%", height: "100%" }}
          accessibilityLabel={`${item.fish?.name_ko ?? item.fish?.name ?? "물고기"} 조과 사진`}
        />
      ) : illustration ? (
        <Image
          source={illustration}
          resizeMode="contain"
          style={{ width: "100%", height: "100%" }}
          accessibilityLabel={`${item.fish?.name_ko ?? item.fish?.name ?? "물고기"} 컬러 일러스트`}
        />
      ) : (
        <View className="flex-1 items-center justify-center">
          <FontAwesome name="image" size={compact ? 22 : 38} color={FIELD_COLORS.muted} />
        </View>
      )}
    </View>
  );
};

export const CatchArchiveCard = ({
  item,
  variant,
}: CatchArchiveCardProps) => {
  const compact = variant === "compact";
  const title = item.fish?.name_ko ?? item.fish?.name ?? "어종 미확인";
  const scientificName = (item.fish?.name ?? "SCIENTIFIC NAME UNAVAILABLE")
    .split(/\s+/)
    .slice(0, 2)
    .join(" ")
    .toUpperCase();
  const sizeCm = item.size_cm == null ? null : Number(item.size_cm);
  const illustration = getField60Illustration(
    item.fish?.catalog_sort_order ?? null,
    "color",
  );
  const memoExcerpt = getNormalizedMemo(item.memo);
  const location = item.location_name?.trim() || "위치 미기록";
  const date = formatCaughtAt(item.caught_at);
  const cardNumber = getCardNumber(item.id);

  return (
    <View
      style={{
        width: "100%",
        backgroundColor: CARD_COLORS.paper,
        borderWidth: compact ? 2 : 3,
        borderColor: CARD_COLORS.ink,
        padding: compact ? 4 : 7,
        overflow: "hidden",
      }}
    >
      <PaperTexture />
      <View
        style={{
          borderWidth: 1,
          borderColor: CARD_COLORS.teal,
          padding: compact ? 6 : 12,
        }}
      >
        <View
          className="flex-row items-center justify-between"
          style={{
            minHeight: compact ? 24 : 38,
            borderBottomWidth: 1,
            borderColor: CARD_COLORS.teal,
            marginBottom: compact ? 6 : 10,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              color: CARD_COLORS.ink,
              fontFamily: monoFont,
              fontSize: compact ? 7 : 15,
              letterSpacing: compact ? 0.8 : 2.4,
            }}
          >
            FIELD CATCH
          </Text>
          <View className="flex-row items-center">
            <Text
              style={{
                color: CARD_COLORS.ink,
                fontFamily: monoFont,
                fontSize: compact ? 6 : 12,
                letterSpacing: compact ? 0.4 : 1.2,
                marginRight: compact ? 4 : 8,
              }}
            >
              {cardNumber}
            </Text>
            <AppIconMark compact={compact} />
          </View>
        </View>

        <CardPhoto item={item} illustration={illustration} compact={compact} />
        <RulerScale sizeCm={sizeCm} compact={compact} />

        {compact ? (
          <>
            <Text
              numberOfLines={1}
              style={{
                marginTop: 7,
                color: CARD_COLORS.ink,
                fontFamily: displayFont,
                fontSize: 27,
                lineHeight: 34,
                textAlign: "center",
              }}
            >
              {title}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: CARD_COLORS.teal,
                fontFamily: monoFont,
                fontSize: 6,
                lineHeight: 10,
                letterSpacing: 0.45,
                textAlign: "center",
              }}
            >
              {scientificName}
            </Text>
            <View
              className="mt-2 flex-row items-end justify-between border-t pt-2"
              style={{ borderColor: CARD_COLORS.teal }}
            >
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  color: CARD_COLORS.ink,
                  fontFamily: monoFont,
                  fontSize: 7,
                  lineHeight: 11,
                }}
              >
                {date}
              </Text>
              <Text
                style={{
                  color:
                    sizeCm == null ? FIELD_COLORS.muted : CARD_COLORS.orange,
                  fontFamily: bodyExtraBoldFont,
                  fontSize: sizeCm == null ? 7 : 15,
                  lineHeight: 18,
                }}
              >
                {sizeCm == null ? "SIZE N/R" : `${sizeCm} cm`}
              </Text>
            </View>
          </>
        ) : (
          <>
            <View
              className="items-center py-4"
              style={{
                borderBottomWidth: 1,
                borderColor: CARD_COLORS.teal,
              }}
            >
              <Text
                style={{
                  color: CARD_COLORS.ink,
                  fontFamily: displayFont,
                  fontSize: 52,
                  lineHeight: 62,
                  textAlign: "center",
                }}
              >
                {title}
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  color: CARD_COLORS.ink,
                  fontFamily: monoFont,
                  fontSize: 12,
                  lineHeight: 18,
                  letterSpacing: 1.2,
                  textAlign: "center",
                }}
              >
                {scientificName}
              </Text>
            </View>

            <View style={{ position: "relative" }}>
              <View
                className="flex-row"
                style={{
                  minHeight: 114,
                  borderBottomWidth: 1,
                  borderColor: CARD_COLORS.teal,
                }}
              >
                <View className="w-[36%] items-center justify-center">
                  {illustration ? (
                    <Image
                      source={illustration}
                      resizeMode="contain"
                      style={{ width: "90%", height: 96 }}
                      accessibilityLabel={`${title} 컬러 일러스트`}
                    />
                  ) : (
                    <FontAwesome
                      name="image"
                      size={34}
                      color={FIELD_COLORS.muted}
                    />
                  )}
                </View>
                <View className="flex-1 items-center justify-center px-3">
                  <Text
                    style={{
                      color:
                        sizeCm == null ? FIELD_COLORS.muted : CARD_COLORS.ink,
                      fontFamily: bodyExtraBoldFont,
                      fontSize: sizeCm == null ? 17 : 41,
                      lineHeight: sizeCm == null ? 24 : 52,
                      textAlign: "center",
                    }}
                  >
                    {sizeCm == null ? "SIZE NOT RECORDED" : `${sizeCm} cm`}
                  </Text>
                </View>
              </View>

              <View
                className="flex-row items-center"
                style={{
                  minHeight: 46,
                  borderBottomWidth: 1,
                  borderColor: CARD_COLORS.teal,
                }}
              >
                <View className="w-[36%] flex-row items-center px-3">
                  <FontAwesome
                    name="calendar"
                    size={15}
                    color={CARD_COLORS.teal}
                  />
                  <Text
                    style={{
                      marginLeft: 9,
                      color: CARD_COLORS.ink,
                      fontFamily: monoFont,
                      fontSize: 11,
                    }}
                  >
                    {date}
                  </Text>
                </View>
                <View className="flex-1 flex-row items-center px-3">
                  <FontAwesome
                    name="map-marker"
                    size={18}
                    color={CARD_COLORS.teal}
                  />
                  <Text
                    numberOfLines={1}
                    style={{
                      marginLeft: 9,
                      flex: 1,
                      color: CARD_COLORS.ink,
                      fontFamily: bodyExtraBoldFont,
                      fontSize: 13,
                    }}
                  >
                    {location}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: "36%",
                  width: 1,
                  backgroundColor: CARD_COLORS.teal,
                }}
              />
            </View>

            {memoExcerpt ? (
              <View className="flex-row items-start px-3 py-3">
                <Text
                  style={{
                    width: 42,
                    color: CARD_COLORS.orange,
                    fontFamily: monoFont,
                    fontSize: 10,
                    letterSpacing: 0.8,
                  }}
                >
                  NOTE
                </Text>
                <Text
                  numberOfLines={2}
                  style={{
                    flex: 1,
                    color: CARD_COLORS.ink,
                    fontFamily: bodyFont,
                    fontSize: 12,
                    lineHeight: 19,
                  }}
                >
                  {memoExcerpt}
                </Text>
              </View>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
};
