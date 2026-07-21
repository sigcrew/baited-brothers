import fs from "node:fs/promises";
import path from "node:path";

type FishialLabel =
  | string
  | {
      label?: string;
      species_id?: string;
    };

const normalize = (value: string) =>
  value.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();

const CATALOG_PATTERN =
  /\["([^"]+)", "([^"]+)", "([^"]+)", "([^"]+)"\]/g;

const main = async () => {
  const labelsPath = process.argv[2] ?? process.env.FISHIAL_LABELS_PATH;
  if (!labelsPath) {
    throw new Error(
      "사용법: npm run qa:audit-fishial -- /path/to/labels-or-class-mapping.json",
    );
  }

  const absolutePath = path.resolve(labelsPath);
  const catalogSource = await fs.readFile(
    path.resolve("src/data/field60CatalogFallback.ts"),
    "utf8",
  );
  const catalog = [...catalogSource.matchAll(CATALOG_PATTERN)].map(
    ([, id, scientificName, nameKo, collectionGroup], index) => ({
      id,
      scientificName,
      nameKo,
      collectionGroup,
      catalogSortOrder: index + 1,
    }),
  );
  if (catalog.length !== 60) {
    throw new Error(`FIELD 60 파싱 결과가 ${catalog.length}종입니다.`);
  }
  const raw = JSON.parse(await fs.readFile(absolutePath, "utf8")) as Record<
    string,
    FishialLabel
  >;
  const labels = Object.entries(raw)
    .map(([classIndex, value]) => ({
      classIndex: Number(classIndex),
      label: typeof value === "string" ? value : value.label,
      fishialSpeciesId:
        typeof value === "string" ? undefined : value.species_id,
    }))
    .filter(
      (
        item,
      ): item is {
        classIndex: number;
        label: string;
        fishialSpeciesId: string | undefined;
      } => Boolean(item.label),
    );
  const fishialByName = new Map(
    labels.map((item) => [normalize(item.label), item]),
  );

  const species = catalog.map((fish) => {
    const match = fishialByName.get(normalize(fish.scientificName));
    return {
      catalogSortOrder: fish.catalogSortOrder,
      fishId: fish.id,
      nameKo: fish.nameKo,
      scientificName: fish.scientificName,
      collectionGroup: fish.collectionGroup,
      supported: Boolean(match),
      fishialClassIndex: match?.classIndex ?? null,
      fishialSpeciesId: match?.fishialSpeciesId ?? null,
    };
  });
  const supported = species.filter((item) => item.supported);

  console.log(
    JSON.stringify(
      {
        source: absolutePath,
        fishialClasses: labels.length,
        field60Species: species.length,
        directlySupported: supported.length,
        directCoverage: supported.length / species.length,
        supported,
        unsupported: species.filter((item) => !item.supported),
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
