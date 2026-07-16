/**
 * FIELD 60 각 종의 필수 10개 검수 항목이 모두 reviewed 이상일 때만
 * fishes.guide_status를 reviewed로 승격합니다.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const REQUIRED_FIELDS = new Set([
  "image_license",
  "taxonomy",
  "identification",
  "habitat",
  "season",
  "methods_and_baits",
  "size",
  "regulations",
  "safety",
  "rarity",
]);

const PASSING_STATUSES = new Set(["reviewed", "verified"]);

const main = async () => {
  const [{ data: fishes, error: fishError }, { data: reviews, error: reviewError }] =
    await Promise.all([
      supabase
        .from("fishes")
        .select("id,name_ko,guide_status")
        .eq("catalog_status", "core"),
      supabase
        .from("fish_guide_reviews")
        .select("fish_id,field_name,review_status"),
    ]);
  if (fishError) throw fishError;
  if (reviewError) throw reviewError;

  const reviewsByFish = Map.groupBy(reviews ?? [], (review) => review.fish_id);
  const eligible = (fishes ?? []).filter((fish) => {
    const passingFields = new Set(
      (reviewsByFish.get(fish.id) ?? [])
        .filter(
          (review) =>
            REQUIRED_FIELDS.has(review.field_name) &&
            PASSING_STATUSES.has(review.review_status)
        )
        .map((review) => review.field_name)
    );
    return passingFields.size === REQUIRED_FIELDS.size;
  });

  if (eligible.length !== 60) {
    const blocked = (fishes ?? [])
      .filter((fish) => !eligible.some((item) => item.id === fish.id))
      .map((fish) => fish.name_ko)
      .join(", ");
    throw new Error(`Only ${eligible.length}/60 species are eligible. Blocked: ${blocked}`);
  }

  console.log(`Eligible FIELD 60 species: ${eligible.length}`);
  if (DRY_RUN) return;

  const { error: updateError } = await supabase
    .from("fishes")
    .update({ guide_status: "reviewed" })
    .in(
      "id",
      eligible.map((fish) => fish.id)
    );
  if (updateError) throw updateError;
  console.log("Updated guide_status=reviewed for all FIELD 60 species.");
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
