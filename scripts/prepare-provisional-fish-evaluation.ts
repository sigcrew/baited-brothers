import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

type DownloadFile = {
  status: "downloaded" | "duplicate" | "error";
  file?: string;
  sha256?: string;
  provider?: string;
};

type DownloadSpecies = {
  sort: number;
  nameKo: string;
  scientificName: string;
  files: DownloadFile[];
};

type TestCase = {
  id: string;
  path: string;
  kind: "fish" | "non_fish" | "low_quality";
  expectedScientificName?: string;
  reviewStatus?: "pending";
  source?: string;
};

const root = process.cwd();
const qaRoot = path.join(root, "qa/fish-recognition");
const downloadSummaryPath = path.join(
  qaRoot,
  "open-photo-candidates",
  "_download-summary.json",
);
const legacyRoot = path.join(qaRoot, "gbif-candidates");
const perSpecies = Math.max(
  1,
  Math.min(
    5,
    Number(process.env.QA_FISH_CASES_PER_SPECIES ?? 5) || 5,
  ),
);

const downloadSummary = JSON.parse(
  await fs.readFile(downloadSummaryPath, "utf8"),
) as { species: DownloadSpecies[] };
const stableManifest = JSON.parse(
  await fs.readFile(path.join(qaRoot, "manifest.json"), "utf8"),
) as { cases: TestCase[] };
const legacyDirectories = await fs.readdir(legacyRoot);
const fishCases: TestCase[] = [];
const providerPriority: Record<string, number> = {
  inaturalist: 0,
  wikimedia: 1,
  gbif: 2,
};
const minimumImageBytes = 30_000;
const maximumImageBytes = 4_000_000;

const hashFile = async (filePath: string) =>
  createHash("sha256")
    .update(await fs.readFile(filePath))
    .digest("hex");

for (const species of downloadSummary.species) {
  const selected: Array<{
    absolutePath: string;
    manifestPath: string;
    sha256: string;
    source: string;
  }> = [];
  const seenHashes = new Set<string>();

  const preferredFiles = species.files
    .filter((file) => file.status === "downloaded")
    .sort(
      (left, right) =>
        (providerPriority[left.provider ?? ""] ?? 9) -
        (providerPriority[right.provider ?? ""] ?? 9),
    );
  for (const file of preferredFiles) {
    if (
      !file.file ||
      !file.sha256 ||
      seenHashes.has(file.sha256)
    ) {
      continue;
    }
    const absolutePath = path.join(root, file.file);
    const { size } = await fs.stat(absolutePath);
    if (size < minimumImageBytes || size > maximumImageBytes) continue;
    seenHashes.add(file.sha256);
    selected.push({
      absolutePath,
      manifestPath: path.relative(qaRoot, absolutePath),
      sha256: file.sha256,
      source: `open-${file.provider ?? "unknown"}`,
    });
    if (selected.length >= perSpecies) break;
  }

  if (selected.length < perSpecies) {
    const prefix = `${String(species.sort).padStart(2, "0")}-`;
    const legacyDirectory = legacyDirectories.find((name) =>
      name.startsWith(prefix),
    );
    if (!legacyDirectory) {
      throw new Error(`${prefix} 기존 후보 폴더가 없습니다.`);
    }
    const legacyFiles = (await fs.readdir(
      path.join(legacyRoot, legacyDirectory),
    ))
      .filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
      .sort();
    for (const fileName of legacyFiles) {
      const absolutePath = path.join(legacyRoot, legacyDirectory, fileName);
      const sha256 = await hashFile(absolutePath);
      if (seenHashes.has(sha256)) continue;
      seenHashes.add(sha256);
      selected.push({
        absolutePath,
        manifestPath: path.relative(qaRoot, absolutePath),
        sha256,
        source: "legacy-gbif",
      });
      if (selected.length >= perSpecies) break;
    }
  }

  if (selected.length < perSpecies) {
    throw new Error(
      `${species.nameKo} 평가 사진이 ${selected.length}/${perSpecies}장뿐입니다.`,
    );
  }

  selected.forEach((file, index) => {
    fishCases.push({
      id:
        `provisional-${String(species.sort).padStart(2, "0")}-` +
        `${String(index + 1).padStart(2, "0")}`,
      path: file.manifestPath,
      kind: "fish",
      expectedScientificName: species.scientificName,
      reviewStatus: "pending",
      source: file.source,
    });
  });
}

const includeRejectionCases =
  process.env.QA_INCLUDE_REJECTION_CASES !== "0";
const rejectionCases = includeRejectionCases
  ? stableManifest.cases.filter((testCase) => testCase.kind !== "fish")
  : [];
const output = {
  notes:
    "공개 라이선스 pending 후보를 사용하는 잠정 평가입니다. 기술적 중복은 제거했지만 사람의 종 동정·품질·라이선스 승인 전에는 출시 판정 근거로 사용할 수 없습니다.",
  generatedAt: new Date().toISOString(),
  casesPerSpecies: perSpecies,
  speciesCount: downloadSummary.species.length,
  cases: [...fishCases, ...rejectionCases],
};
const outputPath = path.join(qaRoot, "provisional-manifest.json");
await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
console.log(
  `잠정 평가 manifest 생성: 어종 ${fishCases.length}장 ` +
    `(${downloadSummary.species.length}종 × ${perSpecies}), ` +
    `거부 ${rejectionCases.length}장`,
);
