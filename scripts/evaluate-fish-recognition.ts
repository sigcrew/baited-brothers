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
const manifestPath = path.join(root, "qa/fish-recognition/manifest.json");
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
const idByScientificName = new Map(catalog.map((fish) => [fish.name, fish.id]));

let top1 = 0;
let top3 = 0;
let fishCount = 0;
let rejectCount = 0;
let rejectPass = 0;
const rows: Record<string, unknown>[] = [];

for (const testCase of manifest.cases) {
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
  });
  const result = await response.json();
  if (!response.ok) {
    rows.push({ id: testCase.id, error: result.error ?? response.status });
    continue;
  }

  const candidateIds = Array.isArray(result.candidates)
    ? result.candidates.map((candidate: { fish_id?: string }) => candidate.fish_id)
    : [];
  if (testCase.kind === "fish") {
    fishCount += 1;
    const expectedId = testCase.expectedScientificName
      ? idByScientificName.get(testCase.expectedScientificName)
      : undefined;
    if (expectedId && candidateIds[0] === expectedId) top1 += 1;
    if (expectedId && candidateIds.includes(expectedId)) top3 += 1;
  } else {
    rejectCount += 1;
    if (result.needs_retake === true && candidateIds.length === 0) {
      rejectPass += 1;
    }
  }
  rows.push({
    id: testCase.id,
    kind: testCase.kind,
    expected: testCase.expectedScientificName ?? "reject",
    needsRetake: result.needs_retake,
    candidates: candidateIds,
    note: result.note,
  });
}

console.table(rows);
console.log(
  JSON.stringify(
    {
      total: manifest.cases.length,
      fishCases: fishCount,
      top1Accuracy: fishCount ? top1 / fishCount : null,
      top3Accuracy: fishCount ? top3 / fishCount : null,
      rejectionCases: rejectCount,
      rejectionAccuracy: rejectCount ? rejectPass / rejectCount : null,
      releaseGate: {
        minimumCasesPerCoreSpecies: 5,
        minimumNonFishCases: 30,
        minimumLowQualityCases: 30,
        targetTop3Accuracy: 0.9,
        targetRejectionAccuracy: 0.95
      }
    },
    null,
    2,
  ),
);
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
