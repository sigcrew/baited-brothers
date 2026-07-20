import { useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import type { Database, TablesInsert } from "@/src/types/database";
import { toUserMessage, withTimeout } from "@/src/lib/appErrors";

type CreateCatchInput = {
  tripId?: string;
  fishId: string;
  imageUri: string;
  mimeType: "image/jpeg" | "image/png";
  latitude?: number;
  longitude?: number;
  locationCapturedAt?: string;
  captureMethod?: Database["public"]["Enums"]["capture_method"];
  sizeCm?: number;
  memo?: string;
  candidateFishIds?: string[];
  idMethod?: "closed_set_candidates" | "fallback_catalog";
  verificationReason?: string;
  clientRequestId: string;
};

type CreateCatchResult = {
  error: Error | null;
  catchId: string | null;
  isFirstDiscovery: boolean;
  discoveredCount: number;
};

export const useCreateCatch = () => {
  const { session } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const createCatch = async (
    input: CreateCatchInput,
  ): Promise<CreateCatchResult> => {
    const userId = session?.user.id;
    if (!userId) {
      return {
        error: new Error("로그인이 필요합니다."),
        catchId: null,
        isFirstDiscovery: false,
        discoveredCount: 0,
      };
    }

    setIsSaving(true);
    const extension = input.mimeType === "image/png" ? "png" : "jpg";
    const path = `${userId}/${Date.now()}.${extension}`;

    try {
      const { data: discoveryRows, error: discoveryError } = await supabase
        .from("user_catches")
        .select("fish_id")
        .eq("user_id", userId)
        .eq("verification_status", "verified");
      if (discoveryError) throw discoveryError;
      const discoveredFishIds = new Set(
        (discoveryRows ?? []).map((row) => row.fish_id),
      );
      const isFirstDiscovery = !discoveredFishIds.has(input.fishId);

      const response = await withTimeout(
        fetch(input.imageUri),
        15_000,
        "사진을 읽는 시간이 초과되었습니다.",
      );
      if (!response.ok) throw new Error("선택한 사진을 읽지 못했습니다.");
      const image = await response.arrayBuffer();
      const { error: uploadError } = await withTimeout(
        supabase.storage
          .from("user-uploads")
          .upload(path, image, { contentType: input.mimeType, upsert: false }),
        30_000,
        "사진 업로드 시간이 초과되었습니다.",
      );
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from("user-uploads")
        .getPublicUrl(path);

      const payload: TablesInsert<"user_catches"> = {
        user_id: userId,
        trip_id: input.tripId ?? null,
        fish_id: input.fishId,
        image_url: publicData.publicUrl,
        caught_at: new Date().toISOString(),
        location_lat: input.latitude ?? null,
        location_lng: input.longitude ?? null,
        location_captured_at: input.locationCapturedAt ?? null,
        size_cm: input.sizeCm ?? null,
        memo: input.memo?.trim() || null,
        capture_method: input.captureMethod ?? "live_camera",
        id_method: input.idMethod ?? "fallback_catalog",
        candidate_fish_ids: input.candidateFishIds ?? [],
        verification_status: "verified",
        verification_reason: input.verificationReason?.trim() || null,
        client_request_id: input.clientRequestId,
      };

      const { data: insertedCatch, error: insertError } = await supabase
        .from("user_catches")
        .insert(payload)
        .select("id")
        .single();
      if (insertError?.code === "23505") {
        await supabase.storage.from("user-uploads").remove([path]);
        const { data: existingCatch } = await supabase
          .from("user_catches")
          .select("id, fish_id")
          .eq("user_id", userId)
          .eq("client_request_id", input.clientRequestId)
          .maybeSingle();
        return {
          error: null,
          catchId: existingCatch?.id ?? null,
          isFirstDiscovery: false,
          discoveredCount: discoveredFishIds.size,
        };
      }
      if (insertError) {
        await supabase.storage.from("user-uploads").remove([path]);
        throw insertError;
      }
      return {
        error: null,
        catchId: insertedCatch.id,
        isFirstDiscovery,
        discoveredCount:
          discoveredFishIds.size + (isFirstDiscovery ? 1 : 0),
      };
    } catch (error) {
      return {
        error: new Error(toUserMessage(error, "조과 저장에 실패했습니다.")),
        catchId: null,
        isFirstDiscovery: false,
        discoveredCount: 0,
      };
    } finally {
      setIsSaving(false);
    }
  };

  return { createCatch, isSaving };
};
