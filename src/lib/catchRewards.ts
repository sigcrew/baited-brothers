import type { Database } from "@/src/types/database";

export type CatchVerificationStatus =
  Database["public"]["Enums"]["catch_verification_status"];

const VERIFIED_STATUSES = new Set<CatchVerificationStatus>([
  "verified",
  "field_verified",
  "metadata_verified",
]);

const RANKING_STATUSES = new Set<CatchVerificationStatus>([
  "verified",
  "field_verified",
]);

/**
 * 위치로 인증된 조과(현장 인증 또는 사진 위치 인증)인지. 도감·배지 해금 조건이 아니라
 * 인증 표시와 분석 지표에만 쓴다. 도감·배지는 도감 60종 어종이면 모두 반영한다.
 */
export const isVerifiedCatch = (
  status: string | null | undefined,
) =>
  Boolean(
    status &&
      VERIFIED_STATUSES.has(status as CatchVerificationStatus),
  );

export const countsForRanking = (
  status: string | null | undefined,
) =>
  Boolean(
    status &&
      RANKING_STATUSES.has(status as CatchVerificationStatus),
  );

export const getVerificationLabel = (
  status: CatchVerificationStatus,
): string => {
  switch (status) {
    case "verified":
    case "field_verified":
      return "현장 인증";
    case "metadata_verified":
      return "사진 위치 인증";
    case "pending":
      return "인증 확인 중";
    case "unverified":
    case "general_record":
      return "일반 기록";
  }
};

export type CollectionCoverage = {
  /** 도감·배지에 반영되는 어종 id. 위치 인증 여부와 상관없이 도감 60종 어종이면 모두 들어간다. */
  unlockedFishIds: Set<string>;
};

/** 조과 목록을 도감 관점으로 요약한다. */
export const summarizeCollectionCoverage = (
  catches: ReadonlyArray<{ fish_id: string | null }>,
): CollectionCoverage => ({
  unlockedFishIds: new Set(
    catches.flatMap((item) => (item.fish_id ? [item.fish_id] : [])),
  ),
});
