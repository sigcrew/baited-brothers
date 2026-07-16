-- Species-level habitat review batch 01: FIELD 60 flatfish.
-- Sources: FishBase species summaries, checked 2026-07-16. Korean occurrence
-- and standard names continue to use the original MBRIS/NIFS source layer.
WITH habitat(name_ko, regions, environment, depth_zone, source_url, notes) AS (VALUES
  (
    '넙치', ARRAY['한반도 연안']::text[],
    '연안부터 대륙붕까지 모래·펄 바닥을 중심으로 생활하는 저서성 어종',
    '저층 · 약 10~200m',
    'https://www.fishbase.se/summary/Paralichthys-olivaceus.html',
    'FishBase: marine demersal, 10–200m; Korean Peninsula 포함 서부 북태평양 분포'
  ),
  (
    '도다리', ARRAY['한반도 연안']::text[],
    '연안의 모래·펄 바닥에 서식하며, 깊은 해역에서는 펄 바닥에서 더 흔한 저서성 어종',
    '저층 · 약 2~170m, 주로 깊은 펄 바닥',
    'https://www.fishbase.se/summary/Pleuronichthys-cornutus.html',
    'FishBase: Korea 포함 북서태평양, 2–170m; 깊은 수역의 펄 바닥 선호 기록'
  ),
  (
    '문치가자미', ARRAY['서해','남해','동해']::text[],
    '연안의 모래 또는 펄 바닥에서 생활하는 저서성 어종',
    '연안 저층 · 구체 수심 자료 부족',
    'https://www.fishbase.se/summary/Pseudopleuronectes-yokohamae.html',
    'FishBase: Korea 포함 북서태평양, coastal sandy and muddy bottoms; 수심 범위 미제공'
  ),
  (
    '참가자미', ARRAY['서해','동해']::text[],
    '한반도 동해안과 황해를 포함한 북서태평양의 저층에 서식하는 저서성 어종',
    '저층 · 약 20~40m',
    'https://www.fishbase.se/summary/Pseudopleuronectes-herzensteini.html',
    'FishBase: marine demersal, 20–40m; Korean east coast와 Yellow Sea 분포'
  ),
  (
    '돌가자미', ARRAY['남해','제주']::text[],
    '연안의 모래·펄 바닥과 기수 영향을 받는 저층에서 생활하는 어종',
    '저층 · 최대 약 150m, 얕은 연안 포함',
    'https://www.fishbase.se/summary/Platichthys-bicoloratus.html',
    'FishBase: marine·brackish·freshwater demersal, 최대 150m; East China Sea 연안 분포'
  ),
  (
    '강도다리', ARRAY['서해','동해']::text[],
    '여름에는 얕은 연안과 하구를 이용하고 겨울에는 더 깊은 수역으로 이동하는 저서성 어종',
    '저층 · 약 0~375m, 계절에 따라 이동',
    'https://www.fishbase.se/summary/Platichthys-stellatus.html',
    'FishBase: marine·brackish·freshwater demersal, 0–375m; Korea 연안과 Yellow Sea 분포'
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
  ('넙치','https://www.fishbase.se/summary/Paralichthys-olivaceus.html','FishBase: marine demersal, 10–200m; Korean Peninsula 포함 서부 북태평양 분포'),
  ('도다리','https://www.fishbase.se/summary/Pleuronichthys-cornutus.html','FishBase: Korea 포함 북서태평양, 2–170m; 깊은 수역의 펄 바닥 선호 기록'),
  ('문치가자미','https://www.fishbase.se/summary/Pseudopleuronectes-yokohamae.html','FishBase: Korea 포함 북서태평양, coastal sandy and muddy bottoms; 수심 범위 미제공'),
  ('참가자미','https://www.fishbase.se/summary/Pseudopleuronectes-herzensteini.html','FishBase: marine demersal, 20–40m; Korean east coast와 Yellow Sea 분포'),
  ('돌가자미','https://www.fishbase.se/summary/Platichthys-bicoloratus.html','FishBase: marine·brackish·freshwater demersal, 최대 150m; East China Sea 연안 분포'),
  ('강도다리','https://www.fishbase.se/summary/Platichthys-stellatus.html','FishBase: marine·brackish·freshwater demersal, 0–375m; Korea 연안과 Yellow Sea 분포')
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
