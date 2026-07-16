-- Preserve historical scientific names while normalizing FIELD 60 to the
-- current accepted names returned by WoRMS on 2026-07-16.
ALTER TABLE public.fishes
  ADD COLUMN IF NOT EXISTS scientific_synonyms text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.fishes.scientific_synonyms IS
  'Historical or superseded scientific names retained for search and provenance.';

WITH accepted_name(name_ko, previous_name, current_name, aphia_id) AS (VALUES
  ('점농어', 'Lateolabrax maculatus', 'Lateolabrax spilonotus', 1860501),
  ('부시리', 'Seriola aureovittata', 'Seriola lalandi', 218436),
  ('참갑오징어', 'Sepia esculenta', 'Acanthosepion esculentum', 1666974)
)
UPDATE public.fishes AS fish
SET
  name = accepted_name.current_name,
  scientific_synonyms = ARRAY(
    SELECT DISTINCT synonym
    FROM unnest(fish.scientific_synonyms || ARRAY[accepted_name.previous_name]) AS synonym
  ),
  guide_source_urls = ARRAY(
    SELECT DISTINCT source_url
    FROM unnest(
      fish.guide_source_urls || ARRAY[
        'https://www.marinespecies.org/aphia.php?p=taxdetails&id=' || accepted_name.aphia_id::text
      ]
    ) AS source_url
  ),
  updated_at = now()
FROM accepted_name
WHERE fish.catalog_status = 'core'
  AND fish.name_ko = accepted_name.name_ko
  AND substring(fish.name from '^([A-Z][a-z-]+ [a-z-]+)') = accepted_name.previous_name;
