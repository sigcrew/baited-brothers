-- FIELD 60 field-guide foundation.
-- Editorial guide data remains explicitly marked as draft until a domain review.
-- Statutory rules are versioned separately so annual changes never overwrite history.

ALTER TABLE public.fishes
  ADD COLUMN IF NOT EXISTS identification_features text,
  ADD COLUMN IF NOT EXISTS similar_species_notes text,
  ADD COLUMN IF NOT EXISTS habitat_regions text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS habitat_environment text,
  ADD COLUMN IF NOT EXISTS depth_zone text,
  ADD COLUMN IF NOT EXISTS peak_seasons smallint[] NOT NULL DEFAULT '{}'::smallint[],
  ADD COLUMN IF NOT EXISTS fishing_methods text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS recommended_baits text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS average_size_cm numeric(6,1),
  ADD COLUMN IF NOT EXISTS max_size_cm numeric(6,1),
  ADD COLUMN IF NOT EXISTS handling_cautions text,
  ADD COLUMN IF NOT EXISTS toxicity text,
  ADD COLUMN IF NOT EXISTS rarity smallint,
  ADD COLUMN IF NOT EXISTS discovery_difficulty smallint,
  ADD COLUMN IF NOT EXISTS image_source_url text,
  ADD COLUMN IF NOT EXISTS image_license text,
  ADD COLUMN IF NOT EXISTS image_attribution text,
  ADD COLUMN IF NOT EXISTS guide_source_urls text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS guide_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS guide_reviewed_at timestamptz;

ALTER TABLE public.fishes
  DROP CONSTRAINT IF EXISTS fishes_rarity_check,
  DROP CONSTRAINT IF EXISTS fishes_discovery_difficulty_check,
  DROP CONSTRAINT IF EXISTS fishes_guide_status_check;

ALTER TABLE public.fishes
  ADD CONSTRAINT fishes_rarity_check CHECK (rarity IS NULL OR rarity BETWEEN 1 AND 5),
  ADD CONSTRAINT fishes_discovery_difficulty_check CHECK (discovery_difficulty IS NULL OR discovery_difficulty BETWEEN 1 AND 5),
  ADD CONSTRAINT fishes_guide_status_check CHECK (guide_status IN ('draft', 'reviewed', 'verified'));

CREATE TABLE IF NOT EXISTS public.fish_regulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fish_id uuid NOT NULL REFERENCES public.fishes(id) ON DELETE CASCADE,
  jurisdiction text NOT NULL DEFAULT '대한민국',
  regulation_type text NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  prohibited_from text,
  prohibited_to text,
  min_size_cm numeric(6,1),
  min_weight_g integer,
  measurement_method text,
  rule_text text NOT NULL,
  source_name text NOT NULL,
  source_url text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fish_regulations_type_check
    CHECK (regulation_type IN ('closed_season', 'minimum_size', 'minimum_weight', 'advisory')),
  CONSTRAINT fish_regulations_positive_values_check
    CHECK ((min_size_cm IS NULL OR min_size_cm > 0) AND (min_weight_g IS NULL OR min_weight_g > 0)),
  CONSTRAINT fish_regulations_effective_dates_check
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE INDEX IF NOT EXISTS idx_fish_regulations_fish_effective
  ON public.fish_regulations (fish_id, effective_from DESC, effective_to DESC NULLS FIRST);

ALTER TABLE public.fish_regulations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fish_regulations_public_read" ON public.fish_regulations;
CREATE POLICY "fish_regulations_public_read"
  ON public.fish_regulations FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON TABLE public.fish_regulations TO anon, authenticated;

COMMENT ON TABLE public.fish_regulations IS
  'Versioned statutory and local fishing rules. Never overwrite an older effective period.';
COMMENT ON COLUMN public.fishes.peak_seasons IS
  'Editorial best fishing months (1-12), not spawning or statutory closure months.';
COMMENT ON COLUMN public.fishes.guide_status IS
  'draft: editorial draft, reviewed: domain-reviewed, verified: sources and copy fully checked';

