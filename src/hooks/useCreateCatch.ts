import { useState } from "react";
import { supabase } from "@/src/lib/supabase";
import { useAuth } from "@/src/contexts/AuthContext";
import type { Database, TablesInsert } from "@/src/types/database";
import { toUserMessage, withTimeout } from "@/src/lib/appErrors";
import {
  removeUserMedia,
  uploadUserPhotoVariants,
} from "@/src/lib/userMedia";
import { trackAnalyticsEvent } from "@/src/lib/analytics";
import { captureCatchConditions } from "@/src/lib/catchConditions";
import {
  countsForCollectionRewards,
  type CatchVerificationStatus,
} from "@/src/lib/catchRewards";

type CreateCatchInput = {
  tripId?: string;
  fishId?: string;
  customSpeciesName?: string;
  imageUri: string;
  mimeType: "image/jpeg" | "image/png";
  imageWidth: number;
  imageHeight: number;
  latitude?: number;
  longitude?: number;
  capturedAt?: string;
  locationAccuracyM?: number;
  locationCapturedAt?: string;
  captureMethod?: Database["public"]["Enums"]["capture_method"];
  sizeCm?: number;
  memo?: string;
  candidateFishIds?: string[];
  idMethod?: "closed_set_candidates" | "fallback_catalog";
  clientRequestId: string;
};

type CreateCatchResult = {
  error: Error | null;
  catchId: string | null;
  isFirstDiscovery: boolean;
  discoveredCount: number;
  verificationStatus: CatchVerificationStatus;
  verificationReason: string | null;
};

type VerifyCatchResponse = {
  status: CatchVerificationStatus;
  reason: string | null;
};

