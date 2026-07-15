/**
 * description이 비어 있는 fishes에 대해 Wikipedia API로 정보를 검색·추출하여 채웁니다.
 *
 * 사전 준비:
 * 1. .env에 SUPABASE_SERVICE_ROLE_KEY, EXPO_PUBLIC_SUPABASE_URL 설정
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const USER_AGENT = "baited-brothers/1.0 (description filler)";
const RATE_LIMIT_MS = 450;
const MAX_DESCRIPTION_LENGTH = 500;

type FishRow = Pick<
  Database["public"]["Tables"]["fishes"]["Row"],
  "id" | "name" | "name_ko"
>;

interface WikipediaSearchResult {
  query?: {
    search?: Array<{ title: string }>;
  };
}

interface WikipediaExtractResult {
  query?: {
    pages?: Record<
      string,
      { extract?: string; title?: string; missing?: boolean }
    >;
  };
}

const searchWikipedia = async (
  term: string,
  lang: "en" | "ko"
): Promise<string | null> => {
  const base = lang === "en" ? "en.wikipedia.org" : "ko.wikipedia.org";
  const url = new URL(`https://${base}/w/api.php`);
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
  const first = data.query?.search?.[0];
  return first?.title ?? null;
};

const getWikipediaExtract = async (
  title: string,
  lang: "en" | "ko"
): Promise<string | null> => {
  const base = lang === "en" ? "en.wikipedia.org" : "ko.wikipedia.org";
  const url = new URL(`https://${base}/w/api.php`);
  url.searchParams.set("action", "query");
  url.searchParams.set("prop", "extracts");
  url.searchParams.set("exintro", "1");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("exchars", String(MAX_DESCRIPTION_LENGTH));
  url.searchParams.set("titles", title);
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as WikipediaExtractResult;
  const pages = data.query?.pages;
  if (!pages) return null;

  const page = Object.values(pages)[0];
  if (!page || page.missing || !page.extract) return null;

  const text = page.extract.trim().replace(/\s+/g, " ");
  return text ? text.slice(0, MAX_DESCRIPTION_LENGTH) : null;
};

const fetchDescriptionForFish = async (fish: FishRow): Promise<string | null> => {
  const trySearch = async (term: string, lang: "en" | "ko") => {
    const title = await searchWikipedia(term, lang);
    if (title) {
      const extract = await getWikipediaExtract(title, lang);
      if (extract) return extract;
      await sleep(RATE_LIMIT_MS);
    }
    await sleep(RATE_LIMIT_MS);
    return null;
  };

  if (fish.name) {
    const r = await trySearch(fish.name, "en") ?? await trySearch(fish.name, "ko");
    if (r) return r;
  }
  if (fish.name_ko) {
    const r = await trySearch(fish.name_ko, "ko") ?? await trySearch(fish.name_ko, "en");
    if (r) return r;
  }
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
    .is("description", null);

  if (error) {
    console.error("Error fetching fishes:", error.message);
    process.exit(1);
  }

  const list = (fishes ?? []) as FishRow[];
  const total = list.length;

  if (total === 0) {
    console.log("No fishes with empty description. Done.");
    return;
  }

  console.log(`Filling descriptions for ${total} fishes...\n`);

  let okCount = 0;
  let skipCount = 0;

  for (let i = 0; i < total; i++) {
    const fish = list[i];
    const label = `${fish.name_ko ? `${fish.name_ko} ` : ""}(${fish.name})`;

    try {
      const description = await fetchDescriptionForFish(fish);

      if (description) {
        const { error: updateError } = await supabase
          .from("fishes")
          .update({ description, updated_at: new Date().toISOString() })
          .eq("id", fish.id);

        if (updateError) {
          console.log(`[${i + 1}/${total}] ${label} - UPDATE ERROR: ${updateError.message}`);
        } else {
          okCount++;
          console.log(`[${i + 1}/${total}] ${label} - OK`);
        }
      } else {
        skipCount++;
        console.log(`[${i + 1}/${total}] ${label} - SKIP`);
      }
    } catch (err) {
      console.log(`[${i + 1}/${total}] ${label} - ERROR:`, err);
    }

    await sleep(RATE_LIMIT_MS);
  }

  console.log(`\nDone. OK: ${okCount}, SKIP: ${skipCount}, Total: ${total}`);
};

main();
