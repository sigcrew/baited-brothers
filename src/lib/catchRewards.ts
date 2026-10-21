import type { Database } from "@/src/types/database";

export type CatchVerificationStatus =
  Database["public"]["Enums"]["catch_verification_status"];

const COLLECTION_STATUSES = new Set<CatchVerificationStatus>([
  "verified",
  "field_verified",
  "metadata_verified",
]);

const RANKING_STATUSES = new Set<CatchVerificationStatus>([
  "verified",
  "field_verified",
]);

export const countsForCollectionRewards = (
  status: string | null | undefined,
) =>
  Boolean(
    status &&
      COLLECTION_STATUSES.has(status as CatchVerificationStatus),
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
  /** 도감·배지에 반영되는(인증된) 어종 id. */
  unlockedFishIds: Set<string>;
  /** 인증되지 않은 일반 기록 수. 카드에는 남지만 도감·배지에는 안 들어간다. */
  generalRecordCount: number;
  /** 일반 기록으로만 잡힌 어종 id. 도감에서 "잡긴 했지만 미인증"으로 표시할 대상. */
  generalRecordOnlyFishIds: Set<string>;
};

/**
 * 조과 목록을 도감 관점으로 요약한다. 사용자에게 "기록했는데 왜 수집 0이냐"를
 * 설명하려면 인증 조과와 일반 기록을 따로 세어야 한다.
 */
export const summarizeCollectionCoverage = (
  catches: ReadonlyArray<{ fish_id: string | null; verification_status: string | null }>,
): CollectionCoverage => {
  const unlockedFishIds = new Set<string>();
  const generalFishIds = new Set<string>();
  let generalRecordCount = 0;
  for (const item of catches) {
    if (countsForCollectionRewards(item.verification_status)) {
      if (item.fish_id) unlockedFishIds.add(item.fish_id);
    } else {
      generalRecordCount += 1;
      if (item.fish_id) generalFishIds.add(item.fish_id);
    }
  }
  const generalRecordOnlyFishIds = new Set([...generalFishIds].filter((id) => !unlockedFishIds.has(id)));
  return { unlockedFishIds, generalRecordCount, generalRecordOnlyFishIds };
};
