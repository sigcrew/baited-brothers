-- FIELD 60 v1 catalog audit (remote migration version: 20260716033719).
-- Preserve every existing species row, classify the imported pool, and add
-- nine missing popular finfish plus eight popular cephalopods.

ALTER TABLE public.fishes
  ADD COLUMN IF NOT EXISTS catalog_status text NOT NULL DEFAULT 'reference',
  ADD COLUMN IF NOT EXISTS catalog_version text,
  ADD COLUMN IF NOT EXISTS collection_group text NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS catalog_sort_order integer,
  ADD COLUMN IF NOT EXISTS inclusion_reason text,
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS source_species_id text;

ALTER TABLE public.fishes
  DROP CONSTRAINT IF EXISTS fishes_catalog_status_check;

ALTER TABLE public.fishes
  ADD CONSTRAINT fishes_catalog_status_check
  CHECK (catalog_status IN ('core', 'extended', 'reference', 'needs_review'));

CREATE INDEX IF NOT EXISTS idx_fishes_catalog_status_group_sort
  ON public.fishes (catalog_status, collection_group, catalog_sort_order, name_ko);

UPDATE public.fishes
SET catalog_status = 'reference',
    catalog_version = NULL,
    catalog_sort_order = NULL,
    inclusion_reason = '공공데이터 원본 풀: 핵심·확장 도감 미선정',
    collection_group = CASE category::text
      WHEN 'flatfish' THEN 'flatfish'
      WHEN 'rockfish' THEN 'rockfish'
      WHEN 'bream' THEN 'bream'
      WHEN 'seabass' THEN 'seabass_croaker'
      WHEN 'mackerel' THEN 'pelagic'
      WHEN 'mullet' THEN 'pelagic'
      WHEN 'cutlassfish' THEN 'pelagic'
      WHEN 'eel' THEN 'eel'
      WHEN 'pufferfish' THEN 'pufferfish'
      ELSE 'other'
    END,
    source_name = COALESCE(source_name, '해양생물종정보 API taxonlist2');

UPDATE public.fishes
SET catalog_status = 'needs_review',
    inclusion_reason = '한국명 누락: 표준명과 국내 출현 여부 검토 필요'
WHERE name_ko IS NULL OR btrim(name_ko) = '';

-- Keep one canonical row for duplicated Korean names and quarantine the rest.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY name_ko
           ORDER BY (name ~ '^[A-Z][a-z]+ [a-z-]+') DESC, created_at DESC NULLS LAST, id
         ) AS duplicate_rank
  FROM public.fishes
  WHERE name_ko IS NOT NULL AND btrim(name_ko) <> ''
)
UPDATE public.fishes AS fish
SET catalog_status = 'needs_review',
    inclusion_reason = '동일 한국명 중복 행: 표준 학명 병합 검토 필요'
FROM ranked
WHERE fish.id = ranked.id AND ranked.duplicate_rank > 1;

-- Recognisable recreational targets that remain outside the fixed FIELD 60.
UPDATE public.fishes
SET catalog_status = 'extended',
    inclusion_reason = '국내 낚시 대상 가능성이 있는 확장 도감 후보'
WHERE name_ko = ANY (ARRAY[
  '가시가자미','기름가자미','물가자미','박대','용가자미','줄가자미','참서대',
  '도화볼락','띠볼락','별우럭','황볼락','황점볼락','청회볼락','홍감펭',
  '강담돔','청돔','청황돔','벤자리','붉돔','어름돔','홍바리','대왕바리','무늬바리',
  '가다랑어','갈전갱이','잿방어','참다랑어','황다랑어','줄삼치','청전갱이',
  '가시쥐치','별쥐치','까치복','자주복','참복','졸복','황복',
  '먹붕장어','흰붕장어','창꼬치','애꼬치','점성어','수조기','흑조기'
]::text[])
AND catalog_status <> 'needs_review';

-- Add missing core finfish. Scientific names are stable identifiers for upsert.
INSERT INTO public.fishes (
  name, name_ko, description, category, catalog_status, catalog_version,
  collection_group, catalog_sort_order, inclusion_reason, aliases, source_name
)
SELECT seed.name, seed.name_ko, seed.description, seed.category::fish_category,
       'core', 'field60_v1', seed.collection_group, seed.sort_order,
       'FIELD 60 v1 국내 바다 생활낚시 핵심 대상종', seed.aliases,
       '국립수산과학원·국가생물종목록 표준명 검토'
