/**
 * Applies the dedicated NIFS/NIBR review for the eight FIELD 60 cephalopods.
 *
 * Usage: npm run review:core-cephalopods -- --apply
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
}) as any;

const NIFS_SPECIES = "https://www.nifs.go.kr/contents/actionContentsCons0088.do";
const NIFS_TECHBOOK = "https://www.nifs.go.kr/cmmn/file/techbook/2024/vo04.html";
const NIBR_LIST =
  "https://www.nibr.go.kr/aiibook/access/ecatalogt.jsp?Dir=21&callmode=admin&catimage=&eclang=ko&start=382&um=s";

const guides = [
  {
    name: "살오징어",
    sources: [NIFS_SPECIES],
    regions: ["남해", "동해", "제주"],
    habitat: "먹이와 수온대를 따라 이동하며 표층부터 약 100m 수심을 주로 이용하는 회유성 오징어",
    depth: "표층~약 100m",
    seasons: [6, 7, 8, 9, 10, 11, 12],
    note: "NIFS 종 정보의 분포·습성·형태·외투장과 2026 금어기 대조",
  },
  {
    name: "참갑오징어",
    sources: [NIFS_SPECIES],
    regions: ["서해", "남해", "제주"],
    habitat: "연안 모래 바닥과 해초·해조류 주변의 저층에서 생활하는 갑오징어",
    depth: "연안 저층 · 산란기에는 약 10m 이내",
    seasons: [3, 4, 5, 6, 9, 10, 11],
    note: "NIFS 갑오징어 생태·양식 자료의 연안 산란장과 형태 정보 대조",
  },
  {
    name: "흰꼴뚜기",
    sources: [NIBR_LIST, NIFS_SPECIES],
    regions: ["남해", "제주"],
    habitat: "따뜻한 연안의 암초와 해조류 군락 주변을 이용하는 오징어",
    depth: "연안 표층~중층 · 구체 수심 자료 부족",
    seasons: [5, 6, 7, 8, 9, 10, 11],
    note: "NIBR 국가생물종목록의 표준명·학명과 NIFS 두족류 식별 자료 대조",
  },
  {
    name: "창꼴뚜기",
    sources: [
      "https://www.nifs.go.kr/m_jelly/board/actionBoard0008View.do?BBS_CL_CD=F&BBS_ID=20260105164613172AIE&MENU_ID=M0000054",
    ],
    regions: ["남해", "동해", "제주"],
    habitat: "따뜻한 연안과 외해의 표층·중층을 이동하는 회유성 꼴뚜기",
    depth: "표층~중층 · 구체 수심 자료 부족",
    seasons: [5, 6, 7, 8, 9, 10],
    note: "NIFS의 창꼴뚜기 표준명·동종이명·인도태평양 분포 답변 대조",
  },
  {
    name: "주꾸미",
    sources: [
      NIFS_TECHBOOK,
      "https://www.nifs.go.kr/eng/board/actionBoard0044View.do?BBS_ID=20241105162236380WKM&MENU_ID=M0000329&selectPage=1",
    ],
    regions: ["서해", "남해"],
    habitat: "연안의 모래·펄 저층과 조개껍데기·은신처 주변에서 생활하는 소형 문어",
    depth: "연안 저층 · 구체 수심 자료 부족",
    seasons: [3, 4, 9, 10, 11],
    note: "NIFS 산란기·서해 출현·어구 자료와 5월 11일~8월 31일 금어기 대조",
  },
  {
    name: "낙지",
    sources: [
      NIFS_TECHBOOK,
      "https://www.nifs.go.kr/board/actionBoard0008View.do?BBS_CL_CD=G&BBS_ID=20201228031145685IXK&MENU_ID=M0000054",
    ],
    regions: ["서해", "남해"],
    habitat: "갯벌과 펄이 발달한 하구·연안 저층의 굴에서 생활하는 문어",
    depth: "조간대~얕은 연안 저층",
    seasons: [3, 4, 5, 7, 8, 9, 10, 11],
    note: "NIFS의 낙지 분포·유사종 식별 및 6월 전국 금어기·시도별 고시 대조",
  },
  {
    name: "참문어",
    sources: [
      NIFS_TECHBOOK,
      "https://www.nifs.go.kr/board/actionBoard0008View.do?BBS_CL_CD=F&BBS_ID=20260330150422182EWT&MENU_ID=M0000054",
    ],
    regions: ["남해", "동해", "제주"],
    habitat: "암초와 돌 틈이 발달한 연안 저층에서 생활하는 문어",
    depth: "연안 저층 · 구체 수심 자료 부족",
    seasons: [3, 4, 7, 8, 9, 10, 11],
    note: "NIFS의 참문어·돌문어 표준명 및 5월 16일~6월 30일 전국 금어기·시도별 고시 대조",
  },
  {
    name: "대문어",
    sources: [NIFS_TECHBOOK, NIBR_LIST],
    regions: ["동해"],
    habitat: "차가운 동해의 암초와 바위가 발달한 저층에서 생활하는 대형 문어",
    depth: "연안~깊은 저층 · 구체 수심 자료 부족",
    seasons: [1, 2, 3, 4, 5, 10, 11, 12],
    note: "NIFS 유사종·산란기 자료와 NIBR 표준명, 600g 금지체중 대조",
  },
] as const;

const main = async () => {
  const apply = process.argv.includes("--apply");
  console.table(guides.map((guide) => ({ species: guide.name, seasons: guide.seasons.join(",") })));
  if (!apply) return;

  const now = new Date().toISOString();
  for (const guide of guides) {
    const { data: fish, error: fishReadError } = await supabase
      .from("fishes")
      .select("id,guide_source_urls")
      .eq("catalog_status", "core")
      .eq("name_ko", guide.name)
      .single();
    if (fishReadError) throw fishReadError;

    const { error: fishUpdateError } = await supabase
      .from("fishes")
      .update({
        habitat_regions: [...guide.regions],
        habitat_environment: guide.habitat,
        depth_zone: guide.depth,
        peak_seasons: [...guide.seasons],
        guide_source_urls: [...new Set([...fish.guide_source_urls, ...guide.sources])],
        updated_at: now,
      })
      .eq("id", fish.id);
    if (fishUpdateError) throw fishUpdateError;

    for (const field of [
      "identification",
      "habitat",
      "season",
      "methods_and_baits",
      "size",
      "safety",
    ]) {
      const { error } = await supabase
        .from("fish_guide_reviews")
        .update({
          review_status: "reviewed",
          source_urls: [...guide.sources],
          review_notes: guide.note,
          reviewer: "source-check: NIFS + NIBR + FIELD 60 editorial",
          reviewed_at: now,
          updated_at: now,
        })
        .eq("fish_id", fish.id)
        .eq("field_name", field);
      if (error) throw error;
    }
  }
  console.log(`Reviewed ${guides.length} FIELD 60 cephalopods.`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
