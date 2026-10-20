const text = (value: unknown, max: number, required = false) => {
  if (typeof value !== "string" || (required && !value.trim()) || value.length > max) {
    if (required) throw new Error("Invalid text field");
    return null;
  }
  return value.trim();
};
export function normalizeContribution(value: Record<string, unknown>) {
  if (value.consent !== true || value.consentVersion !== "recognition-photo-v1") throw new Error("Current consent is required");
  const imageBase64 = value.imageBase64;
  if (typeof imageBase64 !== "string" || imageBase64.length > 3_000_000 ||
    !/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(imageBase64) || imageBase64.length % 4 !== 0) throw new Error("A small JPEG is required");
  const input = value.analysis as Record<string, unknown> | undefined;
  if (!input || !["succeeded", "rejected", "failed"].includes(String(input.status))) throw new Error("Invalid analysis status");
  if (!Array.isArray(input.candidates) || input.candidates.length > 3) throw new Error("Invalid candidates");
  const candidates = input.candidates.map((candidate: Record<string, unknown>) => {
    if (!candidate || typeof candidate.fishId !== "string" || !/^[0-9a-f-]{36}$/i.test(candidate.fishId) ||
      typeof candidate.confidence !== "number" || !Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1) throw new Error("Invalid candidate");
    return { fishId: candidate.fishId, confidence: candidate.confidence, reason: text(candidate.reason, 500) };
  });
  if (input.status !== "succeeded" && candidates.length) throw new Error("Rejected/failed analysis cannot have predictions");
  const durationMs = typeof input.durationMs === "number" && Number.isFinite(input.durationMs) ? Math.max(0, Math.min(180000, Math.round(input.durationMs))) : null;
  return {
    analysisId: text(value.analysisId, 120, true)!, clientRequestId: text(value.clientRequestId, 120, true)!, imageBase64,
    analysis: { status: input.status, candidates, model: text(input.model, 100), version: text(input.version, 100),
      durationMs, note: text(input.note, 600), failureKind: text(input.failureKind, 40) },
  };
}
