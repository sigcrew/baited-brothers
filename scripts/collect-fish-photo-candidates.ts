import "dotenv/config";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type FishRow = {
  catalog_sort_order: number;
  name: string;
  name_ko: string | null;
  scientific_synonyms: string[] | null;
};

type OpenLicense =
  | "CC0-1.0"
  | "CC-BY-2.0"
  | "CC-BY-2.5"
  | "CC-BY-3.0"
  | "CC-BY-4.0"
  | "CC-BY-SA-2.0"
  | "CC-BY-SA-2.5"
  | "CC-BY-SA-3.0"
  | "CC-BY-SA-4.0"
  | "KOGL-TYPE-1"
  | "PUBLIC-DOMAIN";

type Candidate = {
  provider: "gbif" | "inaturalist" | "wikimedia";
  providerAssetId: string;
  scientificNameQueried: string;
  acceptedScientificName: string | null;
  imageUrl: string;
  previewUrl: string | null;
  sourceUrl: string;
  creator: string | null;
  attribution: string | null;
  license: OpenLicense;
  licenseUrl: string | null;
  country: string | null;
  observedAt: string | null;
  width: number | null;
  height: number | null;
  reviewStatus: "pending";
};

type CommonsPage = {
  pageid: number;
  title: string;
  imageinfo?: Array<{
    url?: string;
    thumburl?: string;
    descriptionurl?: string;
    mime?: string;
    width?: number;
    height?: number;
    sha1?: string;
    extmetadata?: Record<string, { value?: string }>;
  }>;
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PER_SPECIES_LIMIT = Math.max(
  1,
  Math.min(50, Number(process.env.PHOTO_CANDIDATES_PER_SPECIES ?? 10) || 10),
);
const TARGET_SPECIES_SORTS = new Set(
  (process.env.PHOTO_CANDIDATE_SPECIES_SORTS ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value >= 1 && value <= 60),
);
const isTargetSpecies = (sort: number) =>
  TARGET_SPECIES_SORTS.size === 0 || TARGET_SPECIES_SORTS.has(sort);
const WIKIMEDIA_DOWNLOAD_ATTEMPTS = Math.max(
  1,
  Math.min(
    4,
    Number(process.env.WIKIMEDIA_DOWNLOAD_ATTEMPTS ?? 1) || 1,
  ),
);
const USER_AGENT =
  "BaitedBrothers-OpenPhotoQA/1.0 (fish recognition evaluation)";
const ROOT = process.cwd();
const QA_ROOT = path.join(ROOT, "qa/fish-recognition");
const OUTPUT_ROOT = path.join(QA_ROOT, "open-photo-candidates");
const MANIFEST_PATH = path.join(QA_ROOT, "open-photo-candidates.json");
const DOWNLOAD_SUMMARY_PATH = path.join(OUTPUT_ROOT, "_download-summary.json");

const VERIFIED_QUERY_ALIASES: Record<string, string[]> = {
  "Pseudopleuronectes yokohamae": [
    "Pleuronectes yokohamae",
    "Limanda yokohamae",
  ],
  "Pseudopleuronectes herzensteini": [
    "Pleuronectes herzensteini",
    "Pleuronectes japonicus",
  ],
  "Platichthys bicoloratus": ["Kareius bicoloratus"],
  "Girella leonina": ["Crenidens leoninus"],
  "Dentex hypselosomus": ["Dentex hypselosoma", "Synagris hypselosoma"],
  "Lateolabrax spilonotus": [
    "Lateolabrax maculatus",
    "Perca labrax spilonotus",
    "Percalabrax spilonotus",
  ],
  "Pennahia argentata": ["Argyrosomus argentatus"],
  "Hyporthodus septemfasciatus": ["Epinephelus septemfasciatus"],
  "Uroteuthis edulis": ["Loligo edulis", "Loligo kensaki"],
  "Todarodes pacificus": [
    "Ommastrephes pacificus",
    "Ommatostrephes pacificus",
  ],
  "Octopus minor": ["Polypus macropus minor", "Callistoctopus minor"],
};

const wait = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const requestJson = async (url: string, source: string) => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    let retryAfterMilliseconds = 0;
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(20_000),
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "application/json",
        },
      });
      if (response.ok) return response.json();
      const retryAfter = Number(response.headers.get("retry-after"));
      retryAfterMilliseconds = Number.isFinite(retryAfter)
        ? retryAfter * 1000
        : 0;
      lastError = new Error(`${source} 요청 실패: ${response.status}`);
      if (
        attempt === 4 ||
        (response.status !== 429 && response.status < 500)
      ) {
        throw lastError;
      }
    } catch (error) {
      lastError = error;
      if (attempt === 4) throw error;
    }
    await wait(
      Math.min(15_000, Math.max(retryAfterMilliseconds, 1500 * attempt)),
    );
  }
  throw lastError;
};