-- Give every FIELD 60 row a useful first-pass field guide. These are intentionally
-- marked draft; regulations below are the independently verified legal layer.
UPDATE public.fishes
SET
  identification_features = COALESCE(
    identification_features,
    NULLIF(substring(regexp_replace(description, E'[\\r\\n]+', ' ', 'g') from '^[^.。!?]+[.。!?]?'), '')
  ),
  habitat_regions = CASE collection_group
    WHEN 'flatfish' THEN ARRAY['서해','남해','동해']
    WHEN 'rockfish' THEN ARRAY['서해','남해','동해']
    WHEN 'bream' THEN ARRAY['서해','남해','제주']
    WHEN 'seabass_croaker' THEN ARRAY['서해','남해','제주']
    WHEN 'pelagic' THEN ARRAY['전 해역']
    WHEN 'filefish' THEN ARRAY['남해','제주','동해']
    WHEN 'pufferfish' THEN ARRAY['서해','남해','동해']
    WHEN 'eel' THEN ARRAY['서해','남해','동해']
    WHEN 'coastal' THEN ARRAY['서해','남해','제주']
    WHEN 'squid' THEN ARRAY['서해','남해','동해','제주']
    WHEN 'octopus' THEN ARRAY['서해','남해','동해','제주']
    ELSE ARRAY['국내 연안']
  END,
  habitat_environment = CASE collection_group
    WHEN 'flatfish' THEN '모래·펄이 섞인 연안 저층과 조류가 흐르는 경계면'
    WHEN 'rockfish' THEN '암초, 방파제 테트라포드, 해조류와 인공어초 주변'
    WHEN 'bream' THEN '갯바위와 방파제의 암초·사질 경계, 조류 소통이 좋은 연안'
    WHEN 'seabass_croaker' THEN '하구와 연안 수로, 모래·펄 또는 암초가 이어지는 곳'
    WHEN 'pelagic' THEN '먹이 떼를 따라 이동하는 연안 표층·중층과 조류 경계'
    WHEN 'filefish' THEN '해조류와 암초가 발달한 연안 및 인공어초 주변'
    WHEN 'pufferfish' THEN '얕은 연안의 모래·펄 바닥과 기수역'
    WHEN 'eel' THEN '모래·펄 바닥의 굴과 암초 틈, 야간 먹이 활동 구간'
    WHEN 'coastal' THEN '방파제·갯바위와 가까운 모래, 펄, 암초 경계'
    WHEN 'squid' THEN '베이트피시가 모이는 연안 암초·해조대와 야간 집어 수역'
    WHEN 'octopus' THEN '암초 틈, 펄·모래 바닥, 조개류가 많은 연안 저층'
    ELSE '국내 연안의 종별 적합 서식처'
  END,
  depth_zone = CASE collection_group
    WHEN 'pelagic' THEN '표층·중층'
    WHEN 'squid' THEN '표층~저층'
    ELSE '주로 저층'
  END,
  peak_seasons = CASE collection_group
    WHEN 'flatfish' THEN ARRAY[3,4,5,9,10,11]::smallint[]
    WHEN 'rockfish' THEN ARRAY[3,4,5,10,11,12]::smallint[]
    WHEN 'bream' THEN ARRAY[4,5,6,9,10,11]::smallint[]
    WHEN 'seabass_croaker' THEN ARRAY[5,6,7,8,9,10]::smallint[]
    WHEN 'pelagic' THEN ARRAY[6,7,8,9,10,11]::smallint[]
    WHEN 'filefish' THEN ARRAY[6,7,8,9,10]::smallint[]
    WHEN 'pufferfish' THEN ARRAY[5,6,7,8,9]::smallint[]
    WHEN 'eel' THEN ARRAY[5,6,7,8,9,10]::smallint[]
    WHEN 'coastal' THEN ARRAY[4,5,6,7,8,9,10]::smallint[]
    WHEN 'squid' THEN ARRAY[4,5,6,9,10,11,12]::smallint[]
    WHEN 'octopus' THEN ARRAY[3,4,5,9,10,11]::smallint[]
    ELSE ARRAY[5,6,9,10]::smallint[]
  END,
  fishing_methods = CASE collection_group
    WHEN 'flatfish' THEN ARRAY['다운샷','원투낚시','선상 흘림']
    WHEN 'rockfish' THEN ARRAY['지그헤드 루어','찌낚시','구멍치기']
    WHEN 'bream' THEN ARRAY['찌낚시','타이라바','카고낚시']
    WHEN 'seabass_croaker' THEN ARRAY['미노우·바이브 루어','외수질','원투낚시']
    WHEN 'pelagic' THEN ARRAY['메탈지그','카드채비','트롤링']
    WHEN 'filefish' THEN ARRAY['선상 가지채비','생활낚시 채비']
    WHEN 'pufferfish' THEN ARRAY['원투낚시','선상 가지채비']
    WHEN 'eel' THEN ARRAY['원투낚시','선상 외줄']
    WHEN 'coastal' THEN ARRAY['원투낚시','찌낚시','라이트 루어']
    WHEN 'squid' THEN ARRAY['에깅','이카메탈','채낚기']
    WHEN 'octopus' THEN ARRAY['에기·애자','다운샷','선상 끌낚시']
    ELSE ARRAY['생활낚시 채비']
  END,
  recommended_baits = CASE collection_group
    WHEN 'flatfish' THEN ARRAY['웜','갯지렁이','생미끼']
    WHEN 'rockfish' THEN ARRAY['웜','새우','크릴']
    WHEN 'bream' THEN ARRAY['크릴','옥수수','새우']
    WHEN 'seabass_croaker' THEN ARRAY['미노우','새우','갯지렁이']
    WHEN 'pelagic' THEN ARRAY['메탈지그','사비키','생미끼']
    WHEN 'filefish' THEN ARRAY['조개살','오징어살','크릴']
    WHEN 'pufferfish' THEN ARRAY['오징어살','갯지렁이']
    WHEN 'eel' THEN ARRAY['오징어살','고등어살','갯지렁이']
    WHEN 'coastal' THEN ARRAY['갯지렁이','새우','소형 루어']
    WHEN 'squid' THEN ARRAY['에기','스테','이카메탈']
    WHEN 'octopus' THEN ARRAY['왕눈이에기','게 모형','애자']
    ELSE ARRAY['현장 베이트에 맞춘 미끼']
  END,
  handling_cautions = COALESCE(handling_cautions, '지느러미 가시와 이빨을 확인하고 젖은 장갑이나 피시그립으로 다룬다.'),
  toxicity = COALESCE(toxicity, '알려진 대표 독성 정보 없음. 식용 판단은 별도 전문 자료를 확인한다.'),
  rarity = COALESCE(rarity, 2),
  discovery_difficulty = COALESCE(discovery_difficulty, 2),
  guide_source_urls = ARRAY['https://www.mbris.kr/','https://www.nifs.go.kr/'],
  guide_status = 'draft'
