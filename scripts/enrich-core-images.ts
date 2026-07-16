/**
 * FIELD 60 대표 이미지를 iNaturalist 연구등급 관찰에서 보강합니다.
 * 상업 서비스에서도 재사용 가능한 CC0 / CC BY / CC BY-SA 사진만 허용하며,
 * 사진 원문, 촬영자 표기, 라이선스를 fishes에 함께 저장합니다.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const REVIEW_EXISTING = process.argv.includes("--review-existing");

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const editorialSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ALLOWED_LICENSES = new Map([
  ["cc0", "CC0 1.0"],
  ["cc-by", "CC BY 4.0"],
  ["cc-by-sa", "CC BY-SA 4.0"],
]);

const NIFS_SOURCE_URL = "https://www.nifs.go.kr/contents/actionContentsCons0088.do";
const OFFICIAL_NIFS_IMAGES: Record<
  string,
  {
    image_url: string;
    image_source_url: string;
    image_license: string;
    image_attribution: string;
  }
> = {
  갈치: {
    image_url: "https://www.nifs.go.kr/cmmn/images/MF00043931_watermark.jpg",
    image_source_url: NIFS_SOURCE_URL,
    image_license: "공공누리 제1유형",
    image_attribution: "국립수산과학원",
  },
  민어: {
    image_url: "https://www.nifs.go.kr/cmmn/images/MF0003239_DG0115_watermark.jpg",
    image_source_url: NIFS_SOURCE_URL,
    image_license: "공공누리 제1유형",
    image_attribution: "국립수산과학원",
  },
  보구치: {
    image_url: "https://www.nifs.go.kr/cmmn/images/MF0005380_DG0102_watermark.jpg",
    image_source_url: NIFS_SOURCE_URL,
    image_license: "공공누리 제1유형",
    image_attribution: "국립수산과학원",
  },
};

const isCommerciallyReusableLicense = (license: string | null | undefined) =>
  /^(CC0|CC BY(?:-SA)?|Public Domain|공공누리 제1유형|KOGL Type 1|Baited Brothers Original Asset)(?:\s|$)/i.test(
    license?.trim() ?? ""
  );

const isCompleteImageRecord = (fish: {
  image_url?: string | null;
  image_source_url?: string | null;
  image_license?: string | null;
  image_attribution?: string | null;
}) =>
  Boolean(
    fish.image_url?.trim() &&
      fish.image_source_url?.trim() &&
      fish.image_attribution?.trim() &&
      isCommerciallyReusableLicense(fish.image_license)
  );

type INatPhoto = {
  id: number;
  url: string;
  attribution?: string;
  license_code?: string;
  original_dimensions?: { width?: number; height?: number };
};

type INatObservation = {
  id: number;
  uri?: string;
  quality_grade?: string;
  taxon?: { name?: string };
  photos?: INatPhoto[];
};

type CommonsImageInfo = {
  url?: string;
  thumburl?: string;
  descriptionurl?: string;
  width?: number;
  height?: number;
  extmetadata?: Record<string, { value?: string }>;
};

type CommonsPage = {
  title?: string;
  imageinfo?: CommonsImageInfo[];
};

const binomial = (scientificName: string) =>
  scientificName.match(/^([A-Z][a-z-]+)\s+([a-z-]+)/)?.slice(1, 3).join(" ") ?? scientificName;

const photoScore = (photo: INatPhoto) => {
  const width = photo.original_dimensions?.width ?? 0;
  const height = photo.original_dimensions?.height ?? 0;
  const area = Math.min(width * height, 12_000_000);
  const landscapeBonus = width >= height ? 2_000_000 : 0;
  return area + landscapeBonus;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (url: string) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url);
    if (response.status !== 429) return response;
    const retryAfterSeconds = Number(response.headers.get("retry-after") ?? 0);
    await wait(Math.max(retryAfterSeconds * 1_000, 1_500 * (attempt + 1)));
  }
  return fetch(url);
};

const fetchRepresentative = async (scientificName: string) => {
  const queryName = binomial(scientificName);
  const params = new URLSearchParams({
    taxon_name: queryName,
    quality_grade: "research",
    photos: "true",
    photo_license: "cc0,cc-by,cc-by-sa",
    order_by: "votes",
    order: "desc",
    per_page: "30",
  });
  const response = await fetchWithRetry(`https://api.inaturalist.org/v1/observations?${params}`);
  if (!response.ok) throw new Error(`iNaturalist ${response.status} for ${queryName}`);
  const payload = (await response.json()) as { results?: INatObservation[] };

  const candidates = (payload.results ?? [])
    .filter((observation) => observation.quality_grade === "research")
    .filter((observation) => binomial(observation.taxon?.name ?? "") === queryName)
    .flatMap((observation) =>
      (observation.photos ?? []).map((photo) => ({ observation, photo }))
    )
    .filter(({ photo }) => ALLOWED_LICENSES.has((photo.license_code ?? "").toLowerCase()))
    .sort((a, b) => photoScore(b.photo) - photoScore(a.photo));

  const selected = candidates[0];
  if (!selected) return null;
  const licenseCode = (selected.photo.license_code ?? "").toLowerCase();
  return {
    image_url: selected.photo.url.replace(/\/square\./, "/large."),
    image_source_url: `https://www.inaturalist.org/photos/${selected.photo.id}`,
    image_license: ALLOWED_LICENSES.get(licenseCode)!,
    image_attribution: selected.photo.attribution?.replace(/^\(c\)\s*/i, "") ?? "iNaturalist contributor",
  };
};

