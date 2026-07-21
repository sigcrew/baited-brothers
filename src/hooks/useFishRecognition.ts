import { useCallback, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import type { Fish } from "@/src/hooks/useFishes";
import { toUserMessage, withTimeout } from "@/src/lib/appErrors";
import {
  normalizeRecognitionResponse,
  type RecognitionResponse,
} from "@/src/lib/fishRecognition";
import { trackAnalyticsEvent } from "@/src/lib/analytics";

export type FishRecognitionCandidate = {
  fishId: string;
  confidence: number;
  reason: string;
};

type RecognizeInput = {
  imageBase64: string;
  mimeType?: string;
  fishes: Fish[];
};

export const useFishRecognition = () => {
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const recognize = useCallback(
    async ({
      imageBase64,
      mimeType = "image/jpeg",
      fishes,
    }: RecognizeInput) => {
      const startedAt = Date.now();
      setIsRecognizing(true);
      setError(null);
      void trackAnalyticsEvent("ai_analysis_started", {
        catalog_count: fishes.length,
      });

      try {
        const { data, error: invokeError } = await withTimeout(
          supabase.functions.invoke<RecognitionResponse>("identify-fish", {
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
          }),
          60_000,
          "AI 판별 시간이 초과되었습니다.",
        );

        if (invokeError) throw invokeError;

        const validFishIds = new Set(fishes.map((fish) => fish.id));
        const normalized = normalizeRecognitionResponse(data, validFishIds);

        void trackAnalyticsEvent(
          normalized.needsRetake || normalized.candidates.length === 0
            ? "ai_analysis_rejected"
            : "ai_analysis_succeeded",
          {
            duration_ms: Date.now() - startedAt,
            candidate_count: normalized.candidates.length,
            needs_retake: normalized.needsRetake,
          },
        );

        return {
          ...normalized,
          error: null,
        };
      } catch (recognitionError) {
        const durationMs = Date.now() - startedAt;
        const normalized = new Error(
          toUserMessage(recognitionError, "AI 어종 추천에 실패했습니다."),
        );
        void trackAnalyticsEvent("ai_analysis_failed", {
          duration_ms: durationMs,
          failure_kind: normalized.message.includes("초과") ? "timeout" : "request",
        });
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
    },
    [],
  );

  return { recognize, isRecognizing, error };
};
