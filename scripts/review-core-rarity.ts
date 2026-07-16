/**
 * Reviews app-specific rarity and discovery difficulty scores.
 *
 * These are FIELD 60 editorial indexes, not conservation status:
 * rarity 1=very common ... 5=rare/localized target
 * difficulty 1=easy shore encounter ... 5=specialized offshore encounter
 *
 * Usage: npm run review:core-rarity -- --apply
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
}) as any;

const main = async () => {
  const apply = process.argv.includes("--apply");
  const { data: fishes, error } = await supabase
    .from("fishes")
    .select("id,name_ko,rarity,discovery_difficulty,guide_source_urls")
    .eq("catalog_status", "core")
    .order("catalog_sort_order");
  if (error) throw error;

  console.table(
    (fishes ?? []).map((fish: any) => ({
      species: fish.name_ko,
      rarity: fish.rarity,
      difficulty: fish.discovery_difficulty,
    }))
  );
  if (!apply) return;

  const now = new Date().toISOString();
  for (const fish of fishes ?? []) {
    const { error: updateError } = await supabase
      .from("fish_guide_reviews")
      .update({
        review_status: "reviewed",
        source_urls: fish.guide_source_urls,
        review_notes:
          `FIELD 60 편집 지수 검수: 희귀도 ${fish.rarity}/5, 발견 난이도 ${fish.discovery_difficulty}/5. ` +
          "보전등급이 아니라 국내 생활낚시에서의 출현 빈도·지역성·필요 장비를 나타냄.",
        reviewer: "FIELD 60 editorial rubric",
        reviewed_at: now,
        updated_at: now,
      })
      .eq("fish_id", fish.id)
      .eq("field_name", "rarity");
    if (updateError) throw updateError;
  }
  console.log(`Reviewed rarity metrics for ${(fishes ?? []).length} core species.`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
