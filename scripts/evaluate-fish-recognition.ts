import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

type TestCase = {
  id: string;
  path: string;
  kind: "fish" | "non_fish" | "low_quality";
  expectedScientificName?: string;
};

type CatalogFish = {
  id: string;
  name: string;
  name_ko: string | null;
  collection_group: string;
  identification_features: string | null;
  similar_species_notes: string | null;
};

const main = async () => {
const root = process.cwd();
const manifestPath = path.resolve(
  root,
  process.env.QA_MANIFEST_PATH ?? "qa/fish-recognition/manifest.json",
);
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as {
  cases: TestCase[];
};
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const userJwt = process.env.AI_TEST_USER_JWT;

if (!supabaseUrl || !anonKey || !userJwt) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, AI_TEST_USER_JWT가 필요합니다.",
  );
}

const authHeaders = {
  apikey: anonKey,
  Authorization: `Bearer ${userJwt}`,
};
const catalogResponse = await fetch(
  `${supabaseUrl}/rest/v1/fishes?catalog_status=eq.core&select=id,name,name_ko,collection_group,identification_features,similar_species_notes&order=catalog_sort_order`,
  { headers: authHeaders },
);
if (!catalogResponse.ok) {
  throw new Error(`도감 조회 실패: ${catalogResponse.status}`);
}
const catalog = (await catalogResponse.json()) as CatalogFish[];
const normalizeScientificName = (value: string) =>
  value
    .normalize("NFKD")
    .split(/\s+/)
    .slice(0, 2)
    .join(" ")
    .toLowerCase();
const scientificNameAliases = new Map([
  ["kareius bicoloratus", "platichthys bicoloratus"],
  ["lateolabrax maculatus", "lateolabrax spilonotus"],
]);
const idByScientificName = new Map(
  catalog.map((fish) => [normalizeScientificName(fish.name), fish.id]),
);

let top1 = 0;
let top3 = 0;
let fishCount = 0;
let rejectCount = 0;
let rejectPass = 0;
let nonFishCount = 0;
let nonFishPass = 0;
let lowQualityCount = 0;
let lowQualityPass = 0;
const rows: Record<string, unknown>[] = new Array(manifest.cases.length);
const concurrency = Math.max(
  1,
  Math.min(8, Number(process.env.QA_CONCURRENCY ?? 1) || 1),
);

