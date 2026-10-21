/**
 * 표시 이름 후보 중 비어 있지 않은 첫 값. Apple 재로그인으로 full_name이 ""로
 * 덮인 계정은 `??`만으로는 걸러지지 않으므로 공백 문자열도 없는 값으로 취급한다.
 */
export const pickDisplayName = (
  ...candidates: Array<string | null | undefined>
): string | null => {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (trimmed) return trimmed;
  }
  return null;
};

/**
 * 프로필 헤더의 "SINCE 2026.07" 표기. 가입 시각이 없거나 깨져 있으면 null.
 */
export const formatMemberSince = (createdAt: string | null | undefined): string | null => {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `SINCE ${date.getFullYear()}.${month}`;
};
