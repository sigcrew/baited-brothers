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
    id: "trips_10",
    title: "노련한 항해",
    description: "출조를 10회 완료했어요",
    accent: "#E95A28",
    category: "VOYAGE",
    requirement: "출조 10회 완료",
  },
  {
    id: "spots_5",
    title: "다섯 개의 항로",
    description: "서로 다른 낚시터 5곳에서 출조를 완료했어요",
    accent: "#17766D",
    category: "VOYAGE",
    requirement: "낚시터 5곳에서 출조 완료",
  },
  {
    id: "trips_20",
    title: "항로의 주인",
    description: "출조를 20회 완료했어요",
    accent: "#E95A28",
    category: "VOYAGE",
    requirement: "출조 20회 완료",
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
    id: "night_trip",
    title: "밤바다의 불빛",
    description: "밤바다에서 출조를 완료했어요",
    accent: "#E95A28",
    category: "FIELD NOTE",
    requirement: "오후 6시부터 오전 3시 사이 출조 1회 완료",
  },
  {
    id: "field_notes_5",
    title: "기록의 습관",
    description: "완성 일지를 5건 기록했어요",
    accent: "#E95A28",
    category: "FIELD NOTE",
    requirement: "완성 일지 5건 기록",
  },
  {
    id: "seasons_4",
    title: "사계의 바다",
    description: "네 계절의 바다를 모두 기록했어요",
    accent: "#17766D",
    category: "FIELD NOTE",
    requirement: "봄·여름·가을·겨울 출조 완료",
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
    id: "catches_10",
    title: "열 번의 손맛",
    description: "조과를 10건 기록했어요",
    accent: "#E95A28",
    category: "CATCH",
    requirement: "조과 10건 기록",
  },
  {
    id: "catches_20",
    title: "스무 번의 손맛",
    description: "조과를 20건 기록했어요",
    accent: "#E95A28",
    category: "CATCH",
    requirement: "조과 20건 기록",
  },
  {
    id: "record_catch",
    title: "기록의 주인",
    description: "50cm 이상의 대어를 기록했어요",
    accent: "#E95A28",
    category: "CATCH",
    requirement: "50cm 이상 조과 1건 기록",
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
  {
    id: "species_20",
    title: "바다 탐구자",
    description: "서로 다른 어종 20종을 모았어요",
    accent: "#17766D",
    category: "SPECIMEN",
    requirement: "서로 다른 어종 20종 수집",
  },
  {
    id: "species_30",
    title: "바다 수집가",
    description: "서로 다른 어종 30종을 모았어요",
    accent: "#17766D",
    category: "SPECIMEN",
    requirement: "서로 다른 어종 30종 수집",
  },
  {
    id: "species_60",
    title: "도감의 완성",
    description: "도감의 60종을 모두 모았어요",
    accent: "#E95A28",
    category: "SPECIMEN",
    requirement: "도감 60종 전체 수집",
  },
];

export type BadgeUnlockContext = {
  catchCount: number;
  uniqueSpecies: number;
  completedTrips: number;
  completeFieldNotes: number;
  dawnTrips: number;
  nightTrips: number;
  completedSeasons: number;
  uniqueSpots: number;
  maxCatchSize: number;
  acquiredAt: Partial<Record<BadgeDefinition["id"], string>>;
};

type BadgeCatchInput = {
  caught_at: string;
  fish_id: string;
  size_cm: number | null;
  trip_id: string | null;
  verification_status: string | null;
};

type BadgeTripInput = {
  completed_at: string | null;
  cover_image_url: string | null;
  id: string;
  memo: string | null;
  scheduled_at: string;
  spot_name: string;
  status: string;
};

const getSpeciesMilestoneDate = (
  catches: BadgeCatchInput[],
  target: number,
) => {
  const species = new Set<string>();
  for (const item of catches) {
    if (item.verification_status !== "verified") continue;
    species.add(item.fish_id);
    if (species.size >= target) return item.caught_at;
  }
  return undefined;
};

