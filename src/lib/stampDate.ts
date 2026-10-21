/**
 * 모노 폰트(SpaceMono) 자리에 쓰는 날짜·시각 스탬프. SpaceMono에는 한글 글리프가 없어서
 * "오전 6:00"처럼 한글이 섞이면 대체 폰트로 깨져 보인다. 여기서는 영문·숫자만 쓴다.
 */
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

const pad = (value: number) => String(value).padStart(2, "0");
const toDate = (value: string | Date) => (typeof value === "string" ? new Date(value) : value);

/** "06:00" (24시간). */
export const stampTime = (value: string | Date) => {
  const date = toDate(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/** "09.11 FRI 06:00". 같은 해 일정 목록용. */
export const stampShortDateTime = (value: string | Date) => {
  const date = toDate(value);
  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${WEEKDAYS[date.getDay()]} ${stampTime(date)}`;
};

/** "2026.09.11 FRI 06:00". 상세 화면용. */
export const stampFullDateTime = (value: string | Date) => {
  const date = toDate(value);
  return `${date.getFullYear()}.${stampShortDateTime(date)}`;
};
