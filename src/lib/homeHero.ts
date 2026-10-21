type SeasonalFish = {
  name_ko: string | null;
  peak_seasons: number[];
  catalog_sort_order: number | null;
};

/**
 * 히어로에 올리는 대표 어종과 낚시꾼이 실제로 부르는 이름. 도감 60종 중 이름만 들어도
 * 출조 욕구가 생기는 어종만 고른다(말쥐치·보구치처럼 낯선 이름은 뺀다).
 * 키는 도감 name_ko, 값은 히어로에 쓸 이름.
 */
export const HEADLINE_SPECIES: Readonly<Record<string, string>> = {
  넙치: "광어",
  도다리: "도다리",
  조피볼락: "우럭",
  볼락: "볼락",
  쥐노래미: "노래미",
  참돔: "참돔",
  감성돔: "감성돔",
  돌돔: "돌돔",
  벵에돔: "벵에돔",
  농어: "농어",
  고등어: "고등어",
  전갱이: "전갱이",
  방어: "방어",
  부시리: "부시리",
  삼치: "삼치",
  갈치: "갈치",
  전어: "전어",
  쥐치: "쥐치",
  붕장어: "붕장어",
  학공치: "학공치",
  참갑오징어: "갑오징어",
  흰꼴뚜기: "무늬오징어",
  창꼴뚜기: "한치",
  주꾸미: "주꾸미",
  참문어: "문어",
};

const dayOfYear = (date: Date) => {
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.floor((date.getTime() - start.getTime()) / 86_400_000);
};

/**
 * 이번 달이 제철인 대표 어종 하나. 같은 날에는 같은 어종이 나오고, 날마다 돌아가며 바뀐다.
 * 해당하는 어종이 없으면 null.
 */
export const pickSeasonalSpecies = (fishes: readonly SeasonalFish[], now: Date = new Date()) => {
  const month = now.getMonth() + 1;
  const candidates = fishes
    .filter((fish) => {
      const key = fish.name_ko?.trim();
      return Boolean(key && HEADLINE_SPECIES[key]) && fish.peak_seasons.includes(month);
    })
    .sort((a, b) => (a.catalog_sort_order ?? 999) - (b.catalog_sort_order ?? 999));
  if (candidates.length === 0) return null;
  const fish = candidates[dayOfYear(now) % candidates.length];
  return { month, name: HEADLINE_SPECIES[fish.name_ko!.trim()] };
};

export const HERO_FALLBACK_TITLE = "다음 손맛은 어디서?";
export const HERO_SUBTITLE = "지도에서 포인트를 고르고 물때를 확인하세요";

/** 다가오는 출조가 없을 때 히어로 제목. "10월, 갈치 시즌입니다". */
export const seasonalHeroTitle = (fishes: readonly SeasonalFish[], now: Date = new Date()) => {
  const pick = pickSeasonalSpecies(fishes, now);
  return pick ? `${pick.month}월, ${pick.name} 시즌입니다` : HERO_FALLBACK_TITLE;
};

/**
 * Anton 숫자 폭(em). 폰트 파일 hmtx에서 읽은 값: "1"만 좁고 나머지는 같다.
 * 예전에는 모든 숫자를 0.58em으로 어림해서 "11" 뒤가 크게 비었다.
 */
const ANTON_DIGIT_ADVANCE: Record<string, number> = { "1": 0.3306 };
const ANTON_DEFAULT_ADVANCE = 0.4941;

/** 숫자와 뒤따르는 "월·일" 사이 여백(글자 크기 대비). 숫자 폭과 상관없이 일정하다. */
const ANTON_TRAILING_GAP = 0.1;

/** 날짜 숫자 SVG 상자 폭. 왼쪽 2pt(x 오프셋) + 실제 글자 폭 + 일정한 뒤 여백. */
export const antonNumberWidth = (value: string, renderSize: number) => {
  const em = [...value].reduce((sum, char) => sum + (ANTON_DIGIT_ADVANCE[char] ?? ANTON_DEFAULT_ADVANCE), 0);
  return Math.ceil(2 + (em + ANTON_TRAILING_GAP) * renderSize);
};
