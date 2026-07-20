import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";

type RejectionCase = {
  id: string;
  path: string;
  kind: "non_fish" | "low_quality";
};

type SourceMetadata = {
  id: string;
  category: string;
  sourceUrl: string;
  imageUrl: string;
  title: string;
  creator: string | null;
  license: string;
  file: string;
};

const root = process.cwd();
const qaRoot = path.join(root, "qa/fish-recognition");
const outputRoot = path.join(qaRoot, "rejection-data");
const nonFishRoot = path.join(outputRoot, "non-fish");
const lowQualityRoot = path.join(outputRoot, "low-quality");

const categories = [
  { id: "cat", scientificName: "Felis catus" },
  { id: "dog", scientificName: "Canis lupus familiaris" },
  { id: "rabbit", scientificName: "Oryctolagus cuniculus" },
  { id: "bird", scientificName: "Larus crassirostris" },
  { id: "starfish", scientificName: "Asterias amurensis" },
  { id: "crab", scientificName: "Portunus trituberculatus" },
] as const;

const stripHtml = (value: string | undefined) =>
  value ? value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : null;

const fetchWithRetry = async (url: string) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      headers: { "User-Agent": "BaitedBrothers-QA/1.0" },
    });
    if (response.ok) return response;
    if (response.status !== 429 || attempt === 3) {
      throw new Error(`요청 실패 ${response.status}: ${url}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1800 * (attempt + 1)));
  }
  throw new Error(`요청 실패: ${url}`);
};

const collectNonFish = async () => {
  const sources: SourceMetadata[] = [];
  const cases: RejectionCase[] = [];

  for (const category of categories) {
    const matchResponse = await fetchWithRetry(
      `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(category.scientificName)}`,
    );
    const match = await matchResponse.json();
    if (!match.usageKey) {
      throw new Error(`${category.scientificName} GBIF taxon match 실패`);
    }
    const occurrenceResponse = await fetchWithRetry(
      `https://api.gbif.org/v1/occurrence/search?taxon_key=${match.usageKey}&media_type=StillImage&limit=80`,
    );
    const occurrenceBody = await occurrenceResponse.json();
    let categoryCount = 0;
    const seen = new Set<string>();

    for (const occurrence of occurrenceBody.results ?? []) {
      for (const media of occurrence.media ?? []) {
        if (categoryCount >= 5) break;
        const imageUrl = media.identifier ?? media.references;
        const license = String(media.license ?? occurrence.license ?? "");
        if (
          !imageUrl ||
          seen.has(imageUrl) ||
          !/creativecommons|CC0|CC BY/i.test(license)
        ) {
          continue;
        }
        seen.add(imageUrl);
        const imageResponse = await fetchWithRetry(imageUrl);
        const contentType = imageResponse.headers.get("content-type") ?? "";
        if (!contentType.startsWith("image/")) continue;

        categoryCount += 1;
        const id = `non-fish-${category.id}-${String(categoryCount).padStart(2, "0")}`;
        const relativeFile = `rejection-data/non-fish/${id}.jpg`;
        const absoluteFile = path.join(qaRoot, relativeFile);
        await fs.writeFile(
          absoluteFile,
          Buffer.from(await imageResponse.arrayBuffer()),
        );
        sources.push({
          id,
          category: category.id,
          sourceUrl:
            media.references ??
            `https://www.gbif.org/occurrence/${occurrence.key}`,
          imageUrl,
          title:
            occurrence.acceptedScientificName ??
            occurrence.scientificName ??
            category.scientificName,
          creator: stripHtml(media.creator ?? occurrence.recordedBy),
          license,
          file: relativeFile,
        });
        cases.push({ id, path: relativeFile, kind: "non_fish" });
      }
      if (categoryCount >= 5) break;
    }

    if (categoryCount !== 5) {
      throw new Error(`${category.id} 범주는 ${categoryCount}/5장만 확보했습니다.`);
    }
    console.log(`${category.id}: ${categoryCount}`);
  }

  return { sources, cases };
};

const lowQualityRecipes = [
  { id: "blur", filter: "gblur=sigma=24" },
  { id: "dark", filter: "eq=brightness=-0.78:contrast=0.7:saturation=0.5" },
  {
    id: "tiny-subject",
    filter:
      "scale=180:-2,pad=1024:768:(ow-iw)/2:(oh-ih)/2:color=gray",
  },
  {
    id: "cropped",
    filter: "crop=iw*0.32:ih*0.55:0:0,scale=1024:-2",
  },
  {
    id: "overexposed",
    filter: "eq=brightness=0.72:contrast=0.45:saturation=0.35",
  },
  {
    id: "pixelated",
    filter: "scale=48:-2,scale=960:-2:flags=neighbor",
  },
] as const;

const createLowQuality = async () => {
  const sourceFiles = [
    "kareius-bicoloratus.png",
    "hyporthodus-septemfasciatus.jpg",
    "pseudopleuronectes-herzensteini.png",
    "lateolabrax-maculatus.png",
    "pseudopleuronectes-yokohamae.png",
  ].map((file) => path.join(root, "assets/images/species/field60", file));

  const sources: Array<Record<string, string>> = [];
  const cases: RejectionCase[] = [];
  for (const recipe of lowQualityRecipes) {
    for (const [index, sourceFile] of sourceFiles.entries()) {
      const id = `low-quality-${recipe.id}-${String(index + 1).padStart(2, "0")}`;
      const relativeFile = `rejection-data/low-quality/${id}.jpg`;
      const absoluteFile = path.join(qaRoot, relativeFile);
      execFileSync(
        "ffmpeg",
        [
          "-loglevel",
          "error",
          "-y",
          "-i",
          sourceFile,
          "-vf",
          recipe.filter,
          "-frames:v",
          "1",
          "-q:v",
          "4",
          absoluteFile,
        ],
        { stdio: "inherit" },
      );
      sources.push({
        id,
        degradation: recipe.id,
        sourceFile: path.relative(qaRoot, sourceFile),
        file: relativeFile,
      });
      cases.push({ id, path: relativeFile, kind: "low_quality" });
    }
  }
  return { sources, cases };
};

const run = async () => {
  await fs.rm(outputRoot, { recursive: true, force: true });
  await fs.mkdir(nonFishRoot, { recursive: true });
  await fs.mkdir(lowQualityRoot, { recursive: true });
  const nonFish = await collectNonFish();
  const lowQuality = await createLowQuality();

  await fs.writeFile(
    path.join(qaRoot, "rejection-sources.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        notice:
          "비어류 원본의 출처·라이선스와 저품질 파생 조건입니다. 공개 배포 전 라이선스를 재검토하세요.",
        nonFish: nonFish.sources,
        lowQuality: lowQuality.sources,
      },
      null,
      2,
    ),
  );

  const manifestPath = path.join(qaRoot, "manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as {
    notes: string;
    cases: Array<RejectionCase & { expectedScientificName?: string }>;
  };
  manifest.cases = [
    ...manifest.cases.filter(
      (testCase) =>
        !testCase.id.startsWith("non-fish-") &&
        !testCase.id.startsWith("low-quality-"),
    ),
    ...nonFish.cases,
    ...lowQuality.cases,
  ];
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(
    `완료: 비어류 ${nonFish.cases.length}장, 저품질 ${lowQuality.cases.length}장`,
  );
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
