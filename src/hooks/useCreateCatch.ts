import { useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import type { TablesInsert } from "@/src/types/database";

type CreateCatchInput = {
  tripId?: string;
  fishId: string;
  imageUri: string;
  latitude: number;
  longitude: number;
  locationCapturedAt: string;
  sizeCm?: number;
  memo?: string;
};

export const useCreateCatch = () => {
  const { session } = useAuth();
  const [isSaving, setIsSaving] = useState(false);

  const createCatch = async (input: CreateCatchInput) => {
    const userId = session?.user.id;
    if (!userId) return { error: new Error("로그인이 필요합니다.") };

    setIsSaving(true);
    const path = `${userId}/${Date.now()}.jpg`;

    try {
      const response = await fetch(input.imageUri);
      const image = await response.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from("user-uploads")
        .upload(path, image, { contentType: "image/jpeg", upsert: false });
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
        location_lat: input.latitude,
        location_lng: input.longitude,
        location_captured_at: input.locationCapturedAt,
        size_cm: input.sizeCm ?? null,
        memo: input.memo?.trim() || null,
        capture_method: "live_camera",
        id_method: "fallback_catalog",
        candidate_fish_ids: [],
        verification_status: "verified",
        verification_reason: null,
      };

      const { error: insertError } = await supabase.from("user_catches").insert(payload);
      if (insertError) {
        await supabase.storage.from("user-uploads").remove([path]);
        throw insertError;
      }
      return { error: null };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error("조과 저장에 실패했습니다.") };
    } finally {
      setIsSaving(false);
    }
  };

  return { createCatch, isSaving };
};
