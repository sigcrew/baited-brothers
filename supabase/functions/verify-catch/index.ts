import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { evaluateCoastalEvidence } from "./coastal-policy.ts";

type VerificationStatus =
  | "field_verified"
  | "metadata_verified"
  | "general_record";

type CatchRow = {
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

const VERIFICATION_VERSION = 2;
const MAX_LOCATION_ACCURACY_M = 100;
const MAX_LOCATION_TIME_DELTA_MS = 2 * 60 * 1_000;
const MAX_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const sha256 = async (value: ArrayBuffer) => {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const decideStatus = (
  row: CatchRow,
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
    capturedAtMs > Date.now() + MAX_FUTURE_CLOCK_SKEW_MS
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authorization = request.headers.get("Authorization");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Server secrets are not configured." }, 500);
  }
  if (!authorization) return json({ error: "Authentication required." }, 401);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "Invalid session." }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await request.json();
    const catchId = typeof body?.catchId === "string" ? body.catchId : "";
    if (!catchId) return json({ error: "catchId is required." }, 400);

    const { data, error: catchError } = await adminClient
      .from("user_catches")
      .select(
        "id, user_id, fish_id, species_corrected_at, capture_method, image_path, captured_at, location_lat, location_lng, location_accuracy_m, location_captured_at",
      )
      .eq("id", catchId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (catchError) throw catchError;
    if (!data) return json({ error: "Catch not found." }, 404);

    const row = data as CatchRow;
    if (!row.image_path) {
      return json({ error: "Catch image is unavailable." }, 400);
    }

    const { data: image, error: imageError } = await adminClient.storage
      .from("user-uploads")
      .download(row.image_path);
    if (imageError || !image) throw imageError ?? new Error("Image download failed");
    const imageHash = await sha256(await image.arrayBuffer());

    let decision = decideStatus(row);
    if (decision.status !== "general_record") {
      const { data: duplicate, error: duplicateError } = await adminClient
        .from("user_catches")
        .select("id")
        .eq("image_hash", imageHash)
        .in("verification_status", ["field_verified", "metadata_verified"])
        .neq("id", row.id)
        .limit(1)
        .maybeSingle();
      if (duplicateError) throw duplicateError;
      if (duplicate) {
        decision = { status: "general_record", reason: "duplicate_image" };
      }
    }

    const verifiedAt = new Date().toISOString();
    const update = {
      verification_status: decision.status,
      verification_reason: decision.reason,
      image_hash: imageHash,
      verification_version: VERIFICATION_VERSION,
      verified_at: verifiedAt,
    };
    let { error: updateError } = await adminClient
      .from("user_catches")
      .update(update)
      .eq("id", row.id)
      .eq("user_id", user.id);

    if (updateError?.code === "23505") {
      decision = { status: "general_record", reason: "duplicate_image" };
      ({ error: updateError } = await adminClient
        .from("user_catches")
        .update({
          ...update,
          verification_status: decision.status,
          verification_reason: decision.reason,
        })
        .eq("id", row.id)
        .eq("user_id", user.id));
    }
    if (updateError) throw updateError;

    const collectionEligible =
      Boolean(row.fish_id) && decision.status !== "general_record";
    const rankingEligible =
      Boolean(row.fish_id) &&
      row.species_corrected_at == null &&
      decision.status === "field_verified";

    return json({
      catchId: row.id,
      status: decision.status,
      reason: decision.reason,
      rewards: {
        collection: collectionEligible,
        badges: collectionEligible,
        personalBest: collectionEligible,
        ranking: rankingEligible,
      },
    });
  } catch (error) {
    console.error("Catch verification failed", error);
    return json({ error: "Catch verification failed." }, 500);
  }
});
