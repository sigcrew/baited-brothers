/**
 * FIELD 60의 현재 검수 완료 대표 이미지를 로컬 참조 폴더에 내려받고,
 * 이미지 생성·게시 작업에서 사용할 manifest.json을 만듭니다.
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OUTPUT_DIR = path.resolve("tmp/field60-illustrations/references");

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const slugify = (value: string) =>
  value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const main = async () => {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const { data: fishes, error } = await supabase
    .from("fishes")
    .select("id,name_ko,name,collection_group,catalog_sort_order,image_url")
    .eq("catalog_status", "core")
    .order("catalog_sort_order", { ascending: true });
  if (error) throw error;

  const manifest = [];
  for (const fish of fishes ?? []) {
    if (!fish.image_url) throw new Error(`Missing image URL: ${fish.name_ko}`);
    const response = await fetch(fish.image_url, {
      headers: { "User-Agent": "BaitedBrothersIllustrationReference/1.0" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`${response.status} ${fish.name_ko}`);
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const extension = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : "jpg";
    const binomial =
      fish.name.match(/^([A-Z][a-z-]+)\s+([a-z-]+)/)?.slice(1, 3).join(" ") ??
      fish.name;
    const fileStem = `${String(fish.catalog_sort_order).padStart(2, "0")}-${slugify(binomial)}`;
    const referencePath = path.join(OUTPUT_DIR, `${fileStem}.${extension}`);
    await writeFile(referencePath, new Uint8Array(await response.arrayBuffer()));
    manifest.push({
      id: fish.id,
      sortOrder: fish.catalog_sort_order,
      nameKo: fish.name_ko,
      scientificName: fish.name,
      binomial,
      group: fish.collection_group,
      fileStem,
      referencePath,
    });
    console.log(`REFERENCE ${fish.name_ko}: ${referencePath}`);
  }

  const manifestPath = path.resolve("tmp/field60-illustrations/manifest.json");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`DONE ${manifest.length} species · ${manifestPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
