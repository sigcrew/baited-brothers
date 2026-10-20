/**
 * Supabase Auth가 돌려주는 영문 오류를 로그인·가입 화면용 한국어 문구로 바꾼다.
 * 알 수 없는 메시지는 그대로 노출하지 않고 일반 문구로 대체한다(내부 문구 유출 방지).
 */
export const authErrorMessage = (
  error: { message?: string; status?: number } | null | undefined,
  fallback = "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
) => {
  const message = error?.message?.toLowerCase() ?? "";
  if (message.includes("invalid login credentials") || message.includes("invalid credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (message.includes("email not confirmed")) {
    return "이메일 인증이 아직 끝나지 않았습니다. 받은 편지함의 확인 링크를 눌러 주세요.";
  }
  if (message.includes("already registered") || message.includes("already exists")) {
    return "이미 가입된 이메일입니다. 로그인하거나 비밀번호를 재설정해 주세요.";
  }
  if (message.includes("password should be at least") || message.includes("password is too short")) {
    return "비밀번호는 6자 이상이어야 합니다.";
  }
  if (message.includes("weak password") || message.includes("password should contain")) {
    return "더 복잡한 비밀번호를 사용해 주세요.";
  }
  if (message.includes("invalid email") || message.includes("unable to validate email")) {
    return "올바른 이메일 주소 형식이 아닙니다.";
  }
  if (message.includes("rate limit") || message.includes("too many") || error?.status === 429) {
    return "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (message.includes("signups not allowed") || message.includes("signup is disabled")) {
    return "지금은 새 가입을 받지 않습니다.";
  }
  if (message.includes("network") || message.includes("fetch") || message.includes("timeout")) {
    return "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
  }
  return fallback;
};
