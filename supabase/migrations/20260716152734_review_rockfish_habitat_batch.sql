-- Species-level habitat review batch 02: FIELD 60 rockfish and greenlings.
-- Sources: FishBase species summaries, checked 2026-07-16. Korean occurrence
-- and standard names continue to use the original MBRIS/NIFS source layer.
WITH habitat(name_ko, regions, environment, depth_zone, source_url, notes) AS (VALUES
  (
    '조피볼락', ARRAY['서해','남해','동해']::text[],
    '연안의 암반 바닥과 방파제·인공어초 주변에서 생활하는 저서성 어종',
    '저층 · 약 3~100m',
    'https://www.fishbase.se/summary/Sebastes-schlegelii.html',
    'FishBase: Korea 포함 북서태평양, marine demersal 3–100m; 연안 암반 바닥 서식'
  ),
  (
    '볼락', ARRAY['남해','동해','제주']::text[],
    '남부와 동부 연안의 암초·해조류 주변에서 생활하며, 어린 개체는 떠다니는 해조류를 이용하는 저서성 어종',
    '연안 저층 · 구체 수심 자료 부족',
    'https://www.fishbase.se/summary/Sebastes-inermis.html',
    'FishBase: southern Korean Peninsula 포함 북서태평양, marine demersal; 유어는 유조와 연관, 수심 범위 미제공'
  ),
  (
    '개볼락', ARRAY['서해','남해','제주']::text[],
    '얕은 연안의 암초와 암반 틈 주변에서 생활하는 저서성 어종',
    '얕은 연안 저층 · 구체 수심 자료 부족',
    'https://www.fishbase.se/summary/Sebastes-pachycephalus.html',
    'FishBase: southern Korean Peninsula와 Yellow Sea 포함 북서태평양; shallow rocky reefs 서식, 수심 범위 미제공'
  ),
  (
    '불볼락', ARRAY['동해']::text[],
    '온대 해역의 중층 아래와 저층에서 생활하는 저서성 볼락류',
    '저층 · 약 40~150m',
    'https://www.fishbase.se/summary/Sebastes-thompsoni.html',
    'FishBase: marine demersal 40–150m; 북서태평양 북부 일본 분포 기록'
  ),
  (
    '쏨뱅이', ARRAY['남해','제주']::text[],
    '따뜻한 연안의 암반 바닥과 암초 주변에서 생활하는 저서성 어종',
    '연안 저층 · 구체 수심 자료 부족',
    'https://www.fishbase.se/summary/Sebastiscus-marmoratus.html',
    'FishBase: marine demersal; southern Hokkaido부터 Philippines, 연안 암반 바닥 서식; 수심 범위 미제공'
  ),
  (
    '노래미', ARRAY['서해','남해','동해']::text[],
    '연안의 해조류 군락과 암초 주변에서 생활하는 저서성 어종',
    '연안 저층 · 구체 수심 자료 부족',
    'https://www.fishbase.se/summary/Hexagrammos-agrammus.html',
    'FishBase: Korean Peninsula와 Yellow Sea 포함 북서태평양; coastal seaweed beds 서식, 수심 범위 미제공'
  ),
  (
    '쥐노래미', ARRAY['서해','남해','동해']::text[],
    '연안 암초와 인공어초 주변에 모여 생활하는 저서성 어종',
    '저층 · 약 4~155m',
    'https://www.fishbase.se/summary/Hexagrammos-otakii.html',
    'FishBase: southern Korean Peninsula와 Yellow Sea 포함 북서태평양, marine demersal 4–155m; rocky coast와 artificial reefs 서식'
  ),
  (
    '성대', ARRAY['서해','남해','제주']::text[],
    '따뜻한 해역의 모래 또는 모래·펄이 섞인 바닥에서 생활하는 저서성 어종',
    '저층 · 약 25~615m',
    'https://www.fishbase.se/summary/Chelidonichthys-spinosus.html',
    'FishBase: marine demersal 25–615m; sandy 또는 sandy-mud bottom 서식'
  ),
  (
    '임연수어', ARRAY['동해']::text[],
    '어린 개체는 표층 가까이 무리를 이루고 성어는 암반 연안의 저층을 이용하는 냉수성 어종',
    '표층~저층 · 약 0~240m, 성어는 주로 저층',
    'https://www.fishbase.se/summary/Pleurogrammus-azonus.html',
    'FishBase: Yellow Sea까지의 북서태평양, marine demersal 0–240m; 유어는 표층 군집, 성어는 저서 생활'
  )
)
UPDATE public.fishes AS fish
SET habitat_regions = habitat.regions,
    habitat_environment = habitat.environment,
    depth_zone = habitat.depth_zone,
    guide_source_urls = ARRAY(
      SELECT DISTINCT source_url
      FROM unnest(fish.guide_source_urls || ARRAY[habitat.source_url]) AS source_url
    ),
    updated_at = now()
FROM habitat
WHERE fish.catalog_status = 'core'
  AND fish.name_ko = habitat.name_ko;

WITH habitat(name_ko, source_url, notes) AS (VALUES
  ('조피볼락','https://www.fishbase.se/summary/Sebastes-schlegelii.html','FishBase: Korea 포함 북서태평양, marine demersal 3–100m; 연안 암반 바닥 서식'),
  ('볼락','https://www.fishbase.se/summary/Sebastes-inermis.html','FishBase: southern Korean Peninsula 포함 북서태평양, marine demersal; 유어는 유조와 연관, 수심 범위 미제공'),
  ('개볼락','https://www.fishbase.se/summary/Sebastes-pachycephalus.html','FishBase: southern Korean Peninsula와 Yellow Sea 포함 북서태평양; shallow rocky reefs 서식, 수심 범위 미제공'),
  ('불볼락','https://www.fishbase.se/summary/Sebastes-thompsoni.html','FishBase: marine demersal 40–150m; 북서태평양 북부 일본 분포 기록'),
  ('쏨뱅이','https://www.fishbase.se/summary/Sebastiscus-marmoratus.html','FishBase: marine demersal; southern Hokkaido부터 Philippines, 연안 암반 바닥 서식; 수심 범위 미제공'),
  ('노래미','https://www.fishbase.se/summary/Hexagrammos-agrammus.html','FishBase: Korean Peninsula와 Yellow Sea 포함 북서태평양; coastal seaweed beds 서식, 수심 범위 미제공'),
  ('쥐노래미','https://www.fishbase.se/summary/Hexagrammos-otakii.html','FishBase: southern Korean Peninsula와 Yellow Sea 포함 북서태평양, marine demersal 4–155m; rocky coast와 artificial reefs 서식'),
  ('성대','https://www.fishbase.se/summary/Chelidonichthys-spinosus.html','FishBase: marine demersal 25–615m; sandy 또는 sandy-mud bottom 서식'),
  ('임연수어','https://www.fishbase.se/summary/Pleurogrammus-azonus.html','FishBase: Yellow Sea까지의 북서태평양, marine demersal 0–240m; 유어는 표층 군집, 성어는 저서 생활')
)
UPDATE public.fish_guide_reviews AS review
SET review_status = 'reviewed',
    source_urls = ARRAY[habitat.source_url],
    review_notes = habitat.notes,
    reviewer = 'source-check: FishBase + MBRIS',
    reviewed_at = now(),
    updated_at = now()
FROM public.fishes AS fish
JOIN habitat ON habitat.name_ko = fish.name_ko
WHERE review.fish_id = fish.id
  AND review.field_name = 'habitat'
  AND fish.catalog_status = 'core';