FROM (VALUES
  ('Girella punctata', '벵에돔', '연안 암초와 갯바위에서 만나는 대표적인 바다낚시 대상어.', 'bream', 'bream', 19, '{}'::text[]),
  ('Girella leonina', '긴꼬리벵에돔', '제주와 남해의 갯바위 낚시에서 만나는 벵에돔류 대상어.', 'bream', 'bream', 20, '{}'::text[]),
  ('Konosirus punctatus', '전어', '연안에 무리 지어 회유하며 생활낚시와 식용으로 익숙한 어종.', 'other', 'pelagic', 41, '{}'::text[]),
  ('Cololabis saira', '꽁치', '표층을 무리 지어 회유하는 대표적인 바닷물고기.', 'other', 'pelagic', 42, '{}'::text[]),
  ('Hyporhamphus sajori', '학공치', '방파제와 연안 찌낚시에서 인기 있는 표층성 어종.', 'other', 'coastal', 48, '{}'::text[]),
  ('Sillago japonica', '보리멸', '모래 바닥 연안에서 원투낚시로 만나는 대표 대상어.', 'other', 'coastal', 49, '{}'::text[]),
  ('Platycephalus indicus', '양태', '모래와 펄 바닥에 서식하며 루어와 배낚시로 잡히는 대상어.', 'other', 'coastal', 50, '{}'::text[]),
  ('Siganus fuscescens', '독가시치', '남해와 제주 연안에서 만나는 가시 독 주의 대상어.', 'other', 'coastal', 51, '{}'::text[]),
  ('Chromis notata', '자리돔', '제주와 남해 암초 연안에서 흔히 만나는 소형 어종.', 'other', 'coastal', 52, '{}'::text[]),
  ('Todarodes pacificus', '살오징어', '동해를 중심으로 회유하며 채낚기와 에깅의 주요 대상종.', 'other', 'squid', 53, ARRAY['오징어']::text[]),
  ('Sepia esculenta', '참갑오징어', '서해와 남해 연안에서 인기 있는 갑오징어 낚시 대상종.', 'other', 'squid', 54, ARRAY['갑오징어']::text[]),
  ('Sepioteuthis lessoniana', '흰꼴뚜기', '연안 에깅의 대표 대상종으로 무늬오징어라는 이름으로 널리 불린다.', 'other', 'squid', 55, ARRAY['무늬오징어','흰오징어']::text[]),
  ('Uroteuthis edulis', '창꼴뚜기', '한치라는 이름으로 널리 알려진 연안·선상 낚시 대상종.', 'other', 'squid', 56, ARRAY['한치','창오징어']::text[]),
  ('Amphioctopus fangsiao', '주꾸미', '서해 연안 선상낚시의 대표적인 봄·가을 대상종.', 'other', 'octopus', 57, ARRAY['쭈꾸미']::text[]),
  ('Octopus minor', '낙지', '서해와 남해의 갯벌·연안에 서식하는 문어류 수산생물.', 'other', 'octopus', 58, '{}'::text[]),
  ('Octopus vulgaris', '참문어', '남해와 제주에서 돌문어라고도 불리는 인기 낚시 대상종.', 'other', 'octopus', 59, ARRAY['돌문어']::text[]),
  ('Enteroctopus dofleini', '대문어', '동해의 차가운 바다에 서식하는 대형 문어류 대상종.', 'other', 'octopus', 60, ARRAY['피문어']::text[])
) AS seed(name, name_ko, description, category, collection_group, sort_order, aliases)
WHERE NOT EXISTS (
  SELECT 1 FROM public.fishes existing
  WHERE existing.name ILIKE seed.name || '%'
);

