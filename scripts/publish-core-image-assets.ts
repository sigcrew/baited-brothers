/**
 * 외부 공개 라이선스 검색으로 적합한 생체 대표 사진을 구하지 못한 FIELD 60
 * 마지막 5종의 큐레이션 이미지를 fish-images 버킷에 게시합니다.
 *
 * - 4종: Baited Brothers가 제작한 자연사 도감 스타일 원본 에셋
 * - 능성어: SAIAB 표본 사진, CC BY 4.0, GBIF occurrence 1265261732
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");
const BUCKET = "fish-images";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Asset = {
  nameKo: string;
  filename: string;
  contentType: "image/png" | "image/jpeg";
  license: string;
  attribution: string;
  sourceUrl?: string;
  reviewNote: string;
};

const assets: Asset[] = [
  {
    nameKo: "문치가자미",
    filename: "pseudopleuronectes-yokohamae.png",
    contentType: "image/png",
    license: "Baited Brothers Original Asset",
    attribution: "Baited Brothers · AI-assisted natural-history illustration",
    reviewNote:
      "앱 전용 자연사 도감 일러스트. Pseudopleuronectes yokohamae의 체형과 무늬를 기준으로 제작·검수",
  },
  {
    nameKo: "참가자미",
    filename: "pseudopleuronectes-herzensteini.png",
    contentType: "image/png",
    license: "Baited Brothers Original Asset",
    attribution: "Baited Brothers · AI-assisted natural-history illustration",
    reviewNote:
      "앱 전용 자연사 도감 일러스트. Pseudopleuronectes herzensteini의 체형과 미세 반점 표현을 기준으로 제작·검수",
  },
  {
    nameKo: "돌가자미",
    filename: "kareius-bicoloratus.png",
    contentType: "image/png",
    license: "Baited Brothers Original Asset",
    attribution: "Baited Brothers · AI-assisted natural-history illustration",
    reviewNote:
      "앱 전용 자연사 도감 일러스트. Platichthys bicoloratus(동의명 Kareius bicoloratus)의 체형과 돌기성 반점 표현을 기준으로 제작·검수",
  },
  {
    nameKo: "점농어",
    filename: "lateolabrax-maculatus.png",
    contentType: "image/png",
    license: "Baited Brothers Original Asset",
    attribution: "Baited Brothers · AI-assisted natural-history illustration",
    reviewNote:
      "앱 전용 자연사 도감 일러스트. Lateolabrax spilonotus(동의명 Lateolabrax maculatus)의 은회색 체색과 상반부 흑색 반점을 기준으로 제작·검수",
  },
  {
    nameKo: "능성어",
    filename: "hyporthodus-septemfasciatus.jpg",
    contentType: "image/jpeg",
    license: "CC BY 4.0",
    attribution: "P.C. Heemstra / South African Institute for Aquatic Biodiversity",
    sourceUrl: "https://www.gbif.org/occurrence/1265261732",
    reviewNote:
      "GBIF occurrence 1265261732 · SAIAB F-090331 · Hyporthodus septemfasciatus · CC BY 4.0",
  },
];

const main = async () => {
  for (const asset of assets) {
    const objectPath = `field60/${asset.filename}`;
    const localPath = path.resolve("assets/images/species/field60", asset.filename);
    const body = await readFile(localPath);

    if (DRY_RUN) {
      console.log(`DRY ${asset.nameKo}: ${localPath} -> ${BUCKET}/${objectPath}`);
      continue;
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, body, {
        contentType: asset.contentType,
        cacheControl: "31536000",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
    const imageUrl = publicUrlData.publicUrl;
    const sourceUrl = asset.sourceUrl ?? imageUrl;

    const { data: fish, error: fishReadError } = await supabase
      .from("fishes")
      .select("id")
      .eq("catalog_status", "core")
      .eq("name_ko", asset.nameKo)
      .single();
    if (fishReadError) throw fishReadError;

    const { error: fishUpdateError } = await supabase
      .from("fishes")
      .update({
        image_url: imageUrl,
        image_source_url: sourceUrl,
        image_license: asset.license,
        image_attribution: asset.attribution,
      })
      .eq("id", fish.id);
    if (fishUpdateError) throw fishUpdateError;

    const now = new Date().toISOString();
    const { error: reviewError } = await supabase
      .from("fish_guide_reviews")
      .update({
        review_status: "reviewed",
        source_urls: [sourceUrl],
        review_notes: `${asset.reviewNote} · ${asset.attribution}`,
        reviewed_at: now,
        updated_at: now,
      })
      .eq("fish_id", fish.id)
      .eq("field_name", "image_license");
    if (reviewError) throw reviewError;

    console.log(`PUBLISHED ${asset.nameKo}: ${imageUrl}`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