const getSpotMilestoneDate = (trips: BadgeTripInput[], target: number) => {
  const spots = new Set<string>();
  for (const trip of trips) {
    const normalizedSpot = trip.spot_name.trim().toLocaleLowerCase();
    if (!normalizedSpot) continue;
    spots.add(normalizedSpot);
    if (spots.size >= target) return trip.completed_at ?? trip.scheduled_at;
  }
  return undefined;
};

const getSeason = (scheduledAt: string) => {
  const month = new Date(scheduledAt).getMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
};

const getSeasonMilestoneDate = (trips: BadgeTripInput[], target: number) => {
  const seasons = new Set<string>();
  for (const trip of trips) {
    seasons.add(getSeason(trip.scheduled_at));
    if (seasons.size >= target) return trip.completed_at ?? trip.scheduled_at;
  }
  return undefined;
};

export const createBadgeUnlockContext = (
  catches: BadgeCatchInput[],
  trips: BadgeTripInput[],
): BadgeUnlockContext => {
  const sortedCatches = [...catches].sort((a, b) =>
    a.caught_at.localeCompare(b.caught_at)
  );
  const doneTrips = trips
    .filter((trip) => trip.status === "done")
    .sort((a, b) =>
      (a.completed_at ?? a.scheduled_at).localeCompare(
        b.completed_at ?? b.scheduled_at
      )
    );
  const verifiedSpecies = new Set(
    sortedCatches
      .filter((item) => item.verification_status === "verified")
      .map((item) => item.fish_id)
  );
  const tripsWithCatches = new Set(
    sortedCatches.flatMap((item) => item.trip_id ? [item.trip_id] : [])
  );
  const completeNotes = doneTrips.filter((trip) =>
    Boolean(
      trip.cover_image_url &&
      trip.memo &&
      tripsWithCatches.has(trip.id)
    )
  );
  const dawnTrips = doneTrips.filter((trip) => {
    const hour = new Date(trip.scheduled_at).getHours();
    return hour >= 3 && hour < 6;
  });
  const nightTrips = doneTrips.filter((trip) => {
    const hour = new Date(trip.scheduled_at).getHours();
    return hour >= 18 || hour < 3;
  });
  const completedSeasons = new Set(
    doneTrips.map((trip) => getSeason(trip.scheduled_at))
  );
  const uniqueSpots = new Set(
    doneTrips
      .map((trip) => trip.spot_name.trim().toLocaleLowerCase())
      .filter(Boolean)
  );
  const maxCatchSize = sortedCatches.reduce(
    (largest, item) => Math.max(largest, item.size_cm ?? 0),
    0
  );
  const recordCatch = sortedCatches.find((item) => (item.size_cm ?? 0) >= 50);

  return {
    catchCount: sortedCatches.length,
    uniqueSpecies: verifiedSpecies.size,
    completedTrips: doneTrips.length,
    completeFieldNotes: completeNotes.length,
    dawnTrips: dawnTrips.length,
    nightTrips: nightTrips.length,
    completedSeasons: completedSeasons.size,
    uniqueSpots: uniqueSpots.size,
    maxCatchSize,
    acquiredAt: {
      trip_first: doneTrips[0]?.completed_at ?? doneTrips[0]?.scheduled_at,
      trips_5: doneTrips[4]?.completed_at ?? doneTrips[4]?.scheduled_at,
      trips_10: doneTrips[9]?.completed_at ?? doneTrips[9]?.scheduled_at,
      spots_5: getSpotMilestoneDate(doneTrips, 5),
      trips_20: doneTrips[19]?.completed_at ?? doneTrips[19]?.scheduled_at,
      field_note: completeNotes[0]?.completed_at ?? completeNotes[0]?.scheduled_at,
      dawn_trip: dawnTrips[0]?.completed_at ?? dawnTrips[0]?.scheduled_at,
      night_trip: nightTrips[0]?.completed_at ?? nightTrips[0]?.scheduled_at,
      field_notes_5: completeNotes[4]?.completed_at ?? completeNotes[4]?.scheduled_at,
      seasons_4: getSeasonMilestoneDate(doneTrips, 4),
      first_catch: sortedCatches[0]?.caught_at,
      catches_5: sortedCatches[4]?.caught_at,
      catches_10: sortedCatches[9]?.caught_at,
      catches_20: sortedCatches[19]?.caught_at,
      record_catch: recordCatch?.caught_at,
      species_3: getSpeciesMilestoneDate(sortedCatches, 3),
      species_10: getSpeciesMilestoneDate(sortedCatches, 10),
      species_20: getSpeciesMilestoneDate(sortedCatches, 20),
      species_30: getSpeciesMilestoneDate(sortedCatches, 30),
      species_60: getSpeciesMilestoneDate(sortedCatches, 60),
    },
  };
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
    case "catches_10":
      return ctx.catchCount >= 10;
    case "catches_20":
      return ctx.catchCount >= 20;
    case "record_catch":
      return ctx.maxCatchSize >= 50;
    case "species_3":
      return ctx.uniqueSpecies >= 3;
    case "species_10":
      return ctx.uniqueSpecies >= 10;
    case "species_20":
      return ctx.uniqueSpecies >= 20;
    case "species_30":
      return ctx.uniqueSpecies >= 30;
    case "species_60":
      return ctx.uniqueSpecies >= 60;
    case "trip_first":
      return ctx.completedTrips >= 1;
    case "trips_5":
      return ctx.completedTrips >= 5;
    case "trips_10":
      return ctx.completedTrips >= 10;
    case "trips_20":
      return ctx.completedTrips >= 20;
    case "spots_5":
      return ctx.uniqueSpots >= 5;
    case "field_note":
      return ctx.completeFieldNotes >= 1;
    case "dawn_trip":
      return ctx.dawnTrips >= 1;
    case "night_trip":
      return ctx.nightTrips >= 1;
    case "field_notes_5":
      return ctx.completeFieldNotes >= 5;
    case "seasons_4":
      return ctx.completedSeasons >= 4;
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
    case "trips_10":
      return { current: ctx.completedTrips, target: 10, label: "완료 출조" };
    case "trips_20":
      return { current: ctx.completedTrips, target: 20, label: "완료 출조" };
    case "spots_5":
      return { current: ctx.uniqueSpots, target: 5, label: "완료 장소" };
    case "field_note":
      return { current: ctx.completeFieldNotes, target: 1, label: "완성 일지" };
    case "dawn_trip":
      return { current: ctx.dawnTrips, target: 1, label: "새벽 출조" };
    case "night_trip":
      return { current: ctx.nightTrips, target: 1, label: "야간 출조" };
    case "field_notes_5":
      return { current: ctx.completeFieldNotes, target: 5, label: "완성 일지" };
    case "seasons_4":
      return { current: ctx.completedSeasons, target: 4, label: "출조 계절" };
    case "first_catch":
      return { current: ctx.catchCount, target: 1, label: "조과 기록" };
    case "catches_5":
      return { current: ctx.catchCount, target: 5, label: "조과 기록" };
    case "catches_10":
      return { current: ctx.catchCount, target: 10, label: "조과 기록" };
    case "catches_20":
      return { current: ctx.catchCount, target: 20, label: "조과 기록" };
    case "record_catch":
      return { current: ctx.maxCatchSize, target: 50, label: "최대 크기(cm)" };
    case "species_3":
      return { current: ctx.uniqueSpecies, target: 3, label: "수집 어종" };
    case "species_10":
      return { current: ctx.uniqueSpecies, target: 10, label: "수집 어종" };
    case "species_20":
      return { current: ctx.uniqueSpecies, target: 20, label: "수집 어종" };
    case "species_30":
      return { current: ctx.uniqueSpecies, target: 30, label: "수집 어종" };
    case "species_60":
      return { current: ctx.uniqueSpecies, target: 60, label: "수집 어종" };
    default:
      return { current: 0, target: 1, label: "진행도" };
  }
};
