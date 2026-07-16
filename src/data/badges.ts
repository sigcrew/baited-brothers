export type BadgeDefinition = {
  id: string;
  title: string;
  description: string;
  accent: string;
  category: "VOYAGE" | "FIELD NOTE" | "CATCH" | "SPECIMEN";
  requirement: string;
};

/** 기본 뱃지 카탈로그 — 해금 여부는 조과/일정 카운트로 판정 */
export const BADGE_CATALOG: BadgeDefinition[] = [
  {
    id: "trip_first",
    title: "첫 출항",
    description: "첫 출조를 완료했어요",
    accent: "#0B2730",
    category: "VOYAGE",
    requirement: "출조 1회 완료",
  },
  {
    id: "trips_5",
    title: "익숙한 항로",
    description: "출조를 5회 완료했어요",
    accent: "#17766D",
    category: "VOYAGE",
    requirement: "출조 5회 완료",
  },
  {
    id: "field_note",
    title: "필드 노트",
    description: "커버·메모·조과가 담긴 일지를 완성했어요",
    accent: "#E95A28",
    category: "FIELD NOTE",
    requirement: "커버·메모·조과를 포함한 완료 일지 1건",
  },
  {
    id: "dawn_trip",
    title: "새벽의 기록",
    description: "오전 6시 이전 출조를 완료했어요",
    accent: "#E95A28",
    category: "FIELD NOTE",
    requirement: "오전 3시부터 6시 사이 출조 1회 완료",
  },
  {
    id: "first_catch",
    title: "첫 손맛",
    description: "첫 조과를 기록했어요",
    accent: "#0F766E",
    category: "CATCH",
    requirement: "조과 1건 기록",
  },
  {
    id: "catches_5",
    title: "다섯 번의 손맛",
    description: "조과를 5건 기록했어요",
    accent: "#0B2730",
    category: "CATCH",
    requirement: "조과 5건 기록",
  },
  {
    id: "species_3",
    title: "도감의 시작",
    description: "서로 다른 어종 3종을 모았어요",
    accent: "#17766D",
    category: "SPECIMEN",
    requirement: "서로 다른 어종 3종 수집",
  },
  {
    id: "species_10",
    title: "바다 관찰자",
    description: "서로 다른 어종 10종을 모았어요",
    accent: "#17766D",
    category: "SPECIMEN",
    requirement: "서로 다른 어종 10종 수집",
  },
];

export type BadgeUnlockContext = {
  catchCount: number;
  uniqueSpecies: number;
  completedTrips: number;
  completeFieldNotes: number;
  dawnTrips: number;
  acquiredAt: Partial<Record<BadgeDefinition["id"], string>>;
};

export const isBadgeUnlocked = (
  badgeId: string,
  ctx: BadgeUnlockContext
): boolean => {
  switch (badgeId) {
    case "first_catch":
      return ctx.catchCount >= 1;
    case "catches_5":
      return ctx.catchCount >= 5;
    case "species_3":
      return ctx.uniqueSpecies >= 3;
    case "species_10":
      return ctx.uniqueSpecies >= 10;
    case "trip_first":
      return ctx.completedTrips >= 1;
    case "trips_5":
      return ctx.completedTrips >= 5;
    case "field_note":
      return ctx.completeFieldNotes >= 1;
    case "dawn_trip":
      return ctx.dawnTrips >= 1;
    default:
      return false;
  }
};

export const getBadgeProgress = (
  badgeId: string,
  ctx: BadgeUnlockContext
): { current: number; target: number; label: string } => {
  switch (badgeId) {
    case "trip_first":
      return { current: ctx.completedTrips, target: 1, label: "완료 출조" };
    case "trips_5":
      return { current: ctx.completedTrips, target: 5, label: "완료 출조" };
    case "field_note":
      return { current: ctx.completeFieldNotes, target: 1, label: "완성 일지" };
    case "dawn_trip":
      return { current: ctx.dawnTrips, target: 1, label: "새벽 출조" };
    case "first_catch":
      return { current: ctx.catchCount, target: 1, label: "조과 기록" };
    case "catches_5":
      return { current: ctx.catchCount, target: 5, label: "조과 기록" };
    case "species_3":
      return { current: ctx.uniqueSpecies, target: 3, label: "수집 어종" };
    case "species_10":
      return { current: ctx.uniqueSpecies, target: 10, label: "수집 어종" };
    default:
      return { current: 0, target: 1, label: "진행도" };
  }
};
