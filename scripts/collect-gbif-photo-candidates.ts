import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase 환경 변수가 필요합니다.");
}

const safeName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

type PhotoCandidate = {
  occurrenceKey: number | string;
  acceptedScientificName: string | null;
  country: string | null;
  eventDate: string | null;
  imageUrl: string;
  sourceUrl: string;
  creator: string | null;
  license: string;
  reviewStatus: "pending";
};

const supplementalCandidates: Record<string, PhotoCandidate[]> = {
  "Octopus minor": [
    {
      occurrenceKey: "inat-364576852",
      acceptedScientificName: "Octopus minor (Sasaki, 1920)",
      country: "Japan",
      eventDate: null,
      imageUrl:
        "https://inaturalist-open-data.s3.amazonaws.com/photos/665568853/original.jpg",
      sourceUrl: "https://www.inaturalist.org/observations/364576852",
      creator: "Tomioka Masafumi",
      license: "http://creativecommons.org/licenses/by-nc/4.0/",
      reviewStatus: "pending",
    },
    {
      occurrenceKey: "inat-349726994",
      acceptedScientificName: "Octopus minor (Sasaki, 1920)",
      country: null,
      eventDate: null,
      imageUrl:
        "https://inaturalist-open-data.s3.amazonaws.com/photos/638015281/original.jpg",
      sourceUrl: "https://www.inaturalist.org/observations/349726994",
      creator: "orcinusss",
      license: "http://creativecommons.org/licenses/by-nc/4.0/",
      reviewStatus: "pending",
    },
  ],
};

const requestJson = async (url: string) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers: { "User-Agent": "BaitedBrothers-QA/1.0" },
    });
    if (response.ok) return response.json();
    if (response.status !== 429 || attempt === 2) {
      throw new Error(`GBIF 요청 실패: ${response.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
  }
};

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
    "qa/fish-recognition/gbif-candidates",
  );
  await fs.mkdir(outputRoot, { recursive: true });
  const speciesRows: Array<Record<string, unknown>> = [];

  for (const fish of fishes ?? []) {
    try {
      const match = await requestJson(
        `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(fish.name)}`,
      );
      const key = match?.usageKey;
      if (!key) throw new Error("GBIF taxon match 없음");
      const occurrences = await requestJson(
        `https://api.gbif.org/v1/occurrence/search?taxon_key=${key}&media_type=StillImage&limit=30`,
      );
      const seen = new Set<string>();
      const candidates: PhotoCandidate[] = [];
      for (const occurrence of occurrences?.results ?? []) {
        for (const media of occurrence.media ?? []) {
          const imageUrl = media.identifier || media.references;
          if (
            !imageUrl ||
            seen.has(imageUrl) ||
            !String(media.type ?? "").toLowerCase().includes("stillimage")
          ) {
            continue;
          }
          const license = String(media.license ?? occurrence.license ?? "");
          if (!/creativecommons|CC0|CC BY/i.test(license)) continue;
          seen.add(imageUrl);
          candidates.push({
            occurrenceKey: occurrence.key,
            acceptedScientificName:
              occurrence.acceptedScientificName ?? occurrence.scientificName,
            country: occurrence.country ?? null,
            eventDate: occurrence.eventDate ?? null,
            imageUrl,
            sourceUrl:
              media.references ??
              `https://www.gbif.org/occurrence/${occurrence.key}`,
            creator: media.creator ?? occurrence.recordedBy ?? null,
            license,
            reviewStatus: "pending",
          });
          if (candidates.length >= 5) break;
        }
        if (candidates.length >= 5) break;
      }
      for (const candidate of supplementalCandidates[fish.name] ?? []) {
        if (candidates.length >= 5) break;
        if (seen.has(candidate.imageUrl)) continue;
        seen.add(candidate.imageUrl);
        candidates.push(candidate);
      }

      if (shouldDownload) {
        const folder = path.join(
          outputRoot,
          `${String(fish.catalog_sort_order).padStart(2, "0")}-${safeName(fish.name)}`,
        );
        await fs.mkdir(folder, { recursive: true });
        for (const [index, candidate] of candidates.entries()) {
          const response = await fetch(candidate.imageUrl);
          if (!response.ok) continue;
          const contentType = response.headers.get("content-type") ?? "";
          if (!contentType.toLowerCase().startsWith("image/")) {
            console.warn(
              `${fish.name_ko} 후보 ${index + 1} 제외: 이미지가 아닌 ${contentType || "unknown"} 응답`,
            );
            continue;
          }
          const extension = contentType.includes("png") ? "png" : "jpg";
          await fs.writeFile(
            path.join(folder, `${String(index + 1).padStart(2, "0")}.${extension}`),
            Buffer.from(await response.arrayBuffer()),
          );
        }
      }

      speciesRows.push({
        sort: fish.catalog_sort_order,
        nameKo: fish.name_ko,
        scientificName: fish.name,
        gbifTaxonKey: key,
        candidateCount: candidates.length,
        candidates,
      });
      console.log(
        `${String(fish.catalog_sort_order).padStart(2, "0")} ${fish.name_ko}: ${candidates.length}`,
      );
    } catch (error) {
      speciesRows.push({
        sort: fish.catalog_sort_order,
        nameKo: fish.name_ko,
        scientificName: fish.name,
        candidateCount: 0,
        error: error instanceof Error ? error.message : String(error),
        candidates: [],
      });
    }
  }

  await fs.writeFile(
    path.join(process.cwd(), "qa/fish-recognition/gbif-candidates.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        notice:
          "GBIF 발생 기록의 이미지 후보입니다. 종 동정·사진 품질·라이선스를 사람이 확인한 뒤 reviewStatus를 approved로 변경해야 합니다.",
        species: speciesRows,
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