WHERE catalog_status = 'core';

-- Species-level handling, identification and size refinements used by the detail UI.
WITH guide(name_ko, aliases_note, similar_note, avg_cm, max_cm, rarity, difficulty, caution, toxicity) AS (VALUES
  ('넙치','두 눈이 몸의 왼쪽에 있고 입과 이빨이 크다. 유안측은 갈색 반점, 무안측은 대체로 흰색이다.','도다리류는 대체로 눈이 오른쪽에 있고 입이 더 작다.',45,100,2,2,'큰 송곳니와 아가미덮개를 주의한다.','알려진 대표 독성 없음'),
  ('도다리','눈이 오른쪽에 모이고 몸은 마름모꼴에 가깝다. 입이 작고 주둥이가 뾰족하다.','문치가자미·돌가자미와 눈 위치, 체형, 몸 표면 돌기를 함께 비교한다.',25,30,3,3,'지느러미 가장자리와 바늘 제거 시 미끄럼을 주의한다.','알려진 대표 독성 없음'),
  ('문치가자미','오른쪽 눈, 작은 입, 가슴지느러미 위에서 둥글게 휘는 측선이 특징이다.','도다리보다 체형이 타원형이고 측선의 굴곡이 뚜렷하다.',25,45,2,2,'지느러미 가시와 미끄러운 표면을 주의한다.','알려진 대표 독성 없음'),
  ('참가자미','무안측 꼬리자루와 지느러미 가장자리에 노란빛이 보인다.','문치가자미는 무안측 꼬리자루의 노란빛이 덜 뚜렷하다.',25,40,3,3,'지느러미 가시와 미끄러운 표면을 주의한다.','알려진 대표 독성 없음'),
  ('돌가자미','유안측에 단단한 골질 돌기가 줄지어 있고 양쪽 몸 표면에 비늘이 거의 없다.','강도다리는 지느러미의 굵은 검은 줄무늬가 더 뚜렷하다.',35,50,3,3,'골질 돌기와 지느러미 가장자리를 주의한다.','알려진 대표 독성 없음'),
  ('강도다리','몸의 왼쪽에 눈이 있고 등·뒷지느러미에 굵은 검은 띠가 반복된다.','넙치도 왼쪽 눈이지만 입이 훨씬 크고 지느러미 띠가 없다.',40,90,3,3,'거친 몸 표면과 지느러미를 주의한다.','알려진 대표 독성 없음'),
  ('조피볼락','회갈색 몸에 불규칙한 짙은 무늬가 있고 머리와 아가미덮개 가시가 강하다.','볼락보다 몸이 굵고 머리 가시가 강하며 입이 크다.',30,60,2,2,'등지느러미와 아가미덮개의 강한 가시에 찔리지 않게 한다.','가시 상처는 감염 위험이 있어 즉시 세척한다.'),
  ('볼락','큰 눈, 붉거나 갈색인 몸, 체측의 흐린 가로무늬가 특징이다.','불볼락은 몸빛이 더 선명한 붉은색이고 군집성이 강하다.',18,35,2,2,'등지느러미와 아가미덮개 가시를 주의한다.','가시 상처에 주의'),
  ('개볼락','짧은 주둥이와 큰 입, 흑갈색 몸의 작은 검은 점이 특징이다.','조피볼락보다 체형이 짧고 무늬가 잘게 흩어진다.',22,40,3,3,'머리와 등지느러미 가시를 주의한다.','가시 상처에 주의'),
  ('불볼락','선명한 붉은빛 몸과 큰 눈, 군집 생활이 특징이다.','볼락은 체색 변이가 크고 상대적으로 연안 얕은 곳에서 자주 보인다.',20,40,3,3,'등지느러미와 아가미덮개 가시를 주의한다.','가시 상처에 주의'),
  ('쏨뱅이','얼룩진 갈색·붉은색 몸과 길고 날카로운 머리·등지느러미 가시가 특징이다.','개볼락보다 머리 윤곽이 울퉁불퉁하고 위장무늬가 강하다.',18,30,2,3,'등지느러미와 머리의 날카로운 가시에 직접 손대지 않는다.','가시 상처에 통증이 생길 수 있어 주의'),
  ('노래미','눈 위 깃털 모양 피판과 하나의 측선, 둥근 꼬리지느러미가 특징이다.','쥐노래미는 측선이 5개이고 꼬리지느러미가 더 오목하다.',20,30,2,2,'등지느러미 가시와 이빨을 주의한다.','알려진 대표 독성 없음'),
  ('쥐노래미','몸에 5개의 측선이 있고 꼬리지느러미 중앙이 오목하다.','노래미는 측선이 1개이고 체형이 더 작고 둥글다.',35,65,2,2,'등지느러미 가시와 이빨을 주의한다.','알려진 대표 독성 없음'),
  ('성대','단단한 골판 머리와 날개처럼 큰 가슴지느러미, 분리된 3개의 보행성 지느러미줄기가 특징이다.','양태는 머리가 위아래로 더 납작하고 큰 가슴지느러미 무늬가 다르다.',30,50,2,2,'머리의 골질 가시와 가슴지느러미 기부를 주의한다.','알려진 대표 독성 없음'),
  ('임연수어','길쭉한 몸과 갈라진 꼬리, 옆구리의 어두운 얼룩무늬가 특징이다.','쥐노래미보다 몸이 유선형이고 회유성이 강하다.',35,60,3,3,'등지느러미 가시와 미끄러운 몸을 주의한다.','알려진 대표 독성 없음'),
  ('참돔','붉은 몸의 푸른 반점과 꼬리지느러미 뒤 가장자리의 검은색이 특징이다.','황돔은 전체적으로 황색 기운이 강하고 체형과 얼굴 윤곽이 다르다.',45,100,2,2,'등지느러미와 아가미덮개 가시를 주의한다.','알려진 대표 독성 없음'),
  ('감성돔','은회색 몸에 흐린 세로띠가 있고 등지느러미 가시가 강하다.','참돔은 붉은빛과 푸른 점이 뚜렷하다.',35,60,2,3,'강한 등지느러미 가시를 접어 잡는다.','알려진 대표 독성 없음'),
  ('돌돔','흰 바탕에 굵은 검은 세로띠가 반복되고 강한 앞니가 있다.','강담돔은 몸의 검은 반점이 점무늬 형태로 나타난다.',35,80,3,4,'단단한 이빨과 등지느러미 가시를 주의한다.','알려진 대표 독성 없음'),
  ('벵에돔','회청색 체색, 작은 입, 둥근 체형과 갈라진 꼬리지느러미가 특징이다.','긴꼬리벵에돔은 꼬리자루가 가늘고 꼬리 양끝이 더 길다.',30,50,2,3,'등지느러미 가시를 주의한다.','알려진 대표 독성 없음'),
  ('긴꼬리벵에돔','가느다란 꼬리자루와 길게 뻗은 꼬리지느러미 양끝이 특징이다.','벵에돔은 꼬리가 상대적으로 짧고 몸이 더 둥글다.',35,60,4,4,'등지느러미 가시를 주의한다.','알려진 대표 독성 없음'),
  ('황돔','붉은빛 몸에 황색 기운과 노란 지느러미가 나타난다.','참돔의 푸른 반점과 꼬리 뒤 검은 가장자리를 비교한다.',30,50,3,3,'등지느러미 가시를 주의한다.','알려진 대표 독성 없음'),
  ('농어','은백색의 길쭉한 몸, 큰 입, 어린 개체의 작은 검은 점이 특징이다.','점농어는 성어에서도 체측 검은 점이 비교적 뚜렷하다.',55,100,2,3,'아가미덮개 가장자리와 등지느러미 가시를 주의한다.','알려진 대표 독성 없음'),
  ('점농어','은백색 몸의 뚜렷한 검은 점과 큰 입이 특징이다.','농어는 성장하면서 체측 점이 흐려지는 경우가 많다.',55,100,3,3,'아가미덮개 가장자리와 등지느러미 가시를 주의한다.','알려진 대표 독성 없음'),
  ('민어','몸이 길고 은회색이며 턱 아래 수염이 없고 부레 소리를 낸다.','수조기·점성어와 입 모양, 체측색, 지느러미를 비교한다.',60,100,4,4,'큰 개체의 등지느러미와 아가미덮개를 주의한다.','알려진 대표 독성 없음'),
  ('보구치','은빛 몸과 등쪽의 갈색 기운, 입 안쪽의 노란빛이 특징이다.','참조기는 꼬리자루가 더 가늘고 머리 윤곽과 체색이 다르다.',25,40,2,2,'등지느러미 가시를 주의한다.','알려진 대표 독성 없음'),
  ('부세','황금빛이 도는 몸과 노란 지느러미, 비교적 큰 체형이 특징이다.','참조기는 체형이 더 작고 꼬리자루가 가늘다.',35,70,4,4,'등지느러미 가시를 주의한다.','알려진 대표 독성 없음'),
  ('참조기','금빛이 도는 은색 몸과 가는 꼬리자루, 머리의 특징적 윤곽이 보인다.','부세는 더 크고 전체적인 황금빛이 강하다.',25,45,3,3,'등지느러미 가시를 주의한다.','알려진 대표 독성 없음'),
  ('자바리','갈색 몸에 여러 개의 어두운 세로띠가 있고 체형이 굵다.','능성어·붉바리와 띠의 수와 색, 반점 배열을 비교한다.',60,130,5,5,'강한 등지느러미 가시와 큰 입을 주의한다.','알려진 대표 독성 없음'),
  ('붉바리','붉은 갈색 몸에 작은 주황·적색 반점이 흩어진다.','자바리는 굵은 세로띠가 더 뚜렷하다.',35,60,5,5,'강한 등지느러미 가시와 아가미덮개를 주의한다.','알려진 대표 독성 없음'),
  ('능성어','연한 몸에 7개 안팎의 어두운 세로띠가 나타난다.','자바리와 띠 모양, 머리 무늬, 체색을 함께 비교한다.',55,120,5,5,'강한 등지느러미 가시와 큰 입을 주의한다.','알려진 대표 독성 없음'),
  ('고등어','푸른 등 쪽의 물결무늬와 은백색 배, 가는 꼬리자루가 특징이다.','망치고등어는 체측 아래까지 점·무늬가 이어지고 눈이 더 크다.',30,50,1,1,'아가미덮개와 빠른 몸부림을 주의하고 즉시 냉장한다.','알려진 대표 독성 없음'),
  ('망치고등어','등의 물결무늬와 함께 체측 아래의 작은 점이 보이는 경우가 많다.','고등어는 배 쪽이 비교적 깨끗하고 체형이 조금 더 굵다.',30,50,2,2,'아가미덮개와 빠른 몸부림을 주의하고 즉시 냉장한다.','알려진 대표 독성 없음'),
  ('전갱이','아가미 뒤에서 꼬리까지 단단한 모비늘이 줄지어 있다.','갈전갱이류와 체형, 측선 모비늘, 지느러미색을 비교한다.',25,50,1,1,'측선의 날카로운 모비늘과 등지느러미를 주의한다.','알려진 대표 독성 없음'),
  ('방어','청회색 등과 은백색 배 사이의 노란 세로띠, 둥근 위턱 모서리가 특징이다.','부시리는 위턱 뒤 모서리가 더 각지고 가슴지느러미가 배지느러미보다 짧다.',70,150,3,4,'큰 개체의 힘과 꼬리, 바늘을 주의한다.','알려진 대표 독성 없음'),
  ('부시리','노란 세로띠와 각진 위턱 뒤 모서리, 짧은 가슴지느러미가 특징이다.','방어는 위턱 모서리가 더 둥글고 가슴·배지느러미 길이가 비슷하다.',80,180,4,4,'큰 개체의 힘과 꼬리, 바늘을 주의한다.','알려진 대표 독성 없음'),
  ('삼치','길고 납작한 방추형 몸과 날카로운 이빨, 체측의 회청색 반점이 특징이다.','꼬치고기는 주둥이가 더 길고 두 등지느러미 간격이 뚜렷하다.',60,120,2,3,'매우 날카로운 이빨에 손을 가까이 대지 않는다.','알려진 대표 독성 없음'),
  ('갈치','리본처럼 길고 은빛인 몸, 큰 송곳니와 실처럼 가는 꼬리가 특징이다.','동갈치류는 몸이 더 원통형이고 꼬리지느러미가 있다.',80,150,2,2,'날카로운 이빨과 등지느러미 가시, 바늘을 주의한다.','알려진 대표 독성 없음'),
  ('청어','은백색 몸과 암청색 등, 배 정중선의 날카로운 모비늘이 특징이다.','전어는 등지느러미 마지막 연조가 길게 뻗고 어깨 반점이 보인다.',25,40,2,2,'배 쪽 모비늘과 아가미덮개를 주의한다.','알려진 대표 독성 없음'),
  ('숭어','눈을 넓게 덮는 기름눈까풀과 굵은 원통형 몸이 특징이다.','가숭어는 기름눈까풀이 작고 눈에 붉은빛이 돌 수 있다.',45,100,1,2,'큰 개체의 강한 꼬리와 미끄러운 몸을 주의한다.','알려진 대표 독성 없음'),
  ('가숭어','큰 눈과 작은 기름눈까풀, 회청색 등과 은백색 배가 특징이다.','숭어는 기름눈까풀이 눈을 더 넓게 덮는다.',45,100,2,2,'큰 개체의 강한 꼬리와 미끄러운 몸을 주의한다.','알려진 대표 독성 없음'),
  ('전어','어깨의 검은 반점과 길게 뻗은 등지느러미 마지막 연조가 특징이다.','청어는 등지느러미 연조가 길게 뻗지 않는다.',20,30,1,1,'비늘이 쉽게 떨어지므로 젖은 손으로 다룬다.','알려진 대표 독성 없음'),
  ('꽁치','가늘고 긴 몸, 뾰족한 주둥이, 꼬리 부근의 작은 토막지느러미가 특징이다.','학공치는 아래턱이 길게 돌출된다.',25,40,3,3,'부드러운 몸과 비늘을 손상시키지 않게 다룬다.','알려진 대표 독성 없음'),
  ('쥐치','마름모꼴 몸과 눈 위의 강한 첫 등지느러미 가시, 거친 피부가 특징이다.','말쥐치는 몸이 더 길고 주둥이가 길다.',20,30,2,2,'첫 등지느러미의 잠금식 가시를 접은 뒤 다룬다.','알려진 대표 독성 없음'),
  ('말쥐치','길쭉한 타원형 몸과 긴 주둥이, 눈 위의 강한 가시가 특징이다.','쥐치는 체고가 더 높고 몸이 마름모꼴에 가깝다.',25,36,2,2,'첫 등지느러미의 강한 가시를 주의한다.','알려진 대표 독성 없음'),
  ('복섬','작은 둥근 몸, 부리 모양 이빨, 등 쪽의 흰 점과 피부극이 특징이다.','다른 참복류와 흰 점 배열, 피부극 분포를 비교한다.',10,15,2,2,'절대 맨손 손질하거나 임의로 식용하지 않는다. 물림도 주의한다.','테트로도톡신 위험. 피부·내장·생식소 등에 강한 독이 있을 수 있음'),
  ('붕장어','긴 원통형 몸과 흰색 측선공, 검은 지느러미 가장자리가 특징이다.','갯장어는 주둥이와 이빨이 더 강하고 등지느러미 시작 위치가 다르다.',60,120,2,3,'날카로운 이빨과 강한 몸부림 때문에 피시그립을 사용한다.','알려진 대표 독성 없음'),
  ('꼬치고기','길고 곧은 몸, 뾰족한 주둥이와 돌출된 아래턱이 특징이다.','삼치는 체고가 더 높고 체측 반점과 작은 토막지느러미가 뚜렷하다.',30,50,3,3,'날카로운 이빨에 손을 가까이 대지 않는다.','알려진 대표 독성 없음'),
  ('학공치','아래턱이 바늘처럼 길게 뻗고 표층을 무리 지어 다닌다.','꽁치는 위아래턱 길이가 비슷하고 토막지느러미가 있다.',25,40,2,2,'긴 아래턱이 부러지지 않도록 젖은 손으로 다룬다.','알려진 대표 독성 없음'),
  ('보리멸','가늘고 긴 은빛 몸과 뾰족한 주둥이, 두 개로 분리된 등지느러미가 특징이다.','청보리멸류와 체색, 등지느러미 무늬를 비교한다.',20,35,2,2,'등지느러미 가시를 주의한다.','알려진 대표 독성 없음'),
  ('양태','위아래로 납작하고 넓은 머리, 큰 입, 모래색 위장무늬가 특징이다.','성대는 머리가 단단한 골판으로 덮이고 큰 가슴지느러미가 화려하다.',40,80,3,3,'아가미덮개와 등지느러미 가시, 큰 입을 주의한다.','알려진 대표 독성 없음'),
  ('독가시치','타원형 몸과 촘촘한 반점, 강한 등·배·뒷지느러미 가시가 특징이다.','자리돔보다 체형이 크고 주둥이가 길며 가시가 훨씬 강하다.',25,40,3,4,'등·배·뒷지느러미 독가시에 절대 맨손으로 닿지 않는다.','가시에 독성이 있어 찔리면 심한 통증을 유발할 수 있음'),
  ('자리돔','작은 타원형 몸과 갈색·회색 체색, 군집 생활이 특징이다.','어린 독가시치는 주둥이와 지느러미 가시 배열이 다르다.',12,20,1,1,'작은 등지느러미 가시를 주의한다.','알려진 대표 독성 없음'),
  ('살오징어','길쭉한 외투와 몸 뒤쪽의 삼각형 지느러미, 붉갈색 색소포가 특징이다.','한치는 지느러미가 외투의 절반 이상 길게 이어지는 편이다.',25,45,2,2,'부리와 빨판, 먹물 분사를 주의한다.','알려진 대표 독성 없음'),
  ('참갑오징어','넓고 납작한 몸, 외투 가장자리를 두르는 지느러미와 내부 갑이 특징이다.','무늬오징어는 몸이 더 길고 내부에 단단한 갑이 없다.',20,35,2,2,'부리와 먹물 분사를 주의한다.','알려진 대표 독성 없음'),
  ('흰꼴뚜기','외투 대부분을 따라 넓은 지느러미가 이어지고 살아 있을 때 무늬 변화가 빠르다.','창꼴뚜기는 몸이 더 가늘고 지느러미 비율과 형태가 다르다.',25,45,3,4,'부리와 강한 빨판, 먹물 분사를 주의한다.','알려진 대표 독성 없음'),
  ('창꼴뚜기','가늘고 긴 외투와 마름모꼴 지느러미가 특징이며 한치로 널리 불린다.','살오징어보다 몸이 가늘고 지느러미가 상대적으로 길다.',20,40,3,3,'부리와 빨판, 먹물 분사를 주의한다.','알려진 대표 독성 없음'),
  ('주꾸미','짧고 둥근 외투와 비교적 짧은 팔, 팔 사이의 물갈퀴가 특징이다.','낙지는 팔이 훨씬 길고 몸이 길쭉하다.',12,25,1,2,'부리에 물리지 않도록 머리 뒤를 안정적으로 잡는다.','알려진 대표 독성 없음'),
  ('낙지','작은 몸에 비해 매우 긴 팔과 길쭉한 외투가 특징이다.','주꾸미는 팔이 짧고 몸이 더 둥글다.',40,70,2,3,'강한 흡반과 부리 물림을 주의한다.','알려진 대표 독성 없음'),
  ('참문어','몸 표면 돌기가 뚜렷하고 팔이 굵으며 암초색으로 빠르게 변한다.','대문어는 훨씬 크게 자라고 주로 동해의 차가운 수역에서 만난다.',60,120,2,3,'강한 흡반과 부리 물림, 큰 개체의 힘을 주의한다.','알려진 대표 독성 없음'),
  ('대문어','매우 큰 체격과 굵고 긴 팔, 붉갈색 체색이 특징이다.','참문어보다 훨씬 크게 자라며 차가운 동해 수역에 주로 분포한다.',150,300,5,5,'대형 개체는 혼자 다루지 말고 강한 흡반과 부리를 주의한다.','알려진 대표 독성 없음')
)
UPDATE public.fishes AS fish
SET identification_features = guide.aliases_note,
    similar_species_notes = guide.similar_note,
    average_size_cm = guide.avg_cm,
    max_size_cm = guide.max_cm,
    rarity = guide.rarity,
    discovery_difficulty = guide.difficulty,
    handling_cautions = guide.caution,
    toxicity = guide.toxicity
