/**
 * FIELD 60 가이드의 완성도와 검수 상태를 읽기 전용으로 감사합니다.
 *
 * Usage: npm run audit:core-guides
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type CoreFish = {
  id: string;
  name_ko: string | null;
  collection_group: string;
  guide_status: string;
  identification_features: string | null;
  similar_species_notes: string | null;
  habitat_regions: string[];
  habitat_environment: string | null;
  peak_seasons: number[];
  fishing_methods: string[];
  recommended_baits: string[];
  average_size_cm: number | null;
  max_size_cm: number | null;
  handling_cautions: string | null;
  toxicity: string | null;
  rarity: number | null;
  discovery_difficulty: number | null;
  image_url: string | null;
  image_source_url: string | null;
  image_license: string | null;
  image_attribution: string | null;
  guide_source_urls: string[];
};

type FieldReview = {
  fish_id: string;
  field_name: string;
  review_status: string;
};

const signature = (value: unknown) => JSON.stringify(value ?? null);

const main = async () => {
  const [fishResult, reviewResult] = await Promise.all([
    supabase
      .from("fishes")
      .select(
        "id,name_ko,collection_group,guide_status,identification_features,similar_species_notes,habitat_regions,habitat_environment,peak_seasons,fishing_methods,recommended_baits,average_size_cm,max_size_cm,handling_cautions,toxicity,rarity,discovery_difficulty,image_url,image_source_url,image_license,image_attribution,guide_source_urls"
      )
      .eq("catalog_status", "core")
      .order("catalog_sort_order", { ascending: true }),
    supabase.from("fish_guide_reviews").select("fish_id,field_name,review_status"),
  ]);

  if (fishResult.error) throw fishResult.error;
  if (reviewResult.error) throw reviewResult.error;

  const fishes = (fishResult.data ?? []) as CoreFish[];
  const reviews = (reviewResult.data ?? []) as FieldReview[];
  const missing: string[] = [];

  for (const fish of fishes) {
    const required = [
      fish.identification_features,
      fish.similar_species_notes,
      fish.habitat_environment,
      fish.average_size_cm,
      fish.max_size_cm,
      fish.handling_cautions,
      fish.toxicity,
      fish.rarity,
      fish.discovery_difficulty,
    ];
    const arrays = [
      fish.habitat_regions,
      fish.peak_seasons,
      fish.fishing_methods,
      fish.recommended_baits,
      fish.guide_source_urls,
    ];
    if (required.some((value) => value == null || value === "") || arrays.some((value) => value.length === 0)) {
      missing.push(fish.name_ko ?? fish.id);
    }
  }

  const genericGroups: string[] = [];
  const groups = Map.groupBy(fishes, (fish) => fish.collection_group);
  for (const [group, members] of groups) {
    if (members.length < 2) continue;
    const patterns = new Set(
      members.map((fish) =>
        signature([fish.habitat_environment, fish.peak_seasons, fish.fishing_methods, fish.recommended_baits])
      )
    );
    if (patterns.size === 1) genericGroups.push(`${group} (${members.length}종)`);
  }

  const reviewCounts = Map.groupBy(reviews, (review) => review.review_status);
  const missingImages = fishes
    .filter(
      (fish) =>
        !fish.image_url || !fish.image_source_url || !fish.image_license || !fish.image_attribution
    )
    .map((fish) => fish.name_ko ?? fish.id);

  console.log(`FIELD 60 GUIDE AUDIT`);
  console.log(`core species: ${fishes.length}`);
  console.log(`guide rows with missing required values: ${missing.length}`);
  console.log(`guide_status reviewed/verified: ${fishes.filter((fish) => fish.guide_status !== "draft").length}`);
  console.log(`licensed image gaps: ${missingImages.length}${missingImages.length ? ` · ${missingImages.join(", ")}` : ""}`);
  console.log(`generic group patterns: ${genericGroups.length} · ${genericGroups.join(", ")}`);
  console.log(`field reviews: ${reviews.length}`);
  for (const status of ["draft", "source_attached", "reviewed", "verified", "needs_revision"]) {
    console.log(`  ${status}: ${reviewCounts.get(status)?.length ?? 0}`);
  }

  if (fishes.length !== 60 || reviews.length !== 600 || missing.length > 0) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
