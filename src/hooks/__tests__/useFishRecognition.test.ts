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

import { getRecognitionFunction } from '../../lib/fishRecognition';

describe('recognition experiment routing', () => {
  it('keeps release builds on production even when an experiment is configured', () => {
    expect(getRecognitionFunction(false, 'identify-fish-qa-evidence')).toBe('identify-fish');
  });
  it('allows the isolated experiment only in development and rejects unknown targets', () => {
    expect(getRecognitionFunction(true, 'identify-fish-qa-evidence')).toBe('identify-fish-qa-evidence');
    expect(getRecognitionFunction(true, 'other-function')).toBe('identify-fish');
    expect(getRecognitionFunction(true, undefined)).toBe('identify-fish');
  });
});

import { buildRecognitionAnalysis } from '../../lib/fishRecognition';
describe('consent-ready analysis snapshot', () => {
  const candidate={fishId:'fish-a',confidence:.7,reason:'무늬'};
  it('keeps prediction order and marks missing server metadata unknown',()=>{
    const a=buildRecognitionAnalysis('attempt',{candidates:[candidate],needsRetake:false,note:'확인 필요'},undefined,1234);
    expect(a.status).toBe('succeeded');expect(a.candidates).toEqual([candidate]);expect(a.model).toBeNull();expect(a.version).toBeNull();
  });
  it('distinguishes retake from network failure and never reuses candidates on failure',()=>{
    expect(buildRecognitionAnalysis('a',{candidates:[],needsRetake:true,note:'흐림'},{model:'m',version:'v'},3).status).toBe('rejected');
    const a=buildRecognitionAnalysis('b',{candidates:[candidate],needsRetake:false,note:null},undefined,4,'timeout');
    expect(a.status).toBe('failed');expect(a.candidates).toEqual([]);expect(a.failureKind).toBe('timeout');
  });
});
