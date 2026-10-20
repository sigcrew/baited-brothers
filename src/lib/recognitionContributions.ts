import { supabase } from "./supabase";
import { withTimeout } from "./appErrors";
export const CONTRIBUTION_CONSENT_VERSION = "recognition-photo-v1";
export const CONTRIBUTION_CONSENT_TEXT =
  "이 사진과 AI 후보·점수·판단 이유·처리 결과, 이후 저장하거나 수정한 어종 선택을 어종 판별 품질 검토에 제공합니다. 실패한 사진도 포함될 수 있습니다. 위치·메모는 별도로 제공하지 않습니다. 최대 90일 보관하며 공개하거나 자동 학습에 사용하지 않습니다. 설정의 사진 제공 관리에서 언제든 철회·삭제할 수 있고, 원래 조과 기록은 유지됩니다. 제공하지 않아도 모든 기록 기능을 사용할 수 있습니다. 사람이 나온 사진이나 다른 사람의 개인정보가 있는 사진은 제공하지 마세요.";
export async function recognitionContributionRequest<T>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await withTimeout(
    supabase.functions.invoke<T>("recognition-contributions", { body }),
    45000,
    "자료 처리 시간이 초과되었습니다. 잠시 후 다시 확인해 주세요.",
  );
  if (error)
    throw new Error(
      "자료를 처리하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.",
    );
  return data as T;
}
