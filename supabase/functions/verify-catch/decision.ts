import { evaluateCoastalEvidence } from "./coastal-policy.ts";

export type VerificationStatus =
  | "field_verified"
  | "metadata_verified"
  | "general_record";

export type CatchRow = {
  id: string;
  user_id: string;
  fish_id: string | null;
  species_corrected_at: string | null;
  capture_method: "live_camera" | "photo_library" | "development_upload" | null;
  image_path: string | null;
  captured_at: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_accuracy_m: number | null;
  location_captured_at: string | null;
};

export const VERIFICATION_VERSION = 2;
export const MAX_LOCATION_ACCURACY_M = 100;
export const MAX_LOCATION_TIME_DELTA_MS = 2 * 60 * 1_000;
export const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1_000;

/**
 * 서버 조과 인증 판정. 순수 함수라 Deno 테스트로 고정한다(decision_test.ts).
 * `now`는 테스트에서 시계를 고정하기 위한 주입 지점이다.
 */
export const decideStatus = (
  row: CatchRow,
  now: number = Date.now(),
): { status: VerificationStatus; reason: string | null } => {
  if (!row.fish_id) {
    return { status: "general_record", reason: "species_outside_catalog" };
  }
  if (row.capture_method === "development_upload") {
    return { status: "general_record", reason: "development_upload" };
  }
  if (
    row.location_lat == null ||
    row.location_lng == null ||
    row.captured_at == null
  ) {
    return { status: "general_record", reason: "location_unavailable" };
  }

  const capturedAtMs = new Date(row.captured_at).getTime();
  if (
    !Number.isFinite(capturedAtMs) ||
    capturedAtMs > now + MAX_FUTURE_CLOCK_SKEW_MS
  ) {
    return { status: "general_record", reason: "capture_timestamp_invalid" };
  }

  const coast = evaluateCoastalEvidence(row.location_lat, row.location_lng);
  if (!coast.allowed) {
    return {
      status: "general_record",
      reason: coast.reason ?? "outside_coastal_zone",
    };
  }

  if (row.capture_method === "photo_library") {
    return { status: "metadata_verified", reason: null };
  }
  if (row.capture_method !== "live_camera") {
    return { status: "general_record", reason: "capture_method_invalid" };
  }
  if (
    row.location_accuracy_m == null ||
    row.location_accuracy_m > MAX_LOCATION_ACCURACY_M
  ) {
    return { status: "general_record", reason: "location_accuracy_low" };
  }
  if (!row.location_captured_at) {
    return {
      status: "general_record",
      reason: "location_timestamp_stale",
    };
  }
  const locationAtMs = new Date(row.location_captured_at).getTime();
  if (
    !Number.isFinite(locationAtMs) ||
    Math.abs(capturedAtMs - locationAtMs) > MAX_LOCATION_TIME_DELTA_MS
  ) {
    return {
      status: "general_record",
      reason: "location_timestamp_stale",
    };
  }
  return { status: "field_verified", reason: null };
};
