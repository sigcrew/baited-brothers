export type AppleFullName = {
  givenName?: string | null;
  familyName?: string | null;
} | null;

/**
 * Apple은 최초 로그인에만 이름을 주고, 이후에는 모든 필드가 null인 fullName 객체를
 * 돌려준다. 실제 이름이 하나라도 있을 때만 user_metadata 갱신 페이로드를 만든다.
 * (예전에는 빈 문자열로 덮어써서 재로그인마다 이름이 사라졌다.)
 */
export const buildAppleNameUpdate = (fullName: AppleFullName) => {
  const givenName = fullName?.givenName?.trim() || null;
  const familyName = fullName?.familyName?.trim() || null;
  if (!givenName && !familyName) return null;
  return {
    full_name: [givenName, familyName].filter(Boolean).join(" "),
    given_name: givenName ?? undefined,
    family_name: familyName ?? undefined,
  };
};
