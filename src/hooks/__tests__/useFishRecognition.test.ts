import { normalizeRecognitionResponse } from "../../lib/fishRecognition";

describe("normalizeRecognitionResponse", () => {
  const validIds = new Set(["fish-a", "fish-b"]);

  it("drops candidates outside the closed catalog and clamps confidence", () => {
    const result = normalizeRecognitionResponse(
      {
        candidates: [
          { fish_id: "fish-a", confidence: 1.4, reason: "체형 일치" },
          { fish_id: "not-allowed", confidence: 0.9 },
        ],
      },
      validIds,
    );
    expect(result.candidates).toEqual([
      { fishId: "fish-a", confidence: 1, reason: "체형 일치" },
    ]);
  });

  it("requires a retake when no usable candidate remains", () => {
    const result = normalizeRecognitionResponse(
      { candidates: [{ fish_id: "not-allowed" }] },
      validIds,
    );
    expect(result.needsRetake).toBe(true);
  });
});
