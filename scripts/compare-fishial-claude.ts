import fs from "node:fs/promises";
import path from "node:path";

type ClaudeRow = {
  id?: string;
  candidates?: string[];
};

type FishialRow = {
  id?: string;
  expectedSort: number;
  top1Match: boolean;
  top3Match: boolean;
};

const catalogPattern =
  /\["([^"]+)", "([^"]+)", "([^"]+)", "([^"]+)"\]/g;

const root = process.cwd();
const claudePath = path.resolve(
  root,
  process.argv[2] ?? "/tmp/baited-brothers-reviewed-top3.json",
);
const fishialPath = path.resolve(
  root,
  process.argv[3] ?? "/tmp/fishial-field60-knn.json",
);
const catalogSource = await fs.readFile(
  path.resolve(root, "src/data/field60CatalogFallback.ts"),
  "utf8",
);

const catalog = [...catalogSource.matchAll(catalogPattern)].map(
  (match, index) => ({
    sort: index + 1,
    id: match[1],
    scientificName: match[2],
    nameKo: match[3],
  }),
);
if (catalog.length !== 60) {
  throw new Error(`FIELD 60 종을 60개 찾지 못했습니다: ${catalog.length}`);
}

const claude = JSON.parse(await fs.readFile(claudePath, "utf8")) as {
  rows: ClaudeRow[];
};
const fishial = JSON.parse(await fs.readFile(fishialPath, "utf8")) as {
  rows: FishialRow[];
};
const claudeById = new Map(
  claude.rows.filter((row) => row.id).map((row) => [row.id, row]),
);
const aligned = fishial.rows
  .map((fishialRow, index) => ({
    fishialRow,
    claudeRow: fishialRow.id
      ? claudeById.get(fishialRow.id)
      : claude.rows[index],
  }))
  .filter(
    (pair): pair is { fishialRow: FishialRow; claudeRow: ClaudeRow } =>
      Boolean(pair.claudeRow),
  );
if (aligned.length === 0) {
  throw new Error("Claude와 Fishial 결과에서 공통 평가 행을 찾지 못했습니다.");
}

let claudeTop1 = 0;
let claudeTop3 = 0;
let fishialTop1 = 0;
let fishialTop3 = 0;
let unionTop3 = 0;
const bothMisses: string[] = [];

aligned.forEach(({ fishialRow, claudeRow }) => {
  const expected = catalog[fishialRow.expectedSort - 1];
  if (!expected) {
    throw new Error(`알 수 없는 FIELD 60 순번: ${fishialRow.expectedSort}`);
  }
  const claudeCandidates = claudeRow.candidates ?? [];
  const claudeTop1Match = claudeCandidates[0] === expected.id;
  const claudeTop3Match = claudeCandidates.includes(expected.id);

  claudeTop1 += Number(claudeTop1Match);
  claudeTop3 += Number(claudeTop3Match);
  fishialTop1 += Number(fishialRow.top1Match);
  fishialTop3 += Number(fishialRow.top3Match);
  unionTop3 += Number(claudeTop3Match || fishialRow.top3Match);
  if (!claudeTop3Match && !fishialRow.top3Match) {
    bothMisses.push(expected.nameKo);
  }
});

const total = aligned.length;
const ratio = (count: number) => count / total;
console.log(
  JSON.stringify(
    {
      total,
      excludedBecauseMissingPair:
        Math.max(claude.rows.length, fishial.rows.length) - total,
      claude: {
        top1: claudeTop1,
        top1Accuracy: ratio(claudeTop1),
        top3: claudeTop3,
        top3Accuracy: ratio(claudeTop3),
      },
      fishial: {
        top1: fishialTop1,
        top1Accuracy: ratio(fishialTop1),
        top3: fishialTop3,
        top3Accuracy: ratio(fishialTop3),
      },
      candidateUnion: {
        top3Recall: unionTop3,
        top3RecallAccuracy: ratio(unionTop3),
        warning:
          "두 모델의 후보 합집합 recall이며, 사용자에게 보여줄 최종 Top-3 정확도가 아닙니다.",
      },
      bothMisses,
    },
    null,
    2,
  ),
);
