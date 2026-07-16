-- FIELD 60 editorial review workflow.
-- A populated guide is not considered reviewed until each required topic has
-- an attached source and a human/domain review. This table is intentionally
-- private to service-role editorial tooling even though it lives in public.

CREATE TABLE public.fish_guide_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fish_id uuid NOT NULL REFERENCES public.fishes(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  review_status text NOT NULL DEFAULT 'draft',
  source_urls text[] NOT NULL DEFAULT '{}'::text[],
  review_notes text,
  reviewer text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fish_guide_reviews_field_check CHECK (
    field_name IN (
      'taxonomy',
      'identification',
      'habitat',
      'season',
      'methods_and_baits',
      'size',
      'regulations',
      'safety',
      'rarity',
      'image_license'
    )
  ),
  CONSTRAINT fish_guide_reviews_status_check CHECK (
    review_status IN ('draft', 'source_attached', 'reviewed', 'verified', 'needs_revision')
  ),
  CONSTRAINT fish_guide_reviews_reviewed_at_check CHECK (
    review_status NOT IN ('reviewed', 'verified') OR reviewed_at IS NOT NULL
  ),
  CONSTRAINT fish_guide_reviews_fish_field_key UNIQUE (fish_id, field_name)
);

CREATE INDEX fish_guide_reviews_fish_status_idx
  ON public.fish_guide_reviews (fish_id, review_status);

CREATE INDEX fish_guide_reviews_open_items_idx
  ON public.fish_guide_reviews (field_name, fish_id)
  WHERE review_status IN ('draft', 'needs_revision');

ALTER TABLE public.fish_guide_reviews ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.fish_guide_reviews FROM anon, authenticated;
GRANT ALL ON TABLE public.fish_guide_reviews TO service_role;

COMMENT ON TABLE public.fish_guide_reviews IS
  'Internal field-level evidence and editorial review state for FIELD 60 guides.';
COMMENT ON COLUMN public.fish_guide_reviews.review_status IS
  'draft: generic/unreviewed, source_attached: evidence linked, reviewed: domain reviewed, verified: final checked, needs_revision: evidence conflict or missing data.';

-- Seed the ten required review topics for every core species. Existing source
-- links are recorded as evidence, but they do not automatically become a human
-- review. Generic group-level guide copy remains draft by design.
WITH required_fields(field_name) AS (
  VALUES
    ('taxonomy'),
    ('identification'),
    ('habitat'),
    ('season'),
    ('methods_and_baits'),
    ('size'),
    ('regulations'),
    ('safety'),
    ('rarity'),
    ('image_license')
), regulation_sources AS (
  SELECT fish_id, array_agg(DISTINCT source_url) AS source_urls
  FROM public.fish_regulations
  WHERE effective_to IS NULL OR effective_to >= current_date
  GROUP BY fish_id
)
INSERT INTO public.fish_guide_reviews (fish_id, field_name, review_status, source_urls, review_notes)
SELECT
  fish.id,
  required_fields.field_name,
  CASE
    WHEN required_fields.field_name = 'taxonomy'
      AND cardinality(fish.guide_source_urls) > 0 THEN 'source_attached'
    WHEN required_fields.field_name = 'regulations'
      AND regulation_sources.fish_id IS NOT NULL THEN 'source_attached'
    WHEN required_fields.field_name = 'image_license'
      AND fish.image_url IS NOT NULL
      AND fish.image_source_url IS NOT NULL
      AND fish.image_license IS NOT NULL
      AND fish.image_attribution IS NOT NULL THEN 'source_attached'
    WHEN required_fields.field_name = 'image_license' THEN 'needs_revision'
    ELSE 'draft'
  END,
  CASE
    WHEN required_fields.field_name = 'taxonomy' THEN fish.guide_source_urls
    WHEN required_fields.field_name = 'regulations' THEN COALESCE(regulation_sources.source_urls, '{}'::text[])
    WHEN required_fields.field_name = 'image_license' AND fish.image_source_url IS NOT NULL
      THEN ARRAY[fish.image_source_url]
    ELSE '{}'::text[]
  END,
  CASE
    WHEN required_fields.field_name IN ('habitat', 'season', 'methods_and_baits')
      THEN '초기값은 어종 그룹 공통 패턴이므로 종별 출처 검수 필요'
    WHEN required_fields.field_name = 'regulations' AND regulation_sources.fish_id IS NULL
      THEN '현행 규제 없음까지 확인해야 완료 처리 가능'
    WHEN required_fields.field_name = 'image_license' AND fish.image_url IS NULL
      THEN '대표 이미지와 재사용 가능한 라이선스 필요'
    ELSE NULL
  END
FROM public.fishes AS fish
CROSS JOIN required_fields
LEFT JOIN regulation_sources ON regulation_sources.fish_id = fish.id
WHERE fish.catalog_status = 'core'
ON CONFLICT (fish_id, field_name) DO NOTHING;
