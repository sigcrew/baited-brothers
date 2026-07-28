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
