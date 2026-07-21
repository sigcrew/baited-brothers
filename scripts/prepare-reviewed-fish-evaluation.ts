import fs from "node:fs/promises";
import path from "node:path";

type DownloadSpecies = {
  sort: number;
  nameKo: string;
  scientificName: string;
};

type Selection =
  | { filePrefix: string; source: string }
  | { assetPath: string; source: string };

const root = process.cwd();
const qaRoot = path.join(root, "qa/fish-recognition");
const candidateRoot = path.join(qaRoot, "open-photo-candidates");
const summary = JSON.parse(
  await fs.readFile(path.join(candidateRoot, "_download-summary.json"), "utf8"),
) as { species: DownloadSpecies[] };

// 2026-07-21 육안 검수 결과입니다. 온전한 개체가 식별되는 실사진만 선택하고,
// 문서·X-ray·일러스트·조리 사진·중복·명백한 오동정 후보는 제외했습니다.
const selections: Record<number, Selection> = {
  1: { filePrefix: "02-", source: "reviewed-open-photo" },
  2: { filePrefix: "01-", source: "reviewed-open-photo" },
  3: {
    assetPath: "assets/images/species/field60/pseudopleuronectes-yokohamae.png",
    source: "curated-app-reference",
  },
  4: {
    assetPath: "assets/images/species/field60/pseudopleuronectes-herzensteini.png",
    source: "curated-app-reference",
  },
  5: {
    assetPath: "assets/images/species/field60/kareius-bicoloratus.png",
    source: "curated-app-reference",
  },
  6: { filePrefix: "03-", source: "reviewed-open-photo" },
  7: { filePrefix: "01-", source: "reviewed-open-photo" },
  8: {
    filePrefix: "11-wikimedia-target-",
    source: "reviewed-wikimedia-category",
  },
  9: { filePrefix: "04-", source: "reviewed-open-photo" },
  10: { filePrefix: "02-", source: "reviewed-open-photo" },
  11: { filePrefix: "01-", source: "reviewed-open-photo" },
  12: { filePrefix: "01-", source: "reviewed-open-photo" },
  13: { filePrefix: "01-", source: "reviewed-open-photo" },
  14: { filePrefix: "04-", source: "reviewed-open-photo" },
  15: { filePrefix: "01-", source: "reviewed-open-photo" },
  16: { filePrefix: "03-", source: "reviewed-open-photo" },
  17: { filePrefix: "01-", source: "reviewed-open-photo" },
  18: { filePrefix: "03-", source: "reviewed-open-photo" },
  19: { filePrefix: "04-", source: "reviewed-open-photo" },
  20: { filePrefix: "05-", source: "reviewed-open-photo" },
  21: { filePrefix: "02-", source: "reviewed-open-photo" },
  22: { filePrefix: "03-", source: "reviewed-open-photo" },
  23: {
    assetPath: "assets/images/species/field60/lateolabrax-maculatus.png",
    source: "curated-app-reference",
  },
  25: { filePrefix: "04-", source: "reviewed-open-photo" },
  26: { filePrefix: "03-", source: "reviewed-open-photo" },
  27: { filePrefix: "02-", source: "reviewed-open-photo" },
  28: { filePrefix: "02-", source: "reviewed-open-photo" },
  29: { filePrefix: "06-", source: "reviewed-open-photo" },
  30: {
    assetPath: "assets/images/species/field60/hyporthodus-septemfasciatus.jpg",
    source: "curated-app-reference",
  },
  31: { filePrefix: "09-", source: "reviewed-open-photo" },
  32: { filePrefix: "06-", source: "reviewed-open-photo" },
  33: { filePrefix: "03-", source: "reviewed-open-photo" },
  34: { filePrefix: "06-", source: "reviewed-open-photo" },
  35: { filePrefix: "06-", source: "reviewed-open-photo" },
  36: { filePrefix: "01-", source: "reviewed-open-photo" },
  37: { filePrefix: "01-", source: "reviewed-open-photo" },
  38: { filePrefix: "02-", source: "reviewed-open-photo" },
  39: { filePrefix: "02-", source: "reviewed-open-photo" },
  40: {
    filePrefix: "11-wikimedia-target-",
    source: "reviewed-wikimedia-category",
  },
  41: { filePrefix: "01-", source: "reviewed-open-photo" },
  42: { filePrefix: "01-", source: "reviewed-open-photo" },
  43: { filePrefix: "03-", source: "reviewed-open-photo" },
  44: { filePrefix: "03-", source: "reviewed-open-photo" },
  45: { filePrefix: "08-", source: "reviewed-open-photo" },
  46: { filePrefix: "10-", source: "reviewed-open-photo" },
  47: { filePrefix: "01-", source: "reviewed-open-photo" },
  48: { filePrefix: "03-", source: "reviewed-open-photo" },
  49: { filePrefix: "02-", source: "reviewed-open-photo" },
  50: { filePrefix: "02-", source: "reviewed-open-photo" },
  51: { filePrefix: "02-", source: "reviewed-open-photo" },
  52: { filePrefix: "06-", source: "reviewed-open-photo" },
  53: { filePrefix: "04-", source: "reviewed-open-photo" },
  54: {
    filePrefix: "13-wikimedia-target-",
    source: "reviewed-wikimedia-category",
  },
  55: { filePrefix: "06-", source: "reviewed-open-photo" },
  56: { filePrefix: "01-", source: "reviewed-open-photo" },
  57: { filePrefix: "01-", source: "reviewed-open-photo" },
  58: { filePrefix: "03-", source: "reviewed-open-photo" },
  59: { filePrefix: "03-", source: "reviewed-open-photo" },
  60: { filePrefix: "01-", source: "reviewed-open-photo" },
};

