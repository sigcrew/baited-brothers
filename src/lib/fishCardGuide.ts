import type { CatalogGroup, Fish } from "@/src/hooks/useFishes";

/** 어종 데이터가 비어 있을 때 쓰는 그룹별 기본 제철·미끼. */
const GROUP_CARD_GUIDES: Record<CatalogGroup, { seasons: number[]; bait: string }> = {
  flatfish: { seasons: [3, 4, 5, 9, 10, 11], bait: "웜" },
  rockfish: { seasons: [3, 4, 5, 10, 11, 12], bait: "웜" },
  bream: { seasons: [4, 5, 6, 9, 10, 11], bait: "크릴" },
  seabass_croaker: { seasons: [5, 6, 7, 8, 9, 10], bait: "미노우" },
  pelagic: { seasons: [6, 7, 8, 9, 10, 11], bait: "메탈지그" },
  filefish: { seasons: [6, 7, 8, 9, 10], bait: "조개살" },
  pufferfish: { seasons: [5, 6, 7, 8, 9], bait: "오징어살" },
  eel: { seasons: [5, 6, 7, 8, 9, 10], bait: "오징어살" },
  coastal: { seasons: [4, 5, 6, 7, 8, 9, 10], bait: "갯지렁이" },
  squid: { seasons: [4, 5, 6, 9, 10, 11, 12], bait: "에기" },
  octopus: { seasons: [3, 4, 5, 9, 10, 11], bait: "왕눈이에기" },
};

type GuideFish = Pick<
  Fish,
  "collection_group" | "recommended_baits" | "min_size_cm" | "peak_seasons" | "habitat_regions" | "habitat_environment"
>;

/** [3,4,5,9,10,11] → "3–5·9–11월". 빈 배열은 null. */
export const formatSeasonRanges = (months: number[]) => {
  const sorted = [...new Set(months)].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const ranges: Array<[number, number]> = [];
  let start = sorted[0];
  let end = sorted[0];
  for (const month of sorted.slice(1)) {
    if (month === end + 1) {
      end = month;
    } else {
      ranges.push([start, end]);
      start = month;
      end = month;
    }
  }
  ranges.push([start, end]);
  return `${ranges
    .map(([rangeStart, rangeEnd]) => (rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}–${rangeEnd}`))
    .join("·")}월`;
};

const resolveGuide = (fish: GuideFish) => {
  const fallback = GROUP_CARD_GUIDES[fish.collection_group as CatalogGroup] ?? GROUP_CARD_GUIDES.coastal;
  const bait = fish.recommended_baits[0] ?? fallback.bait;
  const season =
    formatSeasonRanges(fish.peak_seasons.length > 0 ? fish.peak_seasons : fallback.seasons) ?? "시즌 확인 중";
  return { bait, season };
};

/** 발견한 어종 카드의 한 줄 안내. 금지체장이 있으면 그것을, 없으면 제철을 앞세운다. */
export const getFishCardGuide = (fish: GuideFish) => {
  const { bait, season } = resolveGuide(fish);
  if (fish.min_size_cm) return `금지체장 ${fish.min_size_cm}cm · 미끼 ${bait}`;
  return `제철 ${season} · 미끼 ${bait}`;
};

/** 이보다 긴 서식 환경 설명은 잠긴 카드 한 줄에 넣지 않는다. */
const MAX_ENVIRONMENT_LENGTH = 12;

export type LockedFishHint = {
  /** "제철 3–5·9–11월 · 미끼 웜" */
  tactic: string;
  /** "남해·제주 · 갯바위" 같은 장소 힌트. 데이터가 없으면 null. */
  where: string | null;
};

/**
 * 잠긴(미발견) 어종 카드에 보여 줄 힌트. 이름·학명·사진은 숨기되, "언제 어디서
 * 무엇으로" 노리면 되는지는 알려 줘야 다음 출조 목표가 된다.
 */
export const getLockedFishHint = (fish: GuideFish): LockedFishHint => {
  const { bait, season } = resolveGuide(fish);
  const regions = fish.habitat_regions.filter((region) => region.trim()).slice(0, 3).join("·");
  // habitat_environment는 문장인 경우가 많다. 한 줄에 들어갈 짧은 값("갯바위")만 붙인다.
  const environment = fish.habitat_environment?.trim() ?? "";
  const shortEnvironment = environment.length > 0 && environment.length <= MAX_ENVIRONMENT_LENGTH ? environment : "";
  const where = [regions, shortEnvironment].filter(Boolean).join(" · ") || null;
  return { tactic: `제철 ${season} · 미끼 ${bait}`, where };
};