const verifySavedCatch = async (
  catchId: string,
): Promise<VerifyCatchResponse> => {
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke<VerifyCatchResponse>("verify-catch", {
        body: { catchId },
      }),
      45_000,
      "조과 인증 확인 시간이 초과되었습니다.",
    );
    if (error || !data?.status) {
      return { status: "pending", reason: null };
    }
    return { status: data.status, reason: data.reason ?? null };
  } catch {
    return { status: "pending", reason: null };
  }
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
        verificationStatus: "general_record",
        verificationReason: "authentication_required",
      };
    }

    setIsSaving(true);
    let uploadedPaths: string[] = [];
    let saveStage: "discovery" | "photo_upload" | "database_insert" =
      "discovery";
    void trackAnalyticsEvent("catch_save_started", {
      capture_method: input.captureMethod ?? "live_camera",
      has_trip: Boolean(input.tripId),
    });

    try {
      const customSpeciesName = input.customSpeciesName?.trim() || null;
      if (Boolean(input.fishId) === Boolean(customSpeciesName)) {
        throw new Error("도감 어종 또는 도감 밖 어종 이름 중 하나를 선택해 주세요.");
      }
      const { data: discoveryRows, error: discoveryError } = await supabase
        .from("user_catches")
        .select("fish_id")
        .eq("user_id", userId)
        .in("verification_status", [
          "verified",
          "field_verified",
          "metadata_verified",
        ]);
      if (discoveryError) throw discoveryError;
      const discoveredFishIds = new Set(
        (discoveryRows ?? [])
          .map((row) => row.fish_id)
          .filter((fishId): fishId is string => Boolean(fishId)),
      );
      saveStage = "photo_upload";
      const uploaded = await withTimeout(
        uploadUserPhotoVariants({
          userId,
          folder: "catches",
          photo: {
            uri: input.imageUri,
            width: input.imageWidth,
            height: input.imageHeight,
            mimeType: "image/jpeg",
          },
        }),
        45_000,
        "사진 업로드 시간이 초과되었습니다.",
      );
      uploadedPaths = [uploaded.imagePath, uploaded.thumbnailPath];

      const payload: TablesInsert<"user_catches"> = {
        user_id: userId,
        trip_id: input.tripId ?? null,
        fish_id: input.fishId ?? null,
        custom_species_name: customSpeciesName,
        image_url: null,
        image_path: uploaded.imagePath,
        thumbnail_path: uploaded.thumbnailPath,
        caught_at: input.capturedAt ?? new Date().toISOString(),
        captured_at: input.capturedAt ?? null,
        location_lat: input.latitude ?? null,
        location_lng: input.longitude ?? null,
        location_accuracy_m: input.locationAccuracyM ?? null,
        location_captured_at: input.locationCapturedAt ?? null,
        size_cm: input.sizeCm ?? null,
        memo: input.memo?.trim() || null,
        capture_method: input.captureMethod ?? "live_camera",
        id_method: input.fishId
          ? input.idMethod ?? "fallback_catalog"
          : null,
        candidate_fish_ids: input.candidateFishIds ?? [],
        verification_status: "pending",
        verification_reason: null,
        client_request_id: input.clientRequestId,
      };

      saveStage = "database_insert";
      const { data: insertedCatch, error: insertError } = await supabase
        .from("user_catches")
        .insert(payload)
        .select("id")
        .single();
      if (insertError?.code === "23505") {
        await removeUserMedia(uploadedPaths);
        const { data: existingCatch } = await supabase
          .from("user_catches")
          .select("id, fish_id, verification_status, verification_reason")
          .eq("user_id", userId)
          .eq("client_request_id", input.clientRequestId)
          .maybeSingle();
        const existingVerification =
          existingCatch?.id && existingCatch.verification_status === "pending"
            ? await verifySavedCatch(existingCatch.id)
            : {
                status: existingCatch?.verification_status ?? "pending",
                reason: existingCatch?.verification_reason ?? null,
              };
        void trackAnalyticsEvent("catch_save_succeeded", {
          capture_method: payload.capture_method ?? "unknown",
          idempotent_retry: true,
          has_trip: Boolean(input.tripId),
        });
        return {
          error: null,
          catchId: existingCatch?.id ?? null,
          isFirstDiscovery: false,
          discoveredCount: discoveredFishIds.size,
          verificationStatus: existingVerification.status,
          verificationReason: existingVerification.reason,
        };
      }
      if (insertError) {
        await removeUserMedia(uploadedPaths);
        throw insertError;
      }

      const {
        status: verificationStatus,
        reason: verificationReason,
      } = input.fishId
        ? await verifySavedCatch(insertedCatch.id)
        : {
            status: "general_record" as const,
            reason: "species_outside_catalog",
          };
      const isVerified = countsForCollectionRewards(verificationStatus);
      const isFirstDiscovery =
        Boolean(input.fishId) &&
        isVerified &&
        !discoveredFishIds.has(input.fishId!);

      void trackAnalyticsEvent("catch_created", {
        id_method: payload.id_method ?? "unknown",
        species_source: input.fishId ? "field_60" : "outside_catalog",
        capture_method: payload.capture_method ?? "unknown",
        verified: isVerified,
        first_discovery: isFirstDiscovery,
        has_trip: Boolean(input.tripId),
        has_size: input.sizeCm != null,
        has_note: Boolean(input.memo?.trim()),
      });
      void trackAnalyticsEvent("catch_save_succeeded", {
        capture_method: payload.capture_method ?? "unknown",
        verified: isVerified,
        first_discovery: isFirstDiscovery,
        has_trip: Boolean(input.tripId),
      });
      if (input.latitude != null && input.longitude != null) {
        void captureCatchConditions({
          catchId: insertedCatch.id,
          userId,
          latitude: input.latitude,
          longitude: input.longitude,
        });
      }
      return {
        error: null,
        catchId: insertedCatch.id,
        isFirstDiscovery,
        discoveredCount:
          discoveredFishIds.size + (isFirstDiscovery ? 1 : 0),
        verificationStatus,
        verificationReason,
      };
    } catch (error) {
      const failureKind =
        error instanceof Error && error.message.includes("초과")
          ? "timeout"
          : saveStage;
      void trackAnalyticsEvent("catch_save_failed", {
        failure_kind: failureKind,
        stage: saveStage,
      });
      if (saveStage === "photo_upload") {
        void trackAnalyticsEvent("photo_upload_failed", {
          failure_kind: failureKind,
        });
      }
      return {
        error: new Error(toUserMessage(error, "조과 저장에 실패했습니다.")),
        catchId: null,
        isFirstDiscovery: false,
        discoveredCount: 0,
        verificationStatus: "general_record",
        verificationReason: "save_failed",
      };
    } finally {
      setIsSaving(false);
    }
  };

  return { createCatch, isSaving };
};