const evaluateCase = async (caseIndex: number, testCase: TestCase) => {
  const absolutePath = path.resolve(path.dirname(manifestPath), testCase.path);
  const bytes = await fs.readFile(absolutePath);
  const mimeType = absolutePath.toLowerCase().endsWith(".png")
    ? "image/png"
    : "image/jpeg";
  const response = await fetch(`${supabaseUrl}/functions/v1/identify-fish`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      imageBase64: bytes.toString("base64"),
      mimeType,
      catalog: catalog.map((fish) => ({
        id: fish.id,
        nameKo: fish.name_ko ?? fish.name,
        scientificName: fish.name,
        group: fish.collection_group,
        identificationFeatures: fish.identification_features,
        similarSpeciesNotes: fish.similar_species_notes,
      })),
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const result = await response.json();
  if (!response.ok) {
    rows[caseIndex] = {
      id: testCase.id,
      kind: testCase.kind,
      error: result.error ?? response.status,
      errorCode: result.error_code,
    };
    console.log(`[${caseIndex + 1}/${manifest.cases.length}] ${testCase.id}: error`);
    return;
  }

  const candidateIds = Array.isArray(result.candidates)
    ? result.candidates.map((candidate: { fish_id?: string }) => candidate.fish_id)
    : [];
  if (testCase.kind === "fish") {
    const normalizedExpectedName = testCase.expectedScientificName
      ? normalizeScientificName(testCase.expectedScientificName)
      : undefined;
    const canonicalExpectedName = normalizedExpectedName
      ? scientificNameAliases.get(normalizedExpectedName) ?? normalizedExpectedName
      : undefined;
    const expectedId = canonicalExpectedName
      ? idByScientificName.get(canonicalExpectedName)
      : undefined;
    const top1Match = Boolean(expectedId && candidateIds[0] === expectedId);
    const top3Match = Boolean(expectedId && candidateIds.includes(expectedId));
    if (top1Match) top1 += 1;
    if (top3Match) top3 += 1;
    rows[caseIndex] = {
      id: testCase.id,
      kind: testCase.kind,
      expected: testCase.expectedScientificName,
      expectedId,
      needsRetake: result.needs_retake,
      candidates: candidateIds,
      top1Match,
      top3Match,
      note: result.note,
    };
    console.log(
      `[${caseIndex + 1}/${manifest.cases.length}] ${testCase.id}: ${
        candidateIds.length > 0 ? "candidates" : "no-candidate"
      }`,
    );
    return;
  } else {
    if (result.needs_retake === true && candidateIds.length === 0) {
      rejectPass += 1;
      if (testCase.kind === "non_fish") nonFishPass += 1;
      else lowQualityPass += 1;
    }
  }
  rows[caseIndex] = {
    id: testCase.id,
    kind: testCase.kind,
    expected: testCase.expectedScientificName ?? "reject",
    needsRetake: result.needs_retake,
    candidates: candidateIds,
    note: result.note,
  };
  console.log(
    `[${caseIndex + 1}/${manifest.cases.length}] ${testCase.id}: ${
      result.needs_retake === true && candidateIds.length === 0
        ? "rejected"
        : "accepted"
    }`,
  );
};

let nextCaseIndex = 0;
const worker = async () => {
  while (true) {
    const caseIndex = nextCaseIndex;
    nextCaseIndex += 1;
    if (caseIndex >= manifest.cases.length) return;
    const testCase = manifest.cases[caseIndex];
    if (testCase.kind === "fish") fishCount += 1;
    else {
      rejectCount += 1;
      if (testCase.kind === "non_fish") nonFishCount += 1;
      else lowQualityCount += 1;
    }

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await evaluateCase(caseIndex, testCase);
        break;
      } catch (error) {
        if (attempt < 3) {
          console.warn(
            `[${caseIndex + 1}/${manifest.cases.length}] ${testCase.id}: retry ${attempt}`,
          );
          await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
          continue;
        }
        rows[caseIndex] = {
          id: testCase.id,
          kind: testCase.kind,
          error: error instanceof Error ? error.message : String(error),
        };
        console.error(
          `[${caseIndex + 1}/${manifest.cases.length}] ${testCase.id}: failed`,
        );
      }
    }
  }
};
await Promise.all(Array.from({ length: concurrency }, () => worker()));

const summary = {
  total: manifest.cases.length,
  fishCases: fishCount,
  top1Accuracy: fishCount ? top1 / fishCount : null,
  top3Accuracy: fishCount ? top3 / fishCount : null,
  rejectionCases: rejectCount,
  rejectionAccuracy: rejectCount ? rejectPass / rejectCount : null,
  nonFishCases: nonFishCount,
  nonFishRejectionAccuracy: nonFishCount ? nonFishPass / nonFishCount : null,
  lowQualityCases: lowQualityCount,
  lowQualityRejectionAccuracy: lowQualityCount
    ? lowQualityPass / lowQualityCount
    : null,
  errors: rows.filter((row) => "error" in row).length,
  provisional: manifestPath.endsWith("provisional-manifest.json"),
  releaseGate: {
    minimumCasesPerCoreSpecies: 5,
    minimumNonFishCases: 30,
    minimumLowQualityCases: 30,
    targetTop3Accuracy: 0.9,
    targetRejectionAccuracy: 0.95
  }
};

if (process.env.QA_VERBOSE === "1") console.table(rows);
if (process.env.QA_RESULT_PATH) {
  await fs.writeFile(
    path.resolve(root, process.env.QA_RESULT_PATH),
    JSON.stringify({ generatedAt: new Date().toISOString(), summary, rows }, null, 2),
  );
}
console.log(JSON.stringify(summary, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
