-- FIELD 60 regulation review against the Ministry of Oceans and Fisheries
-- tables republished on 2026-05-20 and the current Enforcement Decree.
-- A reviewed row without fish_regulations records means no species-specific
-- nationwide rule was found in those tables; local rules may still be stricter.
WITH official_source AS (
  SELECT
    'https://www.mof.go.kr/doc/ko/selectDoc.do?bbsSeq=22&docSeq=66688&menuSeq=851'::text AS source_url
), active_rules AS (
  SELECT fish_id, count(*) AS rule_count
  FROM public.fish_regulations
  WHERE effective_from <= current_date
    AND (effective_to IS NULL OR effective_to >= current_date)
  GROUP BY fish_id
)
UPDATE public.fish_guide_reviews AS review
SET review_status = 'reviewed',
    source_urls = ARRAY[official_source.source_url],
    review_notes = CASE
      WHEN active_rules.rule_count > 0
        THEN format('2026-05-20 해양수산부 금어기·금지체장 표 대조 완료. 전국 기준 유효 규정 %s건. 지역별 별도 고시가 더 엄격할 수 있음.', active_rules.rule_count)
      ELSE '2026-05-20 해양수산부 금어기·금지체장 표 대조 결과 종별 전국 규정 없음. 지역별 별도 고시는 출조 전 확인 필요.'
    END,
    reviewer = 'source-check: 해양수산부 + 국가법령정보센터',
    reviewed_at = now(),
    updated_at = now()
FROM public.fishes AS fish
CROSS JOIN official_source
LEFT JOIN active_rules ON active_rules.fish_id = fish.id
WHERE review.fish_id = fish.id
  AND review.field_name = 'regulations'
  AND fish.catalog_status = 'core';
