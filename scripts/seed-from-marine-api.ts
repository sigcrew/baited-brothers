/**
 * 공공데이터포털 해양생물종정보 API(taxonlist2)에서 데이터를 가져와 Supabase fishes 테이블에 시드합니다.
 *
 * taxonlist2 API는 검색형 API로, spcScitfNm/commKorNm/Family/FamilyKR 중 최소 하나가 필요합니다.
 * Family(학명) 또는 FamilyKR(국명)로 과별 조회 후 페이지네이션합니다.
 *
 * 사전 준비:
 * 1. .env에 DATA_GO_KR_API_KEY, SUPABASE_SERVICE_ROLE_KEY, EXPO_PUBLIC_SUPABASE_URL 설정
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { XMLParser } from "fast-xml-parser";
import type { Database } from "../src/types/database";

type FishCategory = Database["public"]["Enums"]["fish_category"];
type FishInsert = Database["public"]["Tables"]["fishes"]["Insert"];

const API_KEY = process.env.DATA_GO_KR_API_KEY;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TAXONLIST2_URL =
  "https://apis.data.go.kr/B553482/mbrisdataview2/taxonlist2";

/** 낚시 대상 어류 과(학명) - Teleostei(조기류) 위주 */
const FISH_FAMILIES = [
  "Pleuronectidae", // 가자미과
  "Paralichthyidae", // 넙치과
  "Bothidae", // 둥글넙치과
  "Cynoglossidae", // 혀가자미과
  "Soleidae", // 도다리과
  "Scorpaenidae", // 양볼락과
  "Sebastidae", // 바닷돔과
  "Hexagrammidae", // 노래미과(육각류)
  "Triglidae", // 채치과(노래미)
  "Sparidae", // 도미과
  "Oplegnathidae", // 돌돔과
  "Serranidae", // 농어과
  "Epinephelidae", // 자바리과
  "Lateolabracidae", // 농어과
  "Haemulidae", // 줄멸과
  "Lutjanidae", // 도미과(빨강돔)
  "Sciaenidae", // 민어과
  "Scombridae", // 고등어과
  "Carangidae", // 전갱이과
  "Mugilidae", // 숭어과
  "Trichiuridae", // 갈치과
  "Clupeidae", // 청어과
  "Engraulidae", // 멸치과
  "Sphyraenidae", // 바라쿠다과(강달거리)
  "Gobiidae", // 망둥어과
  "Tetraodontidae", // 복어과
  "Monacanthidae", // 쥐치과(말쥐치)
  "Congridae", // 곰치과
  "Salmonidae", // 연어과
];

const mapCategoryFromFamily = (familyName: string, koreanName: string): FishCategory => {
  const text = `${(familyName || "").toLowerCase()} ${(koreanName || "").toLowerCase()}`;
  if (
    /넙치|가자미|광어|플라운더|flatfish|pleuronect|paralichthy|bothidae|cynogloss|soleidae|flounder/i.test(
      text
    )
  ) {
    return "flatfish";
  }
  if (
    /우럭|바닷돔|rockfish|sebastes|scorpaen|hexagramm|trigl|노래미/i.test(text)
  ) {
    return "rockfish";
  }
  if (/참돔|감성돔|황돔|청돔|돌돔|sparid|sparus|pagrus|dentex|acanthopagrus|oplegnath/i.test(text)) {
    return "bream";
  }
  if (
    /농어|도미|seabass|serran|epinephel|lateolabrac|haemul|lutjan|sciaen|민어|줄멸|굴거리/i.test(
      text
    )
  ) {
    return "seabass";
  }
  if (/고등어|전갱이|mackerel|scomber|carang/i.test(text)) {
    return "mackerel";
  }
  if (/숭어|mullet|mugil/i.test(text)) {
    return "mullet";
  }
  if (/갈치|cutlassfish|trichiur/i.test(text)) {
    return "cutlassfish";
  }
  if (/곰치|eel|congrid|뱀장어/i.test(text)) {
    return "eel";
  }
  if (/복어|pufferfish|tetraodont|쥐치|말쥐치|monacanth|filefish/i.test(text)) {
    return "pufferfish";
  }
  return "other";
};

const mapCollectionGroup = (category: FishCategory) => {
  switch (category) {
    case "flatfish":
      return "flatfish";
    case "rockfish":
      return "rockfish";
    case "bream":
      return "bream";
    case "seabass":
      return "seabass_croaker";
    case "mackerel":
    case "mullet":
    case "cutlassfish":
      return "pelagic";
    case "eel":
      return "eel";
    case "pufferfish":
      return "pufferfish";
    default:
      return "other";
  }
};

