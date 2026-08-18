import type { ImageSourcePropType } from "react-native";

import { getField60Illustration } from "@/src/data/field60Illustrations";
import type { UserCatch } from "@/src/hooks/useUserCatches";
import type { CatchVerificationStatus } from "@/src/lib/catchRewards";

export type ShareCatchData = {
  id: string;
  imageSource: ImageSourcePropType;
  fishName: string;
  scientificName: string;
  sizeCm: number | null;
  caughtAt: string;
  regionLabel: string | null;
  verificationStatus: CatchVerificationStatus;
  speciesCorrected?: boolean;
};

const FALLBACK_IMAGE = require("@/assets/images/card-app-icon-transparent.png");

export const APP_STORE_URL = "https://apps.apple.com/kr/app/id6792683065";
export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.sigcrew.baitedbrothers";
export const SMART_APP_LINK_URL =
  process.env.EXPO_PUBLIC_SHARE_LINK_URL?.trim() ||
  "https://baited-brothers-share.vercel.app/open";
export const SHARE_JOIN_URL = SMART_APP_LINK_URL;

export const getShareMessage = (
  item: Pick<ShareCatchData, "fishName" | "sizeCm">,
) => {
  const catchLabel =
    item.sizeCm != null
      ? `${item.fishName} ${item.sizeCm.toFixed(1)}cm`
      : item.fishName;

  return [
    `낚시당한 녀석들에서 ${catchLabel} 조과를 기록했어요.`,
    "",
    "나만의 출조와 조과를 기록해 보세요.",
    `앱에서 열기 또는 설치하기: ${SMART_APP_LINK_URL}`,
  ].join("\n");
};

export const getBroadRegionLabel = (locationName?: string | null) => {
  const normalized = locationName?.trim();
  if (!normalized) return null;

  const parts = normalized.split(/\s+/).filter(Boolean);
  const broadParts = parts.filter((part) =>
    /(특별자치도|특별자치시|광역시|특별시|도|시|군|구)$/.test(part),
  );

  // 상세 포인트명은 공유 카드에 그대로 노출하지 않는다.
  return broadParts.slice(0, 2).join(" ") || "대한민국 연안";
};

export const getShareCardNumber = (id: string) => {
  let hash = 0;
  for (const character of id) {
    hash = (hash * 31 + character.charCodeAt(0)) % 1000;
  }
  return `CAT-${String(hash).padStart(3, "0")}`;
};

export const shareCatchFromUserCatch = (item: UserCatch): ShareCatchData => {
  const illustration = getField60Illustration(
    item.fish?.catalog_sort_order ?? null,
    "color",
  );

  return {
    id: item.id,
    imageSource: item.image_url
      ? { uri: item.image_url }
      : (illustration ?? FALLBACK_IMAGE),
    fishName:
      item.fish?.name_ko ??
      item.fish?.name ??
      item.custom_species_name ??
      "어종 미확인",
    scientificName:
      item.fish?.name?.split(/\s+/).slice(0, 2).join(" ") ?? "OUTSIDE FIELD 60",
    sizeCm: item.size_cm,
    caughtAt: item.caught_at,
    regionLabel: getBroadRegionLabel(item.location_name),
    verificationStatus: item.verification_status,
    speciesCorrected: Boolean(item.species_corrected_at),
  };
};
