export const MIN_PASSWORD_LENGTH = 6;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 재설정 메일 요청 전 입력 검증. 문제 없으면 null. */
export const validateResetEmail = (email: string): string | null => {
  const trimmed = email.trim();
  if (!trimmed) return "가입한 이메일 주소를 입력해 주세요.";
  if (!EMAIL_PATTERN.test(trimmed)) return "올바른 이메일 주소 형식이 아닙니다.";
  return null;
};

/** 새 비밀번호 입력 검증. 문제 없으면 null. */
export const validateNewPassword = (password: string, confirm: string): string | null => {
  if (!password || !confirm) return "새 비밀번호를 두 번 입력해 주세요.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.`;
  }
  if (password !== confirm) return "비밀번호가 일치하지 않습니다.";
  return null;
};

/** Supabase가 돌려주는 영문 오류를 사용자 문구로 바꾼다. */
export const passwordResetErrorMessage = (error: { message?: string } | null | undefined) => {
  const message = error?.message?.toLowerCase() ?? "";
  if (message.includes("same password") || message.includes("different from the old")) {
    return "이전과 다른 비밀번호를 입력해 주세요.";
  }
  if (message.includes("expired") || message.includes("invalid") || message.includes("otp")) {
    return "재설정 링크가 만료됐거나 올바르지 않습니다. 메일을 다시 요청해 주세요.";
  }
  if (message.includes("rate limit") || message.includes("too many")) {
    return "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (message.includes("network") || message.includes("fetch")) {
    return "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
  }
  return "비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.";
};