const parseApiResponse = (xml: string): Array<Record<string, unknown>> => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
  });
  const parsed = parser.parse(xml);

  const response = parsed?.response;
  if (!response) {
    throw new Error("Invalid API response structure");
  }

  const header = response.header || {};
  const resultCode =
    header.resultCode ?? header.ResultCode ?? header.RESULTCODE;
  const successCodes = ["00", "0", "000"];
  if (
    resultCode !== undefined &&
    resultCode !== null &&
    !successCodes.includes(String(resultCode))
  ) {
    throw new Error(
      `API error: ${header.resultMsg || header.ResultMsg || "Unknown"} (code: ${resultCode})`
    );
  }

  const body = response.body;
  if (!body) return [];

  let items = body.items?.item;
  if (!items) return [];

  if (!Array.isArray(items)) {
    items = [items];
  }

  return items;
};

const mapToFishItem = (item: Record<string, unknown>): FishInsert | null => {
  const spcScitfNm = (item.SpcScitfNm ?? item.spcScitfNm) as string | undefined;
  const commKorNm = (item.CommKorNm ?? item.commKorNm) as string | undefined;
  const family = (item.Family ?? item.family) as string | undefined;
  const familyKR = (item.FamilyKR ?? item.familyKR) as string | undefined;

  const name = spcScitfNm?.trim() || commKorNm?.trim();
  if (!name || typeof name !== "string") {
    return null;
  }

  const nameKo = commKorNm?.trim() || null;
  const familyName = [family, familyKR].filter(Boolean).join(" ") || "";
  const category = mapCategoryFromFamily(familyName, nameKo || name);
  const sourceSpeciesId = [
    item.Ktsn,
    item.ktsn,
    item.TaxonId,
    item.taxonId,
    item.SpcNo,
    item.spcNo,
  ].find((value) => typeof value === "string" || typeof value === "number");

  const abst = (item.ABST ?? item.abst) as string | undefined;
  const form = (item.FORM ?? item.form) as string | undefined;
  const ecol = (item.ECOL ?? item.ecol) as string | undefined;
  const description = [abst, form, ecol]
    .filter(Boolean)
    .map(String)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500) || null;

  const phylum = (item.PhylumDivision ?? item.phylumDivision) as string | undefined;
  const cls = (item.Class ?? item.class) as string | undefined;
  const isFish =
    phylum === "Chordata" && (cls === "Teleostei" || cls === "Actinopterygii");
  if (!isFish) {
    return null;
  }

  return {
    name: name.slice(0, 200),
    name_ko: nameKo?.slice(0, 100) || null,
    description,
    category,
    min_size_cm: null,
    catalog_status: "reference",
    collection_group: mapCollectionGroup(category),
    inclusion_reason: "공공데이터 신규 수집: 국내 생활낚시 대상 여부 검토 전",
    source_name: "해양생물종정보 API taxonlist2",
    source_species_id: sourceSpeciesId == null ? null : String(sourceSpeciesId),
  };
};

const fetchTaxonList = async (
  family: string,
  pageNo: number,
  numOfRows: number
): Promise<string> => {
  const url = new URL(TAXONLIST2_URL);
  url.searchParams.set("serviceKey", API_KEY!);
  url.searchParams.set("pageNo", String(pageNo));
  url.searchParams.set("numOfRows", String(numOfRows));
  url.searchParams.set("Family", family);

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "BaitedBrothers/1.0" },
  });
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText}`);
  }
  return res.text();
};

const main = async () => {
  if (!API_KEY) {
    console.error("Error: DATA_GO_KR_API_KEY is not set in .env");
    process.exit(1);
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error(
      "Error: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env"
    );
    process.exit(1);
  }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const existingFishes = await supabase.from("fishes").select("name");
  const existingNames = new Set(
    (existingFishes.data || []).map((f) => f.name.toLowerCase())
  );

  const numOfRows = 100;
  let totalInserted = 0;

  console.log(`Fetching from taxonlist2 API (Family별 검색)`);
  console.log("Starting seed...\n");

  for (const family of FISH_FAMILIES) {
    let pageNo = 1;
    let hasMore = true;

    while (hasMore) {
      try {
        const xml = await fetchTaxonList(family, pageNo, numOfRows);
        const items = parseApiResponse(xml);

        if (items.length === 0) {
          hasMore = false;
          break;
        }

        const toInsert: FishInsert[] = [];
        for (const item of items) {
          const fish = mapToFishItem(item);
          if (fish && !existingNames.has(fish.name.toLowerCase())) {
            toInsert.push(fish);
            existingNames.add(fish.name.toLowerCase());
          }
        }

        if (toInsert.length > 0) {
          const { error } = await supabase.from("fishes").insert(toInsert);
          if (error) {
            console.error(
              `[${family}] Page ${pageNo} insert error:`,
              error.message
            );
          } else {
            totalInserted += toInsert.length;
            console.log(
              `[${family}] Page ${pageNo}: inserted ${toInsert.length} fishes`
            );
          }
        }

        if (items.length < numOfRows) {
          hasMore = false;
        } else {
          pageNo++;
          await new Promise((r) => setTimeout(r, 350));
        }
      } catch (err) {
        console.error(`[${family}] Page ${pageNo} error:`, err);
        hasMore = false;
      }
    }

    await new Promise((r) => setTimeout(r, 350));
  }

  console.log(`\nDone. Total inserted: ${totalInserted}`);
};

main();
