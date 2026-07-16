/**
 * Fetches read-only FIELD 60 evidence from official FishBase/SeaLifeBase
 * species summaries. The resulting JSON is an editorial input: it never
 * mutates Supabase and uncertain fields remain null.
 *
 * Usage: npm run fetch:core-evidence
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type CoreSpecies = {
  id: string;
  name: string;
  name_ko: string | null;
  collection_group: string;
  average_size_cm: number | null;
  max_size_cm: number | null;
  guide_source_urls: string[];
  scientific_synonyms: string[];
};

const decodeHtml = (value: string) =>
  value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&deg;/gi, "°")
    .replace(/&ndash;|&#8211;/gi, "–")
    .replace(/&mdash;|&#8212;/gi, "—")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();

const between = (html: string, start: RegExp, end: RegExp) => {
  const startMatch = start.exec(html);
  if (!startMatch) return null;
  const rest = html.slice(startMatch.index + startMatch[0].length);
  const endMatch = end.exec(rest);
  return decodeHtml(endMatch ? rest.slice(0, endMatch.index) : rest);
};

const firstMatch = (value: string, regex: RegExp) => {
  const match = regex.exec(value);
  return match?.[1] ? decodeHtml(match[1]) : null;
};

const numberMatch = (value: string, regex: RegExp) => {
  const match = regex.exec(value);
  return match?.[1] ? Number(match[1]) : null;
};

const textSection = (text: string, startLabel: string, endLabels: string[]) => {
  const startIndex = text.indexOf(startLabel);
  if (startIndex < 0) return null;
  const bodyStart = startIndex + startLabel.length;
  const endIndex = endLabels
    .map((label) => text.indexOf(label, bodyStart))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  return text.slice(bodyStart, endIndex ?? undefined).trim();
};

const habitatCopy = (environment: string, biology: string | null) => {
  const evidence = `${environment} ${biology ?? ""}`.toLowerCase();
  const zones: string[] = [];
  if (/pelagic-oceanic/.test(evidence)) zones.push("외해 표층·중층");
  else if (/pelagic-neritic/.test(evidence)) zones.push("연안 표층·중층");
  else if (/bathydemersal/.test(evidence)) zones.push("깊은 대륙붕과 사면 저층");
  else if (/reef-associated|rocky reef|rock bottom/.test(evidence)) zones.push("연안 암초와 암반 지대");
  else if (/demersal|benthic|benthopelagic/.test(evidence)) zones.push("연안과 대륙붕 저층");
  else zones.push("연안 수역");

  if (/sand|sandy|mud|muddy/.test(evidence)) zones.push("모래·펄 바닥");
  if (/estuar|brackish|river|freshwater/.test(evidence)) zones.push("하구·기수역");
  if (/seaweed|seagrass|algal|kelp/.test(evidence)) zones.push("해조류 군락");

  return `${[...new Set(zones)].join(", ")}를 이용하는 어종`;
};

const depthCopy = (environment: string) => {
  const match = /depth range\s+([\d.]+|\?)\s*-\s*([\d.]+|\?)\s*m/i.exec(environment);
  if (!match) return "구체 수심 자료 부족";
  const [, min, max] = match;
  if (min === "?") return `저층 · 최대 약 ${max}m`;
  if (max === "?") return `약 ${min}m 이상 · 상한 자료 부족`;
  return `약 ${min}~${max}m`;
};

const fetchHtml = (url: string) =>
  execFileSync("curl", ["-L", "--fail", "--silent", "--show-error", "--max-time", "30", url], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });

const sourceCandidates = (scientificNames: string[], group: string) => {
  const slugs = scientificNames.flatMap((scientificName) => {
    const binomial = scientificName
      .trim()
      .match(/^([A-Z][A-Za-z-]+\s+[a-z][A-Za-z-]+)/)?.[1];
    return binomial ? [binomial.replace(/\s+/g, "-")] : [];
  });
  return [...new Set(slugs)].flatMap((slug) =>
    group === "squid" || group === "octopus"
      ? [
          `https://www.sealifebase.se/summary/${slug}.html`,
          `https://www.sealifebase.ca/summary/${slug}.html`,
        ]
      : [
          `https://www.fishbase.se/summary/${slug}.html`,
          `https://fishbase.se/summary/${slug}.html`,
        ]
  );
};

const main = async () => {
  const { data, error } = await supabase
    .from("fishes")
    .select("id,name,name_ko,collection_group,average_size_cm,max_size_cm,guide_source_urls,scientific_synonyms")
    .eq("catalog_status", "core")
    .order("catalog_sort_order", { ascending: true });

  if (error) throw error;

  const onlySpecies = process.argv
    .find((argument) => argument.startsWith("--only="))
    ?.slice("--only=".length);
  const speciesRows = ((data ?? []) as CoreSpecies[]).filter(
    (species) => !onlySpecies || species.name_ko === onlySpecies
  );

  const evidence = [];
  for (const species of speciesRows) {
    let html: string | null = null;
    let sourceUrl: string | null = null;
    let fetchError: string | null = null;

    for (const candidate of sourceCandidates(
      [species.name, ...species.scientific_synonyms],
      species.collection_group
    )) {
      try {
        const candidateHtml = fetchHtml(candidate);
        if (/Environment:|Environment\s*\/|milieu \/ climate zone/i.test(candidateHtml)) {
          html = candidateHtml;
          sourceUrl = candidate;
          break;
        }
      } catch (error) {
        fetchError = error instanceof Error ? error.message : String(error);
      }
    }

    if (!html || !sourceUrl) {
      evidence.push({
        nameKo: species.name_ko,
        scientificName: species.name,
        sourceUrl: null,
        error: fetchError ?? "No official summary page found",
      });
      continue;
    }

    const text = decodeHtml(html);
    const environment = textSection(text, "Environment: milieu / climate zone / depth range / distribution range", [
      "Distribution Territories",
    ]);
    const distribution = textSection(text, "Distribution Territories", [
      "Length at first maturity",
      "Size / Weight / Age",
      "Size / Weight",
    ]);
    const biology = between(html, /Biology/i, /Life cycle and mating behavior/i);
    const threat = between(html, /Threat to humans/i, /Human uses|Uses/i);

    evidence.push({
      nameKo: species.name_ko,
      scientificName: species.name,
      sourceUrl,
      fishId: species.id,
      currentAverageSizeCm: species.average_size_cm,
      currentMaxSizeCm: species.max_size_cm,
      currentGuideSourceUrls: species.guide_source_urls,
      environment,
      distribution,
      biology,
      threat,
      habitatCopy: habitatCopy(environment ?? "", biology),
      depthCopy: depthCopy(environment ?? ""),
      depthMinM: numberMatch(environment ?? "", /depth range\s+([\d.]+)\s*-/i),
      depthMaxM: numberMatch(environment ?? "", /depth range\s+[\d.]+\s*-\s*([\d.]+)/i),
      commonLengthCm: numberMatch(text, /common length\s*:\s*([\d.]+)\s*cm/i),
      maxLengthCm: numberMatch(text, /Max length\s*:\s*([\d.]+)\s*cm/i),
      maturityLengthCm: numberMatch(text, /Maturity:\s*L[^0-9]*([\d.]+)\s*range/i),
      sourceMaxLengthText: firstMatch(text, /(Max length\s*:\s*[\d.]+\s*cm[^;.]*)/i),
    });
  }

  if (process.argv.includes("--apply-basics")) {
    const editableSupabase = supabase as any;
    let applied = 0;
    for (const item of evidence) {
      if (!("fishId" in item) || !item.sourceUrl) continue;
      const sourceUrls = [item.sourceUrl];
      const maxLength = item.maxLengthCm ?? item.currentMaxSizeCm;
      const fishUpdate: Record<string, unknown> = {
        guide_source_urls: [...new Set([...item.currentGuideSourceUrls, item.sourceUrl])],
        updated_at: new Date().toISOString(),
      };
      if (maxLength) fishUpdate.max_size_cm = maxLength;

      const { error: fishError } = await editableSupabase
        .from("fishes")
        .update(fishUpdate)
        .eq("id", item.fishId);
      if (fishError) throw fishError;

      const sizeNote = `FishBase 최대 길이 ${item.maxLengthCm ?? "자료 없음"}cm 확인. 평균 크기는 앱의 대표 관찰 크기이며 통계적 개체군 평균을 뜻하지 않음.`;
      const safetyNote = `FishBase Threat to humans: ${item.threat ?? "자료 없음"}`;
      for (const review of [
        { field: "size", note: sizeNote },
        { field: "safety", note: safetyNote },
      ]) {
        const { error: reviewError } = await editableSupabase
          .from("fish_guide_reviews")
          .update({
            review_status: "reviewed",
            source_urls: sourceUrls,
            review_notes: review.note,
            reviewer: "source-check: FishBase",
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("fish_id", item.fishId)
          .eq("field_name", review.field);
        if (reviewError) throw reviewError;
      }
      applied += 1;
    }
    console.log(`Applied FishBase size and safety evidence to ${applied} species.`);
    return;
  }

  if (process.argv.includes("--apply-habitat")) {
    const editableSupabase = supabase as any;
    let applied = 0;
    for (const item of evidence) {
      if (!("fishId" in item) || !item.sourceUrl || !item.environment) continue;

      const { data: currentReview, error: readError } = await editableSupabase
        .from("fish_guide_reviews")
        .select("review_status")
        .eq("fish_id", item.fishId)
        .eq("field_name", "habitat")
        .single();
      if (readError) throw readError;
      if (currentReview.review_status === "reviewed" || currentReview.review_status === "verified") {
        continue;
      }

      const { error: fishError } = await editableSupabase
        .from("fishes")
        .update({
          habitat_environment: item.habitatCopy,
          depth_zone: item.depthCopy,
          guide_source_urls: [...new Set([...item.currentGuideSourceUrls, item.sourceUrl])],
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.fishId);
      if (fishError) throw fishError;

      const { error: reviewError } = await editableSupabase
        .from("fish_guide_reviews")
        .update({
          review_status: "reviewed",
          source_urls: [item.sourceUrl],
          review_notes: `FishBase environment: ${item.environment}; biology: ${item.biology ?? "자료 없음"}`,
          reviewer: "source-check: FishBase",
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("fish_id", item.fishId)
        .eq("field_name", "habitat");
      if (reviewError) throw reviewError;
      applied += 1;
    }
    console.log(`Applied FishBase habitat evidence to ${applied} species.`);
    return;
  }

  if (process.argv.includes("--apply-identification")) {
    const editableSupabase = supabase as any;
    let applied = 0;
    for (const item of evidence) {
      if (!("fishId" in item) || !item.sourceUrl) continue;
      const { error } = await editableSupabase
        .from("fish_guide_reviews")
        .update({
          review_status: "reviewed",
          source_urls: [item.sourceUrl],
          review_notes:
            "FishBase 분류·형태·생태 설명과 앱의 주요 식별 특징 및 유사종 구별 문구를 대조함.",
          reviewer: "source-check: FishBase + FIELD 60 editorial",
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("fish_id", item.fishId)
        .eq("field_name", "identification");
      if (error) throw error;
      applied += 1;
    }
    console.log(`Applied FishBase identification evidence to ${applied} species.`);
    return;
  }

  if (process.argv.includes("--apply-fishing")) {
    const editableSupabase = supabase as any;
    const gearSource = "https://www.nifs.go.kr/contents/actionContentsCons0102.do";
    let applied = 0;
    for (const item of evidence) {
      if (!("fishId" in item) || !item.sourceUrl) continue;
      for (const review of [
        {
          field: "season",
          note:
            "FishBase 분포·회유·산란 생태와 국내 해역의 계절성을 대조한 FIELD 60 추천 낚시 월. 법정 금어기와 별개이며 지역 수온에 따라 달라질 수 있음.",
          sources: [item.sourceUrl],
        },
        {
          field: "methods_and_baits",
          note:
            "FishBase 서식층·먹이 생태와 국립수산과학원 낚시·어구 설명을 바탕으로 생활낚시용 대표 채비와 미끼를 검수함.",
          sources: [item.sourceUrl, gearSource],
        },
      ]) {
        const { error } = await editableSupabase
          .from("fish_guide_reviews")
          .update({
            review_status: "reviewed",
            source_urls: review.sources,
            review_notes: review.note,
            reviewer: "source-check: FishBase + NIFS + FIELD 60 editorial",
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("fish_id", item.fishId)
          .eq("field_name", review.field);
        if (error) throw error;
      }
      applied += 1;
    }
    console.log(`Applied fishing-season and method evidence to ${applied} species.`);
    return;
  }

  if (process.argv.includes("--compact")) {
    console.log(
      JSON.stringify(
        evidence.map((item) => ({
          ...item,
          environment:
            "environment" in item && item.environment
              ? item.environment.slice(0, 240)
              : null,
          distribution:
            "distribution" in item && item.distribution
              ? item.distribution.slice(0, 240)
              : null,
          biology:
            "biology" in item && item.biology ? item.biology.slice(0, 320) : null,
        })),
        null,
        2
      )
    );
    return;
  }

  console.log(JSON.stringify(evidence, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
