/**
 * 라이선스와 원출처 검수가 끝난 FIELD 60 외부 이미지를 앱의 공개 Storage로
 * 미러링합니다. fishes.image_source_url / image_license / image_attribution은
 * 원저작물 정보를 계속 가리키고, image_url만 안정적인 앱 CDN URL로 바뀝니다.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");
const BUCKET = "fish-images";
const APP_STORAGE_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchImage = async (url: string) => {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "BaitedBrothersCatalogMirror/1.0 (licensed FIELD 60 assets)",
      },
      signal: AbortSignal.timeout(30_000),
    });
    lastStatus = response.status;
    if (response.ok) {
      const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
      if (!contentType.startsWith("image/")) {
        throw new Error(`Non-image content type ${contentType} from ${url}`);
      }
      return {
        body: new Uint8Array(await response.arrayBuffer()),
        contentType,
      };
    }
    if (response.status !== 429 && response.status < 500) break;
    const retryAfter = Number(response.headers.get("retry-after") ?? 0);
    await sleep(Math.max(retryAfter * 1_000, 1_500 * 2 ** attempt));
  }
  throw new Error(`Image fetch failed with status ${lastStatus}: ${url}`);
};

const extensionFor = (contentType: string) => {
  if (contentType === "image/png") return "png";
  if (contentType === "image/webp") return "webp";
  return "jpg";
};

const main = async () => {
  const { data: fishes, error } = await supabase
    .from("fishes")
    .select("id,name_ko,image_url,image_source_url,image_license,image_attribution")
    .eq("catalog_status", "core")
    .order("catalog_sort_order", { ascending: true });
  if (error) throw error;

  let mirrored = 0;
  let skipped = 0;
  for (const fish of fishes ?? []) {
    if (!fish.image_url || !fish.image_source_url || !fish.image_license || !fish.image_attribution) {
      throw new Error(`Incomplete image metadata: ${fish.name_ko}`);
    }
    if (fish.image_url.startsWith(APP_STORAGE_PREFIX)) {
      console.log(`SKIP ${fish.name_ko}: already mirrored`);
      skipped += 1;
      continue;
    }
    if (DRY_RUN) {
      console.log(`DRY ${fish.name_ko}: ${fish.image_url}`);
      continue;
    }

    const image = await fetchImage(fish.image_url);
    if (image.body.byteLength > 5 * 1024 * 1024) {
      throw new Error(`Image exceeds bucket limit for ${fish.name_ko}: ${image.body.byteLength}`);
    }
    const objectPath = `field60/mirrored/${fish.id}.${extensionFor(image.contentType)}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, image.body, {
        contentType: image.contentType,
        cacheControl: "31536000",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
    const { error: updateError } = await supabase
      .from("fishes")
      .update({ image_url: publicUrlData.publicUrl })
      .eq("id", fish.id);
    if (updateError) throw updateError;

    mirrored += 1;
    console.log(`MIRRORED ${fish.name_ko}: ${image.body.byteLength} bytes`);
    await sleep(350);
  }
  console.log(`DONE mirrored=${mirrored} skipped=${skipped} total=${fishes?.length ?? 0}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
