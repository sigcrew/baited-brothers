-- Add species-level biology references. Korean taxonomy remains sourced from
-- MBRIS/NIFS, while FishBase/SeaLifeBase provide direct species summaries.
UPDATE public.fishes
SET guide_source_urls = ARRAY(
  SELECT DISTINCT source_url
  FROM unnest(
    guide_source_urls || ARRAY[
      CASE
        WHEN collection_group IN ('squid', 'octopus') THEN
          'https://www.sealifebase.ca/summary/' ||
          regexp_replace(name, '^([A-Z][a-z-]+) ([a-z-]+).*$', '\1-\2') || '.html'
        ELSE
          'https://www.fishbase.se/summary/' ||
          regexp_replace(name, '^([A-Z][a-z-]+) ([a-z-]+).*$', '\1-\2') || '.html'
      END
    ]
  ) AS source_url
)
WHERE catalog_status = 'core';

-- Only well-established fishing/market names are recorded. A blank aliases
-- array means the species has no reviewed alternate name, not missing data.
WITH reviewed_aliases(name_ko, aliases) AS (VALUES
  ('쏨뱅이', ARRAY['쏨팽이']::text[]),
  ('노래미', ARRAY['놀래미']::text[]),
  ('참돔', ARRAY['도미']::text[]),
  ('감성돔', ARRAY['감생이']::text[]),
  ('돌돔', ARRAY['줄돔(어린 개체)', '뺀찌(통칭)']::text[]),
  ('벵에돔', ARRAY['벵에']::text[]),
  ('농어', ARRAY['깔다구(어린 개체)']::text[]),
  ('고등어', ARRAY['고도리(어린 개체)']::text[]),
  ('전갱이', ARRAY['아지']::text[]),
  ('부시리', ARRAY['히라스']::text[]),
  ('갈치', ARRAY['풀치(어린 개체)']::text[]),
  ('숭어', ARRAY['모치(어린 개체)']::text[]),
  ('가숭어', ARRAY['참숭어']::text[]),
  ('양태', ARRAY['장대(통칭)']::text[]),
  ('독가시치', ARRAY['따치(지역명)']::text[]),
  ('자리돔', ARRAY['자리']::text[])
)
UPDATE public.fishes AS fish
SET aliases = ARRAY(
  SELECT DISTINCT alias
  FROM unnest(fish.aliases || reviewed_aliases.aliases) AS alias
)
FROM reviewed_aliases
WHERE fish.catalog_status = 'core'
  AND fish.name_ko = reviewed_aliases.name_ko;

COMMENT ON COLUMN public.fishes.aliases IS
  'Reviewed common, fishing, market, or regional names. Empty means no alternate name was confirmed.';
