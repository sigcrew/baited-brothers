import { assertEquals } from "jsr:@std/assert@1";
import { decideStatus, type CatchRow } from "./decision.ts";

const NOW = Date.parse("2026-10-20T03:00:00.000Z");
const BUSAN_SEA = { lat: 35.05, lng: 129.1 }; // 부산 앞바다, 연안 판정 통과
const SEOUL = { lat: 37.56, lng: 126.98 }; // 내륙, 연안 판정 실패

const row = (overrides: Partial<CatchRow> = {}): CatchRow => ({
  id: "c1",
  user_id: "u1",
  fish_id: "fish-1",
  species_corrected_at: null,
  capture_method: "live_camera",
  image_path: "u1/catches/c1.jpg",
  captured_at: new Date(NOW - 60_000).toISOString(),
  location_lat: BUSAN_SEA.lat,
  location_lng: BUSAN_SEA.lng,
  location_accuracy_m: 12,
  location_captured_at: new Date(NOW - 60_000).toISOString(),
  ...overrides,
});

Deno.test("a camera catch with coastal GPS, good accuracy and matching time is field_verified", () => {
  assertEquals(decideStatus(row(), NOW), { status: "field_verified", reason: null });
});

Deno.test("a library photo with coastal GPS is only metadata_verified (not ranking-eligible)", () => {
  assertEquals(
    decideStatus(row({ capture_method: "photo_library", location_accuracy_m: null, location_captured_at: null }), NOW),
    { status: "metadata_verified", reason: null },
  );
});

Deno.test("outside-catalog species and development uploads are general records", () => {
  assertEquals(decideStatus(row({ fish_id: null }), NOW), {
    status: "general_record",
    reason: "species_outside_catalog",
  });
  assertEquals(decideStatus(row({ capture_method: "development_upload" }), NOW), {
    status: "general_record",
    reason: "development_upload",
  });
});

Deno.test("missing location or capture time cannot be verified", () => {
  assertEquals(decideStatus(row({ location_lat: null }), NOW).reason, "location_unavailable");
  assertEquals(decideStatus(row({ captured_at: null }), NOW).reason, "location_unavailable");
});

Deno.test("a capture time in the future beyond clock skew is rejected", () => {
  const future = new Date(NOW + 10 * 60_000).toISOString();
  assertEquals(decideStatus(row({ captured_at: future, location_captured_at: future }), NOW).reason, "capture_timestamp_invalid");
  const withinSkew = new Date(NOW + 2 * 60_000).toISOString();
  assertEquals(decideStatus(row({ captured_at: withinSkew, location_captured_at: withinSkew }), NOW).status, "field_verified");
});

Deno.test("inland coordinates never verify", () => {
  const decision = decideStatus(row({ location_lat: SEOUL.lat, location_lng: SEOUL.lng }), NOW);
  assertEquals(decision.status, "general_record");
});

Deno.test("camera catches need accurate GPS taken close to the shutter time", () => {
  assertEquals(decideStatus(row({ location_accuracy_m: 250 }), NOW).reason, "location_accuracy_low");
  assertEquals(decideStatus(row({ location_accuracy_m: null }), NOW).reason, "location_accuracy_low");
  assertEquals(decideStatus(row({ location_captured_at: null }), NOW).reason, "location_timestamp_stale");
  const tenMinutesEarlier = new Date(NOW - 11 * 60_000).toISOString();
  assertEquals(decideStatus(row({ location_captured_at: tenMinutesEarlier }), NOW).reason, "location_timestamp_stale");
});
