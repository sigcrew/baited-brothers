export type RecognitionResponse = {
  candidates?: Array<{
    fish_id?: string;
    confidence?: number;
    reason?: string;
  }>;
  needs_retake?: boolean;
  note?: string;
};

export const normalizeRecognitionResponse = (
  data: RecognitionResponse | null | undefined,
  validFishIds: Set<string>,
) => {
  const candidates = (data?.candidates ?? [])
    .filter(
      (candidate): candidate is {
        fish_id: string;
        confidence?: number;
        reason?: string;
      } =>
        typeof candidate.fish_id === "string" &&
        validFishIds.has(candidate.fish_id),
    )
    .slice(0, 3)
    .map((candidate) => ({
      fishId: candidate.fish_id,
      confidence: Math.min(1, Math.max(0, candidate.confidence ?? 0)),
      reason: candidate.reason?.trim() || "사진의 형태와 무늬를 비교했습니다.",
    }));

  return {
    candidates,
    needsRetake: data?.needs_retake ?? candidates.length === 0,
    note: data?.note?.trim() || null,
  };
};
