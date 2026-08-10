import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Image, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import {
  getShareCardNumber,
  SHARE_JOIN_URL,
  type ShareCatchData,
} from "@/src/lib/shareCard";
import {
  bodyExtraBoldFont,
  bodyFont,
  displayFont,
  monoFont,
} from "@/src/theme/fieldJournal";

const COLORS = {
  paper: "#F7F3E8",
  ink: "#082F4D",
  teal: "#087E7D",
  orange: "#E85F25",
  photo: "#DCE8E7",
};

const BRAND_ICON = require("@/assets/images/card-app-icon-transparent.png");
const PAPER_TEXTURE = require("@/assets/images/design/catch-card-paper-texture.png");
const VERIFIED_STAMP = require("@/assets/images/design/catch-stamps/catch-stamp-verified.png");
const GENERAL_STAMP = require("@/assets/images/design/catch-stamps/catch-stamp-general.png");
const PENDING_STAMP = require("@/assets/images/design/catch-stamps/catch-stamp-pending.png");
const CORRECTED_STAMP = require("@/assets/images/design/catch-stamps/catch-stamp-corrected.png");

export type ShareCardVariant = "mobile" | "offline";

const formatCatchDate = (caughtAt: string) => {
  const date = new Date(caughtAt);
  if (Number.isNaN(date.getTime())) return caughtAt;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(date)
    .replace(/\s/g, "");
};

const getStamp = (item: ShareCatchData) => {
  if (item.speciesCorrected) return CORRECTED_STAMP;
  if (item.verificationStatus === "pending") return PENDING_STAMP;
  if (
    item.verificationStatus === "verified" ||
    item.verificationStatus === "field_verified" ||
    item.verificationStatus === "metadata_verified"
  ) {
    return VERIFIED_STAMP;
  }
  return GENERAL_STAMP;
};

