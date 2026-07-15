export type BadgeDefinition = {
  id: string;
  title: string;
  description: string;
  accent: string;
};

/** 기본 뱃지 카탈로그 — 해금 여부는 조과/일정 카운트로 판정 */
export const BADGE_CATALOG: BadgeDefinition[] = [
  {
    id: "first_catch",
    title: "첫 조과",
    description: "처음으로 조과를 기록했어요",
    accent: "#0F766E",
  },
  {
    id: "species_3",
    title: "초보 수집가",
    description: "서로 다른 어종 3종을 모았어요",
    accent: "#0E7490",
  },
  {
    id: "species_10",
    title: "도감 탐험가",
    description: "서로 다른 어종 10종을 모았어요",
    accent: "#155E75",
  },
  {
    id: "catches_5",
    title: "손맛 다섯 번",
    description: "조과 기록을 5번 남겼어요",
    accent: "#1D4ED8",
  },
  {
    id: "trip_first",
    title: "첫 출조 완료",
    description: "출조 일정을 완료 처리했어요",
    accent: "#0369A1",
  },
  {
    id: "season_ready",
    title: "시즌 준비",
    description: "시즌 챌린지가 열리면 여기에 모입니다",
    accent: "#0F766E",
  },
];

export type BadgeUnlockContext = {
  catchCount: number;
  uniqueSpecies: number;
  completedTrips: number;
};

export const isBadgeUnlocked = (
  badgeId: string,
  ctx: BadgeUnlockContext
): boolean => {
  switch (badgeId) {
    case "first_catch":
      return ctx.catchCount >= 1;
    case "species_3":
      return ctx.uniqueSpecies >= 3;
    case "species_10":
      return ctx.uniqueSpecies >= 10;
    case "catches_5":
      return ctx.catchCount >= 5;
    case "trip_first":
      return ctx.completedTrips >= 1;
    case "season_ready":
      return false;
    default:
      return false;
  }
};
