-- Species-level habitat review batch 03: FIELD 60 breams.
-- Sources: FishBase species summaries, checked 2026-07-16; Korean occurrence
-- and standard names continue to use the original MBRIS/NIFS source layer.
WITH habitat(name_ko, regions, environment, depth_zone, source_url, notes) AS (VALUES
  ('참돔',ARRAY['서해','남해','동해','제주']::text[],'암반과 자갈이 섞인 거친 바닥부터 부드러운 저질과 암초까지 이용하는 저서성 어종','저층 · 약 10~200m, 흔히 10~50m','https://www.fishbase.se/summary/Pagrus-major.html','FishBase: marine demersal 10–200m; rough·soft bottom과 reefs 이용'),
  ('감성돔',ARRAY['서해','남해','제주']::text[],'만과 얕은 암초, 기수 영향을 받는 연안까지 폭넓게 이용하는 저서성 어종','연안 저층 · 약 15m 이상, 상한 자료 부족','https://www.fishbase.se/summary/Acanthopagrus-schlegelii.html','FishBase: southern Korean Peninsula 포함; marine·brackish demersal, bays와 shallow rocky reefs'),
  ('돌돔',ARRAY['남해','동해','제주']::text[],'얕은 연안 암초와 암반 지대를 중심으로 생활하는 암초성 어종','암초 주변 · 약 1~10m','https://www.fishbase.se/summary/Oplegnathus-fasciatus.html','FishBase: Korea 포함 북서태평양, reef-associated 1–10m; coastal rocky reefs'),
  ('벵에돔',ARRAY['남해','제주']::text[],'따뜻한 연안의 암초와 해조류가 발달한 암반 지대에서 생활하는 암초성 어종','연안 암초 · 구체 수심 자료 부족','https://www.fishbase.se/summary/Girella-punctata.html','FishBase: reef-associated; coastal rocky reefs, 수심 범위 미제공'),
  ('긴꼬리벵에돔',ARRAY['남해','제주']::text[],'따뜻한 얕은 연안의 암초와 암반 지대에서 생활하는 암초성 어종','암초 주변 · 약 1~15m','https://www.fishbase.se/summary/Girella-leonina.html','FishBase: reef-associated 1–15m; shallow rocky reefs'),
  ('황돔',ARRAY['남해','제주']::text[],'남부의 비교적 깊은 저층에서 생활하는 온대성 돔류','저층 · 주로 약 50~200m','https://www.fishbase.se/summary/Dentex-hypselosomus.html','FishBase: southern Korea 포함 북서태평양, marine demersal usually 50–200m')
)
UPDATE public.fishes AS fish
SET habitat_regions = habitat.regions,
    habitat_environment = habitat.environment,
    depth_zone = habitat.depth_zone,
    guide_source_urls = ARRAY(SELECT DISTINCT source_url FROM unnest(fish.guide_source_urls || ARRAY[habitat.source_url]) AS source_url),
    updated_at = now()
FROM habitat
WHERE fish.catalog_status = 'core' AND fish.name_ko = habitat.name_ko;

WITH habitat(name_ko, source_url, notes) AS (VALUES
  ('참돔','https://www.fishbase.se/summary/Pagrus-major.html','FishBase: marine demersal 10–200m; rough·soft bottom과 reefs 이용'),
  ('감성돔','https://www.fishbase.se/summary/Acanthopagrus-schlegelii.html','FishBase: southern Korean Peninsula 포함; marine·brackish demersal, bays와 shallow rocky reefs'),
  ('돌돔','https://www.fishbase.se/summary/Oplegnathus-fasciatus.html','FishBase: Korea 포함 북서태평양, reef-associated 1–10m; coastal rocky reefs'),
  ('벵에돔','https://www.fishbase.se/summary/Girella-punctata.html','FishBase: reef-associated; coastal rocky reefs, 수심 범위 미제공'),
  ('긴꼬리벵에돔','https://www.fishbase.se/summary/Girella-leonina.html','FishBase: reef-associated 1–15m; shallow rocky reefs'),
  ('황돔','https://www.fishbase.se/summary/Dentex-hypselosomus.html','FishBase: southern Korea 포함 북서태평양, marine demersal usually 50–200m')
)
UPDATE public.fish_guide_reviews AS review
SET review_status='reviewed', source_urls=ARRAY[habitat.source_url], review_notes=habitat.notes,
    reviewer='source-check: FishBase + MBRIS', reviewed_at=now(), updated_at=now()
FROM public.fishes AS fish JOIN habitat ON habitat.name_ko=fish.name_ko
WHERE review.fish_id=fish.id AND review.field_name='habitat' AND fish.catalog_status='core';
