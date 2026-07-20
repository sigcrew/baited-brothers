type ErrorLike = {
  message?: string;
  status?: number;
  code?: string;
};

export const toUserMessage = (
  error: unknown,
  fallback = "요청을 처리하지 못했습니다.",
) => {
  const value = (error ?? {}) as ErrorLike;
  const message = value.message?.toLowerCase() ?? "";

  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("timeout")
  ) {
    return "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
  }
  if (value.status === 413 || message.includes("smaller captured image")) {
    return "사진 용량이 너무 큽니다. 더 작은 사진으로 다시 시도해 주세요.";
  }
  if (value.status === 401 || message.includes("invalid session")) {
    return "로그인 세션이 만료되었습니다. 다시 로그인해 주세요.";
  }
  if (value.code === "23505" || message.includes("duplicate")) {
    return "이미 저장된 조과입니다.";
  }

  return value.message?.trim() || fallback;
};

export const withTimeout = async <T>(
  task: Promise<T>,
  timeoutMs: number,
  timeoutMessage = "요청 시간이 초과되었습니다.",
) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  try {
    return await Promise.race([task, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};