const Ruler = ({ sizeCm, px }: { sizeCm: number | null; px: (value: number) => number }) => {
  const maxCm = Math.max(60, Math.ceil((sizeCm ?? 60) / 10) * 10);
  const markerPosition = Math.min(96, Math.max(2, ((sizeCm ?? 0) / maxCm) * 100));
  const ticks = Array.from({ length: 31 }, (_, index) => index);

  return (
    <View style={{ height: px(36), marginTop: px(4) }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {ticks.map((tick) => (
          <View key={tick} style={{ alignItems: "center" }}>
            <View
              style={{
                width: px(1),
                height: px(tick % 5 === 0 ? 16 : tick % 2 === 0 ? 9 : 6),
                backgroundColor: COLORS.ink,
              }}
            />
            {tick % 5 === 0 ? (
              <Text
                style={{
                  marginTop: px(3),
                  color: COLORS.ink,
                  fontFamily: monoFont,
                  fontSize: px(8),
                  lineHeight: px(10),
                }}
              >
                {Math.round((tick / 30) * maxCm)}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
      {sizeCm != null ? (
        <View
          style={{
            position: "absolute",
            left: `${markerPosition}%`,
            top: 0,
            width: px(2),
            height: px(20),
            backgroundColor: COLORS.orange,
          }}
        />
      ) : null}
    </View>
  );
};

export const ShareCatchCard = ({
  item,
  width,
  showRegion,
  variant = "mobile",
}: {
  item: ShareCatchData;
  width: number;
  showRegion: boolean;
  variant?: ShareCardVariant;
}) => {
  const scale = width / 360;
  const px = (value: number) => value * scale;
  const isOffline = variant === "offline";

  return (
    <View
      collapsable={false}
      style={{
        width,
        height: width * (isOffline ? 1.568 : 1.39),
        overflow: "hidden",
        backgroundColor: COLORS.paper,
      }}
    >
      <Image
        source={PAPER_TEXTURE}
        resizeMode="repeat"
        style={{ position: "absolute", inset: 0, width: "112%", height: "112%", opacity: 0.24 }}
      />

      <View style={{ flex: 1, borderWidth: px(3), borderColor: COLORS.ink, padding: px(5) }}>
        <View style={{ flex: 1, borderWidth: px(1), borderColor: COLORS.teal, paddingHorizontal: px(12), paddingTop: px(7), paddingBottom: px(7) }}>
          <View style={{ flexDirection: "row", alignItems: "center", minHeight: px(29) }}>
            <Image source={BRAND_ICON} style={{ width: px(28), height: px(28) }} />
            <Text
              style={{
                marginLeft: px(7),
                color: COLORS.ink,
                fontFamily: bodyExtraBoldFont,
                fontSize: px(16),
                lineHeight: px(20),
              }}
            >
              낚시당한 녀석들
            </Text>
            <Text
              style={{
                marginLeft: "auto",
                color: COLORS.ink,
                fontFamily: monoFont,
                fontSize: px(9),
                lineHeight: px(11),
                letterSpacing: px(1.2),
              }}
            >
              {getShareCardNumber(item.id)}
            </Text>
          </View>

          <View style={{ height: px(1), marginTop: px(4), backgroundColor: COLORS.teal }} />

          <Text
            style={{
              marginTop: px(7),
              color: COLORS.ink,
              fontFamily: monoFont,
              fontSize: px(20),
              lineHeight: px(24),
              letterSpacing: px(3.2),
            }}
          >
            FIELD CATCH
          </Text>

          <View
            style={{
              marginTop: px(9),
              height: px(216),
              overflow: "hidden",
              borderWidth: px(1),
              borderColor: COLORS.ink,
              backgroundColor: COLORS.photo,
            }}
          >
            <Image source={item.imageSource} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
          </View>

          <Ruler sizeCm={item.sizeCm} px={px} />

          <View style={{ minHeight: px(83), alignItems: "center", justifyContent: "center" }}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{
                maxWidth: "72%",
                color: COLORS.ink,
                fontFamily: displayFont,
                fontSize: px(39),
                lineHeight: px(44),
                textAlign: "center",
              }}
            >
              {item.fishName}
            </Text>
            <Image
              source={getStamp(item)}
              style={{
                position: "absolute",
                right: px(17),
                top: px(2),
                width: px(52),
                height: px(52),
              }}
            />
            <View style={{ width: "100%", flexDirection: "row", alignItems: "center" }}>
              <View style={{ height: px(1), flex: 1, backgroundColor: COLORS.teal }} />
              <View style={{ marginHorizontal: px(10), flexDirection: "row", alignItems: "baseline" }}>
                <Text
                  style={{
                    color: COLORS.orange,
                    fontFamily: bodyExtraBoldFont,
                    fontSize: px(29),
                    lineHeight: px(34),
                  }}
                >
                  {item.sizeCm != null ? item.sizeCm.toFixed(1) : "--"}
                </Text>
                <Text
                  style={{
                    marginLeft: px(4),
                    color: COLORS.orange,
                    fontFamily: bodyExtraBoldFont,
                    fontSize: px(17),
                    lineHeight: px(22),
                  }}
                >
                  cm
                </Text>
              </View>
              <View style={{ height: px(1), flex: 1, backgroundColor: COLORS.teal }} />
            </View>
          </View>

          <Text
            numberOfLines={1}
            style={{
              color: COLORS.teal,
              fontFamily: monoFont,
              fontSize: px(10),
              lineHeight: px(13),
              letterSpacing: px(1.2),
              textAlign: "center",
            }}
          >
            {item.scientificName.toUpperCase()}
          </Text>

          <View style={{ height: px(1), marginTop: px(8), backgroundColor: COLORS.teal }} />

          <View style={{ height: px(37), flexDirection: "row", alignItems: "center" }}>
            <FontAwesome name="calendar" size={px(14)} color={COLORS.ink} />
            <Text style={{ marginLeft: px(7), color: COLORS.ink, fontFamily: monoFont, fontSize: px(10), lineHeight: px(14) }}>
              {formatCatchDate(item.caughtAt)}
            </Text>
            <View style={{ width: px(1), height: px(24), marginHorizontal: px(12), backgroundColor: COLORS.teal }} />
            <FontAwesome name="map-marker" size={px(17)} color={COLORS.ink} />
            <Text
              numberOfLines={1}
              style={{ marginLeft: px(7), flex: 1, color: COLORS.ink, fontFamily: bodyFont, fontSize: px(10), lineHeight: px(14) }}
            >
              {showRegion && item.regionLabel ? item.regionLabel : "위치 비공개"}
            </Text>
          </View>

          {isOffline ? (
            <>
              <View style={{ height: px(1), backgroundColor: COLORS.teal }} />
              <View style={{ flex: 1, minHeight: px(46), flexDirection: "row", alignItems: "center" }}>
                <Text style={{ color: COLORS.ink, fontFamily: bodyExtraBoldFont, fontSize: px(17), lineHeight: px(22) }}>
                  나도 승선하기
                </Text>
                <FontAwesome name="arrow-right" size={px(14)} color={COLORS.orange} style={{ marginLeft: px(7) }} />
                <View style={{ marginLeft: "auto", padding: px(2), borderWidth: px(1), borderColor: COLORS.ink, backgroundColor: "#FFFDF5" }}>
                  <QRCode
                    value={SHARE_JOIN_URL}
                    size={px(39)}
                    color={COLORS.ink}
                    backgroundColor="#FFFDF5"
                    ecl="M"
                  />
                </View>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
};