const plainText = (value: string | undefined) =>
  (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[^;]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const fetchCommonsRepresentative = async (scientificName: string) => {
  const queryName = binomial(scientificName);
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `intitle:\"${queryName}\"`,
    gsrnamespace: "6",
    gsrlimit: "20",
    prop: "imageinfo",
    iiprop: "url|size|extmetadata",
    iiurlwidth: "1600",
    format: "json",
    origin: "*",
  });
  const response = await fetchWithRetry(`https://commons.wikimedia.org/w/api.php?${params}`);
  if (!response.ok) throw new Error(`Wikimedia Commons ${response.status} for ${queryName}`);
  const payload = (await response.json()) as { query?: { pages?: Record<string, CommonsPage> } };
  const rejectedTerms = /parasite|muscle|spore|histolog|micrograph|larva|egg|otolith|skeleton|x-?ray|radiograph|distribution|range(?: by| map)|map|drawing|water.?colou?r|illustration|plate/i;
  const allowedLicense = /^(CC0|Public domain|CC BY(?:-SA)?)(?:\s|$)/i;

  const candidates = Object.values(payload.query?.pages ?? {})
    .map((page) => ({ page, info: page.imageinfo?.[0] }))
    .filter((item): item is { page: CommonsPage; info: CommonsImageInfo } => Boolean(item.info))
    .filter(({ page, info }) => {
      const metadata = info.extmetadata ?? {};
      const haystack = `${page.title ?? ""} ${plainText(metadata.ImageDescription?.value)}`;
      const categories = metadata.Categories?.value ?? "";
      const license = metadata.LicenseShortName?.value ?? "";
      const fileIsRaster = /\.(jpe?g|png|webp)$/i.test(info.url ?? "");
      return fileIsRaster && !rejectedTerms.test(haystack) && categories.includes(queryName) && allowedLicense.test(license);
    })
    .sort((a, b) => {
      const startsWithName = (page: CommonsPage) =>
        (page.title ?? "").toLowerCase().startsWith(`file:${queryName.toLowerCase()}`) ? 20_000_000 : 0;
      const score = (item: { page: CommonsPage; info: CommonsImageInfo }) =>
        startsWithName(item.page) + Math.min((item.info.width ?? 0) * (item.info.height ?? 0), 12_000_000);
      return score(b) - score(a);
    });

  const selected = candidates[0];
  if (!selected) return null;
  const metadata = selected.info.extmetadata ?? {};
  return {
    image_url: selected.info.thumburl ?? selected.info.url!,
    image_source_url: selected.info.descriptionurl!,
    image_license: metadata.LicenseShortName?.value ?? "Creative Commons",
    image_attribution: plainText(metadata.Artist?.value) || "Wikimedia Commons contributor",
  };
};

const main = async () => {
  const { data: fishes, error } = await supabase
    .from("fishes")
    .select(
      "id,name,name_ko,scientific_synonyms,image_url,image_source_url,image_license,image_attribution"
    )
    .eq("catalog_status", "core")
    .order("catalog_sort_order", { ascending: true });
  if (error) throw error;

  let matched = 0;
  let updated = 0;
  for (const fish of fishes ?? []) {
    if (REVIEW_EXISTING && isCompleteImageRecord(fish)) {
      console.log(`REVIEW ${fish.name_ko}: ${fish.image_license} · ${fish.image_source_url}`);
      if (!DRY_RUN) {
        const now = new Date().toISOString();
        const { error: reviewError } = await editorialSupabase
          .from("fish_guide_reviews")
          .update({
            review_status: "reviewed",
            source_urls: [fish.image_source_url],
            review_notes: `${fish.image_license} · ${fish.image_attribution} · 상업적 재사용 조건과 출처 표기 필드 확인`,
            reviewed_at: now,
            updated_at: now,
          })
          .eq("fish_id", fish.id)
          .eq("field_name", "image_license");
        if (reviewError) throw reviewError;
        updated += 1;
      }
      continue;
    }
    if (!FORCE && isCompleteImageRecord(fish)) {
      console.log(`SKIP ${fish.name_ko}: licensed image exists`);
      continue;
    }
    let image:
      | {
          image_url: string;
          image_source_url: string;
          image_license: string;
          image_attribution: string;
        }
      | null = OFFICIAL_NIFS_IMAGES[fish.name_ko ?? ""] ?? null;
    const searchNames = Array.from(new Set([fish.name, ...fish.scientific_synonyms]));
    if (!image) {
      for (const searchName of searchNames) {
        image =
          (await fetchRepresentative(searchName)) ??
          (await fetchCommonsRepresentative(searchName));
        if (image) break;
        await wait(250);
      }
      await wait(450);
    }
    if (!image) {
      console.log(`MISS ${fish.name_ko}: ${binomial(fish.name)}`);
      continue;
    }
    matched += 1;
    console.log(`${DRY_RUN ? "FOUND" : "UPDATE"} ${fish.name_ko}: ${image.image_license} · ${image.image_source_url}`);
    if (!DRY_RUN) {
      const { error: updateError } = await supabase.from("fishes").update(image).eq("id", fish.id);
      if (updateError) throw updateError;
      const now = new Date().toISOString();
      const { error: reviewError } = await editorialSupabase
        .from("fish_guide_reviews")
        .update({
          review_status: "reviewed",
          source_urls: [image.image_source_url],
          review_notes: `${image.image_license} · ${image.image_attribution} · 상업적 재사용 조건과 출처 표기 필드 확인`,
          reviewed_at: now,
          updated_at: now,
        })
        .eq("fish_id", fish.id)
        .eq("field_name", "image_license");
      if (reviewError) throw reviewError;
      updated += 1;
    }
  }
  console.log(`DONE matched=${matched} updated=${updated} total=${fishes?.length ?? 0}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