-- Promote the canonical existing 43 species. Prefix matching tolerates authorship text.
WITH core(name_prefix, collection_group, sort_order, aliases) AS (VALUES
  ('Paralichthys olivaceus', 'flatfish', 1, ARRAY['광어']::text[]),
  ('Pleuronichthys cornutus', 'flatfish', 2, '{}'::text[]),
  ('Pseudopleuronectes yokohamae', 'flatfish', 3, '{}'::text[]),
  ('Pseudopleuronectes herzensteini', 'flatfish', 4, '{}'::text[]),
  ('Platichthys bicoloratus', 'flatfish', 5, '{}'::text[]),
  ('Platichthys stellatus', 'flatfish', 6, '{}'::text[]),
  ('Sebastes schlegelii', 'rockfish', 7, ARRAY['우럭']::text[]),
  ('Sebastes inermis', 'rockfish', 8, '{}'::text[]),
  ('Sebastes pachycephalus', 'rockfish', 9, '{}'::text[]),
  ('Sebastes thompsoni', 'rockfish', 10, ARRAY['열기']::text[]),
  ('Sebastiscus marmoratus', 'rockfish', 11, '{}'::text[]),
  ('Hexagrammos agrammus', 'rockfish', 12, '{}'::text[]),
  ('Hexagrammos otakii', 'rockfish', 13, '{}'::text[]),
  ('Chelidonichthys spinosus', 'rockfish', 14, '{}'::text[]),
  ('Pleurogrammus azonus', 'rockfish', 15, ARRAY['임연수']::text[]),
  ('Pagrus major', 'bream', 16, '{}'::text[]),
  ('Acanthopagrus schlegelii', 'bream', 17, '{}'::text[]),
  ('Oplegnathus fasciatus', 'bream', 18, '{}'::text[]),
  ('Dentex hypselosomus', 'bream', 21, '{}'::text[]),
  ('Lateolabrax japonicus', 'seabass_croaker', 22, '{}'::text[]),
  ('Lateolabrax maculatus', 'seabass_croaker', 23, '{}'::text[]),
  ('Miichthys miiuy', 'seabass_croaker', 24, '{}'::text[]),
  ('Pennahia argentata', 'seabass_croaker', 25, ARRAY['백조기']::text[]),
  ('Larimichthys crocea', 'seabass_croaker', 26, '{}'::text[]),
  ('Larimichthys polyactis', 'seabass_croaker', 27, '{}'::text[]),
  ('Epinephelus bruneus', 'seabass_croaker', 28, ARRAY['다금바리']::text[]),
  ('Epinephelus akaara', 'seabass_croaker', 29, '{}'::text[]),
  ('Hyporthodus septemfasciatus', 'seabass_croaker', 30, '{}'::text[]),
  ('Scomber japonicus', 'pelagic', 31, '{}'::text[]),
  ('Scomber australasicus', 'pelagic', 32, '{}'::text[]),
  ('Trachurus japonicus', 'pelagic', 33, '{}'::text[]),
  ('Seriola quinqueradiata', 'pelagic', 34, '{}'::text[]),
  ('Seriola aureovittata', 'pelagic', 35, '{}'::text[]),
  ('Scomberomorus niphonius', 'pelagic', 36, '{}'::text[]),
  ('Trichiurus japonicus', 'pelagic', 37, '{}'::text[]),
  ('Clupea pallasii', 'pelagic', 38, '{}'::text[]),
  ('Mugil cephalus', 'pelagic', 39, '{}'::text[]),
  ('Planiliza haematocheilus', 'pelagic', 40, '{}'::text[]),
  ('Stephanolepis cirrhifer', 'filefish', 43, '{}'::text[]),
  ('Thamnaconus modestus', 'filefish', 44, '{}'::text[]),
  ('Takifugu niphobles', 'pufferfish', 45, '{}'::text[]),
  ('Conger myriaster', 'eel', 46, ARRAY['아나고']::text[]),
  ('Sphyraena pinguis', 'coastal', 47, '{}'::text[])
)
UPDATE public.fishes AS fish
SET catalog_status = 'core',
    catalog_version = 'field60_v1',
    collection_group = core.collection_group,
    catalog_sort_order = core.sort_order,
    inclusion_reason = 'FIELD 60 v1 국내 바다 생활낚시 핵심 대상종',
    aliases = core.aliases
FROM core
WHERE fish.name ILIKE core.name_prefix || '%';

-- Explicitly quarantine common-name seed duplicates and aliases represented by a core row.
UPDATE public.fishes
SET catalog_status = 'needs_review',
    catalog_version = NULL,
    catalog_sort_order = NULL,
    inclusion_reason = '핵심 표준종의 통칭·영문 시드 중복 행: 기존 조과 병합 후 정리'
WHERE name IN ('Olive flounder','Mackerel','Sea bass','Stone flounder','Filefish','Red seabream','Yellowtail','Horse mackerel')
   OR name_ko IN ('광어','우럭');

COMMENT ON COLUMN public.fishes.catalog_status IS
  'core: FIELD 60, extended: additional angling target, reference: searchable reference, needs_review: incomplete or duplicate';
COMMENT ON COLUMN public.fishes.collection_group IS
  'Stable user-facing catalog filter independent from legacy fish_category taxonomy';
