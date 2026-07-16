/**
 * FIELD 60 표준 학명을 WoRMS의 accepted marine species와 대조합니다.
 * 한국 표준명은 기존 MBRIS 원본을 유지하고, 학명이 정확히 일치한 종만
 * taxonomy 검수 항목을 reviewed로 올립니다.
 *
 * Usage:
 *   npm run review:core-taxonomy          # dry run
 *   npm run review:core-taxonomy -- --apply
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APPLY = process.argv.includes("--apply");

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type CoreTaxon = {
  id: string;
  name: string;
  name_ko: string | null;
  guide_source_urls: string[];
};

type AphiaRecord = {
  AphiaID: number;
  scientificname: string;
  status: string;
  valid_name: string;
  rank: string;
  isMarine: number | null;
  match_type?: string;
  url: string;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const binomial = (name: string) => name.match(/^([A-Z][a-z-]+\s+[a-z-]+)/)?.[1] ?? name.trim();

const fetchTaxon = async (scientificName: string) => {
  const url = `https://www.marinespecies.org/rest/AphiaRecordsByName/${encodeURIComponent(scientificName)}?like=false&marine_only=true`;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, { headers: { accept: "application/json" } });
    if (response.ok) return (await response.json()) as AphiaRecord[];
    if (response.status !== 429 && response.status < 500) {
      throw new Error(`WoRMS ${response.status} for ${scientificName}`);
    }
    await wait(750 * (attempt + 1));
  }
  throw new Error(`WoRMS retry exhausted for ${scientificName}`);
};

const main = async () => {
  const { data, error } = await supabase
    .from("fishes")
    .select("id,name,name_ko,guide_source_urls")
    .eq("catalog_status", "core")
    .order("catalog_sort_order", { ascending: true });
  if (error) throw error;

  let reviewed = 0;
  let needsRevision = 0;
  for (const fish of (data ?? []) as CoreTaxon[]) {
    const expected = binomial(fish.name);
    const records = await fetchTaxon(expected);
    const exact = records.find(
      (record) =>
        record.rank === "Species" &&
        record.status === "accepted" &&
        record.scientificname === expected &&
        record.valid_name === expected &&
        record.isMarine === 1
    );
    const fallback = records[0];
    const directUrl = exact?.url ?? fallback?.url;
    const valid = Boolean(exact && fish.name_ko?.trim());
    const sourceUrls = Array.from(
      new Set([...(fish.guide_source_urls ?? []), ...(directUrl ? [directUrl] : [])])
    );
    const note = valid
      ? `MBRIS 한국 표준명 + WoRMS accepted marine species exact match · AphiaID ${exact!.AphiaID}`
      : `분류 재검토 필요 · 입력 ${expected} · WoRMS ${fallback?.valid_name ?? "일치 없음"}`;

    console.log(`${valid ? "PASS" : "REVIEW"} ${fish.name_ko ?? "한국명 없음"} · ${expected}`);
    if (valid) reviewed += 1;
    else needsRevision += 1;

    if (APPLY) {
      const { error: fishError } = await supabase
        .from("fishes")
        .update({ guide_source_urls: sourceUrls })
        .eq("id", fish.id);
      if (fishError) throw fishError;

      const { error: reviewError } = await supabase
        .from("fish_guide_reviews")
        .update({
          review_status: valid ? "reviewed" : "needs_revision",
          source_urls: sourceUrls,
          review_notes: note,
          reviewer: "source-check: MBRIS + WoRMS",
          reviewed_at: valid ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq("fish_id", fish.id)
        .eq("field_name", "taxonomy");
      if (reviewError) throw reviewError;
    }
    await wait(120);
  }

  console.log(`DONE mode=${APPLY ? "apply" : "dry-run"} reviewed=${reviewed} needs_revision=${needsRevision}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