FROM guide
WHERE fish.catalog_status = 'core' AND fish.name_ko = guide.name_ko;

-- Current national rules sourced from the Ministry of Oceans and Fisheries,
-- 2026-01-01 tables. Local ordinances can be stricter and are called out in copy.
WITH source AS (
  SELECT
    '해양수산부 수산자원의 금어기·금지체장 기준(2026.1.1.)'::text AS source_name,
    'https://www.mof.go.kr/doc/ko/selectDoc.do?bbsSeq=22&docSeq=64389&menuSeq=851'::text AS source_url
), rules(name_ko, regulation_type, prohibited_from, prohibited_to, min_size_cm, min_weight_g, measurement_method, rule_text) AS (VALUES
  ('문치가자미','closed_season','12-01','01-31',NULL,NULL,NULL,'12월 1일부터 다음 해 1월 31일까지 포획·채취 금지'),
  ('전어','closed_season','05-01','07-15',NULL,NULL,NULL,'5월 1일부터 7월 15일까지. 강원특별자치도 및 경상북도는 제외'),
  ('쥐노래미','closed_season','11-01','12-31',NULL,NULL,NULL,'11월 1일부터 12월 31일까지. 일부 지정 해역은 11월 15일부터 12월 14일까지'),
  ('참조기','closed_season','07-01','07-31',NULL,NULL,NULL,'7월 1일부터 7월 31일까지. 어업 방식·혼획 비율에 따른 예외가 있어 원문 확인 필요'),
  ('갈치','closed_season','07-01','07-31',NULL,NULL,NULL,'북위 33도 이북 해역에서 7월 1일부터 7월 31일까지. 어업 방식·혼획 예외는 원문 확인'),
  ('고등어','closed_season','04-01','06-30',NULL,NULL,NULL,'4월 1일부터 6월 30일 사이 해양수산부장관이 고시하는 1개월. 최신 고시 확인 필요'),
  ('말쥐치','closed_season','05-01','07-31',NULL,NULL,NULL,'5월 1일부터 7월 31일까지. 정치망·연안·구획어업은 6월 1일부터 7월 31일까지'),
  ('삼치','closed_season','05-01','05-31',NULL,NULL,NULL,'5월 1일부터 5월 31일까지 포획·채취 금지'),
  ('감성돔','closed_season','05-01','05-31',NULL,NULL,NULL,'5월 1일부터 5월 31일까지 포획·채취 금지'),
  ('살오징어','closed_season','04-01','05-31',NULL,NULL,NULL,'4월 1일부터 5월 31일까지. 일부 어업은 4월 1일부터 4월 30일까지'),
  ('낙지','closed_season','06-01','06-30',NULL,NULL,NULL,'6월 1일부터 6월 30일까지. 시·도별 별도 고시가 있으면 해당 기간 적용'),
  ('주꾸미','closed_season','05-11','08-31',NULL,NULL,NULL,'5월 11일부터 8월 31일까지 포획·채취 금지'),
  ('참문어','closed_season','05-16','06-30',NULL,NULL,NULL,'5월 16일부터 6월 30일까지. 시·도별 별도 고시가 있으면 해당 기간 적용'),
  ('문치가자미','minimum_size',NULL,NULL,20,NULL,'전장','전장 20cm 이하 포획·채취 금지'),
  ('참가자미','minimum_size',NULL,NULL,20,NULL,'전장','전장 20cm 이하 포획·채취 금지'),
  ('감성돔','minimum_size',NULL,NULL,25,NULL,'전장','전장 25cm 이하 포획·채취 금지'),
  ('돌돔','minimum_size',NULL,NULL,24,NULL,'전장','전장 24cm 이하 포획·채취 금지'),
  ('참돔','minimum_size',NULL,NULL,24,NULL,'전장','전장 24cm 이하 포획·채취 금지'),
  ('넙치','minimum_size',NULL,NULL,35,NULL,'전장','전장 35cm 이하 포획·채취 금지'),
  ('농어','minimum_size',NULL,NULL,30,NULL,'전장','전장 30cm 이하 포획·채취 금지'),
  ('민어','minimum_size',NULL,NULL,33,NULL,'전장','전장 33cm 이하 포획·채취 금지'),
  ('방어','minimum_size',NULL,NULL,30,NULL,'전장','전장 30cm 이하 포획·채취 금지'),
  ('볼락','minimum_size',NULL,NULL,15,NULL,'전장','전장 15cm 이하 포획·채취 금지'),
  ('붕장어','minimum_size',NULL,NULL,35,NULL,'전장','전장 35cm 이하 포획·채취 금지'),
  ('조피볼락','minimum_size',NULL,NULL,23,NULL,'전장','전장 23cm 이하 포획·채취 금지'),
  ('쥐노래미','minimum_size',NULL,NULL,20,NULL,'전장','전장 20cm 이하 포획·채취 금지'),
  ('갈치','minimum_size',NULL,NULL,18,NULL,'항문장','항문장 18cm 이하 포획·채취 금지. 혼획 비율 예외는 원문 확인'),
  ('고등어','minimum_size',NULL,NULL,21,NULL,'전장','전장 21cm 이하 포획·채취 금지. 혼획 비율 예외는 원문 확인'),
  ('참조기','minimum_size',NULL,NULL,15,NULL,'전장','전장 15cm 이하 포획·채취 금지. 혼획 비율 예외는 원문 확인'),
  ('말쥐치','minimum_size',NULL,NULL,18,NULL,'전장','전장 18cm 이하 포획·채취 금지'),
  ('청어','minimum_size',NULL,NULL,20,NULL,'전장','전장 20cm 이하 포획·채취 금지'),
  ('대문어','minimum_weight',NULL,NULL,NULL,600,'체중','체중 600g 이하 포획·채취 금지'),
  ('살오징어','minimum_size',NULL,NULL,15,NULL,'외투장','외투장 15cm 이하 포획·채취 금지. 혼획 비율 예외는 원문 확인')
)
INSERT INTO public.fish_regulations (
  fish_id, jurisdiction, regulation_type, effective_from, effective_to,
  prohibited_from, prohibited_to, min_size_cm, min_weight_g,
  measurement_method, rule_text, source_name, source_url, verified_at
)
SELECT fish.id, '대한민국', rules.regulation_type, DATE '2026-01-01', DATE '2026-12-31',
       rules.prohibited_from, rules.prohibited_to, rules.min_size_cm, rules.min_weight_g,
       rules.measurement_method, rules.rule_text, source.source_name, source.source_url, now()
FROM rules
JOIN public.fishes fish ON fish.name_ko = rules.name_ko AND fish.catalog_status = 'core'
CROSS JOIN source
WHERE NOT EXISTS (
  SELECT 1 FROM public.fish_regulations existing
  WHERE existing.fish_id = fish.id
    AND existing.regulation_type = rules.regulation_type
    AND existing.effective_from = DATE '2026-01-01'
    AND existing.rule_text = rules.rule_text
);

-- Keep the legacy list badge useful while callers transition to the regulation table.
UPDATE public.fishes fish
SET min_size_cm = regulation.min_size_cm
FROM public.fish_regulations regulation
WHERE regulation.fish_id = fish.id
  AND regulation.regulation_type = 'minimum_size'
  AND regulation.effective_from <= CURRENT_DATE
  AND (regulation.effective_to IS NULL OR regulation.effective_to >= CURRENT_DATE);
