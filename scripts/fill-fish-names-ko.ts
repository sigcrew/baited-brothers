/**
 * name_ko가 비어 있는 fishes에 대해 한글 위키백과에서 한글명을 검색하여 채웁니다.
 *
 * 사전 준비:
 * 1. .env에 SUPABASE_SERVICE_ROLE_KEY, EXPO_PUBLIC_SUPABASE_URL 설정
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const USER_AGENT = "baited-brothers/1.0 (name_ko filler)";
const RATE_LIMIT_MS = 450;

type FishRow = Pick<
  Database["public"]["Tables"]["fishes"]["Row"],
  "id" | "name" | "name_ko"
>;

interface WikipediaSearchResult {
  query?: {
    search?: Array<{ title: string }>;
  };
}

interface WikipediaLanglinksResult {
  query?: {
    pages?: Record<
      string,
      { langlinks?: Array<{ lang: string; "*": string }> }
    >;
  };
}

const HANGUL_REGEX = /[\uAC00-\uD7A3]/;

const extractScientificName = (name: string): string => {
  const match = name.match(/^([A-Za-z]+ [a-z]+)/);
  return match ? match[1] : name.split(" ").slice(0, 2).join(" ");
};

const hasHangul = (s: string): boolean => HANGUL_REGEX.test(s);

const isValidSpeciesName = (s: string): boolean => {
  if (s.length > 30 || s.length < 2) return false;
  if (s.endsWith("속") || s.endsWith("과") || s.endsWith("목")) return false;
  if (s.includes("아과") || s.includes("아목")) return false;
  if (/[a-zA-Z]{3,}/.test(s)) return false;
  return true;
};

const searchEnglishWikipedia = async (term: string): Promise<string | null> => {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", term);
  url.searchParams.set("format", "json");
  url.searchParams.set("srlimit", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as WikipediaSearchResult;
  return data.query?.search?.[0]?.title ?? null;
};

const getKoreanTitleFromLanglinks = async (
  enTitle: string
): Promise<string | null> => {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", enTitle);
  url.searchParams.set("prop", "langlinks");
  url.searchParams.set("lllang", "ko");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as WikipediaLanglinksResult;
  const pages = data.query?.pages;
  if (!pages) return null;

  const page = Object.values(pages)[0];
  const koLink = page?.langlinks?.find((l) => l.lang === "ko");
  return koLink?.["*"] ?? null;
};

const searchKoreanWikipedia = async (term: string): Promise<string | null> => {
  const url = new URL("https://ko.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("list", "search");
  url.searchParams.set("srsearch", term);
  url.searchParams.set("format", "json");
  url.searchParams.set("srlimit", "3");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as WikipediaSearchResult;
  const results = data.query?.search ?? [];

  for (const r of results) {
    if (hasHangul(r.title) && isValidSpeciesName(r.title)) {
      return r.title;
    }
  }
  return null;
};

const fetchNameKoForFish = async (fish: FishRow): Promise<string | null> => {
  const sciName = extractScientificName(fish.name);

  const enTitle = await searchEnglishWikipedia(sciName);
  if (enTitle) {
    const koTitle = await getKoreanTitleFromLanglinks(enTitle);
    if (koTitle && hasHangul(koTitle) && isValidSpeciesName(koTitle))
      return koTitle;
    await sleep(RATE_LIMIT_MS);
  }
  await sleep(RATE_LIMIT_MS);

  const koDirect = await searchKoreanWikipedia(sciName);
  if (koDirect) return koDirect;

  return null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error(
      "Error: EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env"
    );
    process.exit(1);
  }

  const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const { data: fishes, error } = await supabase
    .from("fishes")
    .select("id, name, name_ko")
    .is("name_ko", null);

  if (error) {
    console.error("Error fetching fishes:", error.message);
    process.exit(1);
  }

  const list = (fishes ?? []) as FishRow[];
  const total = list.length;

  if (total === 0) {
    console.log("No fishes without name_ko. Done.");
    return;
  }

  console.log(`Filling name_ko for ${total} fishes...\n`);

  let okCount = 0;
  let skipCount = 0;

  for (let i = 0; i < total; i++) {
    const fish = list[i];

    try {
      const nameKo = await fetchNameKoForFish(fish);

      if (nameKo) {
        const { error: updateError } = await supabase
          .from("fishes")
          .update({ name_ko: nameKo, updated_at: new Date().toISOString() })
          .eq("id", fish.id);

        if (updateError) {
          console.log(
            `[${i + 1}/${total}] ${fish.name} - UPDATE ERROR: ${updateError.message}`
          );
        } else {
          okCount++;
          console.log(`[${i + 1}/${total}] ${fish.name} -> ${nameKo} - OK`);
        }
      } else {
        skipCount++;
        console.log(`[${i + 1}/${total}] ${fish.name} - SKIP`);
      }
    } catch (err) {
      console.log(`[${i + 1}/${total}] ${fish.name} - ERROR:`, err);
    }

    await sleep(RATE_LIMIT_MS);
  }

  console.log(`\nDone. OK: ${okCount}, SKIP: ${skipCount}, Total: ${total}`);
};

main();
