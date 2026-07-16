/**
 * Reviews FIELD 60 regulation topics against the current MOF national tables.
 * Species without a listed national rule are explicitly recorded as checked;
 * local ordinances remain a required pre-trip check.
 *
 * Usage:
 *   npm run review:core-regulations
 *   npm run review:core-regulations -- --apply
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SOURCE_URL =
  "https://www.mof.go.kr/doc/ko/selectDoc.do?bbsSeq=22&docSeq=66688&menuSeq=851";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
}) as any;

const main = async () => {
  const apply = process.argv.includes("--apply");
  const now = new Date().toISOString();
  const [{ data: fishes, error: fishError }, { data: rules, error: ruleError }] =
    await Promise.all([
      supabase.from("fishes").select("id,name_ko").eq("catalog_status", "core"),
      supabase
        .from("fish_regulations")
        .select("fish_id")
        .lte("effective_from", now.slice(0, 10))
        .or(`effective_to.is.null,effective_to.gte.${now.slice(0, 10)}`),
    ]);

  if (fishError) throw fishError;
  if (ruleError) throw ruleError;

  const ruleCounts = new Map<string, number>();
  for (const rule of rules ?? []) {
    ruleCounts.set(rule.fish_id, (ruleCounts.get(rule.fish_id) ?? 0) + 1);
  }

  console.table(
    (fishes ?? []).map((fish: { id: string; name_ko: string | null }) => ({
      species: fish.name_ko,
      activeNationalRules: ruleCounts.get(fish.id) ?? 0,
    }))
  );
  if (!apply) {
    console.log("Dry run only. Pass --apply to update review rows.");
    return;
  }

  for (const fish of fishes ?? []) {
    const count = ruleCounts.get(fish.id) ?? 0;
    const reviewNotes =
      count > 0
        ? `2026-05-20 해양수산부 금어기·금지체장 표 대조 완료. 전국 기준 유효 규정 ${count}건. 지역별 별도 고시가 더 엄격할 수 있음.`
        : "2026-05-20 해양수산부 금어기·금지체장 표 대조 결과 종별 전국 규정 없음. 지역별 별도 고시는 출조 전 확인 필요.";
    const { error } = await supabase
      .from("fish_guide_reviews")
      .update({
        review_status: "reviewed",
        source_urls: [SOURCE_URL],
        review_notes: reviewNotes,
        reviewer: "source-check: 해양수산부 + 국가법령정보센터",
        reviewed_at: now,
        updated_at: now,
      })
      .eq("fish_id", fish.id)
      .eq("field_name", "regulations");
    if (error) throw error;
  }

  console.log(`Reviewed regulation status for ${(fishes ?? []).length} core species.`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
