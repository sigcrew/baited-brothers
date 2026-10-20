// Release builds always use production, regardless of local experiment settings.
export const getRecognitionFunction = (isDevelopment: boolean, configured?: string) =>
  isDevelopment && configured === "identify-fish-qa-evidence"
    ? configured
    : "identify-fish";

export type RecognitionResponse = {
  metadata?: { model?: string; version?: string };
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

export type RecognitionAnalysis = {
  id: string;
  status: 'succeeded' | 'rejected' | 'failed';
  candidates: Array<{fishId:string;confidence:number;reason:string}>;
  model: string | null;
  version: string | null;
  durationMs: number;
  note: string | null;
  failureKind: string | null;
};
export const buildRecognitionAnalysis = (
  id: string,
  result: {candidates:RecognitionAnalysis['candidates'];needsRetake:boolean;note:string|null},
  metadata: {model?:string;version?:string} | undefined,
  durationMs: number,
  failureKind: string | null = null,
): RecognitionAnalysis => ({
  id,
  status: failureKind ? 'failed' : result.needsRetake || !result.candidates.length ? 'rejected' : 'succeeded',
  candidates: failureKind || result.needsRetake ? [] : result.candidates,
  model: typeof metadata?.model === 'string' ? metadata.model : null,
  version: typeof metadata?.version === 'string' ? metadata.version : null,
  durationMs,
  note: result.note,
  failureKind,
});