const stripHtml = (value?: string | null) =>
  (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

const safeName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const binomialName = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(" ");

const normalizeLicense = (value?: string | null): OpenLicense | null => {
  const normalized = stripHtml(value)
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, " ");
  if (!normalized) return null;
  if (
    normalized.includes("kogl type 1") ||
    normalized.includes("korea open government license type 1") ||
    normalized.includes("공공누리 제1유형")
  ) {
    return "KOGL-TYPE-1";
  }
  if (
    normalized.includes("by-nc") ||
    normalized.includes("by-nd") ||
    normalized.includes("noncommercial") ||
    normalized.includes("no derivatives")
  ) {
    return null;
  }
  if (
    normalized.includes("public domain") ||
    normalized.includes("publicdomain") ||
    normalized.includes("cc0") ||
    normalized === "pd"
  ) {
    return normalized.includes("cc0") ? "CC0-1.0" : "PUBLIC-DOMAIN";
  }

  const isShareAlike =
    normalized.includes("by-sa") ||
    normalized.includes("by sa") ||
    normalized.includes("/licenses/by-sa/");
  const isAttribution =
    isShareAlike ||
    normalized === "cc-by" ||
    normalized.startsWith("cc by") ||
    normalized.includes("/licenses/by/");
  if (!isAttribution) return null;

  const version =
    normalized.match(/(?:^|[^0-9])(4\.0|3\.0|2\.5|2\.0)(?:[^0-9]|$)/)?.[1] ??
    "4.0";
  if (isShareAlike) {
    return `CC-BY-SA-${version}` as OpenLicense;
  }
  return `CC-BY-${version}` as OpenLicense;
};

const licenseUrlFor = (license: OpenLicense) => {
  if (license === "KOGL-TYPE-1") {
    return "https://www.kogl.or.kr/info/licenseType1.do";
  }
  if (license === "PUBLIC-DOMAIN") {
    return "https://creativecommons.org/publicdomain/mark/1.0/";
  }
  if (license === "CC0-1.0") {
    return "https://creativecommons.org/publicdomain/zero/1.0/";
  }
  const match = license.match(/^CC-BY(-SA)?-(.+)$/);
  if (!match) return null;
  return `https://creativecommons.org/licenses/by${match[1] ? "-sa" : ""}/${match[2]}/`;
};