const findCandidateDirectory = async (sort: number) => {
  const prefix = `${String(sort).padStart(2, "0")}-`;
  const directory = (await fs.readdir(candidateRoot)).find((name) =>
    name.startsWith(prefix),
  );
  if (!directory) throw new Error(`${prefix} 후보 폴더를 찾을 수 없습니다.`);
  return path.join(candidateRoot, directory);
};

const reviews: Array<Record<string, unknown>> = [];
const cases: Array<Record<string, unknown>> = [];

for (const species of summary.species) {
  const selection = selections[species.sort];
  if (!selection) {
    reviews.push({
      sort: species.sort,
      nameKo: species.nameKo,
      scientificName: species.scientificName,
      status: "blocked",
      reason:
        "공개 라이선스와 품질 기준을 모두 충족하는 온전한 개체 사진을 확보하지 못함",
    });
    continue;
  }

  let absolutePath: string;
  if ("assetPath" in selection) {
    absolutePath = path.join(root, selection.assetPath);
  } else {
    const directory = await findCandidateDirectory(species.sort);
    const fileName = (await fs.readdir(directory))
      .filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
      .find((name) => name.startsWith(selection.filePrefix));
    if (!fileName) {
      throw new Error(
        `${species.nameKo}: ${selection.filePrefix} 승인 사진을 찾을 수 없습니다.`,
      );
    }
    absolutePath = path.join(directory, fileName);
  }

  await fs.access(absolutePath);
  const manifestPath = path.relative(qaRoot, absolutePath);
  reviews.push({
    sort: species.sort,
    nameKo: species.nameKo,
    scientificName: species.scientificName,
    status: "approved",
    path: manifestPath,
    source: selection.source,
    criteria:
      "온전한 개체 식별 가능, 실사진, 문서·X-ray·일러스트·조리 사진 아님",
  });
  cases.push({
    id: `reviewed-${String(species.sort).padStart(2, "0")}`,
    path: manifestPath,
    kind: "fish",
    expectedScientificName: species.scientificName,
    reviewStatus: "approved",
    source: selection.source,
  });
}

const generatedAt = new Date().toISOString();
await fs.writeFile(
  path.join(qaRoot, "approved-photo-review.json"),
  JSON.stringify(
    {
      generatedAt,
      reviewScope:
        "60종 자동 수집 후보 및 기존 앱 검증 사진의 형태·품질·출처 메타데이터 육안 검수",
      limitation:
        "분류학 전문가 감수가 아닌 QA용 육안 검수이며, 민어 1종은 승인 사진 미확보",
      summary: {
        catalogSpecies: summary.species.length,
        approvedSpecies: cases.length,
        blockedSpecies: summary.species.length - cases.length,
      },
      species: reviews,
    },
    null,
    2,
  ),
);
await fs.writeFile(
  path.join(qaRoot, "approved-manifest.json"),
  JSON.stringify(
    {
      generatedAt,
      notes:
        "육안 승인된 대표 실사진만 포함한 Top-3 커버리지 측정용 manifest입니다.",
      casesPerSpecies: 1,
      catalogSpeciesCount: summary.species.length,
      approvedSpeciesCount: cases.length,
      cases,
    },
    null,
    2,
  ),
);

console.log(
  `승인 평가 manifest 생성: ${cases.length}/${summary.species.length}종, ` +
    `차단 ${summary.species.length - cases.length}종`,
);
