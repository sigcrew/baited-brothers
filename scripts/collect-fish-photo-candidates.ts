import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type CommonsPage = {
  pageid: number;
  title: string;
  imageinfo?: Array<{
    thumburl?: string;
    descriptionurl?: string;
    mime?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase 환경 변수가 필요합니다.");
}

const stripHtml = (value?: string) =>
  (value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const safeName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const run = async () => {
  const shouldDownload = process.argv.includes("--download");
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: fishes, error } = await client
    .from("fishes")
    .select("catalog_sort_order,name,name_ko")
    .eq("catalog_status", "core")
    .order("catalog_sort_order");
  if (error) throw error;

  const outputRoot = path.join(
    process.cwd(),
    "qa/fish-recognition/commons-candidates",
  );
  await fs.mkdir(outputRoot, { recursive: true });
  const manifest: Array<Record<string, unknown>> = [];

  for (const fish of fishes ?? []) {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      generator: "search",
      gsrnamespace: "6",
      gsrlimit: "10",
      gsrsearch: `\"${fish.name}\" filetype:bitmap`,
      prop: "imageinfo",
      iiprop: "url|mime|extmetadata",
      iiurlwidth: "1280",
      origin: "*",
    });
    const response = await fetch(
      `https://commons.wikimedia.org/w/api.php?${params}`,
      { headers: { "User-Agent": "BaitedBrothers-QA/1.0" } },
    );
    if (!response.ok) {
      manifest.push({
        sort: fish.catalog_sort_order,
        nameKo: fish.name_ko,
        scientificName: fish.name,
        error: response.status,
        candidates: [],
      });
      continue;
    }
    const body = await response.json();
    const pages = Object.values(body.query?.pages ?? {}) as CommonsPage[];
    const candidates = pages
      .map((page) => {
        const info = page.imageinfo?.[0];
        const metadata = info?.extmetadata ?? {};
        return {
          commonsPageId: page.pageid,
          title: page.title,
          thumbnailUrl: info?.thumburl ?? null,
          sourceUrl: info?.descriptionurl ?? null,
          mimeType: info?.mime ?? null,
          license: stripHtml(metadata.LicenseShortName?.value),
          licenseUrl: stripHtml(metadata.LicenseUrl?.value),
          artist: stripHtml(metadata.Artist?.value),
          credit: stripHtml(metadata.Credit?.value),
          description: stripHtml(metadata.ImageDescription?.value),
          reviewStatus: "pending",
        };
      })
      .filter(
        (candidate) =>
          candidate.thumbnailUrl &&
          candidate.mimeType?.startsWith("image/") &&
          candidate.license,
      )
      .slice(0, 5);

    if (shouldDownload) {
      const folder = path.join(
        outputRoot,
        `${String(fish.catalog_sort_order).padStart(2, "0")}-${safeName(fish.name)}`,
      );
      await fs.mkdir(folder, { recursive: true });
      for (const [index, candidate] of candidates.entries()) {
        const imageResponse = await fetch(candidate.thumbnailUrl!);
        if (!imageResponse.ok) continue;
        const extension = candidate.mimeType?.includes("png") ? "png" : "jpg";
        await fs.writeFile(
          path.join(folder, `${String(index + 1).padStart(2, "0")}.${extension}`),
          Buffer.from(await imageResponse.arrayBuffer()),
        );
      }
    }

    manifest.push({
      sort: fish.catalog_sort_order,
      nameKo: fish.name_ko,
      scientificName: fish.name,
      candidateCount: candidates.length,
      candidates,
    });
    console.log(
      `${String(fish.catalog_sort_order).padStart(2, "0")} ${fish.name_ko}: ${candidates.length}`,
    );
  }

  await fs.writeFile(
    path.join(process.cwd(), "qa/fish-recognition/commons-candidates.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        notice:
          "Wikimedia Commons 검색 후보입니다. 종 동정과 사진 여부를 사람이 확인한 뒤 reviewStatus를 approved로 바꿔야 정확도 평가에 사용할 수 있습니다.",
        species: manifest,
      },
      null,
      2,
    ),
  );
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
