-- The source API sometimes appends naming authorities to the scientific name.
-- Complete the accepted-name normalization by comparing the binomial only.
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
    FROM unnest(
      fish.scientific_synonyms || ARRAY[
        substring(fish.name from '^([A-Z][a-z-]+ [a-z-]+)')
      ]
    ) AS synonym
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
