import { useCallback, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import type { Fish } from "@/src/hooks/useFishes";

export type FishRecognitionCandidate = {
  fishId: string;
  confidence: number;
  reason: string;
};

type RecognitionResponse = {
  candidates?: Array<{
    fish_id?: string;
    confidence?: number;
    reason?: string;
  }>;
  needs_retake?: boolean;
  note?: string;
};

type RecognizeInput = {
  imageBase64: string;
  mimeType?: string;
  fishes: Fish[];
};

export const useFishRecognition = () => {
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const recognize = useCallback(async ({
    imageBase64,
    mimeType = "image/jpeg",
    fishes,
  }: RecognizeInput) => {
    setIsRecognizing(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke<
        RecognitionResponse
      >("identify-fish", {
        body: {
          imageBase64,
          mimeType,
          catalog: fishes.slice(0, 80).map((fish) => ({
            id: fish.id,
            nameKo: fish.name_ko ?? fish.name,
            scientificName: fish.name,
            group: fish.collection_group,
            identificationFeatures: fish.identification_features,
            similarSpeciesNotes: fish.similar_species_notes,
          })),
        },
      });

      if (invokeError) throw invokeError;

      const validFishIds = new Set(fishes.map((fish) => fish.id));
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
        error: null,
      };
    } catch (recognitionError) {
      const normalized =
        recognitionError instanceof Error
          ? recognitionError
          : new Error("AI 어종 추천에 실패했습니다.");
      setError(normalized);
      return {
        candidates: [] as FishRecognitionCandidate[],
        needsRetake: false,
        note: null,
        error: normalized,
      };
    } finally {
      setIsRecognizing(false);
    }
  }, []);

  return { recognize, isRecognizing, error };
};
