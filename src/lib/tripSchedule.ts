const DAY_MS = 86_400_000;

/** 달력 날짜 기준 자정. D-day는 시각이 아니라 날짜 차이로 센다. */
const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

export type TripCountdown =
  | { kind: "upcoming"; daysAway: number }
  | { kind: "today" }
  | { kind: "overdue"; daysOverdue: number };

/**
 * 출조 예정일과 오늘의 관계. 지난 예정 출조는 D-0으로 뭉개지 않고 overdue로 돌려준다.
 */
export const tripCountdown = (scheduledAt: string | Date, now: Date = new Date()): TripCountdown => {
  const scheduled = startOfDay(typeof scheduledAt === "string" ? new Date(scheduledAt) : scheduledAt);
  const today = startOfDay(now);
  const diffDays = Math.round((scheduled.getTime() - today.getTime()) / DAY_MS);
  if (diffDays > 0) return { kind: "upcoming", daysAway: diffDays };
  if (diffDays === 0) return { kind: "today" };
  return { kind: "overdue", daysOverdue: -diffDays };
};

/** 홈 카운트다운 표기: "D-3", "D-DAY", "D+40". */
export const formatCountdown = (countdown: TripCountdown) => {
  switch (countdown.kind) {
    case "upcoming":
      return `D-${countdown.daysAway}`;
    case "today":
      return "D-DAY";
    case "overdue":
      return `D+${countdown.daysOverdue}`;
  }
};

/** 예정일이 어제 이전인 '예정' 출조. 완료·취소로 정리해 달라고 안내할 대상. */
export const isTripOverdue = (scheduledAt: string | Date, now: Date = new Date()) =>
  tripCountdown(scheduledAt, now).kind === "overdue";

type Scheduled = { scheduled_at: string };

/**
 * 홈의 "다음 출조": 오늘 이후(오늘 포함) 예정 출조 중 가장 이른 것. 모두 지났으면
 * 가장 최근에 지난 것을 돌려줘서 정리(완료/취소)를 유도한다.
 */
export const pickNextTrip = <T extends Scheduled>(plannedTrips: readonly T[], now: Date = new Date()) => {
  const sorted = [...plannedTrips].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const overdueCount = sorted.filter((trip) => isTripOverdue(trip.scheduled_at, now)).length;
  const upcoming = sorted.find((trip) => !isTripOverdue(trip.scheduled_at, now));
  const trip = upcoming ?? sorted[sorted.length - 1];
  return trip ? { trip, overdueCount } : null;
};

/** 지난 예정 출조 수. 홈·일지 배너용. */
export const countOverdueTrips = (plannedTrips: readonly Scheduled[], now: Date = new Date()) =>
  plannedTrips.filter((trip) => isTripOverdue(trip.scheduled_at, now)).length;
