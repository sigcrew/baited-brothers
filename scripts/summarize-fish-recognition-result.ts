import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";

type ResultRow = {
  id: string;
  kind: string;
  expected?: string;
  candidates?: string[];
  needsRetake?: boolean;
  error?: unknown;
};

type Fish = {
  id: string;
  name: string;
  name_ko: string | null;
};

const root = process.cwd();
const resultPath = path.resolve(
  root,
  process.env.QA_RESULT_PATH ?? "/tmp/baited-brothers-reviewed-top3.json",
);
const result = JSON.parse(await fs.readFile(resultPath, "utf8")) as {
  generatedAt: string;
  summary: Record<string, unknown>;
  rows: ResultRow[];
};
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY가 필요합니다.",
  );
}

const response = await fetch(
  `${supabaseUrl}/rest/v1/fishes?catalog_status=eq.core&select=id,name,name_ko`,
  {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  },
);
if (!response.ok) throw new Error(`도감 조회 실패: ${response.status}`);
const fishes = (await response.json()) as Fish[];
const fishById = new Map(fishes.map((fish) => [fish.id, fish]));
const normalize = (value: string) =>
  value
    .normalize("NFKD")
    .split(/\s+/)
    .slice(0, 2)
    .join(" ")
    .toLowerCase();
const aliases = new Map([
  ["kareius bicoloratus", "platichthys bicoloratus"],
  ["lateolabrax maculatus", "lateolabrax spilonotus"],
]);
const idByName = new Map(
  fishes.map((fish) => [normalize(fish.name), fish.id]),
);

const fishRows = result.rows
  .filter((row) => row.kind === "fish")
  .map((row) => {
    const expectedName = row.expected ?? "";
    const normalized = normalize(expectedName);
    const expectedId = idByName.get(aliases.get(normalized) ?? normalized);
    const candidates = row.candidates ?? [];
    return {
      id: row.id,
      expected: expectedName,
      expectedKo: expectedId ? fishById.get(expectedId)?.name_ko : null,
      candidateNames: candidates.map((id) => {
        const fish = fishById.get(id);
        return fish ? `${fish.name_ko ?? fish.name} (${fish.name})` : id;
      }),
      top1Match: Boolean(expectedId && candidates[0] === expectedId),
      top3Match: Boolean(expectedId && candidates.includes(expectedId)),
      noCandidate: candidates.length === 0,
      needsRetake: row.needsRetake === true,
      error: row.error,
    };
  });

const output = {
  generatedAt: new Date().toISOString(),
  sourceGeneratedAt: result.generatedAt,
  sourceSummary: result.summary,
  reviewedFishCases: fishRows.length,
  top1Matches: fishRows.filter((row) => row.top1Match).length,
  top3Matches: fishRows.filter((row) => row.top3Match).length,
  noCandidateCases: fishRows.filter((row) => row.noCandidate).length,
  wrongCandidateCases: fishRows.filter(
    (row) => !row.noCandidate && !row.top3Match,
  ).length,
  top3Failures: fishRows.filter((row) => !row.top3Match),
  rows: fishRows,
};

const outputPath = path.resolve(
  root,
  process.env.QA_SUMMARY_PATH ??
    "/tmp/baited-brothers-reviewed-top3-summary.json",
);
await fs.writeFile(outputPath, JSON.stringify(output, null, 2));
console.log(
  JSON.stringify(
    {
      reviewedFishCases: output.reviewedFishCases,
      top1Matches: output.top1Matches,
      top3Matches: output.top3Matches,
      noCandidateCases: output.noCandidateCases,
      wrongCandidateCases: output.wrongCandidateCases,
      top3FailureSpecies: output.top3Failures.map(
        (row) => row.expectedKo ?? row.expected,
      ),
      outputPath,
    },
    null,
    2,
  ),
);