const inaturalistPhotoId = (url: string) =>
  url.match(/\/photos\/(\d+)\//)?.[1] ?? null;

const candidateDedupKey = (candidate: Candidate) => {
  const inatId = inaturalistPhotoId(candidate.imageUrl);
  if (inatId) return `inat-photo:${inatId}`;
  return `${candidate.provider}:${candidate.providerAssetId}`;
};

const fetchGbifCandidates = async (
  scientificName: string,
): Promise<Candidate[]> => {
  const match = await requestJson(
    `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(scientificName)}`,
    "GBIF species",
  );
  if (!match?.usageKey) return [];
  const occurrences = await requestJson(
    `https://api.gbif.org/v1/occurrence/search?taxon_key=${match.usageKey}&media_type=StillImage&limit=300`,
    "GBIF occurrence",
  );
  const candidates: Candidate[] = [];
  for (const occurrence of occurrences?.results ?? []) {
    for (const [mediaIndex, media] of (occurrence.media ?? []).entries()) {
      const imageUrl = String(media.identifier ?? media.references ?? "");
      const license = normalizeLicense(
        String(media.license ?? occurrence.license ?? ""),
      );
      if (
        !imageUrl ||
        !license ||
        !String(media.type ?? "").toLowerCase().includes("stillimage")
      ) {
        continue;
      }
      candidates.push({
        provider: "gbif",
        providerAssetId: `${occurrence.key}:${mediaIndex}`,
        scientificNameQueried: scientificName,
        acceptedScientificName:
          occurrence.acceptedScientificName ??
          occurrence.scientificName ??
          null,
        imageUrl,
        previewUrl: null,
        sourceUrl:
          media.references ??
          `https://www.gbif.org/occurrence/${occurrence.key}`,
        creator: media.creator ?? occurrence.recordedBy ?? null,
        attribution: media.title ?? null,
        license,
        licenseUrl: licenseUrlFor(license),
        country: occurrence.country ?? null,
        observedAt: occurrence.eventDate ?? null,
        width: Number(media.width) || null,
        height: Number(media.height) || null,
        reviewStatus: "pending",
      });
    }
  }
  return candidates;
};

const fetchInaturalistCandidates = async (
  scientificName: string,
): Promise<Candidate[]> => {
  const params = new URLSearchParams({
    taxon_name: scientificName,
    quality_grade: "research",
    photos: "true",
    photo_license: "cc0,cc-by,cc-by-sa",
    per_page: "200",
    order_by: "votes",
    order: "desc",
  });
  const body = await requestJson(
    `https://api.inaturalist.org/v1/observations?${params}`,
    "iNaturalist",
  );
  const candidates: Candidate[] = [];
  for (const observation of body?.results ?? []) {
    for (const photo of observation.photos ?? []) {
      const license = normalizeLicense(photo.license_code);
      const baseUrl = String(photo.url ?? "");
      if (!license || !baseUrl) continue;
      const imageUrl = baseUrl.replace(
        /\/(?:square|small|medium|large|original)\./,
        "/large.",
      );
      candidates.push({
        provider: "inaturalist",
        providerAssetId: String(photo.id),
        scientificNameQueried: scientificName,
        acceptedScientificName: observation.taxon?.name ?? null,
        imageUrl,
        previewUrl: baseUrl,
        sourceUrl:
          observation.uri ??
          `https://www.inaturalist.org/observations/${observation.id}`,
        creator:
          photo.attribution ??
          observation.user?.name ??
          observation.user?.login ??
          null,
        attribution: photo.attribution ?? null,
        license,
        licenseUrl: licenseUrlFor(license),
        country: observation.place_guess ?? null,
        observedAt: observation.observed_on_string ?? observation.observed_on,
        width: Number(photo.original_dimensions?.width) || null,
        height: Number(photo.original_dimensions?.height) || null,
        reviewStatus: "pending",
      });
    }
  }
  return candidates;
};

const fetchWikimediaCandidates = async (
  scientificName: string,
): Promise<Candidate[]> => {
  await wait(500);
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrnamespace: "6",
    gsrlimit: "20",
    gsrsearch: `"${scientificName}" filetype:bitmap`,
    prop: "imageinfo",
    iiprop: "url|mime|dimensions|sha1|extmetadata",
    iiurlwidth: "1280",
    iiextmetadatafilter:
      "LicenseShortName|LicenseUrl|Artist|Credit|Attribution|ImageDescription|DateTimeOriginal",
    origin: "*",
  });
  const body = await requestJson(
    `https://commons.wikimedia.org/w/api.php?${params}`,
    "Wikimedia Commons",
  );
  const pages = (body?.query?.pages ?? []) as CommonsPage[];
  const candidates: Candidate[] = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const metadata = info?.extmetadata ?? {};
    const license = normalizeLicense(metadata.LicenseShortName?.value);
    const imageUrl = info?.thumburl ?? info?.url;
    if (
      !license ||
      !imageUrl ||
      !info?.mime?.startsWith("image/")
    ) {
      continue;
    }
    const attribution =
      stripHtml(metadata.Attribution?.value) ||
      stripHtml(metadata.Credit?.value) ||
      null;
    candidates.push({
      provider: "wikimedia",
      providerAssetId: info.sha1 ?? String(page.pageid),
      scientificNameQueried: scientificName,
      acceptedScientificName: null,
      imageUrl,
      previewUrl: info.thumburl ?? null,
      sourceUrl:
        info.descriptionurl ??
        `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
      creator: stripHtml(metadata.Artist?.value) || null,
      attribution,
      license,
      licenseUrl:
        stripHtml(metadata.LicenseUrl?.value) || licenseUrlFor(license),
      country: null,
      observedAt: stripHtml(metadata.DateTimeOriginal?.value) || null,
      width: Number(info.width) || null,
      height: Number(info.height) || null,
      reviewStatus: "pending",
    });
  }
  return candidates;
};

const selectBalancedCandidates = (
  sourceCandidates: Record<Candidate["provider"], Candidate[]>,
) => {
  const selected: Candidate[] = [];
  const seen = new Set<string>();
  const providers: Candidate["provider"][] = [
    "inaturalist",
    "gbif",
    "wikimedia",
  ];
  const queues = Object.fromEntries(
    providers.map((provider) => [provider, [...sourceCandidates[provider]]]),
  ) as Record<Candidate["provider"], Candidate[]>;

  while (
    selected.length < PER_SPECIES_LIMIT &&
    providers.some((provider) => queues[provider].length > 0)
  ) {
    for (const provider of providers) {
      while (queues[provider].length > 0) {
        const candidate = queues[provider].shift()!;
        const key = candidateDedupKey(candidate);
        if (seen.has(key)) continue;
        seen.add(key);
        selected.push(candidate);
        break;
      }
      if (selected.length >= PER_SPECIES_LIMIT) break;
    }
  }
  return selected;
};

const gbifCacheUrl = (candidate: Candidate) => {
  if (candidate.provider !== "gbif") return null;
  const occurrenceKey = candidate.providerAssetId.split(":")[0];
  if (!occurrenceKey) return null;
  const identifierHash = createHash("md5")
    .update(candidate.imageUrl)
    .digest("hex");
  return (
    "https://api.gbif.org/v1/image/cache/1200x/occurrence/" +
    `${occurrenceKey}/media/${identifierHash}`
  );
};

const fetchImage = async (candidate: Candidate) => {
  const fallbackUrls = [
    gbifCacheUrl(candidate),
    candidate.imageUrl,
    candidate.previewUrl,
  ].filter(
    (url, index, urls): url is string =>
      Boolean(url) && urls.indexOf(url) === index,
  );
  let lastError = "다운로드 URL 없음";

  for (const url of fallbackUrls) {
    const maxAttempts =
      candidate.provider === "wikimedia" ? WIKIMEDIA_DOWNLOAD_ATTEMPTS : 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (candidate.provider === "wikimedia") await wait(1200);
      if (candidate.provider === "gbif") await wait(250);
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(15_000),
          headers: {
            "User-Agent": USER_AGENT,
            Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
            Referer: candidate.sourceUrl,
          },
        });
        const contentType = response.headers.get("content-type") ?? "";
        if (response.ok && contentType.startsWith("image/")) {
          return {
            buffer: Buffer.from(await response.arrayBuffer()),
            contentType,
            downloadedFrom: url,
          };
        }
        lastError = response.ok
          ? `이미지가 아닌 응답: ${contentType || "unknown"}`
          : `HTTP ${response.status}`;
        if (attempt < maxAttempts && (response.status === 429 || response.status >= 500)) {
          const retryAfter = Number(response.headers.get("retry-after"));
          await wait(
            Math.min(
              30_000,
              Math.max(
                Number.isFinite(retryAfter) ? retryAfter * 1000 : 0,
                4000 * attempt,
              ),
            ),
          );
          continue;
        }
        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        if (attempt < maxAttempts) {
          await wait(2000 * attempt);
          continue;
        }
      }
    }
  }
  throw new Error(lastError);
};

const downloadCandidates = async (
  fish: FishRow,
  candidates: Candidate[],
  seenHashes: Map<string, string>,
  resume: boolean,
) => {
  const folder = path.join(
    OUTPUT_ROOT,
    `${String(fish.catalog_sort_order).padStart(2, "0")}-${safeName(binomialName(fish.name))}`,
  );
  await fs.mkdir(folder, { recursive: true });
  const existingNames = resume ? await fs.readdir(folder) : [];
  const files: Array<Record<string, unknown>> = [];
  for (const [index, candidate] of candidates.entries()) {
    const filePrefix =
      `${String(index + 1).padStart(2, "0")}-` +
      `${candidate.provider}-${safeName(candidate.providerAssetId)}.`;
    const assetMarker =
      `-${candidate.provider}-${safeName(candidate.providerAssetId)}.`;
    const existingName = existingNames.find(
      (name) => name.startsWith(filePrefix) || name.includes(assetMarker),
    );
    if (existingName) {
      const existingPath = path.join(folder, existingName);
      const buffer = await fs.readFile(existingPath);
      const sha256 = createHash("sha256").update(buffer).digest("hex");
      const relativePath = path.relative(ROOT, existingPath);
      seenHashes.set(sha256, relativePath);
      files.push({
        provider: candidate.provider,
        providerAssetId: candidate.providerAssetId,
        status: "existing",
        sha256,
        bytes: buffer.byteLength,
        file: relativePath,
      });
      continue;
    }
    try {
      const { buffer, contentType, downloadedFrom } =
        await fetchImage(candidate);
      const sha256 = createHash("sha256").update(buffer).digest("hex");
      const duplicateOf = seenHashes.get(sha256);
      if (duplicateOf) {
        files.push({
          provider: candidate.provider,
          providerAssetId: candidate.providerAssetId,
          status: "duplicate",
          sha256,
          duplicateOf,
        });
        continue;
      }
      const extension = contentType.includes("png")
        ? "png"
        : contentType.includes("webp")
          ? "webp"
          : "jpg";
      const filename = `${filePrefix}${extension}`;
      const relativePath = path.relative(
        ROOT,
        path.join(folder, filename),
      );
      await fs.writeFile(path.join(folder, filename), buffer);
      seenHashes.set(sha256, relativePath);
      files.push({
        provider: candidate.provider,
        providerAssetId: candidate.providerAssetId,
        status: "downloaded",
        sha256,
        bytes: buffer.byteLength,
        file: relativePath,
        downloadedFrom,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `${fish.name_ko} ${candidate.provider} ${index + 1}: ${message}`,
      );
      files.push({
        provider: candidate.provider,
        providerAssetId: candidate.providerAssetId,
        status: "error",
        error: message,
      });
    }
  }
  return files;
};

const run = async () => {
  const shouldDownload = process.argv.includes("--download");
  const shouldDownloadExisting = process.argv.includes("--download-existing");
  const shouldResumeDownloads = process.argv.includes("--resume");
  const onlyMissing = process.argv.includes("--only-missing");

  if (shouldDownloadExisting) {
    const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8")) as {
      species?: Array<Record<string, unknown>>;
    };
    if (!shouldResumeDownloads) {
      await fs.rm(OUTPUT_ROOT, { recursive: true, force: true });
    }
    await fs.mkdir(OUTPUT_ROOT, { recursive: true });
    const seenHashes = new Map<string, string>();
    const speciesDownloads: Array<Record<string, unknown>> = [];
    for (const row of manifest.species ?? []) {
      if (!isTargetSpecies(Number(row.sort))) continue;
      const fish: FishRow = {
        catalog_sort_order: Number(row.sort),
        name: String(row.scientificName),
        name_ko: String(row.nameKo ?? ""),
        scientific_synonyms: null,
      };
      const files = await downloadCandidates(
        fish,
        (row.candidates ?? []) as Candidate[],
        seenHashes,
        shouldResumeDownloads,
      );
      speciesDownloads.push({
        sort: fish.catalog_sort_order,
        nameKo: fish.name_ko,
        scientificName: fish.name,
        files,
      });
      console.log(
        `${String(fish.catalog_sort_order).padStart(2, "0")} ${fish.name_ko}: ` +
          `${files.filter((file) => file.status === "downloaded" || file.status === "existing").length}개 확보`,
      );
    }
    const files = speciesDownloads.flatMap(
      (row) => row.files as Array<Record<string, unknown>>,
    );
    await fs.writeFile(
      DOWNLOAD_SUMMARY_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          summary: {
            downloaded: files.filter((file) => file.status === "downloaded")
              .length,
            existing: files.filter((file) => file.status === "existing").length,
            duplicates: files.filter((file) => file.status === "duplicate")
              .length,
            errors: files.filter((file) => file.status === "error").length,
          },
          species: speciesDownloads,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "후보를 새로 수집하려면 EXPO_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.",
    );
  }
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client
    .from("fishes")
    .select(
      "catalog_sort_order,name,name_ko,scientific_synonyms",
    )
    .eq("catalog_status", "core")
    .order("catalog_sort_order");
  if (error) throw error;
  const fishes = (data ?? []) as FishRow[];
  let existingSpecies = new Map<number, Record<string, unknown>>();
  if (onlyMissing) {
    try {
      const existing = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8")) as {
        species?: Array<Record<string, unknown>>;
      };
      existingSpecies = new Map(
        (existing.species ?? []).map((row) => [Number(row.sort), row]),
      );
    } catch {
      console.warn("기존 후보 목록이 없어 전체 종을 수집합니다.");
    }
  }

  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  const speciesRows: Array<Record<string, unknown>> = [];
  const downloadSeenHashes = new Map<string, string>();

  for (const fish of fishes) {
    const existingRow = existingSpecies.get(fish.catalog_sort_order);
    if (!isTargetSpecies(fish.catalog_sort_order)) {
      if (existingRow) speciesRows.push(existingRow);
      continue;
    }
    if (
      existingRow &&
      Number(existingRow.candidateCount) >= PER_SPECIES_LIMIT
    ) {
      speciesRows.push(existingRow);
      console.log(
        `${String(fish.catalog_sort_order).padStart(2, "0")} ${fish.name_ko}: 기존 ${PER_SPECIES_LIMIT}개 유지`,
      );
      continue;
    }
    const queryNames = [
      binomialName(fish.name),
      ...(fish.scientific_synonyms ?? []).map(binomialName),
      ...(VERIFIED_QUERY_ALIASES[binomialName(fish.name)] ?? []),
    ].filter((name, index, names) => name && names.indexOf(name) === index);
    const sourceCandidates: Record<Candidate["provider"], Candidate[]> = {
      gbif: [],
      inaturalist: [],
      wikimedia: [],
    };
    for (const candidate of (existingRow?.candidates ?? []) as Candidate[]) {
      sourceCandidates[candidate.provider].push(candidate);
    }
    const errors: string[] = [];

    for (const [nameIndex, queryName] of queryNames.entries()) {
      const results = await Promise.allSettled([
        fetchGbifCandidates(queryName),
        fetchInaturalistCandidates(queryName),
        fetchWikimediaCandidates(queryName),
      ]);
      const providers: Candidate["provider"][] = [
        "gbif",
        "inaturalist",
        "wikimedia",
      ];
      results.forEach((result, index) => {
        const provider = providers[index];
        if (result.status === "fulfilled") {
          sourceCandidates[provider].push(...result.value);
        } else {
          errors.push(
            `${provider}:${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
          );
        }
      });

      const preliminary = selectBalancedCandidates(sourceCandidates);
      if (preliminary.length >= PER_SPECIES_LIMIT) break;
      await wait(250);
    }

    const candidates = selectBalancedCandidates(sourceCandidates);
    if (shouldDownload) {
      await downloadCandidates(
        fish,
        candidates,
        downloadSeenHashes,
        onlyMissing || shouldResumeDownloads,
      );
    }

    speciesRows.push({
      sort: fish.catalog_sort_order,
      nameKo: fish.name_ko,
      scientificName: fish.name,
      queryNames,
      candidateCount: candidates.length,
      sourceCounts: {
        gbif: sourceCandidates.gbif.length,
        inaturalist: sourceCandidates.inaturalist.length,
        wikimedia: sourceCandidates.wikimedia.length,
      },
      errors,
      candidates,
    });
    console.log(
      `${String(fish.catalog_sort_order).padStart(2, "0")} ${fish.name_ko}: ` +
        `${candidates.length}/${PER_SPECIES_LIMIT} ` +
        `(iNat ${candidates.filter((item) => item.provider === "inaturalist").length}, ` +
        `GBIF ${candidates.filter((item) => item.provider === "gbif").length}, ` +
        `Commons ${candidates.filter((item) => item.provider === "wikimedia").length})`,
    );
    await wait(250);
  }

  const totalCandidates = speciesRows.reduce(
    (sum, row) => sum + Number(row.candidateCount ?? 0),
    0,
  );
  const providerTotals = { gbif: 0, inaturalist: 0, wikimedia: 0 };
  const licenseTotals: Record<string, number> = {};
  for (const row of speciesRows) {
    for (const candidate of (row.candidates ?? []) as Candidate[]) {
      providerTotals[candidate.provider] += 1;
      licenseTotals[candidate.license] =
        (licenseTotals[candidate.license] ?? 0) + 1;
    }
  }
  await fs.writeFile(
    MANIFEST_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        policy: {
          allowedLicenses: [
            "CC0",
            "CC BY",
            "CC BY-SA",
            "Public Domain",
          ],
          excludedLicenses: ["CC BY-NC", "CC BY-ND", "All Rights Reserved"],
          perSpeciesLimit: PER_SPECIES_LIMIT,
          reviewStatus: "pending",
        },
        notice:
          "자동 수집 후보입니다. 종 동정, 한 개체 이상 식별 가능 여부, 사진 품질, 최종 라이선스를 사람이 확인한 뒤에만 평가 정답으로 승인하세요.",
        summary: {
          species: speciesRows.length,
          totalCandidates,
          speciesAtTarget: speciesRows.filter(
            (row) => Number(row.candidateCount) >= PER_SPECIES_LIMIT,
          ).length,
          providerTotals,
          licenseTotals,
        },
        species: speciesRows,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      {
        species: speciesRows.length,
        totalCandidates,
        providerTotals,
        licenseTotals,
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
